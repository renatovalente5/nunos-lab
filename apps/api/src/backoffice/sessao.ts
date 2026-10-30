import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import {
  DIAS_DA_LIGACAO,
  DIAS_DA_SESSAO,
  LIMITES,
  normalizarEmail,
  type PessoaComAcesso,
} from '@nunos-lab/dominio';
import type { Ambiente, C } from '../ambiente.ts';
import {
  DIA,
  agora,
  aleatorio,
  aparelhoDe,
  blob,
  corpo,
  idDaMorada,
  recusar,
  registar,
  sha256,
  traduzirErroDaBase,
} from '../util.ts';
import { conferirCredencialGoogle } from './google.ts';

/**
 * Entrar no backoffice faz-se de duas formas:
 *  · com o GOOGLE: o botão devolve um token assinado pelo Google, e entra quem
 *    tiver o email numa das pessoas da lista (é a forma do dia a dia);
 *  · com uma LIGAÇÃO DE ACESSO: vale uma vez, por 7 dias, para quem não tiver
 *    conta Google (a primeira cria-se com «node scripts/acesso.mjs»).
 * As duas abrem uma sessão deste aparelho, que dura 90 dias sem uso.
 */

/** A guarda: todas as rotas do backoffice, menos «entrar», precisam de sessão. */
export const exigirSessao: MiddlewareHandler<Ambiente> = async (c, next) => {
  const cabecalho = c.req.header('Authorization') ?? '';
  const testemunho = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(testemunho)) recusar(401, 'sessao');
  const resumo = blob(await sha256(testemunho));
  const linha = await c.env.DB.prepare(
    `SELECT s.id, s.admin_id, s.vista_em, a.nome FROM sessoes s JOIN admins a ON a.id = s.admin_id
     WHERE s.resumo = ? AND s.revogada_em IS NULL AND s.expira_em > unixepoch() AND a.removido_em IS NULL`,
  )
    .bind(resumo)
    .first<{ id: number; admin_id: number; vista_em: number; nome: string }>();
  if (!linha) recusar(401, 'sessao');
  // A sessão estica a cada uso, mas escreve-se no máximo uma vez por hora.
  if (linha.vista_em < agora() - 3600) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        'UPDATE sessoes SET vista_em = unixepoch(), expira_em = unixepoch() + ? WHERE id = ?',
      )
        .bind(DIAS_DA_SESSAO * DIA, linha.id)
        .run(),
    );
  }
  c.set('admin', { id: linha.admin_id, nome: linha.nome, sessao: linha.id });
  await next();
};

export const rotasDaSessao = new Hono<Ambiente>();

rotasDaSessao.post('/entrar', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  if (!(await c.env.TRAVAO.limit({ key: `entrar:${ip}` })).success)
    recusar(429, 'muitas_tentativas');
  const { acesso } = await corpo(c, z.object({ acesso: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }));
  const db = c.env.DB;
  // Gastar a ligação é UMA instrução: dois pedidos ao mesmo tempo não entram os dois.
  const gasta = await db
    .prepare(
      `UPDATE acessos SET usado_em = unixepoch()
       WHERE resumo = ? AND usado_em IS NULL AND expira_em > unixepoch()
         AND admin_id IN (SELECT id FROM admins WHERE removido_em IS NULL)
       RETURNING admin_id`,
    )
    .bind(blob(await sha256(acesso)))
    .first<{ admin_id: number }>();
  if (!gasta) recusar(401, 'ligacao_invalida');
  return c.json(await abrirSessao(c, gasta.admin_id, 'ligação'));
});

/** Abre uma sessão para a pessoa, regista a entrada, e devolve o testemunho UMA vez. */
async function abrirSessao(c: C, adminId: number, como: 'ligação' | 'Google') {
  const db = c.env.DB;
  const testemunho = aleatorio(32);
  const aparelho = aparelhoDe(c.req.header('User-Agent') ?? '');
  const [sessao, , admin] = await db.batch([
    db
      .prepare(
        'INSERT INTO sessoes (resumo, admin_id, aparelho, expira_em) VALUES (?, ?, ?, unixepoch() + ?) RETURNING id',
      )
      .bind(blob(await sha256(testemunho)), adminId, aparelho, DIAS_DA_SESSAO * DIA),
    db
      .prepare("INSERT INTO registo (admin_id, accao, alvo) VALUES (?, 'entrou', ?)")
      .bind(adminId, `${aparelho} · ${como}`),
    db.prepare('SELECT id, nome FROM admins WHERE id = ?').bind(adminId),
  ]);
  const quem = admin!.results[0] as { id: number; nome: string };
  return {
    sessao: testemunho,
    eu: { id: quem.id, nome: quem.nome, sessao: (sessao!.results[0] as { id: number }).id },
  };
}

