/**
 * O que a API faz com os passes: ler o cartão de um cliente para o passe,
 * marcar o passe como mudado (e avisar a Apple e a Google), e os segredos.
 */
import type { Programa } from '@nunos-lab/dominio';
import {
  carimboDoPremioAMeio,
  codigoCurto,
  eLingua,
  recompensaNaLingua,
  textoDoQr,
} from '@nunos-lab/dominio';
import type { C } from '../ambiente.ts';
import { cartaoActual, consultaDosPremiosAMeio, lerPrograma, premiosAMeioDe } from '../programa.ts';
import { agora, aleatorio, hex, sha256 } from '../util.ts';
import { assinarBilheteApns, avisarApns, BILHETE_APNS_VALE } from './apns.ts';
import { buffer } from './bytes.ts';
import {
  desactivarObjeto,
  garantirClasse,
  guardarObjeto,
  tokenDaGoogle,
  type CartaoDaGoogle,
  type ContaDeServico,
} from './google.ts';
import { VERSAO_DO_DESENHO } from './grelha.ts';
import { pkpass, VERSAO_DO_PASSE, type CartaoDoPasse, type ConfiguracaoDoPasse } from './passe.ts';

type Env = C['env'];

export function appleLigada(env: Env): boolean {
  return !!(env.APPLE_CERTIFICADO && env.APPLE_CHAVE && env.APPLE_CADEIA && env.WALLET_SEGREDO);
}
export function googleLigada(env: Env): boolean {
  return !!(env.GOOGLE_WALLET_CONTA && env.GOOGLE_WALLET_EMISSOR);
}

export function contaDaGoogle(env: Env): ContaDeServico {
  const c = JSON.parse(env.GOOGLE_WALLET_CONTA ?? '{}') as Partial<ContaDeServico>;
  if (!c.client_email || !c.private_key)
    throw new Error('GOOGLE_WALLET_CONTA não é a conta de serviço.');
  return c as ContaDeServico;
}

/** O testemunho do passe deriva-se do número de série: constante, e sem coluna para alguém lhe mexer. */
export async function testemunhoDoPasse(env: Env, serie: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    buffer(new TextEncoder().encode(env.WALLET_SEGREDO)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const b = new Uint8Array(
    await crypto.subtle.sign('HMAC', chave, buffer(new TextEncoder().encode(`passe:${serie}`))),
  );
  return hex(b).slice(0, 40);
}

/** Uma assinatura curta para as ligações temporárias (descarregar o passe). */
export async function assinarTexto(env: Env, texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    buffer(new TextEncoder().encode(env.WALLET_SEGREDO)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', chave, buffer(new TextEncoder().encode(texto))),
    ),
  ).slice(0, 32);
}

/** O passe de um cliente (a linha de «passes»), criado na primeira vez. */
export async function passeDoCliente(
  db: D1Database,
  clienteId: number,
): Promise<{ serie: string; actualizado_em: number }> {
  const existente = await db
    .prepare('SELECT serie, actualizado_em FROM passes WHERE cliente_id = ?')
    .bind(clienteId)
    .first<{ serie: string; actualizado_em: number }>();
  if (existente) return existente;
  const serie = aleatorio(16);
  await db
    .prepare('INSERT OR IGNORE INTO passes (cliente_id, serie) VALUES (?, ?)')
    .bind(clienteId, serie)
    .run();
  return (await db
    .prepare('SELECT serie, actualizado_em FROM passes WHERE cliente_id = ?')
    .bind(clienteId)
    .first<{ serie: string; actualizado_em: number }>())!;
}

