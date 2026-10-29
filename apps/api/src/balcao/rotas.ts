/**
 * A Balcão (/api/balcao): a ficha de um cartão, carimbar, anular, entregar a
 * recompensa, um cliente novo ao balcão, procurar, o dia e o resumo do dono.
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
  DIAS_DE_CLIENTE_ACTIVO,
  LIMITES_DO_PROGRAMA,
  MINUTOS_PARA_ANULAR,
  inicioDoPeriodo,
  motivoDaVantagem,
  codigoValido,
  diaEmLisboa,
  normalizarCodigo,
  normalizarEmail,
  somarDias,
  type Programa,
  type ClienteProcurado,
  type EuDaBalcao,
  type FichaDoBalcao,
  type FichaDoParceiro,
  type HojeDaBalcao,
  type HojeDoParceiro,
  type Vale,
  type VantagemDoParceiro,
  type Loja,
  type ResultadoDoCarimbo,
  type ResumoDaBalcao,
  type Servico,
  type UltimoCarimbo,
} from '@nunos-lab/dominio';
import type { Ambiente, C } from '../ambiente.ts';
import {
  cartaoActual,
  cartaoPublico,
  codigoNovo,
  consultaDasRecompensas,
  inicioDoDia,
  lerPrograma,
  novoCartao,
  type LinhaCartao,
} from '../programa.ts';
import { DIA, agora, corpo, recusar, traduzirErroDaBase } from '../util.ts';
import { tocarPasse } from '../wallet/servico.ts';
import type { LinhaPromocao } from '../linhas.ts';

export const rotasDaBalcao = new Hono<Ambiente>();

/** Só a barbearia carimba; o papel «parceiro» valida vantagens (fase 2). */
function exigirBarbearia(c: C) {
  if (c.get('pessoa').papel === 'parceiro') recusar(403, 'so_barbearia');
}

function exigirDono(c: C) {
  if (c.get('pessoa').papel !== 'dono') recusar(403, 'so_dono');
}

type LinhaCliente = {
  id: number;
  codigo: string;
  nome: string;
  criado_em: number;
  aniversario: string | null;
};

async function clientePorCodigo(c: C, texto: string): Promise<LinhaCliente> {
  const codigo = normalizarCodigo(texto);
  if (!codigoValido(codigo)) recusar(404, 'cartao_desconhecido');
  const cliente = await c.env.DB.prepare(
    'SELECT id, codigo, nome, criado_em, aniversario FROM clientes WHERE codigo = ? AND apagado_em IS NULL',
  )
    .bind(codigo)
    .first<LinhaCliente>();
  if (!cliente) recusar(404, 'cartao_desconhecido');
  return cliente;
}

const VISITA = `SELECT x.id, x.criado_em AS quando, l.nome AS loja, e.nome AS pessoa, s.nome AS servico
  FROM carimbos x LEFT JOIN lojas l ON l.id = x.loja_id LEFT JOIN equipa e ON e.id = x.pessoa_id
  LEFT JOIN servicos s ON s.id = x.servico_id`;

async function ficha(c: C, cliente: LinhaCliente): Promise<FichaDoBalcao> {
  const db = c.env.DB;
  const hoje = diaEmLisboa();
  let cartao = await cartaoActual(db, cliente.id);
  if (!cartao) {
    await novoCartao(db, cliente.id, 1, await lerPrograma(db)).run();
    cartao = (await cartaoActual(db, cliente.id))!;
  }
  const [cortes, recompensas, ultima, deHoje] = await db.batch([
    db
      .prepare('SELECT count(*) AS n FROM carimbos WHERE cliente_id = ? AND anulado_em IS NULL')
      .bind(cliente.id),
    consultaDasRecompensas(db, cliente.id),
    db
      .prepare(
        `${VISITA} WHERE x.cliente_id = ? AND x.anulado_em IS NULL ORDER BY x.criado_em DESC LIMIT 1`,
      )
      .bind(cliente.id),
    db
      .prepare(
        `SELECT x.criado_em AS quando, e.nome AS pessoa FROM carimbos x LEFT JOIN equipa e ON e.id = x.pessoa_id
         WHERE x.cliente_id = ? AND x.dia = ? AND x.anulado_em IS NULL ORDER BY x.criado_em DESC`,
      )
      .bind(cliente.id, hoje),
  ]);
  const hojeLinhas = deHoje!.results as { quando: number; pessoa: string | null }[];
  const fazAnos = !!cliente.aniversario && hoje.slice(5) === cliente.aniversario;
  const programaDeHoje = await lerPrograma(db);
  return {
    prenda: fazAnos && programaDeHoje.aniversario ? programaDeHoje.aniversario : null,
    cliente: {
      id: cliente.id,
      codigo: cliente.codigo,
      nome: cliente.nome,
      criadoEm: cliente.criado_em,
      cortes: (cortes!.results[0] as { n: number }).n,
      aniversario: fazAnos,
    },
    cartao: cartaoPublico(cartao),
    recompensas: recompensas!.results as FichaDoBalcao['recompensas'],
    ultima: (ultima!.results[0] as FichaDoBalcao['ultima']) ?? null,
    hoje: { carimbos: hojeLinhas.length, ultimo: hojeLinhas[0] ?? null },
  };
}

