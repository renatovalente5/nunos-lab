import { linguaActual, useTextosDe } from '@nunos-lab/ui';
import { en } from './en';
import { pt } from './pt';

/** As frases da for partners: português de Portugal e inglês britânico (7 nov 2026). */
const TEXTOS = { pt, en };

export type Textos = typeof pt;

export function useTextos(): Textos {
  return useTextosDe(TEXTOS);
}

/** Fora de um componente (uma mensagem de erro): na língua deste momento. */
export function textos(): Textos {
  return TEXTOS[linguaActual()];
}