/** O cartão de um cliente, lido da base, na forma que o passe quer. */
export async function cartaoParaOPasse(
  db: D1Database,
  clienteId: number,
  programa?: Programa,
): Promise<(CartaoDoPasse & { lojasIds: number[] }) | null> {
  const cliente = await db
    .prepare('SELECT id, codigo, nome, lingua FROM clientes WHERE id = ? AND apagado_em IS NULL')
    .bind(clienteId)
    .first<{ id: number; codigo: string; nome: string; lingua: string | null }>();
  if (!cliente) return null;
  // O passe sai na língua da conta (a da app); sem ela, em português.
  const lingua = eLingua(cliente.lingua) ? cliente.lingua : 'pt';
  const p = programa ?? (await lerPrograma(db));
  const cartao = await cartaoActual(db, clienteId);
  // O cartão novo a zeros logo a seguir ao 10.º (17 nov 2026): o anterior, para o aviso dizer que
  // ficou completo (o aviso só vai com um carimbo de há pouco: MINUTOS_DO_AVISO em passe.ts).
  const anterior =
    cartao && cartao.carimbos === 0 && cartao.numero > 1
      ? await db
          .prepare(
            'SELECT recompensa, recompensa_en, completo_em FROM cartoes WHERE cliente_id = ? AND numero = ?',
          )
          .bind(clienteId, cartao.numero - 1)
          .first<{ recompensa: string; recompensa_en: string; completo_em: number | null }>()
      : null;
  const [passe, porUsar, cortes, ultima, lojas, defs, meios] = await db.batch([
    db.prepare('SELECT serie FROM passes WHERE cliente_id = ?').bind(clienteId),
    db
      .prepare(
        'SELECT count(*) AS n FROM cartoes WHERE cliente_id = ? AND completo_em IS NOT NULL AND usado_em IS NULL',
      )
      .bind(clienteId),
    db
      .prepare('SELECT count(*) AS n FROM carimbos WHERE cliente_id = ? AND anulado_em IS NULL')
      .bind(clienteId),
    db
      .prepare(
        `SELECT x.criado_em AS quando, l.nome AS loja, e.nome AS pessoa FROM carimbos x
         LEFT JOIN lojas l ON l.id = x.loja_id LEFT JOIN equipa e ON e.id = x.pessoa_id
         WHERE x.cliente_id = ? AND x.anulado_em IS NULL ORDER BY x.criado_em DESC LIMIT 1`,
      )
      .bind(clienteId),
    db.prepare('SELECT id, nome, telefone, lat, lng FROM lojas ORDER BY ordem, id'),
    db.prepare(
      "SELECT chave, valor FROM definicoes WHERE chave IN ('site', 'instagram', 'whatsapp')",
    ),
    consultaDosPremiosAMeio(db, clienteId),
  ]);
  const serie = (passe!.results[0] as { serie: string } | undefined)?.serie;
  if (!serie) return null;
  const d = new Map(
    (defs!.results as { chave: string; valor: string }[]).map((x) => [x.chave, x.valor]),
  );
  const l = lojas!.results as {
    id: number;
    nome: string;
    telefone: string;
    lat: number | null;
    lng: number | null;
  }[];
  // Em inglês: o prémio escrito no backoffice, ou «Corte grátis» e «50% de desconto» traduzidos.
  const recompensaPt = cartao?.recompensa ?? p.recompensa;
  const recompensaEn = ((cartao ? cartao.recompensa_en : p.recompensaEn) ?? '').trim();
  // O prémio a meio do cartão em curso; sem cartão, o do programa.
  const carimboDoMeio = cartao ? cartao.meio : carimboDoPremioAMeio(p);
  const meioPt = cartao ? cartao.meio_recompensa : p.meioRecompensa;
  const meioEn = ((cartao ? cartao.meio_recompensa_en : p.meioRecompensaEn) ?? '').trim();
  const pendentes = premiosAMeioDe(meios!.results, lingua);
  const completouAgora = anterior?.completo_em
    ? lingua === 'en'
      ? (anterior.recompensa_en ?? '').trim() || recompensaNaLingua(anterior.recompensa, 'en')
      : anterior.recompensa
    : null;
  return {
    completouAgora,
    serie,
    codigo: cliente.codigo,
    nome: cliente.nome,
    carimbos: cartao?.carimbos ?? 0,
    objectivo: cartao?.objectivo ?? p.objectivo,
    recompensa:
      lingua === 'en' ? recompensaEn || recompensaNaLingua(recompensaPt, 'en') : recompensaPt,
    porUsar: (porUsar!.results[0] as { n: number }).n,
    cortes: (cortes!.results[0] as { n: number }).n,
    ultima: (ultima!.results[0] as CartaoDoPasse['ultima']) ?? null,
    lojas: l,
    lojasIds: l.map((x) => x.id),
    site: d.get('site') ?? '',
    instagram: d.get('instagram') ?? '',
    whatsapp: d.get('whatsapp') ?? '',
    lingua,
    meio: carimboDoMeio
      ? {
          carimbos: carimboDoMeio,
          recompensa: lingua === 'en' ? meioEn || meioPt : meioPt,
          ganho: !!cartao && cartao.meio_ganho_em !== null,
        }
      : null,
    meiosPorUsar: pendentes.length
      ? { n: pendentes.length, recompensa: pendentes[0]!.recompensa }
      : null,
  };
}