rotasDaBalcao.get('/eu', async (c) => {
  const pessoa = c.get('pessoa');
  const db = c.env.DB;
  const [lojas, servicos, parceiro] = await db.batch([
    db.prepare('SELECT id, nome, morada, telefone, marcar, ordem FROM lojas ORDER BY ordem, id'),
    db.prepare(
      'SELECT id, nome, preco, ordem, activo FROM servicos WHERE activo = 1 ORDER BY ordem, id',
    ),
    db.prepare('SELECT id, nome FROM parceiros WHERE id = ?').bind(pessoa.parceiroId ?? 0),
  ]);
  const eu: EuDaBalcao = {
    pessoa: {
      id: pessoa.id,
      nome: pessoa.nome,
      email: null,
      papel: pessoa.papel,
      lojaId: pessoa.lojaId,
      parceiroId: pessoa.parceiroId,
      activo: true,
      criadoEm: 0,
    },
    sessao: pessoa.sessao,
    lojas: lojas!.results as Loja[],
    servicos: (servicos!.results as (Omit<Servico, 'activo'> & { activo: number })[]).map((s) => ({
      ...s,
      activo: s.activo === 1,
    })),
    programa: await lerPrograma(db),
    parceiro: (parceiro!.results[0] as { id: number; nome: string } | undefined) ?? null,
  };
  return c.json(eu);
});

rotasDaBalcao.get('/ficha/:codigo', async (c) => {
  exigirBarbearia(c);
  return c.json(await ficha(c, await clientePorCodigo(c, c.req.param('codigo'))));
});

const Carimbo = z.object({
  codigo: z.string().min(1).max(20),
  /** A chave de idempotência, gerada pela Balcão. */
  chave: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  lojaId: z.number().int().positive(),
  servicoId: z.number().int().positive().nullish(),
  /** Já viu o aviso do limite do dia e quer carimbar na mesma. */
  confirmar: z.boolean().optional(),
  /** Procurado por nome, sem ler o QR. */
  semLeitura: z.boolean().optional(),
});

async function lojaDe(c: C, lojaId: number): Promise<number> {
  const pessoa = c.get('pessoa');
  const loja = await c.env.DB.prepare('SELECT id FROM lojas WHERE id = ?').bind(lojaId).first();
  if (!loja) recusar(400, 'referencia');
  // Um barbeiro de uma casa carimba nessa casa; o dono em qualquer.
  if (pessoa.papel === 'barbeiro' && pessoa.lojaId && pessoa.lojaId !== lojaId)
    recusar(403, 'outra_casa');
  return lojaId;
}

/**
 * O cupão surpresa: ao carimbar, sai uma das promoções do saco (activas, do
 * parceiro activo, com restantes), sorteada pelo peso, que o cliente ainda
 * não tenha por usar. Vale até «surpresa_dias» dias.
 */
