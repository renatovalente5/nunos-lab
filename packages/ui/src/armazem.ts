/**
 * O armazém do aparelho, na web: o localStorage, síncrono. No telemóvel há
 * outra versão (armazem.native.ts): o Keychain/Keystore para os segredos e o
 * AsyncStorage para o resto, com uma cópia em memória carregada ao arrancar.
 */
export function lerSincrono(chave: string): string | null {
  try {
    return globalThis.localStorage?.getItem(chave) ?? null;
  } catch {
    return null;
  }
}

export function guardar(chave: string, valor: string | null): void {
  try {
    if (valor === null) globalThis.localStorage?.removeItem(chave);
    else globalThis.localStorage?.setItem(chave, valor);
  } catch {
    // Sem armazenamento (modo privado antigo): dura até fechar a página.
  }
}

/** Na web não há nada a carregar: o localStorage já está cá. */
export async function carregarArmazem(_chaves: string[], _segredos: string[]): Promise<void> {}