export function configuracaoDoPasse(env: Env, testemunho: string): ConfiguracaoDoPasse {
  return {
    passTipo: env.APPLE_PASS_TIPO,
    equipa: env.APPLE_EQUIPA,
    origemDaApi: env.ORIGEM_DA_API,
    origemDaApp: env.ORIGENS.split(',')[0]!.trim() + '/nunos-lab',
    testemunho,
  };
}

export async function construirPkpass(env: Env, cartao: CartaoDoPasse, quando: Date) {
  const cfg = configuracaoDoPasse(env, await testemunhoDoPasse(env, cartao.serie));
  return pkpass(
    cartao,
    cfg,
    { certificado: env.APPLE_CERTIFICADO!, chave: env.APPLE_CHAVE!, cadeia: env.APPLE_CADEIA! },
    quando,
  );
}

export function cartaoDaGoogle(env: Env, c: CartaoDoPasse): CartaoDaGoogle {
  return {
    id: `${env.GOOGLE_WALLET_EMISSOR}.nl-${c.serie}`,
    codigo: codigoCurto(c.codigo).replace(' ', ' '),
    qr: textoDoQr(c.codigo),
    nome: c.nome,
    carimbos: c.carimbos,
    objectivo: c.objectivo,
    recompensa: c.recompensa,
    porUsar: c.porUsar,
    meiosPorUsar: c.meiosPorUsar ?? null,
    cortes: c.cortes,
    hero: `${env.ORIGEM_DA_API}/api/wallet/imagem/${VERSAO_DO_DESENHO}/${c.objectivo}/${c.carimbos}/hero.png${c.meio ? `?meio=${c.meio.carimbos}` : ''}`,
    lingua: c.lingua,
  };
}

/**
 * «Perdi o telemóvel»: o passe que está no telemóvel perdido não pode receber
 * o código novo. A série muda (o testemunho deriva dela: o passe antigo deixa
 * de poder falar com o serviço), os aparelhos registados saem, e o objecto da
 * Google, se o havia, fica inactivo. O telemóvel novo adiciona um passe novo.
 */
export async function rodarPasse(c: C, clienteId: number) {
  const db = c.env.DB;
  const passe = await db
    .prepare('SELECT serie, google_em FROM passes WHERE cliente_id = ?')
    .bind(clienteId)
    .first<{ serie: string; google_em: number | null }>();
  if (!passe) return;
  const serie = aleatorio(16);
  await db.batch([
    db.prepare('DELETE FROM registos_apple WHERE serie = ?').bind(passe.serie),
    db
      .prepare(
        'UPDATE passes SET serie = ?, actualizado_em = max(unixepoch(), actualizado_em + 1), google_em = NULL WHERE cliente_id = ?',
      )
      .bind(serie, clienteId),
  ]);
  if (passe.google_em) desactivarPasseDaGoogle(c, passe.serie);
}

