import { inflateSync } from 'node:zlib';

/** Lê um PNG nosso (sem filtros), para os testes (é .test.ts para o tsc do Worker o ignorar: usa o zlib do Node). */
export function lerPng(bytes: Uint8Array) {
  const assinatura = [137, 80, 78, 71, 13, 10, 26, 10];
  if (assinatura.some((b, i) => bytes[i] !== b)) throw new Error('Não é um PNG.');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pedacos: Record<string, Uint8Array> = {};
  let i = 8;
  while (i < bytes.length) {
    const n = v.getUint32(i);
    const tipo = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    pedacos[tipo] = bytes.subarray(i + 8, i + 8 + n);
    i += 12 + n;
  }
  const ihdr = new DataView(pedacos.IHDR!.buffer, pedacos.IHDR!.byteOffset);
  const largura = ihdr.getUint32(0);
  const altura = ihdr.getUint32(4);
  const canais = pedacos.IHDR![9] === 6 ? 4 : 3;
  const cru = inflateSync(pedacos.IDAT!);
  const passo = 1 + largura * canais;
  if (cru.length !== passo * altura) throw new Error('O IDAT não tem o tamanho da imagem.');
  const pixel = (x: number, y: number) => [
    ...cru.subarray(y * passo + 1 + x * canais, y * passo + 1 + (x + 1) * canais),
  ];
  return { largura, altura, canais, pixel };
}
