import type { Lingua } from '@nunos-lab/dominio';
import { linguaActual, useLingua } from '../lingua';
import * as acessos from './acessos';
import * as barbearia from './barbearia';
import * as categorias from './categorias';
import * as cliente from './cliente';
import * as clientes from './clientes';
import * as equipa from './equipa';
import * as fidelidade from './fidelidade';
import * as geral from './geral';
import * as historico from './historico';
import * as parceiro from './parceiro';
import * as parceiros from './parceiros';
import * as promocoes from './promocoes';
import * as resumo from './resumo';

/**
 * As frases do backoffice, português de Portugal e inglês britânico (7 nov 2026): as comuns em
 * geral.ts, as de cada página no seu ficheiro. Cada `en` é do tipo do `pt`: não falta nenhuma.
 */
const PT = {
  geral: geral.pt,
  resumo: resumo.pt,
  clientes: clientes.pt,
  cliente: cliente.pt,
  equipa: equipa.pt,
  fidelidade: fidelidade.pt,
  parceiros: parceiros.pt,
  parceiro: parceiro.pt,
  promocoes: promocoes.pt,
  categorias: categorias.pt,
  barbearia: barbearia.pt,
  acessos: acessos.pt,
  historico: historico.pt,
};

export type Textos = typeof PT;

const EN: Textos = {
  geral: geral.en,
  resumo: resumo.en,
  clientes: clientes.en,
  cliente: cliente.en,
  equipa: equipa.en,
  fidelidade: fidelidade.en,
  parceiros: parceiros.en,
  parceiro: parceiro.en,
  promocoes: promocoes.en,
  categorias: categorias.en,
  barbearia: barbearia.en,
  acessos: acessos.en,
  historico: historico.en,
};

const TEXTOS: Record<Lingua, Textos> = { pt: PT, en: EN };

export function useTextos(): Textos {
  return TEXTOS[useLingua()];
}

/** Fora de um componente (uma mensagem de erro, uma frase do registo): na língua deste momento. */
export function textos(): Textos {
  return TEXTOS[linguaActual()];
}
