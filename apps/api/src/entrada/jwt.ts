/**
 * Um JWT assinado com RS256 por um provedor (a Google, a Apple): confere-se a
 * assinatura contra as chaves públicas dele e devolve-se o conteúdo. O que o
 * conteúdo tem de dizer (iss, aud, exp…) decide quem chama. Só WebCrypto e
 * fetch: corre igual no Worker e no Node (os testes).
 */

export type Chaves = (renovar?: boolean) => Promise<Map<string, CryptoKey>>;

/** As chaves públicas de uma morada JWKS, guardadas enquanto o provedor disser (no máximo 6 h). */
export function chavesDe(url: string): Chaves {
  let guardadas: { chaves: Map<string, CryptoKey>; ate: number } | null = null;
  return async (renovar = false) => {
    if (!renovar && guardadas && guardadas.ate > Date.now()) return guardadas.chaves;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`As chaves de ${new URL(url).host} responderam ${r.status}`);
    const { keys } = (await r.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const chaves = new Map<string, CryptoKey>();
    for (const k of keys)
      if (k.kty === 'RSA')
        chaves.set(
          k.kid,
          await crypto.subtle.importKey(
            'jwk',
            { kty: k.kty, n: k.n, e: k.e, alg: 'RS256', ext: true },
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify'],
          ),
        );
    const idade = Number(/max-age=(\d+)/.exec(r.headers.get('Cache-Control') ?? '')?.[1] ?? 3600);
    guardadas = { chaves, ate: Date.now() + Math.min(idade, 21_600) * 1000 };
    return chaves;
  };
}

export function deBase64url(s: string): Uint8Array {
  const b64 = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(s.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function lerJson(parte: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(new TextDecoder().decode(deBase64url(parte)));
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * O conteúdo de um JWT com a assinatura conferida, ou null. Uma «kid» que não
 * conhecemos pede as chaves outra vez, uma vez (os provedores rodam-nas).
 */
export async function conteudoDoJwt(
  token: string,
  chaves: Chaves,
): Promise<Record<string, unknown> | null> {
  const partes = token.split('.');
  if (partes.length !== 3 || partes.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
  const [cabecalho, corpo] = [lerJson(partes[0]!), lerJson(partes[1]!)];
  if (!cabecalho || !corpo || cabecalho.alg !== 'RS256' || typeof cabecalho.kid !== 'string')
    return null;
  let chave = (await chaves()).get(cabecalho.kid);
  if (!chave) chave = (await chaves(true)).get(cabecalho.kid);
  if (!chave) return null;
  const assinada = new TextEncoder().encode(`${partes[0]}.${partes[1]}`);
  const certa = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    chave,
    deBase64url(partes[2]!),
    assinada,
  );
  return certa ? corpo : null;
}

/** As verificações que todos têm: quem o passou, para quem, e se ainda vale. */
export function conteudoValido(
  corpo: Record<string, unknown>,
  { iss, aud, agora }: { iss: string[]; aud: string[]; agora: number },
): boolean {
  if (typeof corpo.iss !== 'string' || !iss.includes(corpo.iss)) return false;
  const audiencias = Array.isArray(corpo.aud) ? corpo.aud : [corpo.aud];
  if (!audiencias.some((a) => typeof a === 'string' && aud.includes(a))) return false;
  if (typeof corpo.exp !== 'number' || corpo.exp < agora - 60) return false;
  if (typeof corpo.iat === 'number' && corpo.iat > agora + 300) return false;
  return true;
}