/**
 * Entrar com o Google. Um token certo de um email que não está na lista dá
 * 403 «sem_acesso» (a pessoa existe no Google, mas não aqui); um token que não
 * bate certo dá 401.
 */
rotasDaSessao.post('/entrar/google', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  if (!(await c.env.TRAVAO.limit({ key: `entrar:${ip}` })).success)
    recusar(429, 'muitas_tentativas');
  const { credencial } = await corpo(c, z.object({ credencial: z.string().min(20).max(4096) }));
  const id = await conferirCredencialGoogle(credencial, c.env.GOOGLE_CLIENTE);
  if (!id) recusar(401, 'google_invalido');
  const pessoa = await c.env.DB.prepare(
    'SELECT id FROM admins WHERE email = ? AND removido_em IS NULL',
  )
    .bind(id.email)
    .first<{ id: number }>();
  if (!pessoa) recusar(403, 'sem_acesso');
  return c.json(await abrirSessao(c, pessoa.id, 'Google'));
});

export const rotasDosAcessos = new Hono<Ambiente>();

rotasDosAcessos.get('/eu', (c) => c.json(c.get('admin')));

rotasDosAcessos.post('/sair', async (c) => {
  await c.env.DB.prepare('UPDATE sessoes SET revogada_em = unixepoch() WHERE id = ?')
    .bind(c.get('admin').sessao)
    .run();
  return c.body(null, 204);
});

/** Quem tem acesso, em que aparelhos, e as ligações por usar. */
rotasDosAcessos.get('/acessos', async (c) => {
  const db = c.env.DB;
  const eu = c.get('admin');
  const [admins, sessoes, ligacoes] = await db.batch([
    db.prepare(
      'SELECT id, nome, email, criado_em FROM admins WHERE removido_em IS NULL ORDER BY id',
    ),
    db.prepare(
      'SELECT id, admin_id, aparelho, criada_em, vista_em FROM sessoes WHERE revogada_em IS NULL AND expira_em > unixepoch() ORDER BY vista_em DESC',
    ),
    db.prepare(
      'SELECT id, admin_id, criado_em, expira_em FROM acessos WHERE usado_em IS NULL AND expira_em > unixepoch() ORDER BY id',
    ),
  ]);
  type S = { id: number; admin_id: number; aparelho: string; criada_em: number; vista_em: number };
  type L = { id: number; admin_id: number; criado_em: number; expira_em: number };
  const pessoas: PessoaComAcesso[] = (
    admins!.results as { id: number; nome: string; email: string | null; criado_em: number }[]
  ).map((a) => ({
    id: a.id,
    nome: a.nome,
    email: a.email,
    criadoEm: a.criado_em,
    eu: a.id === eu.id,
    sessoes: (sessoes!.results as S[])
      .filter((s) => s.admin_id === a.id)
      .map((s) => ({
        id: s.id,
        aparelho: s.aparelho,
        criadaEm: s.criada_em,
        vistaEm: s.vista_em,
        actual: s.id === eu.sessao,
      })),
    ligacoes: (ligacoes!.results as L[])
      .filter((l) => l.admin_id === a.id)
      .map((l) => ({ id: l.id, criadoEm: l.criado_em, expiraEm: l.expira_em })),
  }));
  return c.json(pessoas);
});

/**
 * Uma ligação de acesso nova: para alguém que já está na lista (outro
 * aparelho), ou para uma pessoa nova (com o nome). Devolve o código UMA vez;
 * o backoffice monta a ligação com a sua própria morada.
 */
rotasDosAcessos.post('/acessos', async (c) => {
  const pedido = await corpo(
    c,
    z.union([
      z.object({ adminId: z.number().int().positive() }),
      z.object({ nome: z.string().trim().min(1).max(LIMITES.pessoa) }),
    ]),
  );
  const db = c.env.DB;
  let adminId: number;
  let nome: string;
  if ('adminId' in pedido) {
    const a = await db
      .prepare('SELECT id, nome FROM admins WHERE id = ? AND removido_em IS NULL')
      .bind(pedido.adminId)
      .first<{ id: number; nome: string }>();
    if (!a) recusar(404, 'nao_existe');
    adminId = a.id;
    nome = a.nome;
  } else {
    const a = await db
      .prepare('INSERT INTO admins (nome) VALUES (?) RETURNING id')
      .bind(pedido.nome)
      .first<{ id: number }>();
    adminId = a!.id;
    nome = pedido.nome;
  }
  const codigo = aleatorio(32);
  const expiraEm = agora() + DIAS_DA_LIGACAO * DIA;
  await db.batch([
    db
      .prepare('INSERT INTO acessos (admin_id, resumo, criado_por, expira_em) VALUES (?, ?, ?, ?)')
      .bind(adminId, blob(await sha256(codigo)), c.get('admin').id, expiraEm),
    registar(c, 'acesso.criado', nome),
  ]);
  return c.json({ codigo, adminId, expiraEm }, 201);
});

