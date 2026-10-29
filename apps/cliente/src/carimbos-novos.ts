import type { ClienteEu } from '@nunos-lab/dominio';
import { guardar, lerSincrono, vibrar } from '@nunos-lab/ui';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const CHAVE_DO_CARTAO_VISTO = 'nunoslab:cartao-visto';
type Visto = { id: number; carimbos: number };

/**
 * Os carimbos que o cliente ainda não viu. A app lembra-se do cartão como o
 * mostrou da última vez (qual, e com quantos carimbos) e, quando há mais, diz
 * a partir de que casa animar: a cerimónia é na abertura da app, ou ao balcão,
 * quando o carimbo chega com a app aberta. Só com o separador à frente, para
 * ser vista. A primeira vez não anima nada. Com «Reduzir movimento» ligado,
 * fica só o toque no pulso.
 */
export function useCarimbosNovos(
  cartao: ClienteEu['cartao'] | null | undefined,
  focado: boolean,
): { novasDesde: number | null; aoAcabar: () => void } {
  const [novasDesde, setNovasDesde] = useState<number | null>(null);
  const [festa, setFesta] = useState(false);
  useEffect(() => {
    if (!cartao || !focado) return;
    let visto: Visto | null = null;
    try {
      visto = JSON.parse(lerSincrono(CHAVE_DO_CARTAO_VISTO) ?? 'null') as Visto | null;
    } catch {
      visto = null;
    }
    const actual: Visto = { id: cartao.id, carimbos: cartao.carimbos };
    guardar(CHAVE_DO_CARTAO_VISTO, JSON.stringify(actual));
    if (!visto || typeof visto.id !== 'number') return;
    const desde =
      visto.id === actual.id
        ? actual.carimbos > visto.carimbos
          ? visto.carimbos
          : null
        : actual.carimbos > 0
          ? 0
          : null;
    if (desde === null) return;
    const completo = actual.carimbos >= cartao.objectivo;
    let vivo = true;
    const reduzir: Promise<boolean> =
      typeof AccessibilityInfo.isReduceMotionEnabled === 'function'
        ? AccessibilityInfo.isReduceMotionEnabled()
        : Promise.resolve(false);
    reduzir
      .catch(() => false)
      .then((semMovimento) => {
        if (!vivo) return;
        if (semMovimento) {
          vibrar(completo ? 'festa' : 'feito');
          return;
        }
        setFesta(completo);
        setNovasDesde(desde);
        // O toque vai com a primeira casa a entrar (a pausa inicial da animação).
        setTimeout(() => vivo && vibrar('feito'), 350);
      });
    return () => {
      vivo = false;
    };
  }, [cartao?.id, cartao?.carimbos, cartao?.objectivo, focado]); // eslint-disable-line react-hooks/exhaustive-deps
  const aoAcabar = () => {
    if (festa) vibrar('festa');
    setFesta(false);
    setNovasDesde(null);
  };
  return { novasDesde, aoAcabar };
}
