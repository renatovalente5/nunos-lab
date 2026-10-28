import { juntar, utf8 } from './bytes.ts';

/**
 * DER: o suficiente para ESCREVER um CMS SignedData e para LER de um
 * certificado o emissor, o número de série e a chave pública.
 */

function comprimento(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v % 256);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

export const der = (etiqueta: number, conteudo: Uint8Array) =>
  juntar(new Uint8Array([etiqueta]), comprimento(conteudo.length), conteudo);
export const sequencia = (...partes: Uint8Array[]) => der(0x30, juntar(...partes));
export const conjunto = (...partes: Uint8Array[]) => der(0x31, juntar(...partes));
export const octetos = (bytes: Uint8Array) => der(0x04, bytes);
/** «[n]» construído (no IMPLICIT substitui a etiqueta original). */
export const contexto = (n: number, conteudo: Uint8Array) => der(0xa0 | n, conteudo);

export function inteiro(n: number): Uint8Array {
  const bytes: number[] = [];
  let v = n;
  do {
    bytes.unshift(v % 256);
    v = Math.floor(v / 256);
  } while (v > 0);
  if (bytes[0]! & 0x80) bytes.unshift(0);
  return der(0x02, new Uint8Array(bytes));
}

export function oid(texto: string): Uint8Array {
  const partes = texto.split('.').map(Number);
  const bytes = [partes[0]! * 40 + partes[1]!];
  for (const p of partes.slice(2)) {
    const grupo = [p & 0x7f];
    for (let v = Math.floor(p / 128); v > 0; v = Math.floor(v / 128))
      grupo.unshift((v & 0x7f) | 0x80);
    bytes.push(...grupo);
  }
  return der(0x06, new Uint8Array(bytes));
}

const nulo = () => new Uint8Array([0x05, 0x00]);
export const algoritmo = (id: string) => sequencia(oid(id), nulo());

/** UTCTime de 1950 a 2049; GeneralizedTime fora disso. */
export function tempo(quando: Date): Uint8Array {
  const p = (n: number) => String(n).padStart(2, '0');
  const ano = quando.getUTCFullYear();
  const resto = `${p(quando.getUTCMonth() + 1)}${p(quando.getUTCDate())}${p(quando.getUTCHours())}${p(quando.getUTCMinutes())}${p(quando.getUTCSeconds())}Z`;
  return ano >= 1950 && ano < 2050
    ? der(0x17, utf8(`${p(ano % 100)}${resto}`))
    : der(0x18, utf8(`${String(ano).padStart(4, '0')}${resto}`));
}

export const OID = {
  dados: '1.2.840.113549.1.7.1',
  assinado: '1.2.840.113549.1.7.2',
  sha256: '2.16.840.1.101.3.4.2.1',
  rsa: '1.2.840.113549.1.1.1',
  tipoConteudo: '1.2.840.113549.1.9.3',
  resumoMensagem: '1.2.840.113549.1.9.4',
  horaAssinatura: '1.2.840.113549.1.9.5',
} as const;

// ——— ler ———

type Valor = { etiqueta: number; inicio: number; fim: number; todo: Uint8Array };

export function ler(bytes: Uint8Array, pos: number): Valor {
  if (pos + 2 > bytes.length) throw new RangeError('DER cortado');
  const etiqueta = bytes[pos]!;
  let i = pos + 1;
  let tamanho = bytes[i++]!;
  if (tamanho & 0x80) {
    const n = tamanho & 0x7f;
    if (n === 0 || n > 4 || i + n > bytes.length)
      throw new RangeError('DER com um comprimento impossível');
    tamanho = 0;
    for (let k = 0; k < n; k++) tamanho = tamanho * 256 + bytes[i++]!;
  }
  if (i + tamanho > bytes.length) throw new RangeError('DER cortado');
  return { etiqueta, inicio: i, fim: i + tamanho, todo: bytes.subarray(pos, i + tamanho) };
}

/** Uma chave privada começa por SEQUENCE { INTEGER versão … }; um certificado por SEQUENCE { SEQUENCE … }. */
export function pareceChavePrivada(b: Uint8Array): boolean {
  if (b.length < 4 || b[0] !== 0x30) return false;
  const i = 1 + (b[1]! & 0x80 ? 1 + (b[1]! & 0x7f) : 1);
  return b[i] === 0x02;
}

/** O emissor, o número de série e a chave pública de um certificado X.509. */
export function camposDoCertificado(certificado: Uint8Array) {
  const fora = ler(certificado, 0);
  const tbs = ler(certificado, fora.inicio);
  let pos = tbs.inicio;
  if (certificado[pos] === 0xa0) pos = ler(certificado, pos).fim;
  const serie = ler(certificado, pos);
  const alg = ler(certificado, serie.fim);
  const emissor = ler(certificado, alg.fim);
  const validade = ler(certificado, emissor.fim);
  const sujeito = ler(certificado, validade.fim);
  const chavePublica = ler(certificado, sujeito.fim);
  if (serie.etiqueta !== 0x02 || emissor.etiqueta !== 0x30 || chavePublica.etiqueta !== 0x30)
    throw new RangeError('isto não tem a forma de um certificado X.509');
  return { serie: serie.todo, emissor: emissor.todo, chavePublica: chavePublica.todo };
}
