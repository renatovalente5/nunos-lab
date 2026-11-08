import type { Lingua } from '@nunos-lab/dominio';
import { useTextosDe } from './lingua';

/** As frases das peças partilhadas pelas duas apps. */
const pt = {
  fechar: 'Fechar',
  semLigacao: 'Sem ligação',
  tentarOutraVez: 'Tentar outra vez',
  exemplo: 'Exemplo',
  novo: 'Novo',
  codigoQr: 'Código QR',
  carimbosDe: (carimbos: number, objectivo: number) =>
    `${carimbos} de ${objectivo} ${objectivo === 1 ? 'carimbo' : 'carimbos'}`,
  continuarComApple: 'Continuar com a Apple',
  continuarComGoogle: 'Continuar com o Google',
  googleNaoAbriu: 'O Google não abriu. Tenta outra vez.',
  googleNaoAbriuNaWeb: 'O Google não abriu. Recarrega a página.',
  semServicosDoGoogle: 'Este telemóvel não tem os serviços do Google.',
  lingua: 'Língua',
};

const en: typeof pt = {
  fechar: 'Close',
  semLigacao: 'No connection',
  tentarOutraVez: 'Try again',
  exemplo: 'Sample',
  novo: 'New',
  codigoQr: 'QR code',
  carimbosDe: (carimbos, objectivo) =>
    `${carimbos} of ${objectivo} ${objectivo === 1 ? 'stamp' : 'stamps'}`,
  continuarComApple: 'Continue with Apple',
  continuarComGoogle: 'Continue with Google',
  googleNaoAbriu: 'Google sign-in didn’t open. Try again.',
  googleNaoAbriuNaWeb: 'Google sign-in didn’t load. Refresh the page.',
  semServicosDoGoogle: 'This phone doesn’t have Google Play services.',
  lingua: 'Language',
};

const TEXTOS_DA_UI: Record<Lingua, typeof pt> = { pt, en };

export function useTextosDaUi() {
  return useTextosDe(TEXTOS_DA_UI);
}
