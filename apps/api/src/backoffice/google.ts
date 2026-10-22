/**
 * «Entrar com o Google»: o botão do Google, no browser, devolve um JWT (o
 * «credential»), assinado pelo Google com RS256. Aqui confere-se a assinatura
 * contra as chaves públicas do Google, e depois o que o token diz: que é para
 * ESTE cliente, que foi o Google que o passou, que ainda vale, e que o email
 * está verificado. Quem entra decide-o a lista de emails das pessoas.
 *
 * Só usa WebCrypto e fetch: corre igual no Worker e no Node (os testes).
 */

export type IdentidadeGoogle = { email: string; sub: string; nome: string };

type ChavesDoGoogle = (renovar?: boolean) => Promise<Map<string, CryptoKey>>;

const CERTIFICADOS = 'https://www.googleapis.com/oauth2/v3/certs';
let guardadas: { chaves: Map<string, CryptoKey>; ate: number } | null = null;

/** As chaves públicas do Google, guardadas enquanto o Google disser (no máximo 6 h). */
export const chavesDoGoogle: ChavesDoGoogle = async (renovar = false) => {
  if (!renovar && guardadas && guardadas.ate > Date.now()) return guardadas.chaves;
  const r = await fetch(CERTIFICADOS);
  if (!r.ok) throw new Error(`As chaves do Google responderam ${r.status}`);
  const { keys } = (await r.json()) as { keys: (JsonWebKey & { kid: string })[] };
  const chaves = new Map<string, CryptoKey>();
  for (const k of keys)
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

function deBase64url(s: string): Uint8Array {
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

/** A identidade do token, ou `null` se alguma coisa nele não bater certo. */
export async function conferirCredencialGoogle(
  credencial: string,
  cliente: string,
  {
    agora = Date.now() / 1000,
    chaves = chavesDoGoogle,
  }: { agora?: number; chaves?: ChavesDoGoogle } = {},
): Promise<IdentidadeGoogle | null> {
  const partes = credencial.split('.');
  if (partes.length !== 3 || partes.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
  const [cabecalho, corpo] = [lerJson(partes[0]!), lerJson(partes[1]!)];
  if (!cabecalho || !corpo || cabecalho.alg !== 'RS256' || typeof cabecalho.kid !== 'string')
    return null;
  // O Google roda as chaves: uma «kid» que não conhecemos pede as chaves outra vez, uma vez.
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
  if (!certa) return null;
  if (corpo.iss !== 'accounts.google.com' && corpo.iss !== 'https://accounts.google.com')
    return null;
  if (corpo.aud !== cliente) return null;
  if (typeof corpo.exp !== 'number' || corpo.exp < agora - 60) return null;
  if (typeof corpo.iat === 'number' && corpo.iat > agora + 300) return null;
  if (corpo.email_verified !== true && corpo.email_verified !== 'true') return null;
  if (typeof corpo.email !== 'string' || typeof corpo.sub !== 'string') return null;
  return {
    email: corpo.email.trim().toLowerCase(),
    sub: corpo.sub,
    nome: typeof corpo.name === 'string' ? corpo.name : '',
  };
}
