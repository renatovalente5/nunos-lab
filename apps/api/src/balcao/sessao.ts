/**
 * Entrar na Balcão: pelo email que o Nuno registou na equipa, provado pela Google, pela Apple ou por um
 * código mandado a esse email (28 nov 2026) — as três dão na mesma pessoa. Uma Apple ou Google que não
 * traga esse email (a Apple com o email escondido, ou outro email) fica ligada à pessoa quando ela
 * confirma o email da equipa com o código, e da vez seguinte entra sozinha. A sessão dura um ano sem
 * uso: um barbeiro não volta a entrar.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
  DIAS_DA_SESSAO_DA_EQUIPA,
  DIAS_MAXIMOS_DA_SESSAO_DA_EQUIPA,
  ENGANOS_DO_CODIGO,
  MINUTOS_DO_CODIGO,
  SEGUNDOS_PARA_REENVIAR,
  eEmailDeRelay,
  normalizarEmail,
  type PapelDaEquipa,
} from '@nunos-lab/dominio';
import type { Ambiente, C } from '../ambiente.ts';
import { conferirCredencialGoogle } from '../backoffice/google.ts';
import { conferirTokenDaApple } from '../entrada/apple.ts';
import {
  DIA,
  agora,
  aleatorio,
  aparelhoDoPedido,
  blob,
  corpo,
  hex,
  linguaDoPedido,
  paraBytes,
  pessoaDaRevisao,
  recusar,
  sha256,
} from '../util.ts';
import { codigoNovo, iguais, redeDe } from './codigo.ts';
import { emEnsaio, emailLigado, mandarCodigo } from './email.ts';

type LinhaPessoa = {
  id: number;
  nome: string;
  papel: PapelDaEquipa;
  loja_id: number | null;
  parceiro_id: number | null;
};

type Forma = 'apple' | 'google';

export const exigirPessoa: MiddlewareHandler<Ambiente> = async (c, next) => {
  const cabecalho = c.req.header('Authorization') ?? '';
  const testemunho = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(testemunho)) recusar(401, 'sessao');
  const linha = await c.env.DB.prepare(
    `SELECT s.id AS sessao, s.vista_em, e.id, e.nome, e.papel, e.loja_id, e.parceiro_id, pa.activo AS parceiro_activo
     FROM sessoes_da_equipa s JOIN equipa e ON e.id = s.pessoa_id LEFT JOIN parceiros pa ON pa.id = e.parceiro_id
     WHERE s.resumo = ? AND s.revogada_em IS NULL AND s.expira_em > unixepoch()
       AND s.criada_em > unixepoch() - ?
       AND e.removido_em IS NULL AND e.activo = 1`,
  )
    // O tecto: 180 dias desde que abriu, por mais que se use (um telemóvel perdido não vale para sempre).
    .bind(blob(await sha256(testemunho)), DIAS_MAXIMOS_DA_SESSAO_DA_EQUIPA * DIA)
    .first<LinhaPessoa & { sessao: number; vista_em: number; parceiro_activo: number | null }>();
  if (!linha) recusar(401, 'sessao');
  // A pessoa de um parceiro desligado no backoffice não valida nada até ele voltar.
  if (linha.papel === 'parceiro' && linha.parceiro_activo === 0) recusar(403, 'parceiro_desligado');
  if (linha.vista_em < agora() - 3600)
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        'UPDATE sessoes_da_equipa SET vista_em = unixepoch(), expira_em = unixepoch() + ? WHERE id = ?',
      )
        .bind(DIAS_DA_SESSAO_DA_EQUIPA * DIA, linha.sessao)
        .run(),
    );
  c.set('pessoa', {
    id: linha.id,
    nome: linha.nome,
    papel: linha.papel,
    lojaId: linha.loja_id,
    parceiroId: linha.parceiro_id,
    sessao: linha.sessao,
    demo: linha.id === pessoaDaRevisao(c.env),
  });
  await next();
};

export const rotasDeEntradaDaBalcao = new Hono<Ambiente>();

async function travar(c: C) {
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  if (!(await c.env.TRAVAO.limit({ key: `entrar:${ip}` }))?.success)
    recusar(429, 'muitas_tentativas');
}

async function abrirSessao(c: C, pessoaId: number, dias = DIAS_DA_SESSAO_DA_EQUIPA) {
  const testemunho = aleatorio(32);
  await c.env.DB.prepare(
    'INSERT INTO sessoes_da_equipa (resumo, pessoa_id, aparelho, expira_em) VALUES (?, ?, ?, unixepoch() + ?)',
  )
    .bind(blob(await sha256(testemunho)), pessoaId, aparelhoDoPedido(c), dias * DIA)
    .run();
  return c.json({ sessao: testemunho });
}

/**
 * A Apple ou a Google com que a pessoa entrou fica com ela: a regra do próprio cartão compara-a com as do
 * cliente, e o «Ocultar o meu email» da Apple já não a contorna (o «sub» da Apple é o mesmo nas apps da
 * mesma equipa; o da Google, o mesmo em todas; revisão de 11 nov 2026). Uma forma que passa a outra pessoa
 * (pelo email dela) perde a ligação por código que tinha.
 */
