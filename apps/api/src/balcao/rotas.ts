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
  type UltimoCarimbo,
} from '@nunos-lab/dominio';
import type { Ambiente, C } from '../ambiente.ts';
import { fazAnosHoje, textoDeBusca } from '@nunos-lab/dominio';
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

/**
 * Um barbeiro não carimba nem entrega o prémio do PRÓPRIO cartão de cliente
 * (a conta de cliente com o email dele): é outro barbeiro que o faz. Pedido do
 * Renato a 29 out 2026.
 */
async function exigirCartaoDeOutro(c: C, clienteId: number) {
  const proprio = await c.env.DB.prepare(
    `SELECT 1 FROM equipa e WHERE e.id = ? AND e.email IS NOT NULL AND (
       EXISTS (SELECT 1 FROM identidades i WHERE i.cliente_id = ? AND i.email = e.email)
       OR EXISTS (SELECT 1 FROM clientes k WHERE k.id = ? AND k.email = e.email))`,
  )
    .bind(c.get('pessoa').id, clienteId, clienteId)
    .first();
  if (proprio) recusar(403, 'proprio_cartao');
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
  // A pessoa de demonstração (os revisores das lojas) só vê e carimba clientes de exemplo.
  const cliente = await c.env.DB.prepare(
    `SELECT id, codigo, nome, criado_em, aniversario FROM clientes WHERE codigo = ? AND apagado_em IS NULL${soExemplos(c, '')}`,
  )
    .bind(codigo)
    .first<LinhaCliente>();
  if (!cliente) recusar(404, 'cartao_desconhecido');
  return cliente;
}

/** Na sessão de demonstração, o pedaço de SQL que prende a consulta aos clientes de exemplo. */
function soExemplos(c: C, alias: string): string {
  if (!c.get('pessoa').demo) return '';
  return alias
    ? ` AND ${alias}.cliente_id IN (SELECT id FROM clientes WHERE exemplo = 1)`
    : ' AND exemplo = 1';
}

const VISITA = `SELECT x.id, x.criado_em AS quando, l.nome AS loja, e.nome AS pessoa
  FROM carimbos x LEFT JOIN lojas l ON l.id = x.loja_id LEFT JOIN equipa e ON e.id = x.pessoa_id`;

async function ficha(c: C, cliente: LinhaCliente): Promise<FichaDoBalcao> {
  const db = c.env.DB;
  const hoje = diaEmLisboa();
  let cartao = await cartaoActual(db, cliente.id);
  if (!cartao) {
    await novoCartao(db, cliente.id, 1, await lerPrograma(db)).run();
    cartao = (await cartaoActual(db, cliente.id))!;
  }
  const [cortes, recompensas, ultima, deHoje, entregue] = await db.batch([
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
    db
      .prepare(
        `SELECT c.usado_em AS quando, e.nome AS pessoa FROM cartoes c LEFT JOIN equipa e ON e.id = c.usado_por
         WHERE c.cliente_id = ? AND c.usado_em >= ? AND c.usado_em != c.completo_em ORDER BY c.usado_em DESC LIMIT 1`,
      )
      .bind(cliente.id, inicioDoDia(hoje)),
  ]);
  const hojeLinhas = deHoje!.results as { quando: number; pessoa: string | null }[];
  const entregueHoje =
    (entregue!.results[0] as { quando: number; pessoa: string | null } | undefined) ?? null;
  const fazAnos = fazAnosHoje(cliente.aniversario, hoje);
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
    hoje: { carimbos: hojeLinhas.length, ultimo: hojeLinhas[0] ?? null, entregue: entregueHoje },
  };
}

/** O cartão a seguir a um cheio. Dois pedidos ao mesmo tempo: o UNIQUE (cliente, número) deixa passar um, e o outro lê-o. */
async function abrirCartaoSeguinte(
  db: D1Database,
  clienteId: number,
  cheio: LinhaCartao,
  programa: Programa,
): Promise<LinhaCartao> {
  try {
    await novoCartao(db, clienteId, cheio.numero + 1, programa).run();
  } catch (e) {
    if (!String(e).includes('UNIQUE constraint failed: cartoes')) throw e;
  }
  return (await cartaoActual(db, clienteId))!;
}

