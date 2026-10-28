import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * O armazém no telemóvel: os segredos (as sessões) no Keychain/Keystore, o
 * resto no AsyncStorage. Tudo passa por uma cópia em memória, carregada uma
 * vez ao arrancar (carregarArmazem), para a leitura ser síncrona como na web.
 */
const memoria = new Map<string, string>();
const segredos = new Set<string>();

// O SecureStore só aceita letras, algarismos, «.», «-» e «_» na chave.
const chaveSegura = (chave: string) => chave.replace(/[^A-Za-z0-9._-]/g, '.');

export function lerSincrono(chave: string): string | null {
  return memoria.get(chave) ?? null;
}

export function guardar(chave: string, valor: string | null): void {
  if (valor === null) memoria.delete(chave);
  else memoria.set(chave, valor);
  const p = segredos.has(chave)
    ? valor === null
      ? SecureStore.deleteItemAsync(chaveSegura(chave))
      : SecureStore.setItemAsync(chaveSegura(chave), valor)
    : valor === null
      ? AsyncStorage.removeItem(chave)
      : AsyncStorage.setItem(chave, valor);
  p.catch(() => {
    // Sem espaço, ou o Keychain trancado: a memória serve até fechar a app.
  });
}

export async function carregarArmazem(chaves: string[], chavesSecretas: string[]): Promise<void> {
  for (const k of chavesSecretas) {
    segredos.add(k);
    const v = await SecureStore.getItemAsync(chaveSegura(k)).catch(() => null);
    if (v) memoria.set(k, v);
  }
  const pares = await AsyncStorage.multiGet(chaves).catch(() => [] as [string, string | null][]);
  for (const [k, v] of pares) if (v) memoria.set(k, v);
}
