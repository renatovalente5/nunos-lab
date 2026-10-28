import { deBase64 } from './bytes.ts';
import { ler, pareceChavePrivada } from './der.ts';

/**
 * Os segredos em PEM (certificado, cadeia, chaves). As mensagens dizem ONDE
 * está o problema e nunca uma letra do conteúdo: um segredo não vai para o
 * registo. O «\n» literal (um segredo colado numa linha) sai primeiro.
 */
export function blocosDoPem(entrada: string | null | undefined, onde: string) {
  const s = String(entrada ?? '')
    .replace(/\\n/g, '\n')
    .trim();
  if (!s) return [];
  const blocos = [...s.matchAll(/-----BEGIN ([^-]+)-----([\s\S]*?)-----END ([^-]+)-----/g)];
  if (!blocos.length) {
    if (s.includes('-----')) throw new Error(`${onde} tem um BEGIN ou um END sem o par.`);
    return [{ rotulo: '', bytes: deBase64(s) }];
  }
  return blocos.map((m, i) => {
    const rotulo = m[1]!.trim();
    let bytes: Uint8Array;
    try {
      bytes = deBase64(m[2]!);
    } catch {
      throw new Error(`O bloco ${i + 1} de ${onde} não é base64.`);
    }
    if (ler(bytes, 0).fim !== bytes.length)
      throw new Error(`O bloco ${i + 1} de ${onde} está truncado.`);
    return { rotulo, bytes };
  });
}

/** Só os certificados — e REBENTA se lá vier uma chave privada (ia parar dentro de cada passe). */
export function certificadosDoPem(entrada: string | null | undefined, onde: string): Uint8Array[] {
  return blocosDoPem(entrada, onde).map((b, i) => {
    if (b.rotulo ? /PRIVATE KEY/.test(b.rotulo) : pareceChavePrivada(b.bytes))
      throw new Error(
        `Há uma CHAVE PRIVADA em ${onde} (bloco ${i + 1}); aí só entram certificados.`,
      );
    if (b.rotulo && !/^(X509 )?CERTIFICATE$/.test(b.rotulo))
      throw new Error(
        `O bloco ${i + 1} de ${onde} é «${b.rotulo}», e aqui só entram certificados.`,
      );
    return b.bytes;
  });
}

/** A chave privada em PKCS#8 («BEGIN PRIVATE KEY»), que é o que a WebCrypto importa. */
export function chavePrivadaDoPem(entrada: string | null | undefined, onde: string): Uint8Array {
  const todos = blocosDoPem(entrada, onde);
  if (todos.length !== 1)
    throw new Error(`${onde} tem de ter exactamente um bloco (tem ${todos.length}).`);
  const { rotulo, bytes } = todos[0]!;
  if (rotulo === 'RSA PRIVATE KEY' || rotulo === 'EC PRIVATE KEY')
    throw new Error(
      `A chave em ${onde} está em PKCS#1/SEC1; tem de ser PKCS#8 («openssl pkcs8 -topk8 -nocrypt»).`,
    );
  if (rotulo === 'ENCRYPTED PRIVATE KEY')
    throw new Error(`A chave em ${onde} está cifrada; tem de ir sem palavra-passe.`);
  if (rotulo && rotulo !== 'PRIVATE KEY')
    throw new Error(`${onde} tem um bloco «${rotulo}», e não uma chave privada.`);
  if (!pareceChavePrivada(bytes)) throw new Error(`${onde} não tem uma chave privada.`);
  return bytes;
}

const cache = new Map<string, Promise<CryptoKey>>();

/** A chave de assinatura, importada UMA vez por instância (importar uma RSA custa CPU). */
export function chaveDeAssinatura(
  pem: string,
  tipo: 'RSASSA-PKCS1-v1_5' | 'ECDSA-P256',
  onde: string,
) {
  const id = `${tipo}\u0000${pem}`;
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const der = chavePrivadaDoPem(pem, onde);
      const alg =
        tipo === 'ECDSA-P256'
          ? { name: 'ECDSA', namedCurve: 'P-256' }
          : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
      try {
        return await crypto.subtle.importKey('pkcs8', der as BufferSource, alg, false, ['sign']);
      } catch {
        throw new Error(
          `A chave em ${onde} não é ${tipo === 'ECDSA-P256' ? 'EC P-256' : 'RSA'} em PKCS#8.`,
        );
      }
    })();
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(id, p);
  }
  return p;
}
