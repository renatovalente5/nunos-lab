/**
 * Onde o telemóvel está, na app da web (27 nov 2026): a do browser, só no momento de carimbar pelo QR
 * do balcão. A API não a guarda.
 */
import type { Posicao } from '@nunos-lab/dominio';

export const temLocalizacao = typeof navigator !== 'undefined' && !!navigator.geolocation;

export class ErroDaLocalizacao extends Error {
  constructor(
    public codigo: 'sem_permissao_de_localizacao' | 'sem_localizacao' | 'localizacao_aproximada',
  ) {
    super(codigo);
  }
}

/** Onde estou agora. `fresca`: sem a posição de há pouco (o «Ler outra vez» depois de uma recusa). */
export function ondeEstou({ fresca = false }: { fresca?: boolean } = {}): Promise<Posicao> {
  return new Promise((resolve, reject) => {
    if (!temLocalizacao) {
      reject(new ErroDaLocalizacao('sem_localizacao'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }),
      (e) =>
        reject(
          new ErroDaLocalizacao(
            e.code === e.PERMISSION_DENIED ? 'sem_permissao_de_localizacao' : 'sem_localizacao',
          ),
        ),
      // Uma posição de há meio minuto podia ser do caminho até à barbearia.
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: fresca ? 0 : 15_000 },
    );
  });
}
