import { buffer, paraBase64url, utf8 } from './bytes.ts';
import { chaveDeAssinatura } from './pem.ts';

/** Os JWT das carteiras: RS256 (Google) e ES256 (APNs). A WebCrypto devolve o ES256 em «r‖s», que é o que um JWS quer. */
export async function assinarJwt(
  alg: 'RS256' | 'ES256',
  pem: string,
  onde: string,
  cabecalho: Record<string, unknown>,
  corpo: Record<string, unknown>,
): Promise<string> {
  const chave = await chaveDeAssinatura(
    pem,
    alg === 'RS256' ? 'RSASSA-PKCS1-v1_5' : 'ECDSA-P256',
    onde,
  );
  const json = (v: unknown) => paraBase64url(utf8(JSON.stringify(v)));
  const dados = `${json({ alg, typ: 'JWT', ...cabecalho })}.${json(corpo)}`;
  const assinatura = await crypto.subtle.sign(
    alg === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5' } : { name: 'ECDSA', hash: 'SHA-256' },
    chave,
    buffer(utf8(dados)),
  );
  return `${dados}.${paraBase64url(new Uint8Array(assinatura))}`;
}
