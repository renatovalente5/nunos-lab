/**
 * A carteira do cliente (o Renato, 10 nov 2026): o saldo e os movimentos, o código para convidar, quem
 * convidou e quem já foi à barbearia; e aceitar o código de quem o convidou (só antes do primeiro corte).
 */
import {
  codigoDoConviteEscrito,
  codigoValido,
  diaEmLisboa,
  nomeCurto,
  type CarteiraDoCliente,
  type ConviteFeito,
} from '@nunos-lab/dominio';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Ambiente, C } from '../ambiente.ts';
import { inicioDoDia } from '../programa.ts';
import {
  codigoDoConvite,
  consultaDoSaldo,
  consultaDosMovimentos,
  lerConvites,
  marcasDoCliente,
  movimentoPublico,
  saldoDe,
  temMarcaApagada,
  type LinhaDoMovimento,
} from '../saldo.ts';
import { corpo, recusar } from '../util.ts';

export const rotasDaCarteira = new Hono<Ambiente>();

async function lerCarteira(c: C): Promise<CarteiraDoCliente> {
  const { id } = c.get('cliente');
  const db = c.env.DB;
  const convites = await lerConvites(db);
  // O código faz-se na primeira vez (com os convites desligados não se mostra nem se faz).
  const codigo = convites.ligado ? await codigoDoConvite(db, id) : null;
  const [saldo, movimentos, feitos, recebido, cortes] = await db.batch([
    consultaDoSaldo(db, id),
    consultaDosMovimentos(db, id),
    db
      .prepare(
        `SELECT k.nome, v.criado_em, v.visitou_em, v.premio_padrinho
         FROM convites v JOIN clientes k ON k.id = v.convidado_id
         WHERE v.padrinho_id = ? ORDER BY v.criado_em DESC, v.id DESC`,
      )
      .bind(id),
    db
      .prepare(
        `SELECT k.nome, v.criado_em, v.premio_convidado
         FROM convites v JOIN clientes k ON k.id = v.padrinho_id WHERE v.convidado_id = ?`,
      )
      .bind(id),
    // Algum carimbo, mesmo anulado: o código de convite é só para quem nunca teve nenhum.
    db.prepare('SELECT count(*) AS n FROM carimbos WHERE cliente_id = ?').bind(id),
  ]);
  // Quem convida vê do convidado o nome curto e se já foi: o dia, não a hora (a privacidade diz isto).
  const doDia = (t: number) => inicioDoDia(diaEmLisboa(t * 1000));
  const lista: ConviteFeito[] = (
    feitos!.results as {
      nome: string;
      criado_em: number;
      visitou_em: number | null;
      premio_padrinho: number;
    }[]
  ).map((v) => ({
    // Quem convida vê do convidado só o nome curto e se já foi (a privacidade diz isto mesmo).
    nome: nomeCurto(v.nome),
    criadoEm: doDia(v.criado_em),
    visitouEm: v.visitou_em === null ? null : doDia(v.visitou_em),
    premio: v.premio_padrinho,
  }));
  const por = recebido!.results[0] as
    { nome: string; criado_em: number; premio_convidado: number } | undefined;
  return {
    saldo: saldoDe(saldo!),
    convites: {
      ...convites,
      codigo,
      aceites: lista.length,
      visitaram: lista.filter((v) => v.visitouEm !== null).length,
      lista,
    },
    convidadoPor: por
      ? { nome: nomeCurto(por.nome), premio: por.premio_convidado, criadoEm: por.criado_em }
      : null,
    // Ainda sem convite e sem carimbo nenhum, e sem ser quem apagou a conta e voltou (as marcas).
    podeUsarCodigo:
      convites.ligado &&
      !por &&
      (cortes!.results[0] as { n: number }).n === 0 &&
      !(await temMarcaApagada(db, await marcasDoCliente(db, c.env.WALLET_SEGREDO, id))),
    movimentos: (movimentos!.results as LinhaDoMovimento[]).map((m) => movimentoPublico(m)),
  };
}

rotasDaCarteira.get('/carteira', async (c) => c.json(await lerCarteira(c)));

/**
 * Aceitar o convite de outro cliente: com os convites ligados, antes do primeiro corte, uma vez, e só
 * enquanto quem convida couber no limite. O prémio do convidado entra logo, no mesmo batch; o de quem
 * convida fica escrito no convite e entra com o primeiro carimbo (balcao/rotas.ts).
 */
