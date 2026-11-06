/**
 * Anular um carimbo: a regra é uma só, na Balcão e no backoffice. Quem carimbou
 * anula nos 10 minutos seguintes; o dono (e o backoffice) sempre. Se o carimbo
 * completou um cartão cuja recompensa já foi entregue à parte, já não se anula;
 * e se o cartão seguinte já tem carimbos, também não (ficavam dois abertos).
 */
import { MINUTOS_PARA_ANULAR } from '@nunos-lab/dominio';
import { agora, recusar } from './util.ts';

export type QuemAnula = {
  /** A pessoa da equipa (null: o backoffice, que não é da equipa). */
  pessoaId: number | null;
  /** O dono e o backoffice anulam sempre; os outros só os seus, em 10 minutos. */
  dono: boolean;
};

/** Confere as regras e devolve as instruções (para irem no mesmo batch que o registo). */
export async function anularCarimbo(
  db: D1Database,
  carimboId: number,
  quem: QuemAnula,
): Promise<{ clienteId: number; criadoEm: number; instrucoes: D1PreparedStatement[] }> {
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
  if (!quem.dono) {
    if (x.pessoa_id !== quem.pessoaId) recusar(403, 'de_outra_pessoa');
    if (x.criado_em < agora() - MINUTOS_PARA_ANULAR * 60) recusar(409, 'tarde_para_anular');
  }
  const instrucoes = [
    db
      .prepare('UPDATE carimbos SET anulado_em = unixepoch(), anulado_por = ? WHERE id = ?')
      .bind(quem.pessoaId, x.id),
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
    // E só o próprio 10.º: anular um carimbo anterior deixava o corte da oferta dado
    // e o cartão por completar outra vez — uma segunda oferta por oito pagos.
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
  return { clienteId: x.cliente_id, criadoEm: x.criado_em, instrucoes };
}