async function sortearCupao(db: D1Database, clienteId: number, carimboId: number, hoje: string) {
  const saco = (
    await db
      .prepare(
        `SELECT p.id, p.parceiro_id, p.destaque, p.titulo, p.surpresa_dias, p.surpresa_peso, p.surpresa_restantes, pa.nome AS parceiro
         FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id
         WHERE p.surpresa = 1 AND p.activa = 1 AND pa.activo = 1
           AND (p.inicio IS NULL OR p.inicio <= ?1) AND (p.fim IS NULL OR p.fim >= ?1)
           AND (p.surpresa_restantes IS NULL OR p.surpresa_restantes > 0)
           AND NOT EXISTS (SELECT 1 FROM cupoes k WHERE k.promocao_id = p.id AND k.cliente_id = ?2 AND k.usado_em IS NULL AND k.valido_ate >= ?1)`,
      )
      .bind(hoje, clienteId)
      .all<{
        id: number;
        parceiro_id: number;
        destaque: string;
        titulo: string;
        surpresa_dias: number;
        surpresa_peso: number;
        surpresa_restantes: number | null;
        parceiro: string;
      }>()
  ).results;
  if (!saco.length) return null;
  let sorte = Math.random() * saco.reduce((s, p) => s + p.surpresa_peso, 0);
  let escolhida = saco[saco.length - 1]!;
  for (const p of saco) {
    sorte -= p.surpresa_peso;
    if (sorte < 0) {
      escolhida = p;
      break;
    }
  }
  const validoAte = somarDias(hoje, escolhida.surpresa_dias);
  await db.batch([
    db
      .prepare(
        'INSERT INTO cupoes (promocao_id, parceiro_id, cliente_id, carimbo_id, valido_ate) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(escolhida.id, escolhida.parceiro_id, clienteId, carimboId, validoAte),
    db
      .prepare(
        'UPDATE promocoes SET surpresa_restantes = surpresa_restantes - 1 WHERE id = ? AND surpresa_restantes IS NOT NULL',
      )
      .bind(escolhida.id),
  ]);
  return {
    parceiro: escolhida.parceiro,
    destaque: escolhida.destaque,
    titulo: escolhida.titulo,
    validoAte,
  };
}

/** O resultado de um carimbo já feito (a mesma chave a chegar outra vez). */
async function resultadoDe(c: C, carimboId: number): Promise<ResultadoDoCarimbo> {
  const db = c.env.DB;
  const x = await db
    .prepare(
      `SELECT x.id, x.cartao_id, x.criado_em, c.completo_em, c.usado_em FROM carimbos x
       JOIN cartoes c ON c.id = x.cartao_id WHERE x.id = ?`,
    )
    .bind(carimboId)
    .first<{ id: number; cartao_id: number; criado_em: number; completo_em: number | null }>();
  if (!x) recusar(404, 'nao_existe');
  const cartao = await db
    .prepare(
      `SELECT c.id, c.cliente_id, c.numero, c.objectivo, c.recompensa, c.iniciado_em, c.completo_em, c.usado_em,
       (SELECT count(*) FROM carimbos y WHERE y.cartao_id = c.id AND y.anulado_em IS NULL) AS carimbos
       FROM cartoes c WHERE c.id = ?`,
    )
    .bind(x.cartao_id)
    .first<LinhaCartao>();
  const completo = !!x.completo_em && x.completo_em >= x.criado_em;
  const cupao = await db
    .prepare(
      `SELECT pa.nome AS parceiro, p.destaque, p.titulo, k.valido_ate AS validoAte FROM cupoes k
       JOIN promocoes p ON p.id = k.promocao_id JOIN parceiros pa ON pa.id = k.parceiro_id WHERE k.carimbo_id = ?`,
    )
    .bind(x.id)
    .first<{ parceiro: string; destaque: string; titulo: string; validoAte: string }>();
  return {
    carimboId: x.id,
    cartao: cartaoPublico(cartao!),
    completo,
    recompensa: completo ? cartao!.recompensa : null,
    anulavelAte: x.criado_em + MINUTOS_PARA_ANULAR * 60,
    cupao: cupao ?? null,
  };
}

async function carimbar(
  c: C,
  cliente: LinhaCliente,
  p: Omit<z.output<typeof Carimbo>, 'codigo'>,
): Promise<ResultadoDoCarimbo> {
  const db = c.env.DB;
  const pessoa = c.get('pessoa');
  const repetida = await db
    .prepare('SELECT id FROM carimbos WHERE chave = ?')
    .bind(p.chave)
    .first<{ id: number }>();
  if (repetida) return resultadoDe(c, repetida.id);
  if (!(await c.env.CARIMBAR.limit({ key: `sessao:${pessoa.sessao}` }))?.success)
    recusar(429, 'muitas_tentativas');
  const lojaId = await lojaDe(c, p.lojaId);
  const programa = await lerPrograma(db);
  if (p.servicoId) {
    const s = await db
      .prepare('SELECT 1 FROM servicos WHERE id = ? AND activo = 1')
      .bind(p.servicoId)
      .first();
    if (!s) recusar(400, 'referencia');
  }
  const hoje = diaEmLisboa();
  let cartao = await cartaoActual(db, cliente.id);
  if (!cartao) {
    await novoCartao(db, cliente.id, 1, programa).run();
    cartao = (await cartaoActual(db, cliente.id))!;
  }
  const deHoje = await db
    .prepare(
      `SELECT x.criado_em AS quando, e.nome AS pessoa FROM carimbos x LEFT JOIN equipa e ON e.id = x.pessoa_id
       WHERE x.cliente_id = ? AND x.dia = ? AND x.anulado_em IS NULL ORDER BY x.criado_em DESC`,
    )
    .bind(cliente.id, hoje)
    .all<{ quando: number; pessoa: string | null }>();
  const repetido = deHoje.results.length >= programa.porDia;
  if (repetido && !p.confirmar)
    throw new HTTPException(409, {
      res: new Response(JSON.stringify({ erro: 'limite_do_dia', ultimo: deHoje.results[0] }), {
        status: 409,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
    });
  const completa = cartao.carimbos + 1 >= cartao.objectivo && !cartao.completo_em;
  const instrucoes = [
    db
      .prepare(
        `INSERT INTO carimbos (cartao_id, cliente_id, loja_id, pessoa_id, servico_id, chave, dia, repetido, sem_leitura)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, criado_em`,
      )
      .bind(
        cartao.id,
        cliente.id,
        lojaId,
        pessoa.id,
        programa.servicos ? (p.servicoId ?? null) : null,
        p.chave,
        hoje,
        repetido ? 1 : 0,
        p.semLeitura ? 1 : 0,
      ),
    db.prepare('UPDATE clientes SET visto_em = unixepoch() WHERE id = ?').bind(cliente.id),
  ];
  if (completa)
    instrucoes.push(
      db.prepare('UPDATE cartoes SET completo_em = unixepoch() WHERE id = ?').bind(cartao.id),
      novoCartao(db, cliente.id, cartao.numero + 1, programa),
    );
  let r: D1Result[];
  try {
    r = await db.batch(instrucoes);
  } catch (e) {
    // A mesma chave a chegar ao mesmo tempo por dois caminhos: conta uma.
    const outra = await db
      .prepare('SELECT id FROM carimbos WHERE chave = ?')
      .bind(p.chave)
      .first<{ id: number }>();
    if (outra) return resultadoDe(c, outra.id);
    traduzirErroDaBase(e);
  }
  const novo = r[0]!.results[0] as { id: number; criado_em: number };
  tocarPasse(c, cliente.id);
  const cupao = await sortearCupao(db, cliente.id, novo.id, hoje);
  return {
    carimboId: novo.id,
    cartao: {
      ...cartaoPublico(cartao),
      carimbos: cartao.carimbos + 1,
    },
    completo: completa,
    recompensa: completa ? cartao.recompensa : null,
    anulavelAte: novo.criado_em + MINUTOS_PARA_ANULAR * 60,
    cupao,
  };
}

rotasDaBalcao.post('/carimbar', async (c) => {
  exigirBarbearia(c);
  const { codigo, ...p } = await corpo(c, Carimbo);
  const cliente = await clientePorCodigo(c, codigo);
  return c.json(await carimbar(c, cliente, p));
});

/**
 * Anular: quem carimbou, nos 10 minutos seguintes; o dono sempre. Se o carimbo
 * completou um cartão cuja recompensa já foi entregue, já não se anula; e se o
 * cartão seguinte já tem carimbos, também não (ficavam dois cartões abertos).
 */
rotasDaBalcao.post('/anular', async (c) => {
  exigirBarbearia(c);
  const { carimboId } = await corpo(c, z.object({ carimboId: z.number().int().positive() }));
  const pessoa = c.get('pessoa');
  const db = c.env.DB;
  const x = await db
    .prepare(
      `SELECT x.id, x.pessoa_id, x.criado_em, x.anulado_em, x.cartao_id, c.cliente_id, c.numero, c.objectivo,
       c.completo_em, c.usado_em,
       (SELECT count(*) FROM carimbos y WHERE y.cartao_id = c.id AND y.anulado_em IS NULL) AS carimbos
       FROM carimbos x JOIN cartoes c ON c.id = x.cartao_id WHERE x.id = ?`,
    )
    .bind(carimboId)
    .first<{
      id: number;
      pessoa_id: number | null;
      criado_em: number;
      anulado_em: number | null;
      cartao_id: number;
      cliente_id: number;
      numero: number;
      objectivo: number;
      completo_em: number | null;
      usado_em: number | null;
      carimbos: number;
    }>();
  if (!x) recusar(404, 'nao_existe');
  if (x.anulado_em) recusar(409, 'ja_anulado');
  if (pessoa.papel !== 'dono') {
    if (x.pessoa_id !== pessoa.id) recusar(403, 'de_outra_pessoa');
    if (x.criado_em < agora() - MINUTOS_PARA_ANULAR * 60) recusar(409, 'tarde_para_anular');
  }
  const instrucoes = [
    db
      .prepare('UPDATE carimbos SET anulado_em = unixepoch(), anulado_por = ? WHERE id = ?')
      .bind(pessoa.id, x.id),
    // O cupão que saiu com este carimbo, se ainda não foi usado, volta ao saco.
    db
      .prepare(
        `UPDATE promocoes SET surpresa_restantes = surpresa_restantes + 1
         WHERE surpresa_restantes IS NOT NULL AND id IN (SELECT promocao_id FROM cupoes WHERE carimbo_id = ? AND usado_em IS NULL)`,
      )
      .bind(x.id),
    db.prepare('DELETE FROM cupoes WHERE carimbo_id = ? AND usado_em IS NULL').bind(x.id),
  ];
  if (x.completo_em && x.carimbos - 1 < x.objectivo) {
    if (x.usado_em) recusar(409, 'recompensa_usada');
    const seguinte = await db
      .prepare(
        `SELECT c.id, (SELECT count(*) FROM carimbos y WHERE y.cartao_id = c.id) AS carimbos
         FROM cartoes c WHERE c.cliente_id = ? AND c.numero = ?`,
      )
      .bind(x.cliente_id, x.numero + 1)
      .first<{ id: number; carimbos: number }>();
    if (seguinte && seguinte.carimbos > 0) recusar(409, 'cartao_seguinte');
    instrucoes.push(
      db.prepare('UPDATE cartoes SET completo_em = NULL WHERE id = ?').bind(x.cartao_id),
    );
    if (seguinte) instrucoes.push(db.prepare('DELETE FROM cartoes WHERE id = ?').bind(seguinte.id));
  }
  await db.batch(instrucoes);
  tocarPasse(c, x.cliente_id);
  return c.body(null, 204);
});

rotasDaBalcao.post('/usar-recompensa', async (c) => {
  exigirBarbearia(c);
  const { codigo, cartaoId, lojaId } = await corpo(
    c,
    z.object({
      codigo: z.string().min(1).max(20),
      cartaoId: z.number().int().positive(),
      lojaId: z.number().int().positive(),
    }),
  );
  const cliente = await clientePorCodigo(c, codigo);
  const loja = await lojaDe(c, lojaId);
  const usado = await c.env.DB.prepare(
    `UPDATE cartoes SET usado_em = unixepoch(), usado_loja_id = ?, usado_por = ?
     WHERE id = ? AND cliente_id = ? AND completo_em IS NOT NULL AND usado_em IS NULL RETURNING id`,
  )
    .bind(loja, c.get('pessoa').id, cartaoId, cliente.id)
    .first();
  if (!usado) recusar(409, 'recompensa_usada');
  tocarPasse(c, cliente.id);
  return c.json(await ficha(c, cliente));
});

/** Um cliente novo ao balcão: nome, email (para depois entrar na app), e o 1.º carimbo. */
rotasDaBalcao.post('/clientes', async (c) => {
  exigirBarbearia(c);
  const p = await corpo(
    c,
    z.object({
      nome: z.string().trim().min(1).max(LIMITES_DO_PROGRAMA.nomeDoCliente),
      email: z.string().trim().max(254).nullish(),
      carimbo: Carimbo.omit({ codigo: true, semLeitura: true, confirmar: true }).nullish(),
    }),
  );
  const db = c.env.DB;
  const email = p.email ? normalizarEmail(p.email) : null;
  if (p.email && !email) recusar(400, 'invalido');
  if (email) {
    const existe = await db
      .prepare(
        `SELECT 1 FROM identidades i JOIN clientes k ON k.id = i.cliente_id
         WHERE i.email = ? AND k.apagado_em IS NULL`,
      )
      .bind(email)
      .first();
    if (existe) recusar(409, 'email_ja_tem_cartao');
  }
  const programa = await lerPrograma(db);
  const codigo = await codigoNovo(db);
  const cliente = await db
    .prepare(
      'INSERT INTO clientes (codigo, nome, email) VALUES (?, ?, ?) RETURNING id, codigo, nome, criado_em, aniversario',
    )
    .bind(codigo, p.nome, email)
    .first<LinhaCliente>();
  if (!cliente) throw new Error('O cliente não nasceu');
  try {
    await db.batch([
      ...(email
        ? [
            db
              .prepare(
                "INSERT INTO identidades (cliente_id, tipo, sujeito, email, dona) VALUES (?, 'email', ?, ?, 0)",
              )
              .bind(cliente.id, email, email),
          ]
        : []),
      novoCartao(db, cliente.id, 1, programa),
    ]);
  } catch (e) {
    // Dois «novo cliente» ao mesmo tempo com o mesmo email: o segundo perde o
    // INSERT da identidade. A conta que acabou de nascer apaga-se e responde-se
    // como se o email já tivesse cartão (tem).
    if (!String(e).includes('UNIQUE constraint failed: identidades')) throw e;
    await db.prepare('DELETE FROM clientes WHERE id = ?').bind(cliente.id).run();
    recusar(409, 'email_ja_tem_cartao');
  }
  const carimbo = p.carimbo ? await carimbar(c, cliente, { ...p.carimbo, confirmar: true }) : null;
  return c.json({ ficha: await ficha(c, cliente), carimbo });
});

rotasDaBalcao.get('/clientes', async (c) => {
  exigirBarbearia(c);
  const q = (c.req.query('q') ?? '').trim();
  if (q.length < 2) return c.json([]);
  const padrao = `%${q.replace(/[%_]/g, '')}%`;
  const codigo = normalizarCodigo(q);
  const linhas = await c.env.DB.prepare(
    `SELECT k.id, k.codigo, k.nome, k.email,
       (SELECT objectivo FROM cartoes c WHERE c.cliente_id = k.id ORDER BY numero DESC LIMIT 1) AS objectivo,
       (SELECT count(*) FROM carimbos x WHERE x.cartao_id = (SELECT id FROM cartoes c WHERE c.cliente_id = k.id ORDER BY numero DESC LIMIT 1) AND x.anulado_em IS NULL) AS carimbos,
       (SELECT max(criado_em) FROM carimbos x WHERE x.cliente_id = k.id AND x.anulado_em IS NULL) AS ultimo
     FROM clientes k WHERE k.apagado_em IS NULL AND (k.nome LIKE ? OR k.email LIKE ? OR k.codigo LIKE ?)
     ORDER BY ultimo DESC NULLS LAST, k.nome LIMIT 20`,
  )
    .bind(padrao, padrao, `${codigo}%`)
    .all<ClienteProcurado & { objectivo: number | null }>();
  return c.json(linhas.results.map((l) => ({ ...l, objectivo: l.objectivo ?? 0 })));
});

/** As casas que esta pessoa vê: a dela, ou todas (o dono, ou um barbeiro sem casa fixa). */
function filtroDaCasa(c: C): number | null {
  const pessoa = c.get('pessoa');
  const pedida = Number(c.req.query('lojaId'));
  if (pessoa.papel === 'barbeiro' && pessoa.lojaId) return pessoa.lojaId;
  return Number.isInteger(pedida) && pedida > 0 ? pedida : null;
}

const ULTIMO = `SELECT x.id, x.criado_em AS quando, k.nome AS cliente, k.id AS clienteId, k.codigo,
    e.nome AS pessoa, l.nome AS loja, s.nome AS servico, c.objectivo,
    (SELECT count(*) FROM carimbos y WHERE y.cartao_id = c.id AND y.anulado_em IS NULL AND y.id <= x.id) AS carimbos,
    x.anulado_em, x.repetido,
    (c.completo_em IS NOT NULL AND x.id = (SELECT max(id) FROM carimbos z WHERE z.cartao_id = c.id AND z.anulado_em IS NULL)) AS recompensa
  FROM carimbos x JOIN clientes k ON k.id = x.cliente_id JOIN cartoes c ON c.id = x.cartao_id
  LEFT JOIN equipa e ON e.id = x.pessoa_id LEFT JOIN lojas l ON l.id = x.loja_id LEFT JOIN servicos s ON s.id = x.servico_id`;

type LinhaUltimo = Omit<UltimoCarimbo, 'anulado' | 'repetido' | 'recompensa'> & {
  anulado_em: number | null;
  repetido: number;
  recompensa: number;
};
const ultimoPublico = (u: LinhaUltimo): UltimoCarimbo => ({
  id: u.id,
  quando: u.quando,
  cliente: u.cliente,
  clienteId: u.clienteId,
  codigo: u.codigo,
  pessoa: u.pessoa,
  loja: u.loja,
  servico: u.servico,
  carimbos: u.carimbos,
  objectivo: u.objectivo,
  anulado: u.anulado_em !== null,
  repetido: u.repetido === 1,
  recompensa: u.recompensa === 1,
});

rotasDaBalcao.get('/hoje', async (c) => {
  exigirBarbearia(c);
  const db = c.env.DB;
  const hoje = diaEmLisboa();
  const loja = filtroDaCasa(c);
  const casa = loja ? 'AND x.loja_id = ?' : '';
  const args = loja ? [hoje, loja] : [hoje];
  const [n, novos, recompensas, ultimos] = await db.batch([
    db
      .prepare(
        `SELECT count(*) AS n FROM carimbos x WHERE x.dia = ? AND x.anulado_em IS NULL ${casa}`,
      )
      .bind(...args),
    db
      .prepare(
        `SELECT count(DISTINCT p.cliente_id) AS n FROM (SELECT x.cliente_id, min(x.dia) AS primeiro FROM carimbos x WHERE x.anulado_em IS NULL GROUP BY x.cliente_id) p
         JOIN carimbos x ON x.cliente_id = p.cliente_id AND x.dia = p.primeiro AND x.anulado_em IS NULL
         WHERE p.primeiro = ? ${casa}`,
      )
      .bind(...args),
    db
      .prepare(
        `SELECT count(*) AS n FROM cartoes x WHERE x.usado_em >= ? ${loja ? 'AND x.usado_loja_id = ?' : ''}`,
      )
      .bind(inicioDoDia(hoje), ...(loja ? [loja] : [])),
    db
      .prepare(`${ULTIMO} WHERE x.dia = ? ${casa} ORDER BY x.criado_em DESC LIMIT 30`)
      .bind(...args),
  ]);
  const r: HojeDaBalcao = {
    dia: hoje,
    carimbos: (n!.results[0] as { n: number }).n,
    novos: (novos!.results[0] as { n: number }).n,
    recompensas: (recompensas!.results[0] as { n: number }).n,
    ultimos: (ultimos!.results as LinhaUltimo[]).map(ultimoPublico),
  };
  return c.json(r);
});

/** Clientes em risco: sem visita há mais de 1,5× o intervalo habitual deles (no mínimo 14 dias), até 180. */
export function emRisco(
  linhas: { n: number; primeiro: number; ultimo: number }[],
  agoraS: number,
): number {
  let total = 0;
  for (const l of linhas) {
    if (l.n < 2) continue;
    const intervalo = (l.ultimo - l.primeiro) / (l.n - 1);
    const parado = agoraS - l.ultimo;
    if (parado > Math.max(1.5 * intervalo, 14 * 86400) && parado <= 180 * 86400) total++;
  }
  return total;
}

rotasDaBalcao.get('/resumo', async (c) => {
  exigirDono(c);
  const db = c.env.DB;
  const periodo =
    (['hoje', 'semana', 'mes'] as const).find((p) => p === c.req.query('periodo')) ?? 'hoje';
  const hoje = diaEmLisboa();
  const dias = periodo === 'hoje' ? 1 : periodo === 'semana' ? 7 : 30;
  const de = somarDias(hoje, -(dias - 1));
  const antesDe = somarDias(de, -dias);
  const antesAte = somarDias(de, -1);
  const loja = filtroDaCasa(c);
  const casa = loja ? 'AND x.loja_id = ?' : '';
  const l = loja ? [loja] : [];
  const [n, anterior, novos, recompensas, porLoja, porPessoa, visitas] = await db.batch([
    db
      .prepare(
        `SELECT count(*) AS n FROM carimbos x WHERE x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL ${casa}`,
      )
      .bind(de, hoje, ...l),
    db
      .prepare(
        `SELECT count(*) AS n FROM carimbos x WHERE x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL ${casa}`,
      )
      .bind(antesDe, antesAte, ...l),
    db
      .prepare(
        `SELECT count(DISTINCT p.cliente_id) AS n FROM (SELECT x.cliente_id, min(x.dia) AS primeiro FROM carimbos x WHERE x.anulado_em IS NULL GROUP BY x.cliente_id) p
         JOIN carimbos x ON x.cliente_id = p.cliente_id AND x.dia = p.primeiro AND x.anulado_em IS NULL
         WHERE p.primeiro BETWEEN ? AND ? ${casa}`,
      )
      .bind(de, hoje, ...l),
    db
      .prepare(
        `SELECT count(*) AS n FROM cartoes x WHERE x.usado_em >= ? ${loja ? 'AND x.usado_loja_id = ?' : ''}`,
      )
      .bind(inicioDoDia(de), ...l),
    db
      .prepare(
        `SELECT l.id, l.nome, count(x.id) AS n FROM lojas l
         LEFT JOIN carimbos x ON x.loja_id = l.id AND x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL
         GROUP BY l.id ORDER BY l.ordem, l.id`,
      )
      .bind(de, hoje),
    db
      .prepare(
        `SELECT e.id, e.nome, lj.nome AS loja, count(x.id) AS n, min(x.criado_em) AS primeiro, max(x.criado_em) AS ultimo
         FROM equipa e LEFT JOIN lojas lj ON lj.id = e.loja_id
         LEFT JOIN carimbos x ON x.pessoa_id = e.id AND x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL ${casa}
         WHERE e.removido_em IS NULL AND e.papel != 'parceiro' GROUP BY e.id ORDER BY n DESC, e.nome`,
      )
      .bind(de, hoje, ...l),
    db.prepare(
      'SELECT count(*) AS n, min(criado_em) AS primeiro, max(criado_em) AS ultimo FROM carimbos WHERE anulado_em IS NULL GROUP BY cliente_id',
    ),
  ]);
  const r: ResumoDaBalcao = {
    periodo,
    de,
    ate: hoje,
    carimbos: (n!.results[0] as { n: number }).n,
    anterior: (anterior!.results[0] as { n: number }).n,
    novos: (novos!.results[0] as { n: number }).n,
    recompensas: (recompensas!.results[0] as { n: number }).n,
    emRisco: emRisco(
      visitas!.results as { n: number; primeiro: number; ultimo: number }[],
      agora(),
    ),
    porLoja: porLoja!.results as ResumoDaBalcao['porLoja'],
    porPessoa: porPessoa!.results as ResumoDaBalcao['porPessoa'],
  };
  return c.json(r);
});

// ——— o parceiro: validar as vantagens ———

function exigirParceiro(c: C): number {
  const p = c.get('pessoa');
  if (p.papel !== 'parceiro' || !p.parceiroId) recusar(403, 'so_parceiro');
  return p.parceiroId;
}

async function clienteActivo(db: D1Database, clienteId: number): Promise<boolean> {
  const r = await db
    .prepare(
      'SELECT 1 FROM carimbos WHERE cliente_id = ? AND anulado_em IS NULL AND criado_em > unixepoch() - ? LIMIT 1',
    )
    .bind(clienteId, DIAS_DE_CLIENTE_ACTIVO * DIA)
    .first();
  return !!r;
}

/** As promoções deste parceiro que se validam e que valem hoje. */
function consultaDasVantagens(db: D1Database, parceiroId: number, hoje: string) {
  return db
    .prepare(
      `SELECT p.* FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id
       WHERE p.parceiro_id = ?1 AND pa.activo = 1 AND p.activa = 1 AND p.validar = 1
         AND (p.inicio IS NULL OR p.inicio <= ?2) AND (p.fim IS NULL OR p.fim >= ?2)
       ORDER BY p.ordem, p.id`,
    )
    .bind(parceiroId, hoje);
}

async function fichaDoParceiro(
  c: C,
  parceiroId: number,
  cliente: LinhaCliente,
): Promise<FichaDoParceiro> {
  const db = c.env.DB;
  const hoje = diaEmLisboa();
  const promos = (await consultaDasVantagens(db, parceiroId, hoje).all<LinhaPromocao>()).results;
  const activo = await clienteActivo(db, cliente.id);
  const contagens = promos.length
    ? await db.batch(
        promos.flatMap((p) => [
          db
            .prepare(
              'SELECT count(*) AS n FROM vales WHERE promocao_id = ? AND cliente_id = ? AND anulado_em IS NULL AND dia >= ?',
            )
            .bind(p.id, cliente.id, inicioDoPeriodo(p.periodo_do_limite, hoje)),
          db
            .prepare('SELECT count(*) AS n FROM vales WHERE promocao_id = ? AND anulado_em IS NULL')
            .bind(p.id),
        ]),
      )
    : [];
  const vantagens: VantagemDoParceiro[] = promos.map((p, i) => {
    const usadas = (contagens[i * 2]!.results[0] as { n: number }).n;
    const total = (contagens[i * 2 + 1]!.results[0] as { n: number }).n;
    return {
      id: p.id,
      destaque: p.destaque,
      titulo: p.titulo,
      detalhe: p.detalhe,
      limitePorCliente: p.limite_por_cliente,
      periodoDoLimite: p.periodo_do_limite,
      usadas,
      motivo: motivoDaVantagem(
        {
          limitePorCliente: p.limite_por_cliente,
          periodoDoLimite: p.periodo_do_limite,
          limiteTotal: p.limite_total,
          soClientesActivos: p.so_clientes_activos === 1,
        },
        { usadasNoPeriodo: usadas, usadasTotal: total, activo },
      ),
    };
  });
  const cupoes = (
    await db
      .prepare(
        `SELECT k.id AS cupaoId, k.valido_ate AS validoAte, p.id, p.destaque, p.titulo, p.detalhe FROM cupoes k
         JOIN promocoes p ON p.id = k.promocao_id
         WHERE k.cliente_id = ? AND k.parceiro_id = ? AND k.usado_em IS NULL AND k.valido_ate >= ? ORDER BY k.valido_ate`,
      )
      .bind(cliente.id, parceiroId, hoje)
      .all<{
        cupaoId: number;
        validoAte: string;
        id: number;
        destaque: string;
        titulo: string;
        detalhe: string;
      }>()
  ).results.map((k): VantagemDoParceiro => ({
    id: k.id,
    destaque: k.destaque,
    titulo: k.titulo,
    detalhe: k.detalhe,
    limitePorCliente: 1,
    periodoDoLimite: 'sempre',
    motivo: 'ok',
    usadas: 0,
    cupaoId: k.cupaoId,
    validoAte: k.validoAte,
  }));
  return {
    cliente: {
      id: cliente.id,
      codigo: cliente.codigo,
      nome: cliente.nome.trim().split(/\s+/)[0] ?? '',
      activo,
    },
    vantagens: [...cupoes, ...vantagens],
  };
}

rotasDaBalcao.get('/ficha-parceiro/:codigo', async (c) => {
  const parceiroId = exigirParceiro(c);
  const cliente = await clientePorCodigo(c, c.req.param('codigo'));
  return c.json(await fichaDoParceiro(c, parceiroId, cliente));
});

const VALE = `SELECT v.id, v.criado_em AS quando, v.promocao_id AS promocaoId, p.destaque, p.titulo,
    k.nome AS cliente, k.codigo, e.nome AS pessoa, v.anulado_em
  FROM vales v JOIN promocoes p ON p.id = v.promocao_id JOIN clientes k ON k.id = v.cliente_id
  LEFT JOIN equipa e ON e.id = v.pessoa_id`;
type LinhaVale = Omit<Vale, 'anulado'> & { anulado_em: number | null };
const valePublico = (v: LinhaVale): Vale => ({
  id: v.id,
  quando: v.quando,
  promocaoId: v.promocaoId,
  destaque: v.destaque,
  titulo: v.titulo,
  cliente: v.cliente.trim().split(/\s+/)[0] ?? '',
  codigo: v.codigo,
  pessoa: v.pessoa,
  anulado: v.anulado_em !== null,
});

/** Validar uma vantagem: idempotente pela chave; recusa com o motivo quando não pode. */
rotasDaBalcao.post('/validar', async (c) => {
  const parceiroId = exigirParceiro(c);
  const { codigo, promocaoId, chave, cupaoId } = await corpo(
    c,
    z.object({
      codigo: z.string().min(1).max(20),
      promocaoId: z.number().int().positive(),
      chave: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
      cupaoId: z.number().int().positive().optional(),
    }),
  );
  const db = c.env.DB;
  const pessoa = c.get('pessoa');
  const cliente = await clientePorCodigo(c, codigo);
  const repetido = await db.prepare(`${VALE} WHERE v.chave = ?`).bind(chave).first<LinhaVale>();
  if (repetido)
    return c.json({
      vale: valePublico(repetido),
      ficha: await fichaDoParceiro(c, parceiroId, cliente),
    });
  const ficha = await fichaDoParceiro(c, parceiroId, cliente);
  // Com cupaoId é o cupão (uma vez); sem ele, a vantagem permanente.
  const vantagem = ficha.vantagens.find((v) =>
    cupaoId ? v.cupaoId === cupaoId : v.id === promocaoId && !v.cupaoId,
  );
  if (!vantagem) recusar(cupaoId ? 409 : 400, cupaoId ? 'cupao_usado' : 'referencia');
  if (vantagem.motivo !== 'ok') recusar(409, vantagem.motivo);
  let novo: { id: number } | null = null;
  try {
    novo = await db
      .prepare(
        'INSERT INTO vales (promocao_id, parceiro_id, cliente_id, pessoa_id, chave, dia, cupao_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      )
      .bind(promocaoId, parceiroId, cliente.id, pessoa.id, chave, diaEmLisboa(), cupaoId ?? null)
      .first<{ id: number }>();
    if (cupaoId)
      await db
        .prepare(
          'UPDATE cupoes SET usado_em = unixepoch(), vale_id = ? WHERE id = ? AND usado_em IS NULL',
        )
        .bind(novo!.id, cupaoId)
        .run();
  } catch (e) {
    const outra = await db.prepare(`${VALE} WHERE v.chave = ?`).bind(chave).first<LinhaVale>();
    if (outra) return c.json({ vale: valePublico(outra), ficha });
    traduzirErroDaBase(e);
  }
  const vale = await db.prepare(`${VALE} WHERE v.id = ?`).bind(novo!.id).first<LinhaVale>();
  return c.json({ vale: valePublico(vale!), ficha: await fichaDoParceiro(c, parceiroId, cliente) });
});

/** Anular uma validação: quem a fez, nos 10 minutos seguintes. */
rotasDaBalcao.post('/anular-vale', async (c) => {
  exigirParceiro(c);
  const { valeId } = await corpo(c, z.object({ valeId: z.number().int().positive() }));
  const pessoa = c.get('pessoa');
  const v = await c.env.DB.prepare(
    'SELECT pessoa_id, criado_em, anulado_em FROM vales WHERE id = ? AND parceiro_id = ?',
  )
    .bind(valeId, pessoa.parceiroId)
    .first<{ pessoa_id: number | null; criado_em: number; anulado_em: number | null }>();
  if (!v) recusar(404, 'nao_existe');
  if (v.anulado_em) recusar(409, 'ja_anulado');
  if (v.pessoa_id !== pessoa.id) recusar(403, 'de_outra_pessoa');
  if (v.criado_em < agora() - MINUTOS_PARA_ANULAR * 60) recusar(409, 'tarde_para_anular');
  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE vales SET anulado_em = unixepoch(), anulado_por = ? WHERE id = ?',
    ).bind(pessoa.id, valeId),
    c.env.DB.prepare('UPDATE cupoes SET usado_em = NULL, vale_id = NULL WHERE vale_id = ?').bind(
      valeId,
    ),
  ]);
  return c.body(null, 204);
});

rotasDaBalcao.get('/hoje-parceiro', async (c) => {
  const parceiroId = exigirParceiro(c);
  const db = c.env.DB;
  const hoje = diaEmLisboa();
  const [n, ultimos] = await db.batch([
    db
      .prepare(
        'SELECT count(*) AS n FROM vales WHERE parceiro_id = ? AND dia = ? AND anulado_em IS NULL',
      )
      .bind(parceiroId, hoje),
    db
      .prepare(`${VALE} WHERE v.parceiro_id = ? AND v.dia = ? ORDER BY v.criado_em DESC LIMIT 30`)
      .bind(parceiroId, hoje),
  ]);
  const r: HojeDoParceiro = {
    dia: hoje,
    validacoes: (n!.results[0] as { n: number }).n,
    ultimos: (ultimos!.results as LinhaVale[]).map(valePublico),
  };
  return c.json(r);
});
