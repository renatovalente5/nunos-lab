/**
 * A conta do cliente (/api/eu): entrar com a Apple ou a Google, o cartão, o
 * perfil, as formas de entrar, as sessões, «Perdi o telemóvel» e apagar a conta.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import {
  DIAS_A_EXPERIENCIA,
  DIAS_DE_CLIENTE_ACTIVO,
  LIMITES_DO_PROGRAMA,
  eAniversarioValido,
  type ClienteEu,
  type FormaDeEntrar,
  type TipoDeEntrada,
} from '@nunos-lab/dominio';
import type { Ambiente, C } from '../ambiente.ts';
import { conferirCredencialGoogle } from '../backoffice/google.ts';
import { conferirTokenDaApple } from '../entrada/apple.ts';
import {
  cartaoPublico,
  codigoNovo,
  consultaDasRecompensas,
  consultaDoCartaoActual,
  lerPrograma,
  novoCartao,
  type LinhaCartao,
} from '../programa.ts';
import { DIA, agora, corpo, idDaMorada, recusar } from '../util.ts';
import { entrarComIdentidade, juntarIdentidade, type IdentidadeProvada } from './identidade.ts';
import { abrirSessaoDoCliente, provaRecente } from './sessao.ts';
import { appleLigada, googleLigada, tocarPasse } from '../wallet/servico.ts';

const Google = z.object({ credencial: z.string().min(20).max(4096) });
const Apple = z.object({
  token: z.string().min(20).max(8192),
  nonce: z.string().min(8).max(128).nullish(),
  /** O nome que a Apple dá só na 1.ª vez (não é assinado: serve só para o perfil). */
  nome: z.string().trim().max(40).nullish(),
});

async function travar(c: C) {
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  if (!(await c.env.TRAVAO.limit({ key: `entrar:${ip}` }))?.success)
    recusar(429, 'muitas_tentativas');
}

async function identidadeGoogle(c: C, credencial: string): Promise<IdentidadeProvada> {
  const id = await conferirCredencialGoogle(credencial, c.env.GOOGLE_CLIENTE);
  if (!id) recusar(401, 'google_invalido');
  return { tipo: 'google', sujeito: id.sub, email: id.email, emailVerificado: true, nome: id.nome };
}

