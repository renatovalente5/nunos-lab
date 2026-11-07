import { QueryClient } from '@tanstack/react-query';
import { textos } from './textos';

export const API = (import.meta.env.VITE_API as string).replace(/\/$/, '');
const CHAVE = 'nunoslab:backoffice:sessao';

/**
 * A sessão deste aparelho. Vive no armazenamento do browser porque a API está
 * noutra origem (o GitHub Pages não deixa a API pôr um cookie do mesmo sítio).
 */
export function sessao(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function guardarSessao(testemunho: string | null) {
  try {
    if (testemunho) localStorage.setItem(CHAVE, testemunho);
    else localStorage.removeItem(CHAVE);
  } catch {
    // Sem armazenamento (modo privado antigo): a sessão dura até fechar a página.
  }
  window.dispatchEvent(new Event('nunoslab:sessao'));
}

/** O texto de um código de recusa, na língua de agora (os códigos estão em textos/geral.ts). */
function textoDoCodigo(codigo: string): string {
  const erros = textos().geral.erros;
  const texto = Object.prototype.hasOwnProperty.call(erros, codigo) ? erros[codigo] : undefined;
  return typeof texto === 'string' ? texto : erros.interno;
}

export class ErroDaApi extends Error {
  constructor(
    public codigo: string,
    public campos: string[] = [],
  ) {
    super(textoDoCodigo(codigo));
  }
}

/** A mensagem de um erro na língua de agora (mudar de língua muda também o erro à vista). */
export function mensagemDe(e: unknown): string {
  return textoDoCodigo(e instanceof ErroDaApi ? e.codigo : 'interno');
}

type Opcoes = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  corpo?: unknown;
  binario?: Blob;
};

export async function pedir<T = void>(
  caminho: string,
  { metodo = 'GET', corpo, binario }: Opcoes = {},
): Promise<T> {
  const cabecalhos: Record<string, string> = {};
  const testemunho = sessao();
  if (testemunho) cabecalhos.Authorization = `Bearer ${testemunho}`;
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (binario) cabecalhos['Content-Type'] = binario.type;
  let r: Response;
  try {
    r = await fetch(API + caminho, {
      method: metodo,
      headers: cabecalhos,
      body: binario ?? (corpo !== undefined ? JSON.stringify(corpo) : undefined),
    });
  } catch {
    throw new ErroDaApi('rede');
  }
  // Uma recusa ao ENTRAR (ligação gasta, Google que não confirma) não é uma sessão que acabou.
  if (r.status === 401 && !caminho.startsWith('/api/bo/entrar')) {
    guardarSessao(null);
    throw new ErroDaApi('sessao');
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { erro?: string; campos?: string[] };
    throw new ErroDaApi(j.erro ?? 'interno', j.campos ?? []);
  }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

export const consultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (n, e) =>
        !(e instanceof ErroDaApi && (e.codigo === 'sessao' || e.codigo === 'nao_existe')) && n < 2,
    },
  },
});

/** Depois de gravar, tudo o que pode ter mudado volta a ser pedido. */
export function refrescar() {
  return consultas.invalidateQueries();
}
