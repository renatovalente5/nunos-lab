import { assinarJwt } from './jwt.ts';

/**
 * A APNs: o toque que diz ao iPhone «vai ver o teu passe» (o corpo é «{}»; é
 * o iPhone que pergunta o que mudou). Por TOKEN (a .p8 da equipa, ES256): o
 * «apns-topic» é o Pass Type ID. O bilhete vale uma hora e a Apple recusa
 * quem o renove mais de uma vez em 20 minutos: guarda-se 50 minutos na base.
 */
export const BILHETE_APNS_VALE = 50 * 60;
const APNS = 'https://api.push.apple.com';
const UMA_SEMANA = 7 * 24 * 3600;

export function assinarBilheteApns(chave: string, kid: string, equipa: string, agora: number) {
  if (!/^[A-Z0-9]{10}$/.test(kid) || !/^[A-Z0-9]{10}$/.test(equipa))
    throw new Error('APNS_KID e APPLE_EQUIPA são 10 letras e algarismos.');
  return assinarJwt('ES256', chave, 'APNS_CHAVE', { kid }, { iss: equipa, iat: Math.floor(agora) });
}

export type RespostaDaApns =
  'entregue' | 'aparelho_morto' | 'bilhete_recusado' | 'repetir' | 'recusado';

export async function avisarApns(
  pushToken: string,
  bilhete: string,
  topico: string,
  agora: number,
): Promise<RespostaDaApns> {
  if (!/^[0-9A-Fa-f]{16,256}$/.test(pushToken)) return 'aparelho_morto';
  const r = await fetch(`${APNS}/3/device/${pushToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${bilhete}`,
      'apns-topic': topico,
      'apns-push-type': 'alert',
      'apns-priority': '5',
      // Nunca zero: «0» diz à APNs para não guardar, e quem está sem rede fica com o passe parado.
      'apns-expiration': String(Math.floor(agora) + UMA_SEMANA),
      'content-type': 'application/json',
    },
    body: '{}',
    redirect: 'manual',
  });
  if (r.status === 200) return 'entregue';
  let motivo = '';
  try {
    motivo = String(((await r.json()) as { reason?: unknown }).reason ?? '');
  } catch {
    // sem corpo
  }
  if (r.status === 410 || motivo === 'Unregistered' || motivo === 'BadDeviceToken')
    return 'aparelho_morto';
  if (r.status === 403 && (motivo === 'ExpiredProviderToken' || motivo === 'InvalidProviderToken'))
    return 'bilhete_recusado';
  if (r.status === 429 || r.status >= 500) return 'repetir';
  console.error('apns', r.status, motivo);
  return 'recusado';
}
