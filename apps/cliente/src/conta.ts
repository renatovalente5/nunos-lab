/**
 * A conta do cliente na app: a sessão fica no aparelho, o «eu» (cartão,
 * visitas, formas de entrar) vem de /api/eu e fica em cache para abrir sem
 * rede. A API vive noutra origem: a sessão vai no cabeçalho.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClienteEu, Lingua } from '@nunos-lab/dominio';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Linking, Platform } from 'react-native';
import {
  cabecalhoDoAparelho,
  guardar as guardarNoArmazem,
  lerSincrono,
  linguaActual,
  useLingua,
} from '@nunos-lab/ui';
import { CHAVE_DO_CARTAO_VISTO } from './carimbos-novos';
import { API, PRAZO_DO_PEDIDO } from './dados';
import { textos } from './textos';

const CHAVE_DA_SESSAO = 'nunoslab:sessao';
// A versão sobe quando a forma do «eu» muda: um guardado antigo sem os campos novos rebentava o Cartão.
const CHAVE_DO_EU = 'nunoslab:eu:2';
const CHAVE_DO_EU_ANTIGA = 'nunoslab:eu:1';
let limpouAAntiga = false;

export const GOOGLE_CLIENTE = process.env.EXPO_PUBLIC_GOOGLE_CLIENTE ?? '';
export const APPLE_CLIENTE = process.env.EXPO_PUBLIC_APPLE_CLIENTE ?? '';

const ouvintes = new Set<() => void>();
function avisar() {
  for (const o of ouvintes) o();
}

/** O que a raiz quer feito quando a sessão cai num pedido: tirar o «eu» da cache das consultas. */
let aoPerderSessao: (() => void) | null = null;
export function registarAoPerderSessao(f: () => void) {
  aoPerderSessao = f;
}

export function sessao(): string | null {
  return lerSincrono(CHAVE_DA_SESSAO);
}

export function guardarSessao(testemunho: string | null) {
  guardarNoArmazem(CHAVE_DA_SESSAO, testemunho);
  if (!testemunho) {
    guardarNoArmazem(CHAVE_DO_EU, null);
    // Senão a conta seguinte neste aparelho via o cartão inteiro a animar.
    guardarNoArmazem(CHAVE_DO_CARTAO_VISTO, null);
  }
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

/**
 * O texto de um código na língua de agora; um desconhecido (ou do protótipo: «constructor») dá
 * «Algo correu mal».
 */
function textoDoCodigo(codigo: string): string {
  const erros = textos().erros;
  const texto = Object.prototype.hasOwnProperty.call(erros, codigo) ? erros[codigo] : undefined;
  return typeof texto === 'string' ? texto : erros.interno;
}

export class ErroDaConta extends Error {
  constructor(public codigo: string) {
    super(textoDoCodigo(codigo));
  }
}

/** A mensagem de um erro na língua de agora (mudar de língua muda também o erro à vista). */
export function mensagemDe(e: unknown): string {
  return textoDoCodigo(e instanceof ErroDaConta ? e.codigo : 'interno');
}

async function pedir<T = void>(
  caminho: string,
  { metodo = 'GET', corpo }: { metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; corpo?: unknown } = {},
): Promise<T> {
  // O nome do aparelho (só nas apps nativas): a lista das sessões na Conta.
  const cabecalhos: Record<string, string> = cabecalhoDoAparelho();
  const t = sessao();
  if (t) cabecalhos.Authorization = `Bearer ${t}`;
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  const prazo = new AbortController();
  const temporizador = setTimeout(() => prazo.abort(), PRAZO_DO_PEDIDO);
  try {
    let r: Response;
    try {
      // O que vem na conta (o prémio, a prenda, as vantagens) na língua da app.
      r = await fetch(`${API}/api/eu${caminho}?lingua=${linguaActual()}`, {
        method: metodo,
        headers: cabecalhos,
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
        signal: prazo.signal,
      });
    } catch {
      throw new ErroDaConta('rede');
    }
    if (r.status === 401 && !caminho.startsWith('/entrar')) {
      // O «eu» de quem saiu sai da cache: senão ficava à vista quando a conta seguinte entrasse.
      // Só se a sessão guardada ainda for a deste pedido: um 401 atrasado de quem já saiu não
      // pode tirar a sessão de quem entrou depois no mesmo aparelho.
      if (sessao() === t) {
        aoPerderSessao?.();
        guardarSessao(null);
      }
      throw new ErroDaConta('sessao');
    }
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      throw new ErroDaConta(j.erro ?? 'interno');
    }
    if (r.status === 204) return undefined as T;
    try {
      return (await r.json()) as T;
    } catch {
      throw new ErroDaConta(prazo.signal.aborted ? 'rede' : 'interno');
    }
  } finally {
    clearTimeout(temporizador);
  }
}

