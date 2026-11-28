/**
 * O carimbo pelo QR do balcão (o Nuno, 27 nov 2026): o cliente lê com a app o QR da barbearia e o carimbo
 * entra sem o barbeiro tirar o telemóvel do bolso. As regras estão em packages/dominio/src/qr-do-balcao.ts:
 * perto da barbearia, de dia, um por dia, e com o barbeiro o primeiro carimbo de um cliente novo e o que
 * completa o cartão. Daqui para a frente é o carimbo de sempre (`carimbar`, em balcao/rotas.ts), sem
 * pessoa da equipa, com as regras da história do cliente no próprio INSERT (`regraDoQr`).
 */
import { z } from 'zod';
import {
  TAMANHO_DO_CODIGO_DO_BALCAO,
  codigoDoBalcaoValido,
  dentroDasHorasDoQr,
  diaEmLisboa,
  recusaDaLocalizacao,
  type CarimboDoQr,
} from '@nunos-lab/dominio';
import type { C } from '../ambiente.ts';
import { carimbar, eDaPessoa, regraDoQr, type LinhaCliente } from '../balcao/rotas.ts';
import { lerPrograma } from '../programa.ts';
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

type LojaDoQr = { id: number; nome: string; lat: number | null; lng: number | null };

export async function carimboPeloQr(c: C): Promise<CarimboDoQr> {
  const p = await corpo(c, Pedido);
  const { id, demo } = c.get('cliente');
  const db = c.env.DB;
  // O travão antes de tudo: os pedidos recusados (longe, fora de horas) também contam (2.ª revisão de 27 nov).
  if (!(await c.env.CARIMBAR.limit({ key: `qr:${id}` }))?.success)
    recusar(429, 'muitas_tentativas');
  // A mesma chave a chegar outra vez (a resposta perdeu-se): é o mesmo carimbo, e vem antes de tudo — com
  // o QR trocado entretanto, ou lido noutra barbearia, devolve-se o que entrou, com a barbearia dele.
  const repetida = await db
    .prepare(
      `SELECT x.loja_id AS id, coalesce(l.nome, '') AS nome FROM carimbos x LEFT JOIN lojas l ON l.id = x.loja_id
       WHERE x.chave = ? AND x.cliente_id = ?`,
    )
    .bind(p.chave, id)
    .first<{ id: number; nome: string }>();
  let loja: LojaDoQr | null = repetida ? { ...repetida, lat: null, lng: null } : null;
  if (!loja) {
    if (!codigoDoBalcaoValido(p.codigo)) recusar(404, 'qr_desconhecido');
    // Um QR trocado no backoffice (ou de outra coisa) deixa de valer.
    loja = await db
      .prepare('SELECT id, nome, lat, lng FROM lojas WHERE codigo_qr = ?')
      .bind(p.codigo)
      .first<LojaDoQr>();
    if (!loja) recusar(404, 'qr_desconhecido');
  }
  const cliente = await db
    .prepare(
      'SELECT id, codigo, nome, criado_em, aniversario, aniversario_desde FROM clientes WHERE id = ? AND apagado_em IS NULL',
    )
    .bind(id)
    .first<LinhaCliente>();
  if (!cliente) recusar(404, 'nao_existe');
  if (!repetida) {
    // A conta da revisão das lojas (Apple e Google) não está em Portugal: carimba sem o sítio nem as horas.
    if (!demo) {
      if (!dentroDasHorasDoQr()) recusar(409, 'fora_de_horas');
      if (p.lat === undefined || p.lng === undefined || p.precisao === undefined)
        recusar(400, 'sem_localizacao');
      // Longe, ou com a localização tão imprecisa que não se sabe (a «aproximada» erra quilómetros).
      const recusa =
        loja.lat === null || loja.lng === null
          ? 'longe_do_balcao'
          : recusaDaLocalizacao(
              { lat: p.lat, lng: p.lng, precisao: p.precisao },
              { lat: loja.lat, lng: loja.lng },
            );
      if (recusa) recusar(409, recusa);
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
    // O primeiro carimbo é do barbeiro (é aí que um convite se paga e que se conhece o cliente novo), um
    // QR anulado hoje na barbearia não se repete, e o carimbo que completa o cartão é o corte do prémio
    // (o barbeiro aplica o desconto ao cobrar). A conta da revisão salta-as: o revisor da Apple ou da
    // Google lê o QR sem ter passado pelo barbeiro.
    // Quem já tem o carimbo de hoje segue para o `carimbar`, que o diz como sempre («limite_do_dia», com
    // a hora e quem o deu).
    if (!demo) {
      const regra = await regraDoQr(db, id, diaEmLisboa(), (await lerPrograma(db)).porDia);
      if (regra && regra !== 'limite_do_dia') recusar(409, regra);
    }
  }
  const feito = await carimbar(
    c,
    cliente,
    { chave: p.chave, lojaId: loja.id, confirmar: false, semLeitura: false },
    false,
    { peloQr: true, regras: !demo },
  );
  const saldo = saldoDe(await consultaDoSaldo(db, id).all());
  return {
    cartao: feito.cartao,
    loja: loja.nome,
    premioAMeio: feito.premioAMeio ?? null,
    saldo,
  };
}
