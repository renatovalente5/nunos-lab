/**
 * O QR do balcão (o Nuno, 27 nov 2026: «um QR code para meter ao balcão e os clientes ao lerem o QR code
 * receberem um carimbo», para não ter de tirar o telemóvel do bolso). Cada barbearia tem o seu código, que
 * o Nuno imprime no backoffice; o cliente lê-o com a app e o carimbo entra sem o barbeiro.
 *
 * Contra a fotografia do QR partilhada (o Renato escolheu o QR impresso sabendo disto): só perto da
 * barbearia (a localização do telemóvel, nesse momento, sem a guardar), só de dia, um por dia como os
 * outros, e nunca nos dois momentos em que o barbeiro tem de estar: o primeiro carimbo de um cliente novo
 * (o convite paga-se aí) e o carimbo que completa o cartão (o desconto aplica-se ao cobrar).
 */
import { ALFABETO_DO_CODIGO } from './cartao.ts';

/** O código de uma barbearia no QR: 16 letras do alfabeto dos cartões (80 bits ao acaso). */
export const TAMANHO_DO_CODIGO_DO_BALCAO = 16;

/** Um código novo a partir de 16 bytes ao acaso (256 é múltiplo de 32: sem viés). */
export function gerarCodigoDoBalcao(bytes: Uint8Array): string {
  if (bytes.length < TAMANHO_DO_CODIGO_DO_BALCAO) throw new Error('Faltam bytes para o código');
  let codigo = '';
  for (let i = 0; i < TAMANHO_DO_CODIGO_DO_BALCAO; i++)
    codigo += ALFABETO_DO_CODIGO[bytes[i]! % 32];
  return codigo;
}

export function codigoDoBalcaoValido(codigo: string): boolean {
  return (
    codigo.length === TAMANHO_DO_CODIGO_DO_BALCAO &&
    [...codigo].every((l) => ALFABETO_DO_CODIGO.includes(l))
  );
}

/** A morada da app na web: o QR leva-a, para quem o lê com a câmara do telemóvel abrir a página. */
export const SITIO_DA_APP = 'https://renatovalente5.github.io/nunos-lab';

/** O que vai no QR impresso: a página da app com o código (`/?balcao=CODIGO`). */
export function ligacaoDoBalcao(codigo: string, sitio: string = SITIO_DA_APP): string {
  return `${sitio.replace(/\/$/, '')}/?balcao=${codigo}`;
}

/**
 * O código do balcão no que a câmara leu: a ligação (de qualquer morada, para um QR impresso continuar a
 * servir se a app mudar de casa) ou o código sozinho. null se não for um QR do balcão (o QR de um cartão
 * de cliente, por exemplo).
 */
export function codigoDoBalcaoLido(texto: string): string | null {
  const t = texto.trim();
  const daLigacao = /[?&]balcao=([0-9A-Za-z]{16})(?:[&#]|$)/.exec(t)?.[1];
  const codigo = (daLigacao ?? t).toUpperCase();
  return codigoDoBalcaoValido(codigo) ? codigo : null;
}

export type Coordenadas = { lat: number; lng: number };
/** Onde o telemóvel está, e a precisão que o sistema diz (o raio, em metros). */
export type Posicao = Coordenadas & { precisao: number };

/** A distância entre dois sítios, em metros (pela esfera: a poucos metros chega). */
export function distanciaEmMetros(a: Coordenadas, b: Coordenadas): number {
  const raio = 6_371_008.8;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * raio * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Até onde o QR carimba: a barbearia e a rua à frente. */
export const RAIO_DO_BALCAO = 150;
/**
 * A imprecisão do telemóvel que se perdoa: dentro de uma loja o GPS falha dezenas de metros. Mais do que
 * isto já não conta (quem está longe com uma precisão má não passa por isso).
 */
export const FOLGA_DA_PRECISAO = 100;

/** O telemóvel está ao pé da barbearia: perto, contando com a imprecisão dele até à folga. */
export function pertoDoBalcao(posicao: Posicao, loja: Coordenadas): boolean {
  if (![posicao.lat, posicao.lng, posicao.precisao].every(Number.isFinite)) return false;
  const folga = Math.min(Math.max(0, posicao.precisao), FOLGA_DA_PRECISAO);
  return distanciaEmMetros(posicao, loja) <= RAIO_DO_BALCAO + folga;
}

/**
 * Porque é que a localização não serve (null: o telemóvel está ao pé da barbearia). Com uma precisão má
 * e a barbearia dentro do erro (a localização «aproximada» do iPhone ou do Android, que erra quilómetros,
 * ou um sinal fraco) não se diz «longe»: pede-se a localização exacta (revisão de 27 nov 2026).
 */
export function recusaDaLocalizacao(
  posicao: Posicao,
  loja: Coordenadas,
): 'longe_do_balcao' | 'localizacao_imprecisa' | null {
  if (pertoDoBalcao(posicao, loja)) return null;
  if (![posicao.lat, posicao.lng, posicao.precisao].every(Number.isFinite))
    return 'longe_do_balcao';
  return posicao.precisao > FOLGA_DA_PRECISAO &&
    distanciaEmMetros(posicao, loja) <= RAIO_DO_BALCAO + posicao.precisao
    ? 'localizacao_imprecisa'
    : 'longe_do_balcao';
}

/**
 * As horas em que o QR carimba, em Lisboa: as barbearias não têm horário no sistema (marca-se na
 * Fresha), e de madrugada ninguém corta o cabelo.
 */
export const HORAS_DO_QR = { de: 8, ate: 22 } as const;

const HORA_EM_LISBOA = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Lisbon',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Está dentro das horas do QR (das 8h às 22h de Lisboa)? */
export function dentroDasHorasDoQr(instante: number = Date.now()): boolean {
  const hora = Number(HORA_EM_LISBOA.format(instante));
  return hora >= HORAS_DO_QR.de && hora < HORAS_DO_QR.ate;
}

/** Porque é que o QR não carimbou (as apps dizem cada uma por palavras). */
export const RECUSAS_DO_QR = [
  'qr_desconhecido',
  'fora_de_horas',
  'sem_localizacao',
  'longe_do_balcao',
  'localizacao_imprecisa',
  'primeiro_com_o_barbeiro',
  'qr_anulado_hoje',
  'premio_com_o_barbeiro',
  'equipa_pede_a_um_colega',
  'limite_do_dia',
  'entregue_hoje',
] as const;
export type RecusaDoQr = (typeof RECUSAS_DO_QR)[number];
