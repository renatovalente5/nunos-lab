/**
 * O que se lê de uma vez não se parte entre linhas: «9:00–13:00», «300 €»,
 * «15 %». O texto continua igual à vista; só os sítios onde a linha pode
 * partir mudam. «·» cola-se à palavra de antes, para nenhuma linha começar
 * por um ponto. Aplicar duas vezes dá o mesmo que uma.
 */
const JUNTOR = '\u2060';
const ESPACO_INSEPARAVEL = '\u00A0';

export function semPartir(texto: string): string {
  return texto
    .replace(/(\d)[ \u00A0]*([–—-])[ \u00A0]*(?=\d)/g, `$1${JUNTOR}$2${JUNTOR}`)
    .replace(/(\d)[ \u00A0]+(?=€|%|h\b|min\b|km\b)/g, `$1${ESPACO_INSEPARAVEL}`)
    .replace(/[ \u00A0]+·[ \u00A0]+/g, `${ESPACO_INSEPARAVEL}· `);
}
