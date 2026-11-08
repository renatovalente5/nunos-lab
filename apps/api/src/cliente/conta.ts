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
  diaEmLisboa,
  eAniversarioValido,
  naLingua,
  temPrendaHoje,
  textoDeBusca,
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
import { DIA, agora, corpo, idDaMorada, linguaDoPedido, recusar } from '../util.ts';
import { nomeLimpo } from '../nomes.ts';
import { entrarComIdentidade, juntarIdentidade, type IdentidadeProvada } from './identidade.ts';
import { apagarConta } from './apagar.ts';
import { abrirSessaoDoCliente } from './sessao.ts';
import { appleLigada, googleLigada, rodarPasse, tocarPasse } from '../wallet/servico.ts';

const Google = z.object({ credencial: z.string().min(20).max(4096) });
const Apple = z.object({
  token: z.string().min(20).max(8192),
  /** O nonce prende o token a este pedido: sem ele, um token apanhado valia até caducar. */
  nonce: z.string().min(8).max(128),
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
  const id = await conferirTokenDaApple(token, clientes, nonce);
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
  aniversario_desde: number | null;
  loja_id: number | null;
  criado_em: number;
};

/** As versões inglesas que vêm com as vantagens do cliente (vazias: o português). */
type ComIngles = { destaque_en: string; titulo_en: string; detalhe_en?: string };

async function lerEu(c: C): Promise<ClienteEu> {
  const { id, sessao } = c.get('cliente');
  const db = c.env.DB;
  const programa = await lerPrograma(db);
  // Os textos do backoffice (o prémio, a prenda, as vantagens) na língua da app.
  const lingua = linguaDoPedido(c);
  const consultas = () =>
    db.batch([
      db
        .prepare(
          'SELECT id, codigo, nome, aniversario, aniversario_desde, loja_id, criado_em FROM clientes WHERE id = ?',
        )
        .bind(id),
      consultaDoCartaoActual(db, id),
      consultaDasRecompensas(db, id),
      db
        .prepare(
          `SELECT x.id, x.criado_em AS quando, l.nome AS loja, e.nome AS pessoa
           FROM carimbos x LEFT JOIN lojas l ON l.id = x.loja_id LEFT JOIN equipa e ON e.id = x.pessoa_id
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
          `SELECT v.id, v.criado_em AS quando, pa.id AS parceiroId, pa.nome AS parceiro, p.id AS promocaoId, p.destaque, p.titulo,
             p.destaque_en, p.titulo_en
           FROM vales v JOIN promocoes p ON p.id = v.promocao_id JOIN parceiros pa ON pa.id = v.parceiro_id
           WHERE v.cliente_id = ? AND v.anulado_em IS NULL ORDER BY v.criado_em DESC LIMIT 30`,
        )
        .bind(id),
      db
        .prepare(
          'SELECT 1 AS activo FROM carimbos WHERE cliente_id = ? AND anulado_em IS NULL AND criado_em > unixepoch() - ? LIMIT 1',
        )
        .bind(id, DIAS_DE_CLIENTE_ACTIVO * DIA),
      db
        .prepare(
          `SELECT k.id, pa.id AS parceiroId, pa.nome AS parceiro, p.id AS promocaoId, p.destaque, p.titulo, p.detalhe,
             p.destaque_en, p.titulo_en, p.detalhe_en, k.emitido_em AS emitidoEm, k.valido_ate AS validoAte, k.usado_em AS usadoEm
           FROM cupoes k JOIN promocoes p ON p.id = k.promocao_id JOIN parceiros pa ON pa.id = k.parceiro_id
           WHERE k.cliente_id = ? AND ((k.usado_em IS NULL AND k.valido_ate >= ?) OR k.usado_em > unixepoch() - 30 * 86400)
           ORDER BY k.usado_em IS NOT NULL, k.valido_ate, k.emitido_em DESC LIMIT 30`,
        )
        .bind(id, diaEmLisboa()),
      db
        .prepare('SELECT 1 FROM prendas WHERE cliente_id = ? AND ano = ?')
        .bind(id, Number(diaEmLisboa().slice(0, 4))),
      // O passe da Apple está nalgum iPhone: a Apple regista o aparelho ao juntá-lo e apaga ao tirá-lo.
      db
        .prepare(
          'SELECT 1 FROM registos_apple r JOIN passes p ON p.serie = r.serie WHERE p.cliente_id = ? LIMIT 1',
        )
        .bind(id),
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
    cartao: cartaoPublico(cartao, lingua),
    recompensas: (
      r[2]!.results as (ClienteEu['recompensas'][number] & { recompensa_en: string })[]
    ).map(({ recompensa_en, ...x }) => ({
      ...x,
      recompensa: naLingua(lingua, x.recompensa, recompensa_en),
    })),
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
    demo: c.get('cliente').demo,
    // Sempre true: a regra dos 15 minutos saiu a 6 nov 2026 (decisão do Renato). Fica pelas
    // apps antigas, que sem o campo pediam para sair e entrar.
    provaRecente: true,
    programa: {
      objectivo: programa.objectivo,
      recompensa: naLingua(lingua, programa.recompensa, programa.recompensaEn),
    },
    activo: r[8]!.results.length > 0,
    vales: (r[7]!.results as (ClienteEu['vales'][number] & ComIngles)[]).map(
      ({ destaque_en, titulo_en, ...v }) => ({
        ...v,
        destaque: naLingua(lingua, v.destaque, destaque_en),
        titulo: naLingua(lingua, v.titulo, titulo_en),
      }),
    ),
    wallet: {
      apple: appleLigada(c.env),
      google: googleLigada(c.env),
      appleNaCarteira: r[11]!.results.length > 0,
    },
    cupoes: (r[9]!.results as (ClienteEu['cupoes'][number] & ComIngles)[]).map(
      ({ destaque_en, titulo_en, detalhe_en, ...k }) => ({
        ...k,
        destaque: naLingua(lingua, k.destaque, destaque_en),
        titulo: naLingua(lingua, k.titulo, titulo_en),
        detalhe: naLingua(lingua, k.detalhe, detalhe_en),
      }),
    ),
    // A prenda só com a data dada há 30 dias ou mais (senão mudava-se na véspera), e uma vez por ano.
    prenda:
      temPrendaHoje(cliente.aniversario, cliente.aniversario_desde, diaEmLisboa(), agora()) &&
      programa.aniversario &&
      r[10]!.results.length === 0
        ? naLingua(lingua, programa.aniversario, programa.aniversarioEn)
        : null,
  };
}

/**
 * A conta fica com a língua em que a app está (a escolhida, ou a do telemóvel): o passe da carteira
 * sai nela, e refaz-se quando muda. As apps de antes do inglês não a mandam: fica como estava.
 */
async function guardarLingua(c: C) {
  if (!c.req.query('lingua')) return;
  const lingua = linguaDoPedido(c);
  const { id } = c.get('cliente');
  const r = await c.env.DB.prepare(
    'UPDATE clientes SET lingua = ? WHERE id = ? AND lingua IS NOT ?',
  )
    .bind(lingua, id, lingua)
    .run();
  if (r.meta.changes) tocarPasse(c, id);
}

rotasDaConta.get('/', async (c) => {
  await guardarLingua(c);
  return c.json(await lerEu(c));
});

const Perfil = z.object({
  nome: nomeLimpo(LIMITES_DO_PROGRAMA.nomeDoCliente).optional(),
  aniversario: z
    .string()
    .nullable()
    .refine((v) => v === null || eAniversarioValido(v))
    .optional(),
  lojaId: z.number().int().positive().nullable().optional(),
  lingua: z.enum(['pt', 'en']).optional(),
});

rotasDaConta.patch('/perfil', async (c) => {
  // A demonstração (os revisores das lojas) não muda o cliente de exemplo para o revisor seguinte.
  exigirNaoDemo(c);
  const p = await corpo(c, Perfil);
  const db = c.env.DB;
  const { id } = c.get('cliente');
  if (p.lojaId) {
    const loja = await db.prepare('SELECT 1 FROM lojas WHERE id = ?').bind(p.lojaId).first();
    if (!loja) recusar(400, 'referencia');
  }
  const partes: string[] = [];
  const valores: (string | number | null)[] = [];
  if (p.nome !== undefined)
    (partes.push('nome = ?', 'busca = ?'), valores.push(p.nome, textoDeBusca(p.nome)));
  if (p.aniversario !== undefined) {
    // A data conta a partir de quando foi dada: a prenda só vale DIAS_PARA_A_PRENDA depois.
    // Gravar a mesma data outra vez não reinicia a contagem.
    const actual = await db
      .prepare('SELECT aniversario FROM clientes WHERE id = ?')
      .bind(id)
      .first<{ aniversario: string | null }>();
    if ((actual?.aniversario ?? null) !== p.aniversario) {
      partes.push('aniversario = ?', 'aniversario_desde = ?');
      valores.push(p.aniversario, p.aniversario === null ? null : agora());
    }
  }
  if (p.lojaId !== undefined) (partes.push('loja_id = ?'), valores.push(p.lojaId));
  if (p.lingua !== undefined) (partes.push('lingua = ?'), valores.push(p.lingua));
  if (partes.length === 0) {
    // A mesma data outra vez não é um erro: a roda voltou ao que estava.
    if (p.aniversario !== undefined) return c.json(await lerEu(c));
    recusar(400, 'nada_a_mudar');
  }
  await db
    .prepare(`UPDATE clientes SET ${partes.join(', ')} WHERE id = ?`)
    .bind(...valores, id)
    .run();
  // O nome e a língua estão no passe.
  if (p.nome !== undefined || p.lingua !== undefined) tocarPasse(c, id);
  return c.json(await lerEu(c));
});

// ——— as formas de entrar ———

/**
 * A sessão de demonstração (os revisores das lojas) lê o cartão e pouco mais:
 * não roda o código, não apaga a conta, não junta nem tira formas de entrar
 * — a porta da revisão tem de continuar a abrir para o revisor seguinte.
 */
function exigirNaoDemo(c: C) {
  if (c.get('cliente').demo) recusar(403, 'demonstracao');
}

rotasDaConta.post('/formas/google', async (c) => {
  exigirNaoDemo(c);
  const { credencial } = await corpo(c, Google);
  await juntarIdentidade(c.env.DB, c.get('cliente').id, await identidadeGoogle(c, credencial));
  return c.json(await lerEu(c));
});

rotasDaConta.post('/formas/teste', async (c) => {
  exigirNaoDemo(c);
  await juntarIdentidade(
    c.env.DB,
    c.get('cliente').id,
    identidadeDeTeste(c, await corpo(c, Teste)),
  );
  return c.json(await lerEu(c));
});

rotasDaConta.post('/formas/apple', async (c) => {
  exigirNaoDemo(c);
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
  exigirNaoDemo(c);
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
  // A conta nunca fica sem forma nenhuma (dois aparelhos a tirar cada um a do
  // outro ao mesmo tempo): a condição vai nas duas instruções, na mesma transacção.
  const ficaAlguma = '(SELECT count(*) FROM identidades WHERE cliente_id = ?) > 1';
  const r = await db.batch([
    db
      .prepare(
        `UPDATE sessoes_de_cliente SET revogada_em = unixepoch() WHERE identidade_id = ? AND revogada_em IS NULL AND ${ficaAlguma}`,
      )
      .bind(formaId, id),
    db
      .prepare(`DELETE FROM identidades WHERE id = ? AND cliente_id = ? AND ${ficaAlguma}`)
      .bind(formaId, id, id),
    ...(email && email === sai.email
      ? [db.prepare('UPDATE clientes SET email = ? WHERE id = ?').bind(outra, id)]
      : []),
  ]);
  if (!r[1]!.meta.changes) recusar(409, 'ultima_forma');
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
  exigirNaoDemo(c);
  const { id, sessao } = c.get('cliente');
  await c.env.DB.prepare(
    'UPDATE sessoes_de_cliente SET revogada_em = unixepoch() WHERE cliente_id = ? AND id != ? AND revogada_em IS NULL',
  )
    .bind(id, sessao)
    .run();
  return c.json(await lerEu(c));
});

/** Termina UMA das outras sessões (a lista da Conta): a de agora sai por «Sair». */
rotasDaConta.post('/sessoes/:id/terminar', async (c) => {
  exigirNaoDemo(c);
  const { id, sessao } = c.get('cliente');
  const alvo = Number(c.req.param('id'));
  if (!Number.isInteger(alvo) || alvo <= 0 || alvo === sessao) recusar(404, 'nao_existe');
  const r = await c.env.DB.prepare(
    'UPDATE sessoes_de_cliente SET revogada_em = unixepoch() WHERE id = ? AND cliente_id = ? AND revogada_em IS NULL',
  )
    .bind(alvo, id)
    .run();
  if (!r.meta.changes) recusar(404, 'nao_existe');
  return c.json(await lerEu(c));
});

/** Termina as outras sessões E troca o código do cartão: o telemóvel perdido deixa de servir. */
rotasDaConta.post('/perdi-o-telemovel', async (c) => {
  exigirNaoDemo(c);
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
  // O passe do telemóvel perdido não pode receber o código novo: muda de série.
  await rodarPasse(c, id);
  tocarPasse(c, id);
  return c.json(await lerEu(c));
});

/** Apagar a conta: sai tudo o que é pessoal; os carimbos ficam sem dono, para as contagens (apagar.ts). */
rotasDaConta.delete('/', async (c) => {
  exigirNaoDemo(c);
  await apagarConta(c, c.get('cliente').id);
  return c.body(null, 204);
});
