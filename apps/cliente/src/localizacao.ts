/**
 * Onde o telemóvel está, para o QR do balcão (27 nov 2026): só no momento de carimbar, e a API não o
 * guarda. A expo-location chegou na 1.0.6: as apps de antes recebem este código por OTA sem o módulo
 * nativo, e importá-lo lá rebentava. Por isso confere-se e carrega-se só quando é preciso.
 */
import type { Posicao } from '@nunos-lab/dominio';
import { requireOptionalNativeModule } from 'expo';

/** Esta app tem a localização (a 1.0.6 em diante). */
export const temLocalizacao = !!requireOptionalNativeModule('ExpoLocation');

/** Um erro com o código das mensagens (textos › erros). */
export class ErroDaLocalizacao extends Error {
  constructor(public codigo: 'sem_permissao_de_localizacao' | 'sem_localizacao') {
    super(codigo);
  }
}

export async function ondeEstou(): Promise<Posicao> {
  if (!temLocalizacao) throw new ErroDaLocalizacao('sem_localizacao');
  const Location = require('expo-location') as typeof import('expo-location');
  const permissao = await Location.requestForegroundPermissionsAsync();
  if (!permissao.granted) throw new ErroDaLocalizacao('sem_permissao_de_localizacao');
  // A última posição, se é recente e boa, chega logo; senão pede-se uma, com prazo.
  const ultima = await Location.getLastKnownPositionAsync({
    maxAge: 60_000,
    requiredAccuracy: 100,
  }).catch(() => null);
  const posicao =
    ultima ??
    (await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
    ]).catch(() => null));
  if (!posicao) throw new ErroDaLocalizacao('sem_localizacao');
  return {
    lat: posicao.coords.latitude,
    lng: posicao.coords.longitude,
    precisao: posicao.coords.accuracy ?? 1000,
  };
}