/** O objecto da Google de uma série que já não serve fica inactivo (em waitUntil). */
export function desactivarPasseDaGoogle(c: C, serie: string) {
  if (!googleLigada(c.env)) return;
  c.executionCtx.waitUntil(
    (async () => {
      const token = await tokenDaGoogle(contaDaGoogle(c.env));
      await desactivarObjeto(token, `${c.env.GOOGLE_WALLET_EMISSOR}.nl-${serie}`);
    })().catch((e) => console.error('google', e)),
  );
}

/**
 * O cartão de um cliente mudou (carimbo, anulação, recompensa, nome, código):
 * o passe passa a «actualizado agora», a Apple recebe um toque em cada
 * aparelho registado, e a Google recebe o objecto novo. Tudo em waitUntil:
 * nunca atrasa nem falha o carimbo.
 */
export function tocarPasse(c: C, clienteId: number) {
  c.executionCtx.waitUntil(
    (async () => {
      const db = c.env.DB;
      const passe = await db
        .prepare('SELECT serie, google_em FROM passes WHERE cliente_id = ?')
        .bind(clienteId)
        .first<{ serie: string; google_em: number | null }>();
      if (!passe) return;
      // Sempre a avançar: duas mudanças no mesmo segundo davam a mesma etiqueta, e a 2.ª não chegava à Wallet.
      await db
        .prepare(
          'UPDATE passes SET actualizado_em = max(unixepoch(), actualizado_em + 1) WHERE cliente_id = ?',
        )
        .bind(clienteId)
        .run();
      // Só quem guardou na Google (google_em) é que se actualiza: poupa a API.
      const feito = await Promise.allSettled([
        avisarApple(c.env, [passe.serie]),
        passe.google_em ? avisarGoogle(c.env, [clienteId]) : null,
      ]);
      for (const f of feito) if (f.status === 'rejected') console.error('passe', f.reason);
    })().catch((e) => console.error('passe', e)),
  );
}

/** O que vai na fila «nunos-lab-passes»: uma série da Apple (os aparelhos dela) ou um cliente com o cartão na Google. */
export type AvisoDoPasse = { apple: string } | { google: number };

/**
 * Todos os passes passam a «actualizado agora», e cada série registada na Apple e cada cartão
 * guardado na Google vão para a fila (avisosDaFila). Serve quando o passe muda de cara. Fora do
 * waitUntil, que só dá 30 s depois da resposta: a 26 nov 2026 os ~80 iPhones e os 9 cartões da
 * Google já não cabiam, e a Google ficou a meio. Devolve quantos foram para a fila.
 */
export async function refrescarPasses(env: Env) {
  const db = env.DB;
  const [, apple, google] = await db.batch([
    db.prepare('UPDATE passes SET actualizado_em = max(unixepoch(), actualizado_em + 1)'),
    db.prepare('SELECT DISTINCT serie FROM registos_apple'),
    db.prepare('SELECT cliente_id FROM passes WHERE google_em IS NOT NULL'),
  ]);
  const series = apple!.results as { serie: string }[];
  const clientes = google!.results as { cliente_id: number }[];
  const avisos: AvisoDoPasse[] = [
    ...series.map((r) => ({ apple: r.serie })),
    ...clientes.map((r) => ({ google: r.cliente_id })),
  ];
  // Até 100 mensagens por envio.
  for (let i = 0; i < avisos.length; i += 100)
    await env.PASSES.sendBatch(avisos.slice(i, i + 100).map((body) => ({ body })));
  return { apple: series.length, google: clientes.length };
}

/**
 * Um lote da fila dos passes (até 100 avisos; 15 minutos para os fazer). Um lote de cada vez
 * (wrangler.jsonc), para o bilhete da APNs não se renovar em dois sítios ao mesmo tempo. A mesma
 * série ou o mesmo cliente duas vezes no lote (dois refrescamentos seguidos) leva um aviso só; o
 * que falhou volta à fila daqui a um minuto.
 */
