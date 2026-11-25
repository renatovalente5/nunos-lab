import { caminhoDaAppClip } from '@nunos-lab/dominio';

/**
 * As ligações que abrem a app vindas de fora (o Renato, 25 nov 2026). Com a app instalada, a ligação da
 * App Clip (https://appclip.apple.com/id?p=…&convite=CODIGO) abre a app em vez da App Clip: vai para a
 * página inicial com o código, como uma ligação de convite. As outras seguem como vieram.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return caminhoDaAppClip(path) ?? path;
  } catch {
    return path;
  }
}
