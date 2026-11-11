/**
 * O código de convite que vem da Play Store (o Renato, 11 nov 2026): no Android, a página do convite leva à
 * Play Store com `&referrer=convite%3DCODIGO`, a Play Store guarda-o, e a app lê-o uma vez no primeiro
 * arranque (o Install Referrer). Fica como o de uma ligação: guardado até a pessoa entrar, e usa-se então
 * (componentes/saldo.tsx). No iPhone não há forma oficial: o módulo nem está ligado lá (package.json).
 */
import { codigoDoReferrer, ligacaoDaPlayStore } from '@nunos-lab/dominio';
import { guardar, lerSincrono } from '@nunos-lab/ui';
import { Platform } from 'react-native';
import { conviteGuardado, guardarConvite } from './carteira';

/** Já se leu o que a Play Store tinha (uma vez por instalação: não volta a pôr um código usado). */
const CHAVE_DO_LIDO = 'nunoslab:convite-da-loja';

export async function lerConviteDaLoja(): Promise<void> {
  if (Platform.OS !== 'android' || lerSincrono(CHAVE_DO_LIDO)) return;
  try {
    // Só existe nas builds com o módulo (a 1.0.4 do Android): numa 1.0.3, o require falha e não se faz
    // nada (o código escreve-se à mão, como antes).
    const { getInstallReferrerAsync } =
      require('expo-application') as typeof import('expo-application');
    const referrer = await getInstallReferrerAsync();
    guardar(CHAVE_DO_LIDO, '1');
    const codigo = codigoDoReferrer(referrer);
    // Uma ligação aberta antes fica (a primeira manda, como nas ligações).
    if (codigo && !conviteGuardado()) guardarConvite(codigo);
  } catch {
    // Sem o módulo, instalada fora da Play Store, ou o serviço da loja não respondeu: tenta-se no
    // arranque seguinte.
  }
}

/**
 * A app está aberta a todos na Play Store? Em 11 nov 2026 ainda só no teste fechado (12 testadores × 14
 * dias antes de pedir a produção): quem não é testador encontrava a app «indisponível». Passa a true no dia
 * em que a Google aprovar a produção (e publica-se o site).
 */
export const PLAY_STORE_ABERTA = false;

/**
 * Na página web aberta num Android, o convite leva à Play Store com o código (instalar e entrar chega);
 * no iPhone e no computador (ou com a Play Store ainda fechada), null: entra-se na página, e o código
 * fica na conta.
 */
export function playStoreDoConvite(codigo: string, aberta = PLAY_STORE_ABERTA): string | null {
  if (!aberta || Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  return /Android/i.test(navigator.userAgent) ? ligacaoDaPlayStore(codigo) : null;
}
