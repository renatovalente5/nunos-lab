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

/**
 * Um nome como se vê: sem os caracteres invisíveis (marcas de direcção, espaços de largura
 * zero, hífen invisível, BOM) e com os espaços juntos. Colados de outro sítio, um nome só
 * de invisíveis passava por um nome e ficava em branco no cartão e no balcão; a marca
 * U+202E virava o nome ao contrário. Os juntores U+200C/U+200D ficam (emojis compostos,
 * algumas escritas), mas sozinhos não fazem um nome. Aplicar duas vezes dá o mesmo.
 */
const INVISIVEIS =
  /[\u00AD\u061C\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

export function limparNome(texto: string): string {
  const limpo = texto.replace(INVISIVEIS, '').replace(/\s+/g, ' ').trim();
  return /[^\s\u200C\u200D]/.test(limpo) ? limpo : '';
}
