/**
 * O código do cartão de cliente: 8 letras do alfabeto de Crockford (sem I, L,
 * O nem U, que se confundem com 1 e 0), as 7 primeiras ao acaso e a última de
 * controlo. É identificação, não autorização: quem carimba é a sessão da
 * Balcão. No QR vai com o prefixo «NL1.», para a Balcão só aceitar os nossos.
 */
export const ALFABETO_DO_CODIGO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const TAMANHO_DO_CODIGO = 8;
export const PREFIXO_DO_QR = 'NL1.';

// Pesos ímpares: uma letra trocada muda sempre a soma (módulo 32).
const PESOS = [1, 3, 5, 7, 9, 11, 13];

function letraDeControlo(corpo: string): string {
  let soma = 0;
  for (let i = 0; i < corpo.length; i++) soma += PESOS[i]! * ALFABETO_DO_CODIGO.indexOf(corpo[i]!);
  return ALFABETO_DO_CODIGO[soma % 32]!;
}

/** Um código novo a partir de 7 bytes ao acaso (256 é múltiplo de 32: sem viés). */
export function gerarCodigo(bytes: Uint8Array): string {
  if (bytes.length < TAMANHO_DO_CODIGO - 1) throw new Error('Faltam bytes para o código');
  let corpo = '';
  for (let i = 0; i < TAMANHO_DO_CODIGO - 1; i++) corpo += ALFABETO_DO_CODIGO[bytes[i]! % 32];
  return corpo + letraDeControlo(corpo);
}

/**
 * O que a pessoa escreveu, arrumado: maiúsculas, O→0, I e L→1, sem espaços nem
 * traços, e sem o prefixo do QR se vier colado. Não garante que exista.
 */
export function normalizarCodigo(texto: string): string {
  return texto
    .trim()
    .toUpperCase()
    .replace(/^NL1\./, '')
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** Tem o tamanho certo, só letras do alfabeto, e a letra de controlo bate. */
export function codigoValido(codigo: string): boolean {
  if (codigo.length !== TAMANHO_DO_CODIGO) return false;
  for (const l of codigo) if (!ALFABETO_DO_CODIGO.includes(l)) return false;
  return letraDeControlo(codigo.slice(0, -1)) === codigo.at(-1);
}

/** «7K3Q9M2X» → «7K3Q 9M2X», com um espaço que não parte. */
export function codigoCurto(codigo: string): string {
  return `${codigo.slice(0, 4)} ${codigo.slice(4)}`;
}

/** O texto que vai no QR do cartão (e no passe da Wallet). */
export function textoDoQr(codigo: string): string {
  return PREFIXO_DO_QR + codigo;
}

/** O código dentro do texto de um QR lido, ou null se não for um cartão nosso. */
export function codigoDoQr(texto: string): string | null {
  if (!texto.startsWith(PREFIXO_DO_QR)) return null;
  const codigo = texto.slice(PREFIXO_DO_QR.length);
  return codigoValido(codigo) ? codigo : null;
}

/** O que a Balcão aceita: o QR, ou o código escrito à mão (com erros de O/I/L). */
export function codigoLido(texto: string): string | null {
  const doQr = codigoDoQr(texto.trim());
  if (doQr) return doQr;
  const escrito = normalizarCodigo(texto);
  return codigoValido(escrito) ? escrito : null;
}
