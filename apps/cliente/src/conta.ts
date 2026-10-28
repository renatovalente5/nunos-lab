/**
 * A conta do cliente na app: a sessão fica no aparelho, o «eu» (cartão,
 * visitas, formas de entrar) vem de /api/eu e fica em cache para abrir sem
 * rede. A API vive noutra origem: a sessão vai no cabeçalho.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClienteEu } from '@nunos-lab/dominio';
import { useSyncExternalStore } from 'react';
import { Linking, Platform } from 'react-native';
import { guardar as guardarNoArmazem, lerSincrono } from '@nunos-lab/ui';
import { API } from './dados';

const CHAVE_DA_SESSAO = 'nunoslab:sessao';
const CHAVE_DO_EU = 'nunoslab:eu:1';

export const GOOGLE_CLIENTE = process.env.EXPO_PUBLIC_GOOGLE_CLIENTE ?? '';
export const APPLE_CLIENTE = process.env.EXPO_PUBLIC_APPLE_CLIENTE ?? '';

const ouvintes = new Set<() => void>();
function avisar() {
  for (const o of ouvintes) o();
}

export function sessao(): string | null {
  return lerSincrono(CHAVE_DA_SESSAO);
}

export function guardarSessao(testemunho: string | null) {
  guardarNoArmazem(CHAVE_DA_SESSAO, testemunho);
  if (!testemunho) guardarNoArmazem(CHAVE_DO_EU, null);
  avisar();
}

/** Há sessão neste aparelho? (muda quando se entra ou sai). */
export function useTemSessao(): boolean {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => !!sessao(),
    () => false,
  );
}

const MENSAGENS: Record<string, string> = {
  sessao: 'A sessão acabou. Entra outra vez.',
  google_invalido: 'O Google não confirmou a entrada. Tenta outra vez.',
  apple_invalido: 'A Apple não confirmou a entrada. Tenta outra vez.',
  apple_desligado: 'Entrar com a Apple ainda não está disponível.',
  muitas_tentativas: 'Demasiadas tentativas. Espera um minuto.',
  codigo_invalido: 'Código errado.',
  prova_recente: 'Para mudar isto, entra outra vez.',
  noutra_conta: 'Essa conta já está ligada a outro cartão.',
  forma_actual: 'É a forma com que entraste agora. Entra por outra e volta aqui.',
  ultima_forma: 'É a única forma de entrar: não se pode tirar.',
  so_formas_novas: 'Só podes tirar esta daqui a uns dias.',
  invalido: 'Há algo por corrigir.',
  rede: 'Sem ligação. Tenta outra vez.',
  interno: 'Algo correu mal. Tenta outra vez.',
};

export class ErroDaConta extends Error {
  constructor(public codigo: string) {
    super(MENSAGENS[codigo] ?? MENSAGENS.interno);
  }
}

export function mensagemDe(e: unknown): string {
  return e instanceof ErroDaConta ? e.message : (MENSAGENS.interno as string);
}

