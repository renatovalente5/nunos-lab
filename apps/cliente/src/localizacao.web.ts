/**
 * Onde o telemóvel está, na app da web (27 nov 2026): a do browser, só no momento de carimbar pelo QR
 * do balcão. A API não a guarda.
 */
import type { Posicao } from '@nunos-lab/dominio';

export const temLocalizacao = typeof navigator !== 'undefined' && !!navigator.geolocation;

export class ErroDaLocalizacao extends Error {
  constructor(public codigo: 'sem_permissao_de_localizacao' | 'sem_localizacao') {
    super(codigo);
  }
}

export function ondeEstou(): Promise<Posicao> {
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
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  });
}
