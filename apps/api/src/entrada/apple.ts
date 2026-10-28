/**
 * «Entrar com a Apple»: a Apple devolve um id_token (RS256) com o «sub» da
 * pessoa e, se ela quiser, o email — que pode ser de retransmissão
 * (@privaterelay.appleid.com). O «aud» é o Services ID (na web) ou o bundle
 * id (na app nativa). O «nonce» prende o token ao pedido que a app fez: na web
 * vai tal e qual; na app nativa vai o SHA-256 dele.
 */
import { chavesDe, conteudoDoJwt, conteudoValido, type Chaves } from './jwt.ts';

export type IdentidadeApple = { sub: string; email: string | null; emailVerificado: boolean };

export const chavesDaApple: Chaves = chavesDe('https://appleid.apple.com/auth/keys');

async function sha256Hex(texto: string): Promise<string> {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function conferirTokenDaApple(
  token: string,
  clientes: string[],
  nonce: string | null,
  { agora = Date.now() / 1000, chaves = chavesDaApple }: { agora?: number; chaves?: Chaves } = {},
): Promise<IdentidadeApple | null> {
  const corpo = await conteudoDoJwt(token, chaves);
  if (!corpo) return null;
  if (!conteudoValido(corpo, { iss: ['https://appleid.apple.com'], aud: clientes, agora }))
    return null;
  if (typeof corpo.sub !== 'string' || !corpo.sub) return null;
  if (nonce) {
    if (typeof corpo.nonce !== 'string') return null;
    if (corpo.nonce !== nonce && corpo.nonce !== (await sha256Hex(nonce))) return null;
  }
  const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : null;
  return {
    sub: corpo.sub,
    email,
    emailVerificado: corpo.email_verified === true || corpo.email_verified === 'true',
  };
}
