/**
 * O saldo e os convites na app (o Renato, 10 nov 2026): o que o cliente já viu do saldo (para o
 * aviso e a pílula contarem só o que é novo) e o código de um convite que chegou por uma ligação,
 * guardado até a pessoa entrar.
 */
import type { MovimentoDoSaldo } from '@nunos-lab/dominio';
import { guardar, lerSincrono } from '@nunos-lab/ui';
import { useSyncExternalStore } from 'react';
import type { Textos } from './textos';

export const CHAVE_DO_SALDO_VISTO = 'nunoslab:saldo-visto';
export const CHAVE_DO_CONVITE = 'nunoslab:convite';

/** O saldo como o cliente o viu da última vez: o último movimento (e se estava anulado) e o valor. */
export type SaldoVisto = { chave: string; saldo: number };

/** A chave de um movimento: anular o último também é novidade (o saldo volta). */
export function chaveDoMovimento(m: MovimentoDoSaldo | null): string {
  return m ? `${m.id}${m.anulado ? 'a' : ''}` : '-';
}

export function lerVisto(): SaldoVisto | null {
  try {
    const v = JSON.parse(lerSincrono(CHAVE_DO_SALDO_VISTO) ?? 'null') as SaldoVisto | null;
    return v && typeof v.chave === 'string' && typeof v.saldo === 'number' ? v : null;
  } catch {
    return null;
  }
}

export function marcarVisto(v: SaldoVisto): void {
  guardar(CHAVE_DO_SALDO_VISTO, JSON.stringify(v));
}

// ——— o convite que chegou por uma ligação (/?convite=CODIGO) ———

const ouvintes = new Set<() => void>();

export function conviteGuardado(): string | null {
  return lerSincrono(CHAVE_DO_CONVITE);
}

export function guardarConvite(codigo: string | null): void {
  guardar(CHAVE_DO_CONVITE, codigo);
  for (const o of ouvintes) o();
}

/** O código guardado (muda quando chega uma ligação, ou quando se usa). */
export function useConviteGuardado(): string | null {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    conviteGuardado,
    () => null,
  );
}

// ——— o QR em grande à frente: o aviso do saldo espera por trás dele ———

let qrAberto = false;
const ouvintesDoQr = new Set<() => void>();

/** O Cartão diz quando o QR em grande abre e fecha (um Modal tapa o aviso, que ficava por ver). */
export function definirQrAberto(aberto: boolean): void {
  qrAberto = aberto;
  for (const o of ouvintesDoQr) o();
}

export function useQrAberto(): boolean {
  return useSyncExternalStore(
    (o) => {
      ouvintesDoQr.add(o);
      return () => ouvintesDoQr.delete(o);
    },
    () => qrAberto,
    () => false,
  );
}

/** A frase de um movimento, na língua da app. */
export function fraseDoMovimento(m: MovimentoDoSaldo, t: Textos): string {
  const f = t.carteira.movimento;
  switch (m.tipo) {
    case 'convidado':
      return f.convidado(m.quem);
    case 'convite':
      return f.convite(m.quem);
    case 'uso':
      return f.uso(m.loja);
    default:
      return m.nota || f.acerto;
  }
}
