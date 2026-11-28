/**
 * O QR do balcão lido com a câmara do telemóvel quando a app da web não tem sessão (revisão de 27 nov
 * 2026): o código fica guardado até a pessoa entrar e o
 * Cartão, já com sessão, volta ao ecrã do QR com ele. Antes perdia-se ao entrar. Dez minutos: entrar leva
 * um ou dois; meia hora abria o QR já fora da barbearia (2.ª revisão de 27 nov 2026).
 */
import { codigoDoBalcaoValido } from '@nunos-lab/dominio';
import { guardar, lerSincrono } from '@nunos-lab/ui';

const CHAVE = 'nunoslab:qr-pendente';
const VALIDADE = 10 * 60_000;

export function guardarQrPendente(codigo: string | null): void {
  guardar(CHAVE, codigo ? JSON.stringify({ codigo, ate: Date.now() + VALIDADE }) : null);
}

/** O código guardado, se ainda vale; e esquece-o (abre o ecrã do QR uma vez só). */
export function tirarQrPendente(): string | null {
  const texto = lerSincrono(CHAVE);
  if (!texto) return null;
  guardar(CHAVE, null);
  try {
    const v = JSON.parse(texto) as { codigo?: unknown; ate?: unknown } | null;
    return v &&
      typeof v.codigo === 'string' &&
      codigoDoBalcaoValido(v.codigo) &&
      typeof v.ate === 'number' &&
      v.ate > Date.now()
      ? v.codigo
      : null;
  } catch {
    return null;
  }
}
