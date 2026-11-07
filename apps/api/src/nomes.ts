import { limparNome } from '@nunos-lab/dominio';
import { z } from 'zod';

/**
 * Um nome que se vê, de 1 a «maximo» letras: sem invisíveis e com os espaços juntos
 * (limparNome). O tecto antes de limpar só trava um corpo absurdo.
 */
export const nomeLimpo = (maximo: number) =>
  z
    .string()
    .max(maximo * 4)
    .transform(limparNome)
    .pipe(z.string().min(1).max(maximo));
