/**
 * «Entrar com o Google»: o botão do Google, no browser, devolve um JWT (o
 * «credential»), assinado pelo Google com RS256. Confere-se a assinatura e o
 * que o token diz: que é para ESTE cliente, que foi o Google que o passou, que
 * ainda vale, e que o email está verificado. Quem entra decide-o quem chama.
 */
import { chavesDe, conteudoDoJwt, conteudoValido, type Chaves } from '../entrada/jwt.ts';

export type IdentidadeGoogle = { email: string; sub: string; nome: string };

export const chavesDoGoogle: Chaves = chavesDe('https://www.googleapis.com/oauth2/v3/certs');

/** A identidade do token, ou `null` se alguma coisa nele não bater certo. */
export async function conferirCredencialGoogle(
  credencial: string,
  cliente: string,
  { agora = Date.now() / 1000, chaves = chavesDoGoogle }: { agora?: number; chaves?: Chaves } = {},
): Promise<IdentidadeGoogle | null> {
  const corpo = await conteudoDoJwt(credencial, chaves);
  if (!corpo) return null;
  if (
    !conteudoValido(corpo, {
      iss: ['accounts.google.com', 'https://accounts.google.com'],
      aud: [cliente],
      agora,
    })
  )
    return null;
  if (corpo.email_verified !== true && corpo.email_verified !== 'true') return null;
  if (typeof corpo.email !== 'string' || typeof corpo.sub !== 'string') return null;
  return {
    email: corpo.email.trim().toLowerCase(),
    sub: corpo.sub,
    nome:
      typeof corpo.given_name === 'string'
        ? corpo.given_name
        : typeof corpo.name === 'string'
          ? corpo.name
          : '',
  };
}
