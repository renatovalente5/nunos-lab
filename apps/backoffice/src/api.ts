import { QueryClient } from '@tanstack/react-query';

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

const MENSAGENS: Record<string, string> = {
  sessao: 'A sessão acabou. Entra outra vez com uma ligação de acesso.',
  ligacao_invalida: 'Esta ligação já foi usada ou já caducou. Entra com o Google.',
  google_invalido: 'O Google não confirmou a entrada. Tenta outra vez.',
  sem_acesso: 'Esta conta Google não tem acesso ao backoffice.',
  muitas_tentativas: 'Demasiadas tentativas. Espera um minuto.',
  invalido: 'Há campos por corrigir.',
  json: 'O pedido chegou partido. Tenta outra vez.',
  referencia: 'Uma das escolhas já não existe. Recarrega a página.',
  datas: 'A data de fim tem de ser no mesmo dia ou depois do início.',
  imagem_grande: 'A imagem é grande demais.',
  tipo_de_imagem: 'Esse formato não serve. Usa JPG, PNG ou WebP.',
  imagem_invalida: 'Esse ficheiro não é uma imagem.',
  imagem_vazia: 'Esse ficheiro está vazio.',
  medidas: 'Não consegui ler as medidas da imagem.',
  a_si_proprio: 'Não podes tirar o teu próprio acesso.',
  nao_existe: 'Isto já não existe. Recarrega a página.',
  nada_a_mudar: 'Não havia nada para gravar.',
  repetido: 'Isso já existe.',
  rede: 'Sem ligação à internet. Tenta outra vez.',
  interno: 'Algo correu mal do nosso lado. Tenta outra vez.',
};

export class ErroDaApi extends Error {
  constructor(
    public codigo: string,
    public campos: string[] = [],
  ) {
    super(MENSAGENS[codigo] ?? MENSAGENS.interno);
  }
}

export function mensagemDe(e: unknown): string {
  return e instanceof ErroDaApi ? e.message : (MENSAGENS.interno as string);
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
  if (r.status === 401 && caminho !== '/api/bo/entrar') {
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
      retry: (n, e) => !(e instanceof ErroDaApi && e.codigo === 'sessao') && n < 2,
    },
  },
});

/** Depois de gravar, tudo o que pode ter mudado volta a ser pedido. */
export function refrescar() {
  return consultas.invalidateQueries();
}
