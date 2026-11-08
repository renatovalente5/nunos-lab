import { eLingua, type Lingua } from '@nunos-lab/dominio';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';
import type { C } from './ambiente.ts';

export const agora = (): number => Math.floor(Date.now() / 1000);
export const DIA = 86_400;

/** A língua de um pedido da app (`?lingua=en`); sem ela, ou outra qualquer, o português. */
export function linguaDoPedido(c: {
  req: { query: (nome: string) => string | undefined };
}): Lingua {
  const l = c.req.query('lingua');
  return eLingua(l) ? l : 'pt';
}

/** Uma recusa com código: a app e o backoffice traduzem o código para texto. */
export function recusar(
  estado: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 503,
  codigo: string,
): never {
  throw new HTTPException(estado, {
    res: new Response(JSON.stringify({ erro: codigo }), {
      status: estado,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
  });
}

/** O corpo JSON do pedido, validado; um campo errado dá 400 com os nomes dos campos. */
export async function corpo<T extends z.ZodType>(c: C, esquema: T): Promise<z.output<T>> {
  // Nenhum corpo legítimo passa de uns KB: o resto nem se lê.
  if (Number(c.req.header('Content-Length') ?? 0) > 65_536) recusar(413, 'grande');
  let dados: unknown;
  try {
    dados = await c.req.json();
  } catch {
    recusar(400, 'json');
  }
  const r = esquema.safeParse(dados);
  if (!r.success) {
    // O nome de cima («lojas») e o caminho inteiro («lojas.0.telefone»), para o
    // backoffice marcar o campo certo dentro de uma lista.
    const campos = [
      ...new Set(
        r.error.issues.flatMap((i) => [String(i.path[0] ?? ''), i.path.map(String).join('.')]),
      ),
    ].filter(Boolean);
    throw new HTTPException(400, {
      res: new Response(JSON.stringify({ erro: 'invalido', campos }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
    });
  }
  return r.data;
}

/**
 * A pessoa da equipa que é a conta da revisão das lojas (a «App Review» da Apple, 8 nov): a variável
 * REVISAO_PESSOA da produção; sem ela (em local), 0, que não é o id de ninguém.
 */
export function pessoaDaRevisao(env: object): number {
  return Number((env as { REVISAO_PESSOA?: string }).REVISAO_PESSOA) || 0;
}

/** Um id inteiro positivo vindo da morada; outra coisa qualquer dá 404. */
export function idDaMorada(c: C, nome = 'id'): number {
  const v = c.req.param(nome) ?? '';
  if (!/^[1-9]\d{0,9}$/.test(v)) recusar(404, 'nao_existe');
  return Number(v);
}

export function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(dados: string | Uint8Array): Promise<Uint8Array> {
  const entrada = typeof dados === 'string' ? new TextEncoder().encode(dados) : dados;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', entrada));
}

/** `n` bytes aleatórios em base64url (32 bytes → 43 caracteres). */
export function aleatorio(n = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** O D1 recebe BLOBs como ArrayBuffer. */
export function blob(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** E devolve-os como ArrayBuffer ou como lista de números, conforme a versão. */
export function paraBytes(valor: unknown): Uint8Array {
  if (valor instanceof Uint8Array) return valor;
  if (valor instanceof ArrayBuffer) return new Uint8Array(valor);
  if (Array.isArray(valor)) return Uint8Array.from(valor as number[]);
  throw new Error('BLOB num formato desconhecido');
}

/** «iPhone · Safari», «Mac · Chrome»: o suficiente para a pessoa reconhecer o aparelho. */
export function aparelhoDe(ua: string): string {
  const sistema = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Aparelho';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /CriOS|Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '';
  return browser ? `${sistema} · ${browser}` : sistema;
}

/**
 * O nome do aparelho de um pedido. As apps nativas dizem-no no cabeçalho `X-Aparelho` («iPhone»,
 * «Android · Samsung SM-S911B»): o User-Agent delas («CFNetwork/Darwin», «okhttp») não diz nada e
 * a lista das sessões ficava cheia de «Aparelho». A web vai pelo User-Agent («Mac · Safari»).
 */
export function aparelhoDoPedido(c: { req: { header(nome: string): string | undefined } }): string {
  const dito = (c.req.header('X-Aparelho') ?? '')
    .replace(/[^\p{L}\p{N} ·.,()+\-]/gu, '')
    .trim()
    .slice(0, 40);
  return dito || aparelhoDe(c.req.header('User-Agent') ?? '');
}

/** Uma linha do registo, para ir no mesmo batch que a mudança. */
export function registar(c: C, accao: string, alvo = ''): D1PreparedStatement {
  return c.env.DB.prepare('INSERT INTO registo (admin_id, accao, alvo) VALUES (?, ?, ?)').bind(
    c.get('admin')?.id ?? null,
    accao,
    alvo.slice(0, 120),
  );
}

/** Traduz as recusas da base (chaves estrangeiras, limites) para um 400 com código. */
export function traduzirErroDaBase(e: unknown): never {
  const m = e instanceof Error ? e.message : String(e);
  if (/FOREIGN KEY/i.test(m)) recusar(400, 'referencia');
  if (/CHECK constraint/i.test(m)) recusar(400, 'invalido');
  if (/UNIQUE constraint/i.test(m)) recusar(409, 'repetido');
  throw e;
}