async function pedir<T = void>(
  caminho: string,
  { metodo = 'GET', corpo }: { metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; corpo?: unknown } = {},
): Promise<T> {
  const cabecalhos: Record<string, string> = {};
  const t = sessao();
  if (t) cabecalhos.Authorization = `Bearer ${t}`;
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  let r: Response;
  try {
    r = await fetch(`${API}/api/eu${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroDaConta('rede');
  }
  if (r.status === 401 && !caminho.startsWith('/entrar')) {
    guardarSessao(null);
    throw new ErroDaConta('sessao');
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { erro?: string };
    throw new ErroDaConta(j.erro ?? 'interno');
  }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

function lerEuGuardado(): ClienteEu | undefined {
  try {
    const texto = lerSincrono(CHAVE_DO_EU);
    return texto ? (JSON.parse(texto) as ClienteEu) : undefined;
  } catch {
    return undefined;
  }
}

async function buscarEu(): Promise<ClienteEu> {
  const eu = await pedir<ClienteEu>('');
  guardarNoArmazem(CHAVE_DO_EU, JSON.stringify(eu));
  return eu;
}

/** O cliente: o cartão, as visitas, a conta. Pede de 15 em 15 s enquanto está à vista. */
export function useEu(aoVivo = false) {
  const temSessao = useTemSessao();
  return useQuery({
    queryKey: ['eu'],
    queryFn: buscarEu,
    enabled: temSessao,
    initialData: temSessao ? lerEuGuardado : undefined,
    initialDataUpdatedAt: 0,
    networkMode: 'always',
    staleTime: 5_000,
    refetchInterval: aoVivo ? 15_000 : false,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/** Depois de entrar ou de mudar a conta, o «eu» volta a pedir-se. */
export function useConta() {
  const consultas = useQueryClient();
  const entrou = async (r: { sessao: string }) => {
    guardarSessao(r.sessao);
    await consultas.invalidateQueries({ queryKey: ['eu'] });
  };
  const actualizar = (eu: ClienteEu) => {
    consultas.setQueryData(['eu'], eu);
    guardarNoArmazem(CHAVE_DO_EU, JSON.stringify(eu));
  };
  return {
    entrarComGoogle: (credencial: string) =>
      pedir<{ sessao: string }>('/entrar/google', { metodo: 'POST', corpo: { credencial } }).then(
        entrou,
      ),
    entrarComApple: (dados: { token: string; nonce: string; nome: string | null }) =>
      pedir<{ sessao: string }>('/entrar/apple', { metodo: 'POST', corpo: dados }).then(entrou),
    entrarComDemonstracao: (codigo: string) =>
      pedir<{ sessao: string }>('/entrar/demonstracao', { metodo: 'POST', corpo: { codigo } }).then(
        entrou,
      ),
    perfil: (p: { nome?: string; aniversario?: string | null; lojaId?: number | null }) =>
      pedir<ClienteEu>('/perfil', { metodo: 'PATCH', corpo: p }).then(actualizar),
    juntarGoogle: (credencial: string) =>
      pedir<ClienteEu>('/formas/google', { metodo: 'POST', corpo: { credencial } }).then(
        actualizar,
      ),
    juntarApple: (dados: { token: string; nonce: string; nome: string | null }) =>
      pedir<ClienteEu>('/formas/apple', { metodo: 'POST', corpo: dados }).then(actualizar),
    tirarForma: (id: number) =>
      pedir<ClienteEu>(`/formas/${id}`, { metodo: 'DELETE' }).then(actualizar),
    sairDasOutras: () => pedir<ClienteEu>('/sair-das-outras', { metodo: 'POST' }).then(actualizar),
    perdiOTelemovel: () =>
      pedir<ClienteEu>('/perdi-o-telemovel', { metodo: 'POST' }).then(actualizar),
    sair: async () => {
      try {
        await pedir('/sair', { metodo: 'POST' });
      } finally {
        guardarSessao(null);
        consultas.removeQueries({ queryKey: ['eu'] });
      }
    },
    apagar: async () => {
      await pedir('', { metodo: 'DELETE' });
      guardarSessao(null);
      consultas.removeQueries({ queryKey: ['eu'] });
    },
  };
}

/** Onde a app está a correr, para mostrar a carteira certa (iPhone: Apple; Android: Google; resto: as duas). */
export function carteirasDaqui(): { apple: boolean; google: boolean } {
  if (Platform.OS === 'ios') return { apple: true, google: false };
  if (Platform.OS === 'android') return { apple: false, google: true };
  if (typeof navigator === 'undefined') return { apple: true, google: true };
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Macintosh/.test(ua)) return { apple: true, google: false };
  if (/Android/.test(ua)) return { apple: false, google: true };
  return { apple: true, google: true };
}

/** Pede ao servidor a ligação para pôr o cartão na carteira, e abre-a. */
export async function abrirNaCarteira(qual: 'apple' | 'google'): Promise<void> {
  const r = await pedir<{ url: string }>(`/wallet/${qual}`, { metodo: 'POST' });
  if (Platform.OS === 'web') window.location.href = r.url;
  else await Linking.openURL(r.url);
}

/** A morada a que a Apple devolve a entrada: a raiz desta app, nesta origem. */
export function moradaDeRetornoDaApple(): string {
  if (typeof window === 'undefined') return '';
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
  return `${window.location.origin}${base}/`;
}
