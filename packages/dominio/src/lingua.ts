/**
 * As línguas do Nuno's Lab: o português de Portugal e o inglês britânico (o Renato, 7 nov 2026).
 * Cada app abre na língua do aparelho (português se for português, inglês nos outros casos) e
 * deixa escolher. Os conteúdos do backoffice têm uma versão inglesa; sem ela, fica o português.
 */
export type Lingua = 'pt' | 'en';

export const LINGUAS: readonly Lingua[] = ['pt', 'en'];

/** A etiqueta BCP 47 de cada língua: as datas, os números e o `lang` da página. */
export const ETIQUETA_DA_LINGUA: Record<Lingua, string> = { pt: 'pt-PT', en: 'en-GB' };

/** Cada língua dita na própria língua, como na escolha do iPhone. */
export const NOME_DA_LINGUA: Record<Lingua, string> = { pt: 'Português', en: 'English' };

export function eLingua(valor: unknown): valor is Lingua {
  return valor === 'pt' || valor === 'en';
}

/**
 * A língua de uma etiqueta do aparelho («pt-PT», «pt_BR», «en-US», «fr»): o português de
 * qualquer país, ou o inglês. Sem etiqueta nenhuma, o português (a casa é portuguesa).
 */
export function linguaDaEtiqueta(etiqueta: string | null | undefined): Lingua {
  if (!etiqueta) return 'pt';
  return /^pt(?:$|[-_])/i.test(etiqueta) ? 'pt' : 'en';
}

/** Um conteúdo do backoffice na língua pedida: a versão inglesa se a houver, senão o português. */
export function naLingua(lingua: Lingua, pt: string, en?: string | null): string {
  const ingles = en?.trim();
  return lingua === 'en' && ingles ? ingles : pt;
}
