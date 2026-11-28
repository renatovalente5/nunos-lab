/**
 * Entrar na for partners com um código mandado ao email da equipa (28 nov 2026): o que a API e a app
 * partilham.
 */

/** Quantos algarismos tem o código. */
export const ALGARISMOS_DO_CODIGO = 6;
/** Quanto tempo vale um código. */
export const MINUTOS_DO_CODIGO = 10;
/** Quanto tempo até se poder pedir outro para o mesmo email (antes disso, vale o que já foi). */
export const SEGUNDOS_PARA_REENVIAR = 30;
/** Os enganos que um código aguenta antes de deixar de valer. */
export const ENGANOS_DO_CODIGO = 5;

/**
 * O código no que se escreveu ou colou, só com os algarismos: «123 456», «Código: 123456» e
 * «123456 é o teu código» dão «123456». Com mais algarismos (um texto colado com a data, por
 * exemplo), fica o primeiro grupo de seis seguidos; sem nenhum, os primeiros seis.
 */
export function codigoEscrito(texto: string): string {
  // Sem «lookbehind» (o Hermes das versões antigas não o lê): o algarismo de antes vai no grupo 1.
  const seis = new RegExp(`(^|\\D)(\\d{${ALGARISMOS_DO_CODIGO}})(?!\\d)`).exec(texto);
  if (seis) return seis[2]!;
  return texto.replace(/\D/g, '').slice(0, ALGARISMOS_DO_CODIGO);
}

/**
 * O código depois de uma mudança no campo. O preenchimento automático e o colar acrescentam o código
 * ao que já lá estava («12» + «123456»): o que entrou de novo ganha, se tiver o código inteiro.
 */
export function codigoDepoisDe(antes: string, agora: string): string {
  const novo = agora.startsWith(antes) ? agora.slice(antes.length) : '';
  if (novo.replace(/\D/g, '').length >= ALGARISMOS_DO_CODIGO) return codigoEscrito(novo);
  return codigoEscrito(agora);
}
