import { crc32, juntar, u16le, u32le, utf8 } from './bytes.ts';

/**
 * O ZIP do .pkpass: só armazenado (os PNG já vêm comprimidos), com as datas a
 * zeros para o mesmo passe dar sempre os mesmos bytes.
 */
export function zipar(ficheiros: readonly (readonly [string, Uint8Array])[]): Uint8Array {
  const locais: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let posicao = 0;
  for (const [nome, dados] of ficheiros) {
    const nomeBytes = utf8(nome);
    const comum = juntar(
      u16le(20),
      u16le(0),
      u16le(0),
      u16le(0),
      u16le(0),
      u32le(crc32(dados)),
      u32le(dados.length),
      u32le(dados.length),
      u16le(nomeBytes.length),
      u16le(0),
    );
    const cabecalho = juntar(u32le(0x04034b50), comum, nomeBytes);
    locais.push(cabecalho, dados);
    central.push(
      juntar(
        u32le(0x02014b50),
        u16le(20),
        comum,
        u16le(0),
        u16le(0),
        u16le(0),
        u32le(0),
        u32le(posicao),
        nomeBytes,
      ),
    );
    posicao += cabecalho.length + dados.length;
  }
  const corpo = juntar(...locais);
  const indice = juntar(...central);
  const fim = juntar(
    u32le(0x06054b50),
    u16le(0),
    u16le(0),
    u16le(ficheiros.length),
    u16le(ficheiros.length),
    u32le(indice.length),
    u32le(corpo.length),
    u16le(0),
  );
  return juntar(corpo, indice, fim);
}