export async function avisosDaFila(lote: MessageBatch<AvisoDoPasse>, env: Env) {
  const inicio = Date.now();
  const series = new Set<string>();
  const clientes = new Set<number>();
  for (const { body } of lote.messages)
    if ('apple' in body) series.add(body.apple);
    else clientes.add(body.google);
  // Uma coisa e depois a outra: as 6 ligações são as mesmas, e os registos lêem-se melhor.
  const apple = await avisarApple(env, [...series]).catch((e: unknown) => {
    console.error('apns', e);
    return series;
  });
  const google = await avisarGoogle(env, [...clientes], { classe: true }).catch((e: unknown) => {
    console.error('google', e);
    return clientes;
  });
  for (const m of lote.messages)
    if ('apple' in m.body ? apple.has(m.body.apple) : google.has(m.body.google))
      m.retry({ delaySeconds: 60 });
    else m.ack();
  console.log(
    'passes avisados',
    JSON.stringify({
      apple: series.size,
      google: clientes.size,
      porRepetir: apple.size + google.size,
      ms: Date.now() - inicio,
    }),
  );
}

/** Quantos avisos de cada vez: o Worker só tem 6 ligações abertas ao mesmo tempo (as do D1 contam). */
const DE_CADA_VEZ = 6;

/** Corre `f` em cada item, DE_CADA_VEZ de cada vez. Quem chama trata dos erros de cada um. */
async function emParalelo<T>(itens: readonly T[], f: (x: T) => Promise<void>) {
  let i = 0;
  const um = async () => {
    while (i < itens.length) await f(itens[i++]!).catch((e) => console.error('passes', e));
  };
  await Promise.all(Array.from({ length: Math.min(DE_CADA_VEZ, itens.length) }, um));
}

/**
 * Depois de publicar um passe com outra cara (VERSAO_DO_PASSE), a primeira
 * vez que cada instância do Worker acorda compara a versão com a guardada;
 * se for outra, refaz os passes e guarda a nova. Duas instâncias ao mesmo
 * tempo dão, no pior caso, dois toques: não faz mal.
 */
let versaoConferida = false;
export function refrescarSePreciso(env: Env, esperar: (p: Promise<unknown>) => void) {
  if (versaoConferida) return;
  versaoConferida = true;
  esperar(
    (async () => {
      const db = env.DB;
      const guardada = await db
        .prepare("SELECT valor FROM definicoes WHERE chave = 'passe_versao'")
        .first<{ valor: string }>();
      if (guardada?.valor === VERSAO_DO_PASSE) return;
      // A versão grava-se ANTES de refazer, e só uma instância a consegue mudar:
      // as outras lêem-na já nova e saem; e uma tarefa cortada a meio não volta
      // a correr em cada instância que acorda.
      const ganhou = await db
        .prepare(
          "INSERT INTO definicoes (chave, valor) VALUES ('passe_versao', ?1) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor WHERE valor != ?1",
        )
        .bind(VERSAO_DO_PASSE)
        .run();
      if (!ganhou.meta.changes) return;
      const feito = await refrescarPasses(env);
      console.log('passes refeitos', VERSAO_DO_PASSE, JSON.stringify(feito));
    })().catch((e) => console.error('passes', e)),
  );
}

async function bilheteApns(env: Env): Promise<string> {
  const db = env.DB;
  const t = agora();
  const guardado = await db
    .prepare("SELECT valor, criado_em FROM bilhetes WHERE nome = 'apns'")
    .first<{ valor: string; criado_em: number }>();
  if (guardado && t - guardado.criado_em < BILHETE_APNS_VALE) return guardado.valor;
  const novo = await assinarBilheteApns(env.APNS_CHAVE!, env.APNS_KID, env.APPLE_EQUIPA, t);
  await db
    .prepare(
      "INSERT INTO bilhetes (nome, valor, criado_em) VALUES ('apns', ?, ?) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor, criado_em = excluded.criado_em",
    )
    .bind(novo, t)
    .run();
  return novo;
}