rotasDosAcessos.delete('/acessos/:id', async (c) => {
  const id = idDaMorada(c);
  const r = await c.env.DB.prepare('DELETE FROM acessos WHERE id = ? AND usado_em IS NULL')
    .bind(id)
    .run();
  if (!r.meta.changes) recusar(404, 'nao_existe');
  return c.body(null, 204);
});

rotasDosAcessos.delete('/sessoes/:id', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  const s = await db
    .prepare(
      'SELECT s.aparelho, a.nome FROM sessoes s JOIN admins a ON a.id = s.admin_id WHERE s.id = ? AND s.revogada_em IS NULL',
    )
    .bind(id)
    .first<{ aparelho: string; nome: string }>();
  if (!s) recusar(404, 'nao_existe');
  await db.batch([
    db.prepare('UPDATE sessoes SET revogada_em = unixepoch() WHERE id = ?').bind(id),
    registar(c, 'sessao.terminada', `${s.nome} · ${s.aparelho}`),
  ]);
  return c.body(null, 204);
});

/** Tirar o acesso a uma pessoa: as sessões dela acabam, e as ligações por usar também. */
rotasDosAcessos.delete('/pessoas/:id', async (c) => {
  const id = idDaMorada(c);
  if (id === c.get('admin').id) recusar(409, 'a_si_proprio');
  const db = c.env.DB;
  const a = await db
    .prepare('SELECT nome FROM admins WHERE id = ? AND removido_em IS NULL')
    .bind(id)
    .first<{ nome: string }>();
  if (!a) recusar(404, 'nao_existe');
  // Nunca fica zero admins (dois a tirarem-se um ao outro ao mesmo tempo).
  const tirado = await db
    .prepare(
      'UPDATE admins SET removido_em = unixepoch() WHERE id = ? AND removido_em IS NULL AND (SELECT count(*) FROM admins WHERE removido_em IS NULL) > 1',
    )
    .bind(id)
    .run();
  if (!tirado.meta.changes) recusar(409, 'ultimo_admin');
  await db.batch([
    db
      .prepare(
        'UPDATE sessoes SET revogada_em = unixepoch() WHERE admin_id = ? AND revogada_em IS NULL',
      )
      .bind(id),
    db.prepare('DELETE FROM acessos WHERE admin_id = ? AND usado_em IS NULL').bind(id),
    registar(c, 'pessoa.removida', a.nome),
  ]);
  return c.body(null, 204);
});

const EmailDoGoogle = z
  .string()
  .refine((v) => normalizarEmail(v) !== null)
  .transform((v) => normalizarEmail(v)!);

/** Dar acesso a uma pessoa nova: o nome e o email da conta Google com que vai entrar. */
rotasDosAcessos.post('/pessoas', async (c) => {
  const p = await corpo(
    c,
    z.object({ nome: z.string().trim().min(1).max(LIMITES.pessoa), email: EmailDoGoogle }),
  );
  const db = c.env.DB;
  try {
    const [nova] = await db.batch([
      db
        .prepare('INSERT INTO admins (nome, email) VALUES (?, ?) RETURNING id')
        .bind(p.nome, p.email),
      registar(c, 'pessoa.criada', `${p.nome} · ${p.email}`),
    ]);
    return c.json({ id: (nova!.results[0] as { id: number }).id }, 201);
  } catch (e) {
    traduzirErroDaBase(e);
  }
});

/** Mudar (ou tirar, com null) o email Google de uma pessoa. */
rotasDosAcessos.patch('/pessoas/:id', async (c) => {
  const id = idDaMorada(c);
  const { email } = await corpo(c, z.object({ email: EmailDoGoogle.nullable() }));
  const db = c.env.DB;
  const a = await db
    .prepare('SELECT nome FROM admins WHERE id = ? AND removido_em IS NULL')
    .bind(id)
    .first<{ nome: string }>();
  if (!a) recusar(404, 'nao_existe');
  try {
    await db.batch([
      db.prepare('UPDATE admins SET email = ? WHERE id = ?').bind(email, id),
      registar(c, 'pessoa.email', `${a.nome} · ${email ?? 'sem email'}`),
    ]);
  } catch (e) {
    traduzirErroDaBase(e);
  }
  return c.body(null, 204);
});
