import { ETIQUETA_DA_LINGUA, eLingua, linguaDaEtiqueta, type Lingua } from '@nunos-lab/dominio';
import { useSyncExternalStore } from 'react';

/**
 * A língua do backoffice: a escolhida neste browser, ou a dele. A chave é a do site e da for
 * partners (o mesmo endereço): escolher aqui muda as três neste browser.
 */
const CHAVE = 'nunoslab:lingua';
const ouvintes = new Set<() => void>();
/** A escolha desta página, para quando o browser não guarda nada (modo privado antigo). */
let escolhidaAgora: Lingua | null = null;

export function linguaActual(): Lingua {
  if (escolhidaAgora) return escolhidaAgora;
  try {
    const guardada = localStorage.getItem(CHAVE);
    if (eLingua(guardada)) return guardada;
  } catch {
    // Sem armazenamento: fica a do browser.
  }
  return linguaDaEtiqueta(navigator.languages?.[0] ?? navigator.language ?? '');
}

export function escolherLingua(lingua: Lingua): void {
  escolhidaAgora = lingua;
  try {
    localStorage.setItem(CHAVE, lingua);
  } catch {
    // Sem armazenamento: vale até fechar a página.
  }
  avisar();
}

function avisar() {
  document.documentElement.lang = ETIQUETA_DA_LINGUA[linguaActual()];
  ouvintes.forEach((f) => f());
}

// Escolhida noutro separador (o site, a for partners): esta página acompanha.
window.addEventListener('storage', (e) => {
  if (e.key !== CHAVE) return;
  escolhidaAgora = null;
  avisar();
});
document.documentElement.lang = ETIQUETA_DA_LINGUA[linguaActual()];

function ouvir(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

export function useLingua(): Lingua {
  return useSyncExternalStore(ouvir, linguaActual, linguaActual);
}

/** A etiqueta para os números e as datas: «pt-PT» ou «en-GB». */
export function etiquetaDaLingua(): string {
  return ETIQUETA_DA_LINGUA[linguaActual()];
}
