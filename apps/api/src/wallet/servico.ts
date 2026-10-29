/**
 * O que a API faz com os passes: ler o cartão de um cliente para o passe,
 * marcar o passe como mudado (e avisar a Apple e a Google), e os segredos.
 */
import type { Programa } from '@nunos-lab/dominio';
import { codigoCurto, textoDoQr } from '@nunos-lab/dominio';
import type { C } from '../ambiente.ts';
import { cartaoActual, lerPrograma } from '../programa.ts';
import { agora, aleatorio, hex, sha256 } from '../util.ts';
import { assinarBilheteApns, avisarApns, BILHETE_APNS_VALE } from './apns.ts';
import { buffer } from './bytes.ts';
import {
  actualizarObjeto,
  desactivarObjeto,
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
    .prepare('SELECT id, codigo, nome FROM clientes WHERE id = ? AND apagado_em IS NULL')
    .bind(clienteId)
    .first<{ id: number; codigo: string; nome: string }>();
  if (!cliente) return null;
  const p = programa ?? (await lerPrograma(db));
  const cartao = await cartaoActual(db, clienteId);
  const [passe, porUsar, cortes, ultima, lojas, defs] = await db.batch([
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
  return {
    serie,
    codigo: cliente.codigo,
    nome: cliente.nome,
    carimbos: cartao?.carimbos ?? 0,
    objectivo: cartao?.objectivo ?? p.objectivo,
    recompensa: cartao?.recompensa ?? p.recompensa,
    porUsar: (porUsar!.results[0] as { n: number }).n,
    cortes: (cortes!.results[0] as { n: number }).n,
    ultima: (ultima!.results[0] as CartaoDoPasse['ultima']) ?? null,
    lojas: l,
    lojasIds: l.map((x) => x.id),
    site: d.get('site') ?? '',
    instagram: d.get('instagram') ?? '',
    whatsapp: d.get('whatsapp') ?? '',
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
    cortes: c.cortes,
    hero: `${env.ORIGEM_DA_API}/api/wallet/imagem/${VERSAO_DO_DESENHO}/${c.objectivo}/${c.carimbos}/hero.png`,
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
        'UPDATE passes SET serie = ?, actualizado_em = unixepoch(), google_em = NULL WHERE cliente_id = ?',
      )
      .bind(serie, clienteId),
  ]);
  if (passe.google_em && googleLigada(c.env))
    c.executionCtx.waitUntil(
      (async () => {
        const token = await tokenDaGoogle(contaDaGoogle(c.env));
        await desactivarObjeto(token, `${c.env.GOOGLE_WALLET_EMISSOR}.nl-${passe.serie}`);
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
        .prepare('SELECT serie FROM passes WHERE cliente_id = ?')
        .bind(clienteId)
        .first<{ serie: string }>();
      if (!passe) return;
      await db
        .prepare('UPDATE passes SET actualizado_em = unixepoch() WHERE cliente_id = ?')
        .bind(clienteId)
        .run();
      await Promise.allSettled([avisarApple(c.env, passe.serie), avisarGoogle(c.env, clienteId)]);
    })().catch((e) => console.error('passe', e)),
  );
}

/**
 * Todos os passes passam a «actualizado agora», cada aparelho registado na
 * Apple recebe um toque, e a Google recebe os objectos de quem lá guardou.
 * Serve quando o passe muda de cara. Devolve o que fez.
 */
export async function refrescarPasses(env: Env) {
  const db = env.DB;
  await db.prepare('UPDATE passes SET actualizado_em = unixepoch()').run();
  const series = (
    await db.prepare('SELECT DISTINCT serie FROM registos_apple').all<{ serie: string }>()
  ).results;
  for (const { serie } of series)
    await avisarApple(env, serie).catch((e) => console.error('apns', e));
  const google = (
    await db
      .prepare('SELECT cliente_id FROM passes WHERE google_em IS NOT NULL')
      .all<{ cliente_id: number }>()
  ).results;
  for (const { cliente_id } of google)
    await avisarGoogle(env, cliente_id).catch((e) => console.error('google', e));
  return { apple: series.length, google: google.length };
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
      const feito = await refrescarPasses(env);
      await db
        .prepare(
          "INSERT INTO definicoes (chave, valor) VALUES ('passe_versao', ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor",
        )
        .bind(VERSAO_DO_PASSE)
        .run();
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

async function avisarApple(env: Env, serie: string) {
  if (!appleLigada(env) || !env.APNS_CHAVE) return;
  const db = env.DB;
  const registos = (
    await db
      .prepare('SELECT aparelho, push_token FROM registos_apple WHERE serie = ?')
      .bind(serie)
      .all<{ aparelho: string; push_token: string }>()
  ).results;
  if (!registos.length) return;
  let bilhete = await bilheteApns(env);
  for (const r of registos) {
    let resposta = await avisarApns(r.push_token, bilhete, env.APPLE_PASS_TIPO, agora());
    if (resposta === 'bilhete_recusado') {
      await db.prepare("DELETE FROM bilhetes WHERE nome = 'apns'").run();
      bilhete = await bilheteApns(env);
      resposta = await avisarApns(r.push_token, bilhete, env.APPLE_PASS_TIPO, agora());
    }
    if (resposta === 'aparelho_morto')
      await db
        .prepare('DELETE FROM registos_apple WHERE aparelho = ? AND serie = ?')
        .bind(r.aparelho, serie)
        .run();
  }
}

async function avisarGoogle(env: Env, clienteId: number) {
  if (!googleLigada(env)) return;
  const db = env.DB;
  const passe = await db
    .prepare('SELECT google_em FROM passes WHERE cliente_id = ?')
    .bind(clienteId)
    .first<{ google_em: number | null }>();
  // Só quem guardou na Google (google_em) é que se actualiza: poupa a API.
  if (!passe?.google_em) return;
  const cartao = await cartaoParaOPasse(db, clienteId);
  if (!cartao) return;
  const token = await tokenDaGoogle(contaDaGoogle(env));
  await actualizarObjeto(
    token,
    env.GOOGLE_WALLET_EMISSOR,
    configuracaoDoPasse(env, '').origemDaApp,
    cartaoDaGoogle(env, cartao),
  );
}