/** O «eu» guardado, só se tiver a forma de agora: um de uma versão antiga da app fica de fora. */
function lerEuGuardado(): ClienteEu | undefined {
  try {
    if (!limpouAAntiga) {
      limpouAAntiga = true;
      guardarNoArmazem(CHAVE_DO_EU_ANTIGA, null);
    }
    const texto = lerSincrono(CHAVE_DO_EU);
    if (!texto) return undefined;
    const eu = JSON.parse(texto) as Partial<ClienteEu>;
    const listas: (keyof ClienteEu)[] = [
      'recompensas',
      'visitas',
      'formas',
      'sessoes',
      'vales',
      'cupoes',
    ];
    const inteiro =
      !!eu &&
      typeof eu.codigo === 'string' &&
      !!eu.cartao &&
      !!eu.programa &&
      !!eu.wallet &&
      typeof eu.wallet === 'object' &&
      typeof eu.activo === 'boolean' &&
      'prenda' in eu &&
      listas.every((k) => Array.isArray(eu[k]));
    if (!inteiro) {
      guardarNoArmazem(CHAVE_DO_EU, null);
      return undefined;
    }
    return eu as ClienteEu;
  } catch {
    return undefined;
  }
}

async function buscarEu(): Promise<ClienteEu> {
  const usada = sessao();
  const eu = await pedir<ClienteEu>('');
  // Saiu (ou entrou outra conta) com o pedido a caminho: o «eu» de quem já não está não se grava,
  // senão a conta seguinte neste aparelho via o cartão da anterior até chegar o seu.
  if (sessao() === usada) guardarNoArmazem(CHAVE_DO_EU, JSON.stringify(eu));
  return eu;
}

/**
 * O cliente: o cartão, as visitas, a conta. Com `aoVivo` pede de 15 em 15 s;
 * cada ecrã passa «estou à frente» (os separadores ficam montados quando se
 * muda para outro, e sem isso o Cartão pedia nas Vantagens e nas Barbearias).
 */
export function useEu(aoVivo = false) {
  const temSessao = useTemSessao();
  const lingua = useLingua();
  const consulta = useQuery({
    queryKey: ['eu'],
    queryFn: buscarEu,
    enabled: temSessao,
    initialData: temSessao ? lerEuGuardado : undefined,
    initialDataUpdatedAt: 0,
    networkMode: 'always',
    staleTime: 5_000,
    refetchInterval: aoVivo ? 15_000 : false,
    refetchOnWindowFocus: true,
    // Depois de um 401 não se repete: a sessão já foi, e repetia sem testemunho para mais um 401.
    retry: (n, e) => n < 1 && !(e instanceof ErroDaConta && e.codigo === 'sessao'),
  });
  // Ao mudar de língua, a conta pede-se outra vez: o prémio e as vantagens vêm na nova.
  const { refetch } = consulta;
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    if (temSessao) void refetch();
  }, [lingua, temSessao, refetch]);
  return consulta;
}

/** Depois de entrar ou de mudar a conta, o «eu» volta a pedir-se. */
export function useConta() {
  const consultas = useQueryClient();
  // O «eu» de uma conta anterior sai da cache ANTES de haver sessão (senão o
  // cartão dela aparecia até a rede responder). A consulta nova pede sozinha:
  // um invalidateQueries aqui cancelava esse pedido e fazia outro.
  const entrou = (r: { sessao: string }) => {
    consultas.removeQueries({ queryKey: ['eu'] });
    guardarSessao(r.sessao);
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
    perfil: (p: {
      nome?: string;
      aniversario?: string | null;
      lojaId?: number | null;
      lingua?: Lingua;
    }) => pedir<ClienteEu>('/perfil', { metodo: 'PATCH', corpo: p }).then(actualizar),
    juntarGoogle: (credencial: string) =>
      pedir<ClienteEu>('/formas/google', { metodo: 'POST', corpo: { credencial } }).then(
        actualizar,
      ),
    juntarApple: (dados: { token: string; nonce: string; nome: string | null }) =>
      pedir<ClienteEu>('/formas/apple', { metodo: 'POST', corpo: dados }).then(actualizar),
    tirarForma: (id: number) =>
      pedir<ClienteEu>(`/formas/${id}`, { metodo: 'DELETE' }).then(actualizar),
    sairDasOutras: () => pedir<ClienteEu>('/sair-das-outras', { metodo: 'POST' }).then(actualizar),
    terminarSessao: (id: number) =>
      pedir<ClienteEu>(`/sessoes/${id}/terminar`, { metodo: 'POST' }).then(actualizar),
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
  // No telemóvel há «window» mas não há «window.location»: o botão nativo não precisa de morada.
  if (Platform.OS !== 'web' || typeof location === 'undefined') return '';
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
  return `${window.location.origin}${base}/`;
}

/**
 * A língua escolhida fica também na conta, se houver sessão: o passe da carteira e o que o
 * servidor escreve saem nela. Sem rede, fica para a próxima escolha (a da app já mudou).
 */
export function guardarLinguaNaConta(lingua: Lingua): void {
  if (!sessao()) return;
  void pedir('/perfil', { metodo: 'PATCH', corpo: { lingua } }).catch(() => {});
}
