import { buffer, crc32, juntar, utf8 } from './bytes.ts';
import type { Tela } from './tela.ts';

/**
 * Um PNG a partir de uma tela: 8 bits, RGB ou RGBA, sem filtros (as linhas
 * já levam o byte a zero), comprimido pelo zlib do próprio Worker
 * (CompressionStream). O inverso só serve para as máscaras dos glifos.
 */

const ASSINATURA = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const u32be = (n: number) =>
  new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);

function pedaco(tipo: string, dados: Uint8Array): Uint8Array {
  const t = utf8(tipo);
  return juntar(u32be(dados.length), t, dados, u32be(crc32(juntar(t, dados))));
}

async function passarPor(bytes: Uint8Array, fluxo: ReadableWritablePair<Uint8Array, Uint8Array>) {
  const saida = new Response(buffer(bytes)).body!.pipeThrough(fluxo);
  return new Uint8Array(await new Response(saida).arrayBuffer());
}

export const deflatar = (bytes: Uint8Array) => passarPor(bytes, new CompressionStream('deflate'));
export const inflar = (bytes: Uint8Array) => passarPor(bytes, new DecompressionStream('deflate'));

export async function png(tela: Tela): Promise<Uint8Array> {
  const ihdr = juntar(
    u32be(tela.largura),
    u32be(tela.altura),
    new Uint8Array([8, tela.canais === 4 ? 6 : 2, 0, 0, 0]),
  );
  return juntar(
    ASSINATURA,
    pedaco('IHDR', ihdr),
    pedaco('IDAT', await deflatar(tela.dados)),
    pedaco('IEND', new Uint8Array(0)),
  );
}