rotasDaBalcao.get('/eu', async (c) => {
  const pessoa = c.get('pessoa');
  const db = c.env.DB;
  const [lojas, parceiro] = await db.batch([
    db.prepare('SELECT id, nome, morada, telefone, marcar, ordem FROM lojas ORDER BY ordem, id'),
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
    programa: await lerPrograma(db),
    parceiro: (parceiro!.results[0] as { id: number; nome: string } | undefined) ?? null,
  };
  return c.json(eu);
});

/** Sair deste aparelho: a sessão termina no servidor (a app apaga o testemunho). */
rotasDaBalcao.post('/sair', async (c) => {
  await c.env.DB.prepare(
    'UPDATE sessoes_da_equipa SET revogada_em = unixepoch() WHERE id = ? AND revogada_em IS NULL',
  )
    .bind(c.get('pessoa').sessao)
    .run();
  return c.body(null, 204);
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
  /** Já viu o aviso do limite do dia e quer carimbar na mesma. */
  confirmar: z.boolean().optional(),
  /** Procurado por nome, sem ler o QR. */
  semLeitura: z.boolean().optional(),
  /** O instante em que foi dado, quando vem da fila sem rede (conta nesse dia). */
  quando: z.number().int().positive().optional(),
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
  // O saco desce primeiro, e só se ainda havia: dois carimbos ao mesmo segundo
  // no último cupão dão um cupão e um «sem cupão», não um erro.
  if (escolhida.surpresa_restantes !== null) {
    const desceu = await db
      .prepare(
        'UPDATE promocoes SET surpresa_restantes = surpresa_restantes - 1 WHERE id = ? AND surpresa_restantes > 0',
      )
      .bind(escolhida.id)
      .run();
    if (!desceu.meta.changes) return null;
  }
  await db
    .prepare(
      'INSERT INTO cupoes (promocao_id, parceiro_id, cliente_id, carimbo_id, valido_ate) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(escolhida.id, escolhida.parceiro_id, clienteId, carimboId, validoAte)
    .run();
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
      `SELECT x.id, x.cartao_id, x.criado_em, c.completo_em, c.usado_em,
       (SELECT max(y.id) FROM carimbos y WHERE y.cartao_id = x.cartao_id AND y.anulado_em IS NULL) AS ultimo_id
       FROM carimbos x JOIN cartoes c ON c.id = x.cartao_id WHERE x.id = ?`,
    )
    .bind(carimboId)
    .first<{
      id: number;
      cartao_id: number;
      criado_em: number;
      completo_em: number | null;
      ultimo_id: number | null;
    }>();
  if (!x) recusar(404, 'nao_existe');
  const cartao = await db
    .prepare(
      `SELECT c.id, c.cliente_id, c.numero, c.objectivo, c.recompensa, c.iniciado_em, c.completo_em, c.usado_em,
       (SELECT count(*) FROM carimbos y WHERE y.cartao_id = c.id AND y.anulado_em IS NULL) AS carimbos
       FROM cartoes c WHERE c.id = ?`,
    )
    .bind(x.cartao_id)
    .first<LinhaCartao>();
  // Só o carimbo que completou o cartão (o último) é «completo»: uma chave antiga reenviada não festeja um prémio.
  const completo = !!x.completo_em && x.id === x.ultimo_id;
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
    .prepare('SELECT id, cliente_id FROM carimbos WHERE chave = ?')
    .bind(p.chave)
    .first<{ id: number; cliente_id: number }>();
  if (repetida) {
    // A mesma chave noutro cliente é um erro da app: nunca o carimbo do outro.
    if (repetida.cliente_id !== cliente.id) recusar(409, 'repetido');
    return resultadoDe(c, repetida.id);
  }
  if (!(await c.env.CARIMBAR.limit({ key: `sessao:${pessoa.sessao}` }))?.success)
    recusar(429, 'muitas_tentativas');
  const lojaId = await lojaDe(c, p.lojaId);
  await exigirCartaoDeOutro(c, cliente.id);
  const programa = await lerPrograma(db);
  // Um carimbo que vem da fila sem rede traz o instante em que foi dado (até 7 dias): conta nesse dia.
  const quando =
    p.quando && p.quando >= agora() - 7 * DIA && p.quando <= agora() + 60 ? p.quando : null;
  const hoje = quando ? diaEmLisboa(quando * 1000) : diaEmLisboa();
  let cartao = await cartaoActual(db, cliente.id);
  if (!cartao) {
    await novoCartao(db, cliente.id, 1, programa).run();
    cartao = (await cartaoActual(db, cliente.id))!;
  } else if (cartao.completo_em) {
    // O cartão cheio fica cheio até o prémio ser entregue ou até este carimbo:
    // o cliente veio pagar um corte, nasce o seguinte (e o prémio fica por usar).
    cartao = await abrirCartaoSeguinte(db, cliente.id, cartao, programa);
  }
  // Um prémio entregue hoje à parte («Entregar», os cartões de antes da regra do
  // 10.º): o corte grátis não leva carimbo, e carimbar pede confirmação.
  const entregueHoje = await db
    .prepare(
      `SELECT c.usado_em AS quando, e.nome AS pessoa FROM cartoes c LEFT JOIN equipa e ON e.id = c.usado_por
       WHERE c.cliente_id = ? AND c.usado_em >= ? AND c.usado_em != c.completo_em ORDER BY c.usado_em DESC LIMIT 1`,
    )
    .bind(cliente.id, inicioDoDia(hoje))
    .first<{ quando: number; pessoa: string | null }>();
  if (entregueHoje && !p.confirmar)
    throw new HTTPException(409, {
      res: new Response(JSON.stringify({ erro: 'entregue_hoje', ultimo: entregueHoje }), {
        status: 409,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
    });
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
        `INSERT INTO carimbos (cartao_id, cliente_id, loja_id, pessoa_id, chave, dia, repetido, sem_leitura, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, coalesce(?, unixepoch())) RETURNING id, criado_em`,
      )
      .bind(
        cartao.id,
        cliente.id,
        lojaId,
        pessoa.id,
        p.chave,
        hoje,
        repetido || entregueHoje ? 1 : 0,
        p.semLeitura ? 1 : 0,
        quando,
      ),
    db.prepare('UPDATE clientes SET visto_em = unixepoch() WHERE id = ?').bind(cliente.id),
  ];
  // O 10.º corte é a oferta: o carimbo que completa o cartão entrega o prémio
  // nesse mesmo acto (completo e usado ao mesmo segundo). O cartão fica cheio
  // à vista até ao carimbo seguinte, que abre o próximo.
  if (completa)
    instrucoes.push(
      db
        .prepare(
          'UPDATE cartoes SET completo_em = unixepoch(), usado_em = unixepoch(), usado_loja_id = ?, usado_por = ? WHERE id = ?',
        )
        .bind(lojaId, pessoa.id, cartao.id),
    );
  let r: D1Result[];
  try {
    r = await db.batch(instrucoes);
  } catch (e) {
    // A mesma chave a chegar ao mesmo tempo por dois caminhos: conta uma.
    const outra = await db
      .prepare('SELECT id FROM carimbos WHERE chave = ? AND cliente_id = ?')
      .bind(p.chave, cliente.id)
      .first<{ id: number }>();
    if (outra) return resultadoDe(c, outra.id);
    traduzirErroDaBase(e);
  }
  const novo = r[0]!.results[0] as { id: number; criado_em: number };
  tocarPasse(c, cliente.id);
  // O cupão é um extra: um erro no sorteio nunca falha um carimbo já gravado.
  const cupao = await sortearCupao(db, cliente.id, novo.id, hoje).catch((e) => {
    console.error('cupao', e);
    return null;
  });
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
       (SELECT count(*) FROM carimbos y WHERE y.cartao_id = c.id AND y.anulado_em IS NULL) AS carimbos,
       (SELECT max(y.id) FROM carimbos y WHERE y.cartao_id = c.id AND y.anulado_em IS NULL) AS ultimo_id
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
      ultimo_id: number | null;
    }>();
  if (!x) recusar(404, 'nao_existe');
  if (x.anulado_em) recusar(409, 'ja_anulado');
  if (pessoa.papel !== 'dono' || pessoa.demo) {
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
    // Entregue à parte («Entregar»), já não se anula; entregue pelo próprio 10.º carimbo, anula-se com ele.
    if (x.usado_em && x.usado_em !== x.completo_em) recusar(409, 'recompensa_usada');
    // E só o próprio 10.º: anular um carimbo anterior deixava o corte grátis dado
    // e o cartão por completar outra vez — um segundo corte grátis por oito pagos.
    if (x.usado_em && x.id !== x.ultimo_id) recusar(409, 'recompensa_usada');
    const seguinte = await db
      .prepare(
        `SELECT c.id, (SELECT count(*) FROM carimbos y WHERE y.cartao_id = c.id AND y.anulado_em IS NULL) AS carimbos
         FROM cartoes c WHERE c.cliente_id = ? AND c.numero = ?`,
      )
      .bind(x.cliente_id, x.numero + 1)
      .first<{ id: number; carimbos: number }>();
    if (seguinte && seguinte.carimbos > 0) recusar(409, 'cartao_seguinte');
    instrucoes.push(
      db
        .prepare(
          'UPDATE cartoes SET completo_em = NULL, usado_em = NULL, usado_loja_id = NULL, usado_por = NULL WHERE id = ?',
        )
        .bind(x.cartao_id),
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
  await exigirCartaoDeOutro(c, cliente.id);
  const loja = await lojaDe(c, lojaId);
  const usado = await c.env.DB.prepare(
    `UPDATE cartoes SET usado_em = unixepoch(), usado_loja_id = ?, usado_por = ?
     WHERE id = ? AND cliente_id = ? AND completo_em IS NOT NULL AND usado_em IS NULL RETURNING id`,
  )
    .bind(loja, c.get('pessoa').id, cartaoId, cliente.id)
    .first();
  if (!usado) recusar(409, 'recompensa_usada');
  // Entregue o prémio do cartão mais recente, nasce o seguinte: o cliente volta a ver um cartão a zeros.
  const actual = await cartaoActual(c.env.DB, cliente.id);
  if (actual && actual.id === cartaoId)
    await abrirCartaoSeguinte(c.env.DB, cliente.id, actual, await lerPrograma(c.env.DB));
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
  if (email && p.carimbo) {
    const proprio = await db
      .prepare('SELECT 1 FROM equipa WHERE id = ? AND email = ?')
      .bind(c.get('pessoa').id, email)
      .first();
    if (proprio) recusar(403, 'proprio_cartao');
  }
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
  if (p.carimbo) {
    // A mesma submissão outra vez (dois toques, a rede a cair depois de gravar): a
    // ficha que já nasceu com essa chave, e não um segundo cliente.
    const repetida = await db
      .prepare('SELECT id, cliente_id FROM carimbos WHERE chave = ?')
      .bind(p.carimbo.chave)
      .first<{ id: number; cliente_id: number }>();
    if (repetida) {
      const jaCriado = await db
        .prepare(
          'SELECT id, codigo, nome, criado_em, aniversario FROM clientes WHERE id = ? AND apagado_em IS NULL',
        )
        .bind(repetida.cliente_id)
        .first<LinhaCliente>();
      if (jaCriado)
        return c.json({
          ficha: await ficha(c, jaCriado),
          carimbo: await resultadoDe(c, repetida.id),
        });
    }
    // A casa confere-se antes de o cliente nascer: uma recusa aqui não deixa um cliente sem carimbo.
    await lojaDe(c, p.carimbo.lojaId);
  }
  const programa = await lerPrograma(db);
  const codigo = await codigoNovo(db);
  const cliente = await db
    .prepare(
      'INSERT INTO clientes (codigo, nome, email, busca, exemplo) VALUES (?, ?, ?, ?, ?) RETURNING id, codigo, nome, criado_em, aniversario',
    )
    .bind(codigo, p.nome, email, textoDeBusca(p.nome), c.get('pessoa').demo ? 1 : 0)
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
  let carimbo: ResultadoDoCarimbo | null = null;
  if (p.carimbo) {
    try {
      carimbo = await carimbar(c, cliente, { ...p.carimbo, confirmar: true });
    } catch (e) {
      // Dois «cliente novo» com a mesma chave AO MESMO TEMPO: os dois nasceram antes
      // de se verem; o carimbo do segundo bate na chave do primeiro. O segundo
      // cliente (sem carimbo) sai, e responde-se com a ficha do primeiro.
      const outra = await db
        .prepare('SELECT id, cliente_id FROM carimbos WHERE chave = ?')
        .bind(p.carimbo.chave)
        .first<{ id: number; cliente_id: number }>();
      if (!outra || outra.cliente_id === cliente.id) throw e;
      await db.prepare('DELETE FROM clientes WHERE id = ?').bind(cliente.id).run();
      const primeiro = await db
        .prepare('SELECT id, codigo, nome, criado_em, aniversario FROM clientes WHERE id = ?')
        .bind(outra.cliente_id)
        .first<LinhaCliente>();
      if (!primeiro) throw e;
      return c.json({ ficha: await ficha(c, primeiro), carimbo: await resultadoDe(c, outra.id) });
    }
  }
  return c.json({ ficha: await ficha(c, cliente), carimbo });
});

rotasDaBalcao.get('/clientes', async (c) => {
  exigirBarbearia(c);
  // O D1 recusa padrões LIKE com mais de 50 caracteres: um nome tem no máximo 40.
  const q = (c.req.query('q') ?? '').trim().slice(0, 40);
  if (q.length < 2) return c.json([]);
  const padrao = `%${q.replace(/[%_]/g, '')}%`;
  const busca = `%${textoDeBusca(q.replace(/[%_]/g, ''))}%`;
  const codigo = normalizarCodigo(q);
  const linhas = await c.env.DB.prepare(
    `SELECT k.id, k.codigo, k.nome, k.email,
       (SELECT objectivo FROM cartoes c WHERE c.cliente_id = k.id ORDER BY numero DESC LIMIT 1) AS objectivo,
       (SELECT count(*) FROM carimbos x WHERE x.cartao_id = (SELECT id FROM cartoes c WHERE c.cliente_id = k.id ORDER BY numero DESC LIMIT 1) AND x.anulado_em IS NULL) AS carimbos,
       (SELECT max(criado_em) FROM carimbos x WHERE x.cliente_id = k.id AND x.anulado_em IS NULL) AS ultimo
     FROM clientes k WHERE k.apagado_em IS NULL${soExemplos(c, '')} AND (k.nome LIKE ? OR k.busca LIKE ? OR k.email LIKE ? OR k.codigo LIKE ?)
     ORDER BY ultimo DESC NULLS LAST, k.nome LIMIT 20`,
  )
    .bind(padrao, busca, padrao, codigo ? `${codigo}%` : '')
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
    e.nome AS pessoa, x.pessoa_id AS pessoaId, l.nome AS loja, c.objectivo,
    (SELECT count(*) FROM carimbos y WHERE y.cartao_id = c.id AND y.anulado_em IS NULL AND y.id <= x.id) AS carimbos,
    x.anulado_em, x.repetido,
    (c.completo_em IS NOT NULL AND x.id = (SELECT max(id) FROM carimbos z WHERE z.cartao_id = c.id AND z.anulado_em IS NULL)) AS recompensa
  FROM carimbos x JOIN clientes k ON k.id = x.cliente_id JOIN cartoes c ON c.id = x.cartao_id
  LEFT JOIN equipa e ON e.id = x.pessoa_id LEFT JOIN lojas l ON l.id = x.loja_id`;

type LinhaUltimo = Omit<UltimoCarimbo, 'anulado' | 'repetido' | 'recompensa' | 'anulavelAte'> & {
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
  pessoaId: u.pessoaId,
  anulavelAte: u.quando + MINUTOS_PARA_ANULAR * 60,
  loja: u.loja,
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
  const casa = (loja ? 'AND x.loja_id = ?' : '') + soExemplos(c, 'x');
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
        `SELECT count(*) AS n FROM cartoes x WHERE x.usado_em >= ? ${loja ? 'AND x.usado_loja_id = ?' : ''}${soExemplos(c, 'x')}`,
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
  const casa = (loja ? 'AND x.loja_id = ?' : '') + soExemplos(c, 'x');
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
        `SELECT count(*) AS n FROM cartoes x WHERE x.usado_em >= ? ${loja ? 'AND x.usado_loja_id = ?' : ''}${soExemplos(c, 'x')}`,
      )
      .bind(inicioDoDia(de), ...l),
    db
      .prepare(
        `SELECT l.id, l.nome, count(x.id) AS n FROM lojas l
         LEFT JOIN carimbos x ON x.loja_id = l.id AND x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL${soExemplos(c, 'x')}
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
      `SELECT count(*) AS n, min(x.criado_em) AS primeiro, max(x.criado_em) AS ultimo FROM carimbos x WHERE x.anulado_em IS NULL${soExemplos(c, 'x')} GROUP BY x.cliente_id`,
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
    k.nome AS cliente, k.codigo, e.nome AS pessoa, v.anulado_em, v.parceiro_id, v.cliente_id
  FROM vales v JOIN promocoes p ON p.id = v.promocao_id JOIN clientes k ON k.id = v.cliente_id
  LEFT JOIN equipa e ON e.id = v.pessoa_id`;
type LinhaVale = Omit<Vale, 'anulado'> & {
  anulado_em: number | null;
  parceiro_id: number;
  cliente_id: number;
};
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
  if (repetido) {
    // A mesma chave noutro parceiro ou noutro cliente é um erro da app: nunca o vale do outro.
    if (repetido.parceiro_id !== parceiroId || repetido.cliente_id !== cliente.id)
      recusar(409, 'repetido');
    return c.json({
      vale: valePublico(repetido),
      ficha: await fichaDoParceiro(c, parceiroId, cliente),
    });
  }
  const ficha = await fichaDoParceiro(c, parceiroId, cliente);
  // Com cupaoId é o cupão (uma vez); sem ele, a vantagem permanente.
  const vantagem = ficha.vantagens.find((v) =>
    cupaoId ? v.cupaoId === cupaoId : v.id === promocaoId && !v.cupaoId,
  );
  if (!vantagem) recusar(cupaoId ? 409 : 400, cupaoId ? 'cupao_usado' : 'referencia');
  // Com cupão, a promoção é a do cupão: o pedido não a escolhe.
  if (cupaoId && promocaoId !== vantagem.id) recusar(400, 'referencia');
  if (vantagem.motivo !== 'ok') recusar(409, vantagem.motivo);
  let novo: { id: number } | null = null;
  try {
    const r = await db.batch([
      db
        .prepare(
          'INSERT INTO vales (promocao_id, parceiro_id, cliente_id, pessoa_id, chave, dia, cupao_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
        )
        .bind(
          vantagem.id,
          parceiroId,
          cliente.id,
          pessoa.id,
          chave,
          diaEmLisboa(),
          cupaoId ?? null,
        ),
      ...(cupaoId
        ? [
            db
              .prepare(
                'UPDATE cupoes SET usado_em = unixepoch(), vale_id = (SELECT id FROM vales WHERE chave = ?) WHERE id = ? AND usado_em IS NULL',
              )
              .bind(chave, cupaoId),
          ]
        : []),
    ]);
    novo = r[0]!.results[0] as { id: number };
    // O cupão já tinha sido gasto por outro pedido ao mesmo tempo: o vale acabado de nascer sai.
    if (cupaoId && !r[1]!.meta.changes) {
      await db.prepare('DELETE FROM vales WHERE id = ?').bind(novo.id).run();
      recusar(409, 'cupao_usado');
    }
  } catch (e) {
    if (e instanceof HTTPException) throw e;
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
