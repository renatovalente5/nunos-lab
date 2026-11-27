/**
 * O carimbo pelo QR do balcão (o Nuno, 27 nov 2026): o cliente lê com a app o QR da barbearia e o carimbo
 * entra sem o barbeiro tirar o telemóvel do bolso. As regras estão em packages/dominio/src/qr-do-balcao.ts:
 * perto da barbearia, de dia, um por dia, e com o barbeiro o primeiro carimbo de um cliente novo e o que
 * completa o cartão. Daqui para a frente é o carimbo de sempre (`carimbar`, em balcao/rotas.ts), sem
 * pessoa da equipa.
 */
import { z } from 'zod';
import {
  TAMANHO_DO_CODIGO_DO_BALCAO,
  codigoDoBalcaoValido,
  dentroDasHorasDoQr,
  pertoDoBalcao,
  type CarimboDoQr,
} from '@nunos-lab/dominio';
import type { C } from '../ambiente.ts';
import { carimbar, eDaPessoa, type LinhaCliente } from '../balcao/rotas.ts';
import { cartaoActual } from '../programa.ts';
import { consultaDoSaldo, saldoDe } from '../saldo.ts';
import { corpo, recusar } from '../util.ts';

const Pedido = z.object({
  codigo: z.string().trim().toUpperCase().length(TAMANHO_DO_CODIGO_DO_BALCAO),
  /** A chave de idempotência da app: a resposta perdida e o toque outra vez contam um carimbo. */
  chave: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  /** Onde o telemóvel está agora (não se guarda: só decide se está ao pé da barbearia). */
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  precisao: z.number().min(0).max(1_000_000).optional(),
});

export async function carimboPeloQr(c: C): Promise<CarimboDoQr> {
  const p = await corpo(c, Pedido);
  const { id, demo } = c.get('cliente');
  const db = c.env.DB;
  if (!codigoDoBalcaoValido(p.codigo)) recusar(404, 'qr_desconhecido');
  const loja = await db
    .prepare('SELECT id, nome, lat, lng FROM lojas WHERE codigo_qr = ?')
    .bind(p.codigo)
    .first<{ id: number; nome: string; lat: number | null; lng: number | null }>();
  // Um QR trocado no backoffice (ou de outra coisa) deixa de valer.
  if (!loja) recusar(404, 'qr_desconhecido');
  const cliente = await db
    .prepare(
      'SELECT id, codigo, nome, criado_em, aniversario, aniversario_desde FROM clientes WHERE id = ? AND apagado_em IS NULL',
    )
    .bind(id)
    .first<LinhaCliente>();
  if (!cliente) recusar(404, 'nao_existe');
  // A mesma chave a chegar outra vez (a resposta perdeu-se): é o mesmo carimbo, devolve-se o que entrou.
  const repetida = await db
    .prepare('SELECT 1 FROM carimbos WHERE chave = ? AND cliente_id = ?')
    .bind(p.chave, id)
    .first();
  if (!repetida) {
    // A conta da revisão das lojas (Apple e Google) não está em Portugal: carimba sem o sítio nem as horas.
    if (!demo) {
      if (!dentroDasHorasDoQr()) recusar(409, 'fora_de_horas');
      if (p.lat === undefined || p.lng === undefined || p.precisao === undefined)
        recusar(400, 'sem_localizacao');
      if (
        loja.lat === null ||
        loja.lng === null ||
        !pertoDoBalcao(
          { lat: p.lat, lng: p.lng, precisao: p.precisao },
          { lat: loja.lat, lng: loja.lng },
        )
      )
        recusar(409, 'longe_do_balcao');
    }
    // A equipa das barbearias não se carimba a si mesma (como na for partners: pede a um colega).
    const daEquipa = await db
      .prepare(
        `SELECT 1 FROM equipa p WHERE p.removido_em IS NULL AND p.papel IN ('dono', 'barbeiro')
           AND ${eDaPessoa('?1', 'p.id')} LIMIT 1`,
      )
      .bind(id)
      .first();
    if (daEquipa) recusar(403, 'equipa_pede_a_um_colega');
    // O primeiro carimbo é do barbeiro: é aí que um convite se paga e que se conhece o cliente novo.
    const jaTem = await db
      .prepare('SELECT 1 FROM carimbos WHERE cliente_id = ? AND anulado_em IS NULL LIMIT 1')
      .bind(id)
      .first();
    // A conta da revisão das lojas (um cliente de exemplo) salta também esta regra e a do prémio: o revisor
    // da Apple ou da Google lê o QR sem ter passado pelo barbeiro.
    if (!jaTem && !demo) recusar(409, 'primeiro_com_o_barbeiro');
    // O carimbo que completa o cartão é o corte do prémio: o barbeiro aplica o desconto ao cobrar. (Um
    // cartão já completo, dos de antes de 17 nov, abre o seguinte: esse carimbo não é o do prémio.)
    const cartao = await cartaoActual(db, id);
    if (!demo && cartao && cartao.completo_em === null && cartao.carimbos + 1 >= cartao.objectivo)
      recusar(409, 'premio_com_o_barbeiro');
  }
  const feito = await carimbar(
    c,
    cliente,
    { chave: p.chave, lojaId: loja.id, confirmar: false, semLeitura: false },
    false,
    { peloQr: true },
  );
  const saldo = saldoDe(await consultaDoSaldo(db, id).all());
  return {
    cartao: feito.cartao,
    loja: loja.nome,
    premioAMeio: feito.premioAMeio ?? null,
    saldo,
  };
}
