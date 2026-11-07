import { ETIQUETA_DA_LINGUA, eLingua, linguaDaEtiqueta, type Lingua } from '@nunos-lab/dominio';
import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { guardar, lerSincrono } from './armazem';

/**
 * A língua das apps: a escolhida neste aparelho, ou a dele. No telemóvel lê-se pelo `Intl` do
 * Hermes, sem módulo nativo, para chegar às apps já instaladas por actualização.
 */

/** A escolha guardada (as duas apps; na web, a mesma para o site todo). */
export const CHAVE_DA_LINGUA = 'nunoslab:lingua';

let doAparelho: Lingua | null = null;
let fixa: Lingua | null = null;
const ouvintes = new Set<() => void>();

export function linguaDoAparelho(): Lingua {
  if (!doAparelho) {
    let etiqueta = '';
    try {
      etiqueta =
        Platform.OS === 'web'
          ? (globalThis.navigator?.languages?.[0] ?? globalThis.navigator?.language ?? '')
          : Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      // Sem Intl: fica o português.
    }
    doAparelho = linguaDaEtiqueta(etiqueta);
  }
  return doAparelho;
}

/** A língua de agora: a fixa (uma app ainda só em português), a escolhida, ou a do aparelho. */
export function linguaActual(): Lingua {
  if (fixa) return fixa;
  const escolhida = lerSincrono(CHAVE_DA_LINGUA);
  return eLingua(escolhida) ? escolhida : linguaDoAparelho();
}

export function escolherLingua(lingua: Lingua): void {
  guardar(CHAVE_DA_LINGUA, lingua);
  ouvintes.forEach((f) => f());
}

/** Uma app que ainda não tem as frases em inglês: as peças partilhadas ficam em português. */
export function fixarLingua(lingua: Lingua): void {
  fixa = lingua;
  ouvintes.forEach((f) => f());
}

function ouvir(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

export function useLingua(): Lingua {
  return useSyncExternalStore(ouvir, linguaActual, linguaActual);
}

/** As frases de uma app na língua de agora: um dicionário por língua. */
export function useTextosDe<T>(textos: Record<Lingua, T>): T {
  return textos[useLingua()];
}

/** Na web, o `lang` da página acompanha a língua (o leitor de ecrã e o tradutor do browser). */
export function useLangDaPagina(): void {
  const lingua = useLingua();
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.lang = ETIQUETA_DA_LINGUA[lingua];
  }, [lingua]);
}
