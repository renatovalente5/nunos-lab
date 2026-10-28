/** Bytes: o que o ZIP, o DER e os JWT precisam, só com o que a web dá (o Worker não tem Buffer). */

export function juntar(...partes: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of partes) total += p.length;
  const saida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

const codificador = new TextEncoder();
export const utf8 = (s: string): Uint8Array => codificador.encode(s);

export function hex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function paraBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const paraBase64url = (bytes: Uint8Array): string =>
  paraBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** base64 → bytes, a sério: só o alfabeto, e nunca um comprimento impossível. */
export function deBase64(texto: string): Uint8Array {
  const limpo = texto.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(limpo) || limpo.replace(/=+$/, '').length % 4 === 1)
    throw new RangeError('base64 inválido');
  const bin = atob(limpo.padEnd(Math.ceil(limpo.length / 4) * 4, '='));
  const saida = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) saida[i] = bin.charCodeAt(i);
  return saida;
}

export const u16le = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
export const u32le = (n: number) =>
  new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** O D1 e a WebCrypto querem um ArrayBuffer certinho. */
export function buffer(b: Uint8Array): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}