async function guardarIdentidade(c: C, pessoaId: number, tipo: Forma, sujeito: string) {
  await c.env.DB.prepare(
    `INSERT INTO identidades_da_equipa (pessoa_id, tipo, sujeito) VALUES (?, ?, ?)
     ON CONFLICT (tipo, sujeito) DO UPDATE SET pessoa_id = excluded.pessoa_id,
       ligada = CASE WHEN pessoa_id = excluded.pessoa_id THEN ligada ELSE 0 END`,
  )
    .bind(pessoaId, tipo, sujeito)
    .run();
}

type Encontrada = { id: number; parceiro_activo: number | null };

/** A pessoa encontrada, se estiver activa; a de um parceiro desligado é recusada. */
function activa(p: Encontrada | null): number | null {
  if (!p) return null;
  if (p.parceiro_activo === 0) recusar(403, 'parceiro_desligado');
  return p.id;
}

/** A pessoa da equipa com este email (já normalizado), ou null. */
async function pessoaComEmail(c: C, email: string): Promise<number | null> {
  return activa(
    await c.env.DB.prepare(
      `SELECT e.id, pa.activo AS parceiro_activo FROM equipa e LEFT JOIN parceiros pa ON pa.id = e.parceiro_id
       WHERE e.email = ? AND e.removido_em IS NULL AND e.activo = 1`,
    )
      .bind(email)
      .first<Encontrada>(),
  );
}

async function pessoaDoEmail(c: C, email: string | null): Promise<number> {
  const id = email ? await pessoaComEmail(c, email) : null;
  if (!id) recusar(403, 'sem_acesso');
  return id;
}

/** A pessoa a que um código ligou esta Apple ou Google. Só as ligadas: as outras não abrem sessão. */
async function pessoaDaFormaLigada(c: C, tipo: Forma, sujeito: string): Promise<number | null> {
  return activa(
    await c.env.DB.prepare(
      `SELECT e.id, pa.activo AS parceiro_activo FROM identidades_da_equipa q
       JOIN equipa e ON e.id = q.pessoa_id LEFT JOIN parceiros pa ON pa.id = e.parceiro_id
       WHERE q.tipo = ? AND q.sujeito = ? AND q.ligada = 1
         AND e.removido_em IS NULL AND e.activo = 1 AND e.email IS NOT NULL`,
    )
      .bind(tipo, sujeito)
      .first<Encontrada>(),
  );
}

/** Quanto tempo uma Apple ou Google sem pessoa espera pelo código do email da equipa. */
const MINUTOS_DA_LIGACAO = 15;

/**
 * A recusa de uma Apple ou Google que não deu com ninguém. Com o email ligado, leva uma ligação: se a
 * pessoa confirmar o email da equipa com o código nos 15 minutos seguintes, esta forma fica dela.
 */
