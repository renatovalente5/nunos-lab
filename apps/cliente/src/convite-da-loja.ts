/**
 * O código de convite que vem da loja (o Renato, 11 e 25 nov 2026). Fica como o de uma ligação: guardado
 * até a pessoa entrar, e usa-se então (componentes/saldo.tsx).
 * - Android: a página do convite leva à Play Store com `&referrer=convite%3DCODIGO`, a Play Store guarda-o,
 *   e a app lê-o uma vez no primeiro arranque (o Install Referrer).
 * - iPhone: a Apple não tem Install Referrer. A página do convite abre a App Clip (targets/convite), que
 *   deixa o código num ficheiro do grupo partilhado; ao instalar, a Apple troca a App Clip pela app e o
 *   ficheiro fica, e a app lê-o no primeiro arranque.
 */
import {
  FICHEIRO_DO_CONVITE_IOS,
  GRUPO_PARTILHADO_IOS,
  codigoDoReferrer,
  ligacaoDaAppClip,
  ligacaoDaPlayStore,
  safariComAppClip,
} from '@nunos-lab/dominio';
import { guardar, lerSincrono } from '@nunos-lab/ui';
import { Platform } from 'react-native';
import { conviteGuardado, guardarConvite } from './carteira';

/** Já se leu o que a Play Store tinha (uma vez por instalação: não volta a pôr um código usado). */
const CHAVE_DO_LIDO = 'nunoslab:convite-da-loja';

export async function lerConviteDaLoja(): Promise<void> {
  if (Platform.OS === 'ios') return lerConviteDaAppClip();
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
 * O código que a App Clip deixou no grupo partilhado. Lê-se e apaga-se: não volta a pôr um código usado.
 * Numa build sem o grupo (a 1.0.3 do iPhone) não há pasta, e não se faz nada.
 */
function lerConviteDaAppClip(): void {
  try {
    const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const pasta = Paths.appleSharedContainers[GRUPO_PARTILHADO_IOS];
    if (!pasta) return;
    const ficheiro = new File(pasta, FICHEIRO_DO_CONVITE_IOS);
    if (!ficheiro.exists) return;
    const codigo = codigoDoReferrer(`convite=${ficheiro.textSync().trim()}`);
    ficheiro.delete();
    // Uma ligação aberta antes fica (a primeira manda, como nas ligações).
    if (codigo && !conviteGuardado()) guardarConvite(codigo);
  } catch {
    // Sem o ficheiro ou sem acesso a ele: o código escreve-se à mão, como antes.
  }
}

/**
 * A app está aberta a todos na Play Store? Em 11 nov 2026 ainda só no teste fechado (12 testadores × 14
 * dias antes de pedir a produção): quem não é testador encontrava a app «indisponível». Passa a true no dia
 * em que a Google aprovar a produção (e publica-se o site).
 */
export const PLAY_STORE_ABERTA = false;

/**
 * A App Clip está na App Store? A ligação da Apple só abre a App Clip depois de a Apple a aprovar e de a
 * versão sair: a 1.0.4 do iPhone saiu a 26 nov 2026, e o Renato provou a ligação no iPhone dele.
 */
export const APP_CLIP_ABERTA = true;

/**
 * Na página web aberta num Android, o convite leva à Play Store com o código (instalar e entrar chega);
 * no iPhone e no computador (ou com a Play Store ainda fechada), null: entra-se na página, e o código
 * fica na conta.
 */
export function playStoreDoConvite(codigo: string, aberta = PLAY_STORE_ABERTA): string | null {
  if (!aberta || Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  return /Android/i.test(navigator.userAgent) ? ligacaoDaPlayStore(codigo) : null;
}

/**
 * Na página web aberta no Safari de um iPhone, o convite abre a App Clip com o código (a App Clip mostra
 * o convite e leva a instalar a app). Nos outros, ou com a App Clip ainda por sair, null: entra-se na
 * página, e o código fica na conta.
 */
export function appClipDoConvite(codigo: string, aberta = APP_CLIP_ABERTA): string | null {
  if (!aberta || Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  return safariComAppClip(navigator.userAgent) ? ligacaoDaAppClip(codigo) : null;
}