async function identidadeApple(
  c: C,
  { token, nonce, nome }: z.output<typeof Apple>,
): Promise<IdentidadeProvada> {
  const clientes = (c.env.APPLE_CLIENTES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (clientes.length === 0) recusar(400, 'apple_desligado');
  const id = await conferirTokenDaApple(token, clientes, nonce ?? null);
  if (!id) recusar(401, 'apple_invalido');
  return {
    tipo: 'apple',
    sujeito: id.sub,
    email: id.email,
    emailVerificado: id.emailVerificado,
    nome: nome ?? '',
  };
}

// ——— entrar (sem sessão) ———

export const rotasDeEntradaDoCliente = new Hono<Ambiente>();

async function entrar(c: C, id: IdentidadeProvada) {
  const db = c.env.DB;
  const programa = await lerPrograma(db);
  const { clienteId, identidadeId, nova } = await entrarComIdentidade(db, id, programa);
  const sessao = await abrirSessaoDoCliente(c, clienteId, identidadeId);
  return c.json({ sessao, nova });
}

rotasDeEntradaDoCliente.post('/entrar/google', async (c) => {
  await travar(c);
  const { credencial } = await corpo(c, Google);
  return entrar(c, await identidadeGoogle(c, credencial));
});

rotasDeEntradaDoCliente.post('/entrar/apple', async (c) => {
  await travar(c);
  return entrar(c, await identidadeApple(c, await corpo(c, Apple)));
});

/**
 * SÓ NO «wrangler dev» (MODO=desenvolvimento, que a publicação não leva): uma
 * identidade de faz de conta, para a prova da API percorrer as regras das
 * contas sem tokens da Google nem da Apple. Em produção não existe (404).
 */
const Teste = z.object({
  tipo: z.enum(['apple', 'google']),
  sujeito: z.string().min(1).max(80),
  email: z.string().trim().max(254).nullable(),
  emailVerificado: z.boolean().optional(),
  nome: z.string().trim().max(40).optional(),
});
function identidadeDeTeste(c: C, t: z.output<typeof Teste>): IdentidadeProvada {
  if ((c.env as { MODO?: string }).MODO !== 'desenvolvimento') recusar(404, 'nao_existe');
  return {
    tipo: t.tipo,
    sujeito: t.sujeito,
    email: t.email,
    emailVerificado: t.emailVerificado ?? true,
    nome: t.nome ?? '',
  };
}
rotasDeEntradaDoCliente.post('/entrar/teste', async (c) =>
  entrar(c, identidadeDeTeste(c, await corpo(c, Teste))),
);

// ——— a conta (com sessão) ———

export const rotasDaConta = new Hono<Ambiente>();

type LinhaCliente = {
  id: number;
  codigo: string;
  nome: string;
  aniversario: string | null;
  loja_id: number | null;
  criado_em: number;
};

async function lerEu(c: C): Promise<ClienteEu> {
  const { id, sessao, criadaEm } = c.get('cliente');
  const db = c.env.DB;
  const programa = await lerPrograma(db);
  const consultas = () =>
    db.batch([
      db
        .prepare(
          'SELECT id, codigo, nome, aniversario, loja_id, criado_em FROM clientes WHERE id = ?',
        )
        .bind(id),
      consultaDoCartaoActual(db, id),
      consultaDasRecompensas(db, id),
      db
        .prepare(
          `SELECT x.id, x.criado_em AS quando, l.nome AS loja, e.nome AS pessoa, s.nome AS servico
           FROM carimbos x LEFT JOIN lojas l ON l.id = x.loja_id LEFT JOIN equipa e ON e.id = x.pessoa_id
           LEFT JOIN servicos s ON s.id = x.servico_id
           WHERE x.cliente_id = ? AND x.anulado_em IS NULL ORDER BY x.criado_em DESC LIMIT 30`,
        )
        .bind(id),
      db
        .prepare('SELECT count(*) AS n FROM carimbos WHERE cliente_id = ? AND anulado_em IS NULL')
        .bind(id),
      db
        .prepare(
          'SELECT id, tipo, email, criada_em FROM identidades WHERE cliente_id = ? ORDER BY id',
        )
        .bind(id),
      db
        .prepare(
          `SELECT id, aparelho, criada_em, vista_em FROM sessoes_de_cliente
           WHERE cliente_id = ? AND revogada_em IS NULL AND expira_em > unixepoch() ORDER BY vista_em DESC`,
        )
        .bind(id),
      db
        .prepare(
          `SELECT v.id, v.criado_em AS quando, pa.id AS parceiroId, pa.nome AS parceiro, p.id AS promocaoId, p.destaque, p.titulo
           FROM vales v JOIN promocoes p ON p.id = v.promocao_id JOIN parceiros pa ON pa.id = v.parceiro_id
           WHERE v.cliente_id = ? AND v.anulado_em IS NULL ORDER BY v.criado_em DESC LIMIT 30`,
        )
        .bind(id),
      db
        .prepare(
          'SELECT 1 AS activo FROM carimbos WHERE cliente_id = ? AND anulado_em IS NULL AND criado_em > unixepoch() - ? LIMIT 1',
        )
        .bind(id, DIAS_DE_CLIENTE_ACTIVO * DIA),
    ]);
  let r = await consultas();
  if (!r[1]!.results[0]) {
    // Sem cartão (não devia acontecer): abre-se o primeiro.
    await novoCartao(db, id, 1, programa).run();
    r = await consultas();
  }
  const cliente = r[0]!.results[0] as LinhaCliente;
  const cartao = r[1]!.results[0] as LinhaCartao;
  const limite = agora() - DIAS_A_EXPERIENCIA * DIA;
  return {
    id: cliente.id,
    codigo: cliente.codigo,
    nome: cliente.nome,
    aniversario: cliente.aniversario,
    lojaId: cliente.loja_id,
    criadoEm: cliente.criado_em,
    cortes: (r[4]!.results[0] as { n: number }).n,
    cartao: cartaoPublico(cartao),
    recompensas: r[2]!.results as ClienteEu['recompensas'],
    visitas: r[3]!.results as ClienteEu['visitas'],
    formas: (
      r[5]!.results as {
        id: number;
        tipo: TipoDeEntrada;
        email: string | null;
        criada_em: number;
      }[]
    ).map((f): FormaDeEntrar => ({
      id: f.id,
      tipo: f.tipo,
      email: f.email,
      criadaEm: f.criada_em,
      aExperiencia: f.criada_em > limite && cliente.criado_em <= limite,
    })),
    sessoes: (
      r[6]!.results as { id: number; aparelho: string; criada_em: number; vista_em: number }[]
    ).map((s) => ({
      id: s.id,
      aparelho: s.aparelho,
      criadaEm: s.criada_em,
      vistaEm: s.vista_em,
      actual: s.id === sessao,
    })),
    provaRecente: criadaEm > agora() - 15 * 60,
    programa: { objectivo: programa.objectivo, recompensa: programa.recompensa },
    activo: r[8]!.results.length > 0,
    vales: r[7]!.results as ClienteEu['vales'],
    wallet: { apple: appleLigada(c.env), google: googleLigada(c.env) },
  };
}

rotasDaConta.get('/', async (c) => c.json(await lerEu(c)));

const Perfil = z.object({
  nome: z.string().trim().max(LIMITES_DO_PROGRAMA.nomeDoCliente).optional(),
  aniversario: z
    .string()
    .nullable()
    .refine((v) => v === null || eAniversarioValido(v))
    .optional(),
  lojaId: z.number().int().positive().nullable().optional(),
});

rotasDaConta.patch('/perfil', async (c) => {
  const p = await corpo(c, Perfil);
  const db = c.env.DB;
  const { id } = c.get('cliente');
  if (p.lojaId) {
    const loja = await db.prepare('SELECT 1 FROM lojas WHERE id = ?').bind(p.lojaId).first();
    if (!loja) recusar(400, 'referencia');
  }
  const partes: string[] = [];
  const valores: (string | number | null)[] = [];
  if (p.nome !== undefined) (partes.push('nome = ?'), valores.push(p.nome));
  if (p.aniversario !== undefined) (partes.push('aniversario = ?'), valores.push(p.aniversario));
  if (p.lojaId !== undefined) (partes.push('loja_id = ?'), valores.push(p.lojaId));
  if (partes.length === 0) recusar(400, 'nada_a_mudar');
  await db
    .prepare(`UPDATE clientes SET ${partes.join(', ')} WHERE id = ?`)
    .bind(...valores, id)
    .run();
  if (p.nome !== undefined) tocarPasse(c, id);
  return c.json(await lerEu(c));
});

// ——— as formas de entrar ———

function exigirProvaRecente(c: C) {
  if (!provaRecente(c)) recusar(403, 'prova_recente');
}

rotasDaConta.post('/formas/google', async (c) => {
  exigirProvaRecente(c);
  const { credencial } = await corpo(c, Google);
  await juntarIdentidade(c.env.DB, c.get('cliente').id, await identidadeGoogle(c, credencial));
  return c.json(await lerEu(c));
});

rotasDaConta.post('/formas/teste', async (c) => {
  exigirProvaRecente(c);
  await juntarIdentidade(
    c.env.DB,
    c.get('cliente').id,
    identidadeDeTeste(c, await corpo(c, Teste)),
  );
  return c.json(await lerEu(c));
});

rotasDaConta.post('/formas/apple', async (c) => {
  exigirProvaRecente(c);
  await juntarIdentidade(
    c.env.DB,
    c.get('cliente').id,
    await identidadeApple(c, await corpo(c, Apple)),
  );
  return c.json(await lerEu(c));
});

/**
 * Tirar uma forma de entrar: nunca a última, nunca a que abriu esta sessão, e
 * uma conta com mais de 7 dias nunca fica só com formas mais novas do que isso
 * (quem pegou num telemóvel desbloqueado junta a dele mas não tira a do dono).
 * Tirar termina as sessões que essa forma abriu.
 */
rotasDaConta.delete('/formas/:id', async (c) => {
  exigirProvaRecente(c);
  const formaId = idDaMorada(c);
  const { id, identidadeId } = c.get('cliente');
  const db = c.env.DB;
  const [formas, cliente] = await db.batch([
    db.prepare('SELECT id, email, dona, criada_em FROM identidades WHERE cliente_id = ?').bind(id),
    db.prepare('SELECT criado_em, email FROM clientes WHERE id = ?').bind(id),
  ]);
  type F = { id: number; email: string | null; dona: number; criada_em: number };
  const todas = formas!.results as F[];
  const sai = todas.find((f) => f.id === formaId);
  if (!sai) recusar(404, 'nao_existe');
  const ficam = todas.filter((f) => f.id !== formaId);
  if (ficam.length === 0) recusar(409, 'ultima_forma');
  if (formaId === identidadeId) recusar(409, 'forma_actual');
  const { criado_em, email } = cliente!.results[0] as { criado_em: number; email: string | null };
  const limite = agora() - DIAS_A_EXPERIENCIA * DIA;
  if (criado_em <= limite && !ficam.some((f) => f.criada_em <= limite))
    recusar(409, 'so_formas_novas');
  // A morada dos avisos passa a outra forma provada que já cá estava, ou a nenhuma.
  const outra = ficam.find((f) => f.dona === 1 && f.email && f.criada_em <= limite)?.email ?? null;
  await db.batch([
    db
      .prepare(
        'UPDATE sessoes_de_cliente SET revogada_em = unixepoch() WHERE identidade_id = ? AND revogada_em IS NULL',
      )
      .bind(formaId),
    db.prepare('DELETE FROM identidades WHERE id = ? AND cliente_id = ?').bind(formaId, id),
    ...(email && email === sai.email
      ? [db.prepare('UPDATE clientes SET email = ? WHERE id = ?').bind(outra, id)]
      : []),
  ]);
  return c.json(await lerEu(c));
});

// ——— as sessões ———

rotasDaConta.post('/sair', async (c) => {
  await c.env.DB.prepare('UPDATE sessoes_de_cliente SET revogada_em = unixepoch() WHERE id = ?')
    .bind(c.get('cliente').sessao)
    .run();
  return c.body(null, 204);
});

rotasDaConta.post('/sair-das-outras', async (c) => {
  const { id, sessao } = c.get('cliente');
  await c.env.DB.prepare(
    'UPDATE sessoes_de_cliente SET revogada_em = unixepoch() WHERE cliente_id = ? AND id != ? AND revogada_em IS NULL',
  )
    .bind(id, sessao)
    .run();
  return c.json(await lerEu(c));
});

/** Termina as outras sessões E troca o código do cartão: o telemóvel perdido deixa de servir. */
rotasDaConta.post('/perdi-o-telemovel', async (c) => {
  const { id, sessao } = c.get('cliente');
  const db = c.env.DB;
  const codigo = await codigoNovo(db);
  await db.batch([
    db
      .prepare(
        'UPDATE sessoes_de_cliente SET revogada_em = unixepoch() WHERE cliente_id = ? AND id != ? AND revogada_em IS NULL',
      )
      .bind(id, sessao),
    db
      .prepare('UPDATE clientes SET codigo = ?, codigo_versao = codigo_versao + 1 WHERE id = ?')
      .bind(codigo, id),
  ]);
  tocarPasse(c, id);
  return c.json(await lerEu(c));
});

/** Apagar a conta: sai tudo o que é pessoal; os carimbos ficam sem dono, para as contagens. */
rotasDaConta.delete('/', async (c) => {
  exigirProvaRecente(c);
  const { id } = c.get('cliente');
  const db = c.env.DB;
  const codigo = await codigoNovo(db);
  await db.batch([
    db.prepare('DELETE FROM identidades WHERE cliente_id = ?').bind(id),
    db
      .prepare(
        'UPDATE sessoes_de_cliente SET revogada_em = unixepoch() WHERE cliente_id = ? AND revogada_em IS NULL',
      )
      .bind(id),
    db
      .prepare(
        `UPDATE clientes SET nome = '', email = NULL, aniversario = NULL, loja_id = NULL,
         codigo = ?, codigo_versao = codigo_versao + 1, apagado_em = unixepoch() WHERE id = ?`,
      )
      .bind(codigo, id),
  ]);
  return c.body(null, 204);
});