async function recusarSemPessoa(
  c: C,
  erro: 'sem_acesso' | 'email_escondido',
  tipo: Forma,
  sujeito: string,
): Promise<never> {
  if (!emailLigado(c.env)) recusar(403, erro);
  const ligar = aleatorio(32);
  await c.env.DB.prepare(
    'INSERT INTO ligacoes_da_equipa (resumo, tipo, sujeito, expira_em) VALUES (?, ?, ?, unixepoch() + ?)',
  )
    .bind(blob(await sha256(ligar)), tipo, sujeito, MINUTOS_DA_LIGACAO * 60)
    .run();
  throw new HTTPException(403, {
    res: new Response(JSON.stringify({ erro, ligar }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
  });
}

/** Entrar com uma Apple ou Google provada: o email da equipa primeiro; depois, uma forma ligada. */
async function entrarComForma(
  c: C,
  f: { tipo: Forma; sujeito: string; email: string | null },
): Promise<Response> {
  if (f.email) {
    const pessoa = await pessoaComEmail(c, f.email);
    if (pessoa) {
      await guardarIdentidade(c, pessoa, f.tipo, f.sujeito);
      return abrirSessao(c, pessoa);
    }
  }
  const ligada = await pessoaDaFormaLigada(c, f.tipo, f.sujeito);
  if (ligada) return abrirSessao(c, ligada);
  return recusarSemPessoa(c, f.email ? 'sem_acesso' : 'email_escondido', f.tipo, f.sujeito);
}

/** A ligação que a recusa deu passa a forma para esta pessoa (caducada ou desconhecida: entra sem ligar). */
async function ligarForma(c: C, pessoaId: number, ligar: string) {
  const db = c.env.DB;
  const l = await db
    .prepare('DELETE FROM ligacoes_da_equipa WHERE resumo = ? RETURNING tipo, sujeito, expira_em')
    .bind(blob(await sha256(ligar)))
    .first<{ tipo: Forma; sujeito: string; expira_em: number }>();
  if (!l || l.expira_em <= agora()) return;
  await db
    .prepare(
      `INSERT INTO identidades_da_equipa (pessoa_id, tipo, sujeito, ligada) VALUES (?, ?, ?, 1)
       ON CONFLICT (tipo, sujeito) DO UPDATE SET pessoa_id = excluded.pessoa_id, ligada = 1`,
    )
    .bind(pessoaId, l.tipo, l.sujeito)
    .run();
}

rotasDeEntradaDaBalcao.post('/entrar/google', async (c) => {
  await travar(c);
  const { credencial } = await corpo(c, z.object({ credencial: z.string().min(20).max(4096) }));
  const id = await conferirCredencialGoogle(credencial, c.env.GOOGLE_CLIENTE);
  if (!id) recusar(401, 'google_invalido');
  return entrarComForma(c, { tipo: 'google', sujeito: id.sub, email: id.email });
});

/**
 * SÓ NO «wrangler dev» (MODO=desenvolvimento, que a publicação não leva): entrar
 * como se o Google ou a Apple tivessem provado este email, para a prova da API
 * percorrer as regras da equipa sem tokens. Em produção não existe (404).
 */
rotasDeEntradaDaBalcao.post('/entrar/teste', async (c) => {
  if (!emEnsaio(c.env)) recusar(404, 'nao_existe');
  const { email, tipo, sujeito } = await corpo(
    c,
    z.object({
      email: z.string().trim().max(254).nullable(),
      // Para a prova: a Apple ou a Google com que entra (como nas portas a sério).
      tipo: z.enum(['apple', 'google']).optional(),
      sujeito: z.string().min(1).max(255).optional(),
    }),
  );
  if (tipo && sujeito) {
    // Como nas portas a sério: o relay da Apple não diz quem é.
    const provado =
      email && !(tipo === 'apple' && eEmailDeRelay(email)) ? email.toLowerCase() : null;
    return entrarComForma(c, { tipo, sujeito, email: provado });
  }
  if (!email) recusar(403, 'email_escondido');
  return abrirSessao(c, await pessoaDoEmail(c, email.toLowerCase()));
});

rotasDeEntradaDaBalcao.post('/entrar/apple', async (c) => {
  await travar(c);
  const { token, nonce } = await corpo(
    c,
    z.object({ token: z.string().min(20).max(8192), nonce: z.string().min(8).max(128) }),
  );
  const clientes = c.env.APPLE_CLIENTES.split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (clientes.length === 0) recusar(400, 'apple_desligado');
  const id = await conferirTokenDaApple(token, clientes, nonce);
  if (!id) recusar(401, 'apple_invalido');
  // Sem o email partilhado (ou com um de retransmissão), a Apple não diz quem é: só entra uma Apple
  // ligada por um código; senão, a app oferece o código por email (ou «Partilhar o meu email»).
  const email = id.email && id.emailVerificado && !eEmailDeRelay(id.email) ? id.email : null;
  return entrarComForma(c, { tipo: 'apple', sujeito: id.sub, email });
});

// ——— O código por email (28 nov 2026) ———

/** Códigos por email numa hora e num dia, e de uma rede numa hora: o resto espera. */
const CODIGOS_POR_HORA = 5;
const CODIGOS_POR_DIA = 10;
const CODIGOS_DA_REDE_POR_HORA = 10;
/** Os enganos de um email num dia: seis algarismos aguentam pouco mais; o resto fica para depois. */
const ENGANOS_POR_DIA = 15;

/** O resumo do código de um email: a base nunca guarda o código. */
const resumoDoCodigo = (email: string, codigo: string) => sha256(`codigo:${email}:${codigo}`);

/** A rede do pedido, resumida (para os limites; a base não guarda o endereço). */
async function resumoDaRede(c: C): Promise<string> {
  return hex(await sha256(`rede:${redeDe(c.req.header('CF-Connecting-IP') ?? 'local')}`)).slice(
    0,
    32,
  );
}

/** Se a app mostra «Continuar com email» (só com o remetente posto: o domínio na Cloudflare). */
rotasDeEntradaDaBalcao.get('/entrar/formas', (c) => c.json({ email: emailLigado(c.env) }));

/**
 * Pedir o código. A resposta é a mesma esteja ou não o email na equipa (ninguém descobre pela app quem
 * é parceiro), e os limites contam igual nos dois casos; o email só sai para quem é, e depois da
 * resposta. Pedir outra vez antes dos 30 s não manda outro: vale o que já foi.
 */
rotasDeEntradaDaBalcao.post('/entrar/email', async (c) => {
  await travar(c);
  if (!emailLigado(c.env)) recusar(503, 'email_desligado');
  const pedido = await corpo(c, z.object({ email: z.string().max(254) }));
  const email = normalizarEmail(pedido.email);
  if (!email) recusar(400, 'email_invalido');
  const db = c.env.DB;
  const rede = await resumoDaRede(c);
  const conta = await db
    .prepare(
      `SELECT
         (SELECT count(*) FROM codigos_de_entrada WHERE email = ?1 AND criado_em > unixepoch() - 3600) AS hora,
         (SELECT count(*) FROM codigos_de_entrada WHERE email = ?1 AND criado_em > unixepoch() - 86400) AS dia,
         (SELECT max(criado_em) FROM codigos_de_entrada WHERE email = ?1 AND usado_em IS NULL
            AND expira_em > unixepoch()) AS ultimo,
         (SELECT count(*) FROM codigos_de_entrada WHERE rede = ?2 AND criado_em > unixepoch() - 3600) AS da_rede`,
    )
    .bind(email, rede)
    .first<{ hora: number; dia: number; ultimo: number | null; da_rede: number }>();
  const ha = conta?.ultimo ? agora() - conta.ultimo : Infinity;
  if (ha < SEGUNDOS_PARA_REENVIAR)
    return c.json({ ok: true, reenviarEm: SEGUNDOS_PARA_REENVIAR - Math.max(0, ha) });
  if (
    (conta?.hora ?? 0) >= CODIGOS_POR_HORA ||
    (conta?.dia ?? 0) >= CODIGOS_POR_DIA ||
    (conta?.da_rede ?? 0) >= CODIGOS_DA_REDE_POR_HORA
  )
    recusar(429, 'muitos_codigos');
  const pessoa = await db
    .prepare('SELECT id FROM equipa WHERE email = ? AND removido_em IS NULL AND activo = 1')
    .bind(email)
    .first<{ id: number }>();
  const codigo = codigoNovo();
  await db
    .prepare(
      'INSERT INTO codigos_de_entrada (email, resumo, pessoa_id, rede, expira_em) VALUES (?, ?, ?, ?, unixepoch() + ?)',
    )
    .bind(
      email,
      blob(await resumoDoCodigo(email, codigo)),
      pessoa?.id ?? null,
      rede,
      MINUTOS_DO_CODIGO * 60,
    )
    .run();
  if (pessoa) c.executionCtx.waitUntil(mandarCodigo(c.env, email, codigo, linguaDoPedido(c)));
  return c.json({
    ok: true,
    reenviarEm: SEGUNDOS_PARA_REENVIAR,
    // Só no «wrangler dev», para a prova: o código, se tivesse saído.
    ...(emEnsaio(c.env) ? { codigoDeEnsaio: pessoa ? codigo : null } : {}),
  });
});

/**
 * Entrar com o código. Vale qualquer código deste email ainda por usar (o primeiro pode chegar depois
 * do segundo). Cada engano conta uma vez, no código mais novo; um código leva os enganos dele e os dos
 * que vieram depois (contra ele também se tentou): cinco acabam com ele, e quinze num dia fecham o email.
 */
rotasDeEntradaDaBalcao.post('/entrar/email/codigo', async (c) => {
  await travar(c);
  if (!emailLigado(c.env)) recusar(503, 'email_desligado');
  const pedido = await corpo(
    c,
    z.object({
      email: z.string().max(254),
      codigo: z.string().regex(/^\d{6}$/),
      ligar: z
        .string()
        .regex(/^[A-Za-z0-9_-]{43}$/)
        .optional(),
    }),
  );
  const email = normalizarEmail(pedido.email);
  if (!email) recusar(400, 'email_invalido');
  const db = c.env.DB;
  const { results: deHoje } = await db
    .prepare(
      `SELECT id, resumo, pessoa_id, tentativas, usado_em IS NULL AND expira_em > unixepoch() AS vivo
       FROM codigos_de_entrada WHERE email = ? AND criado_em > unixepoch() - 86400 ORDER BY id DESC`,
    )
    .bind(email)
    .all<{
      id: number;
      resumo: unknown;
      pessoa_id: number | null;
      tentativas: number;
      vivo: number;
    }>();
  // Do mais novo para o mais antigo: os enganos que cada código já levou (os dele e os dos de depois).
  let enganos = 0;
  const vivos: ((typeof deHoje)[number] & { gastos: number })[] = [];
  for (const l of deHoje) {
    enganos += l.tentativas;
    if (l.vivo) vivos.push({ ...l, gastos: enganos });
  }
  if (enganos >= ENGANOS_POR_DIA) recusar(429, 'codigo_bloqueado');
  const validos = vivos.filter((v) => v.gastos < ENGANOS_DO_CODIGO);
  if (validos.length === 0) recusar(401, vivos.length ? 'codigo_esgotado' : 'codigo_caducado');
  const resumo = await resumoDoCodigo(email, pedido.codigo);
  const certo = validos.find((v) => iguais(paraBytes(v.resumo), resumo));
  if (!certo) {
    // No mais novo (o primeiro dos válidos): conta para ele e para todos os de antes.
    await db
      .prepare('UPDATE codigos_de_entrada SET tentativas = tentativas + 1 WHERE id = ?')
      .bind(validos[0]!.id)
      .run();
    // O engano que gastou o último código diz logo que é preciso outro.
    recusar(
      401,
      validos.every((v) => v.gastos + 1 >= ENGANOS_DO_CODIGO) ? 'codigo_esgotado' : 'codigo_errado',
    );
  }
  // Só um pedido fica com o código (dois ao mesmo tempo: o segundo já o encontra usado), e os outros
  // códigos deste email deixam de valer.
  const [usado] = await db.batch([
    db
      .prepare(
        'UPDATE codigos_de_entrada SET usado_em = unixepoch() WHERE id = ? AND usado_em IS NULL',
      )
      .bind(certo.id),
    db
      .prepare(
        'UPDATE codigos_de_entrada SET usado_em = unixepoch() WHERE email = ? AND usado_em IS NULL AND id != ?',
      )
      .bind(email, certo.id),
  ]);
  if (!usado?.meta.changes) recusar(401, 'codigo_caducado');
  // O código de um email de fora da equipa nunca saiu: só por sorte se acerta, e não abre nada.
  if (!certo.pessoa_id) recusar(401, 'codigo_errado');
  // A pessoa outra vez: pode ter saído da equipa (ou o parceiro desligado) depois de pedir.
  const pessoa = await pessoaDoEmail(c, email);
  if (pedido.ligar) await ligarForma(c, pessoa, pedido.ligar);
  return abrirSessao(c, pessoa);
});