rotasDaCarteira.post('/convite', async (c) => {
  // Contra quem experimenta códigos ao calhas: a mesma trava de entrar.
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  if (!(await c.env.TRAVAO.limit({ key: `convite:${ip}` }))?.success)
    recusar(429, 'muitas_tentativas');
  const { codigo: escrito } = await corpo(
    c,
    // A ligação inteira colada também serve (tem uns 60 caracteres).
    z.object({ codigo: z.string().trim().min(1).max(500) }),
  );
  // A conta de demonstração (a das lojas) não aceita convites: pagava a um cliente a sério.
  if (c.get('cliente').demo) recusar(403, 'demonstracao');
  const { id } = c.get('cliente');
  const db = c.env.DB;
  const convites = await lerConvites(db);
  if (!convites.ligado) recusar(409, 'convites_desligados');
  const codigo = codigoDoConviteEscrito(escrito);
  if (!codigoValido(codigo)) recusar(404, 'convite_desconhecido');
  const padrinho = await db
    .prepare(
      'SELECT id FROM clientes WHERE codigo_convite = ? AND apagado_em IS NULL AND exemplo = 0',
    )
    .bind(codigo)
    .first<{ id: number }>();
  if (!padrinho) recusar(404, 'convite_desconhecido');
  if (padrinho.id === id) recusar(409, 'convite_proprio');
  // Quem já teve conta (cortou ou foi convidado), apagou-a e voltou com a mesma Apple ou Google: não é
  // novo (as marcas guardadas ao apagar; 11 nov 2026).
  if (await temMarcaApagada(db, await marcasDoCliente(db, c.env.WALLET_SEGREDO, id)))
    recusar(409, 'conta_ja_usada');
  await recusarSeNaoPode(db, id, padrinho.id, convites.limite);
  // As mesmas regras outra vez dentro do INSERT: dois pedidos ao mesmo tempo (ou um carimbo a chegar
  // entretanto) não passam as duas. O prémio do convidado entra só se o convite entrou.
  let r: D1Result[];
  try {
    r = await db.batch([
      db
        .prepare(
          `INSERT INTO convites (padrinho_id, convidado_id, premio_convidado, premio_padrinho)
           SELECT ?1, ?2, ?3, ?4
           WHERE NOT EXISTS (SELECT 1 FROM carimbos WHERE cliente_id = ?2)
             AND (?5 IS NULL OR (SELECT count(*) FROM convites WHERE padrinho_id = ?1) < ?5)
             AND NOT EXISTS (SELECT 1 FROM convites WHERE padrinho_id = ?2 AND convidado_id = ?1)
             AND EXISTS (SELECT 1 FROM clientes WHERE id = ?1 AND apagado_em IS NULL AND exemplo = 0)
             AND EXISTS (SELECT 1 FROM clientes WHERE id = ?2 AND exemplo = 0)
             AND ?1 < ?2
           RETURNING id`,
        )
        .bind(padrinho.id, id, convites.valorConvidado, convites.valorPadrinho, convites.limite),
      db
        .prepare(
          `INSERT INTO movimentos_de_saldo (cliente_id, valor, tipo, convite_id)
           SELECT v.convidado_id, v.premio_convidado, 'convidado', v.id FROM convites v
           WHERE v.convidado_id = ?1 AND v.premio_convidado > 0
             AND NOT EXISTS (SELECT 1 FROM movimentos_de_saldo m WHERE m.convite_id = v.id AND m.tipo = 'convidado')`,
        )
        .bind(id),
    ]);
  } catch (e) {
    // O mesmo cliente aceite duas vezes ao mesmo tempo: a UNIQUE (convidado) deixa passar um.
    if (String(e).includes('UNIQUE constraint failed')) recusar(409, 'ja_convidado');
    throw e;
  }
  if (!r[0]!.results.length) {
    // Alguma regra mudou entre a verificação e o INSERT: diz-se qual.
    await recusarSeNaoPode(db, id, padrinho.id, convites.limite);
    recusar(404, 'convite_desconhecido');
  }
  return c.json(await lerCarteira(c));
});

/** As recusas de aceitar um convite, pela ordem em que se dizem à pessoa. */
async function recusarSeNaoPode(
  db: D1Database,
  id: number,
  padrinhoId: number,
  limite: number | null,
): Promise<void> {
  const [ja, cortes, aceites, reciproco, padrinho] = await db.batch([
    db.prepare('SELECT 1 FROM convites WHERE convidado_id = ?').bind(id),
    // Algum carimbo, mesmo anulado: carimbar e anular não faz de ninguém um «novo».
    db.prepare('SELECT count(*) AS n FROM carimbos WHERE cliente_id = ?').bind(id),
    db.prepare('SELECT count(*) AS n FROM convites WHERE padrinho_id = ?').bind(padrinhoId),
    // Dois amigos não se convidam um ao outro: ganhavam os dois prémios dos dois lados.
    db
      .prepare('SELECT 1 FROM convites WHERE padrinho_id = ? AND convidado_id = ?')
      .bind(id, padrinhoId),
    db
      .prepare('SELECT 1 FROM clientes WHERE id = ? AND apagado_em IS NULL AND exemplo = 0')
      .bind(padrinhoId),
  ]);
  if (!padrinho!.results.length) recusar(404, 'convite_desconhecido');
  if (ja!.results.length) recusar(409, 'ja_convidado');
  if ((cortes!.results[0] as { n: number }).n > 0) recusar(409, 'ja_cortou');
  if (reciproco!.results.length) recusar(409, 'convite_reciproco');
  // Quem convida já cá estava: a conta de quem aceita é mais recente. Sem isto, três contas novas
  // convidavam-se em roda (A→B→C→A) e cada uma ganhava dos dois lados.
  if (padrinhoId > id) recusar(409, 'convite_mais_recente');
  if (limite !== null && (aceites!.results[0] as { n: number }).n >= limite)
    recusar(409, 'convites_esgotados');
}