/** O bilhete recusado sai da base, e vem outro. */
async function renovarBilheteApns(env: Env): Promise<string> {
  await env.DB.prepare("DELETE FROM bilhetes WHERE nome = 'apns'").run();
  return bilheteApns(env);
}

type RegistoApple = { serie: string; aparelho: string; push_token: string };

/**
 * Um toque em cada aparelho registado destas séries, com um bilhete para todos, DE_CADA_VEZ de
 * cada vez (um a um, os ~80 iPhones levavam 19 s). Devolve as séries com algum aparelho por
 * avisar: a APNs pediu para repetir, ou a ligação falhou.
 */
async function avisarApple(env: Env, series: string[]): Promise<Set<string>> {
  const porRepetir = new Set<string>();
  if (!series.length || !appleLigada(env) || !env.APNS_CHAVE) return porRepetir;
  const db = env.DB;
  const registos = (
    await db
      .prepare(
        'SELECT serie, aparelho, push_token FROM registos_apple WHERE serie IN (SELECT value FROM json_each(?))',
      )
      .bind(JSON.stringify(series))
      .all<RegistoApple>()
  ).results;
  if (!registos.length) return porRepetir;
  let bilhete = bilheteApns(env);
  const mortos: RegistoApple[] = [];
  await emParalelo(registos, async (r) => {
    try {
      const usado = bilhete;
      let resposta = await avisarApns(r.push_token, await usado, env.APPLE_PASS_TIPO, agora());
      if (resposta === 'bilhete_recusado') {
        // O primeiro a ver o bilhete recusado pede outro; os seguintes usam esse (a Apple recusa
        // quem o renove mais de uma vez em 20 minutos).
        if (bilhete === usado) bilhete = renovarBilheteApns(env);
        resposta = await avisarApns(r.push_token, await bilhete, env.APPLE_PASS_TIPO, agora());
      }
      // Cada aviso deixa o resultado e o começo da série e do aparelho (nunca o token): o pedido do
      // iPhone que vier a seguir traz os mesmos começos no endereço, e vê-se se ele respondeu ao aviso.
      console.log(
        'apns',
        resposta,
        `passe ${r.serie.slice(0, 4)}`,
        `aparelho ${r.aparelho.slice(0, 4)}`,
      );
      if (resposta === 'aparelho_morto') mortos.push(r);
      else if (resposta === 'repetir') porRepetir.add(r.serie);
    } catch (e) {
      console.error('apns', e);
      porRepetir.add(r.serie);
    }
  });
  if (mortos.length)
    await db.batch(
      mortos.map((r) =>
        db
          .prepare('DELETE FROM registos_apple WHERE aparelho = ? AND serie = ?')
          .bind(r.aparelho, r.serie),
      ),
    );
  return porRepetir;
}

/**
 * Os cartões da Google destes clientes, como estão agora: um token para todos, o programa lido uma
 * vez, DE_CADA_VEZ de cada vez. Com `classe`, a classe confere-se antes, uma vez (era por objecto).
 * Devolve os clientes que falharam.
 */
async function avisarGoogle(
  env: Env,
  clientes: number[],
  { classe = false } = {},
): Promise<Set<number>> {
  const falharam = new Set<number>();
  if (!clientes.length || !googleLigada(env)) return falharam;
  const db = env.DB;
  const emissor = env.GOOGLE_WALLET_EMISSOR;
  const token = await tokenDaGoogle(contaDaGoogle(env));
  if (classe)
    await garantirClasse(token, emissor, configuracaoDoPasse(env, '').origemDaApp).catch((e) =>
      console.error('classe da google', e),
    );
  const programa = await lerPrograma(db);
  await emParalelo(clientes, async (id) => {
    try {
      const cartao = await cartaoParaOPasse(db, id, programa);
      if (cartao) await guardarObjeto(token, emissor, cartaoDaGoogle(env, cartao));
    } catch (e) {
      console.error('google', e);
      falharam.add(id);
    }
  });
  return falharam;
}
