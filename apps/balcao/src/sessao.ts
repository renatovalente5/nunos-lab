/**
 * A sessão da Balcão fica no aparelho (um ano sem uso), e o «eu» (a pessoa, as
 * casas, os serviços, o programa) em cache. Os carimbos sem rede ficam numa
 * fila com a chave de idempotência, e seguem quando houver rede.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EuDaBalcao,
  FichaDoBalcao,
  FichaDoParceiro,
  HojeDaBalcao,
  HojeDoParceiro,
  ResultadoDoCarimbo,
  ResumoDaBalcao,
  Vale,
} from '@nunos-lab/dominio';
import { useEffect, useSyncExternalStore } from 'react';
import { guardar as guardarNoArmazem, lerSincrono } from '@nunos-lab/ui';

export const API = (
  process.env.EXPO_PUBLIC_API ?? 'https://nunos-lab.renato-lima-valente-dcb.workers.dev'
).replace(/\/$/, '');
export const GOOGLE_CLIENTE = process.env.EXPO_PUBLIC_GOOGLE_CLIENTE ?? '';
export const APPLE_CLIENTE = process.env.EXPO_PUBLIC_APPLE_CLIENTE ?? '';

const CHAVE_DA_SESSAO = 'nunoslab:balcao:sessao';
const CHAVE_DO_EU = 'nunoslab:balcao:eu:1';
const CHAVE_DA_CASA = 'nunoslab:balcao:casa';
const CHAVE_DA_FILA = 'nunoslab:balcao:fila';

const ouvintes = new Set<() => void>();
const avisar = () => {
  for (const o of ouvintes) o();
};
const ler = (chave: string) => lerSincrono(chave);
const escrever = (chave: string, valor: string | null) => guardarNoArmazem(chave, valor);

/** As chaves que a Balcão guarda no aparelho (o telemóvel carrega-as ao arrancar). */
export const CHAVES_DO_ARMAZEM = [CHAVE_DO_EU, CHAVE_DA_CASA, CHAVE_DA_FILA];
export const CHAVES_SECRETAS = [CHAVE_DA_SESSAO];

export const sessao = () => ler(CHAVE_DA_SESSAO);
export function guardarSessao(t: string | null) {
  escrever(CHAVE_DA_SESSAO, t);
  if (!t) {
    escrever(CHAVE_DO_EU, null);
    escrever(CHAVE_DA_CASA, null);
  }
  avisar();
}
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

/** A casa em que este aparelho está a carimbar (o dono e os barbeiros sem casa fixa escolhem). */
export const casaGuardada = (): number | null => {
  const v = ler(CHAVE_DA_CASA);
  return v && /^\d+$/.test(v) ? Number(v) : null;
};
export function guardarCasa(id: number | null) {
  escrever(CHAVE_DA_CASA, id === null ? null : String(id));
  avisar();
}
export function useCasaGuardada(): number | null {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    casaGuardada,
    () => null,
  );
}

const MENSAGENS: Record<string, string> = {
  sessao: 'A sessão acabou. Entra outra vez.',
  ligacao_invalida: 'Esta ligação já foi usada ou caducou. Pede outra no backoffice.',
  google_invalido: 'O Google não confirmou a entrada.',
  apple_invalido: 'A Apple não confirmou a entrada.',
  apple_desligado: 'Entrar com a Apple ainda não está disponível.',
  sem_acesso: 'Esta conta não está na equipa. Pede ao Nuno para a juntar.',
  muitas_tentativas: 'Demasiadas tentativas. Espera um minuto.',
  cartao_desconhecido: 'Este código não é de nenhum cartão.',
  outra_casa: 'Este cartão não se carimba nesta casa com a tua conta.',
  so_barbearia: 'A tua conta não carimba.',
  so_parceiro: 'A tua conta não valida vantagens.',
  ja_usou: 'Já usou hoje.',
  limite_do_cliente: 'Este cliente chegou ao limite.',
  limite_total: 'Esta vantagem esgotou.',
  cliente_inactivo: 'Sem corte no último ano: não vale.',
  cupao_usado: 'Esse cupão já foi usado ou caducou.',
  so_dono: 'Só o dono vê isto.',
  ja_anulado: 'Já estava anulado.',
  tarde_para_anular: 'Já passaram 10 minutos: só o Nuno anula.',
  de_outra_pessoa: 'Foi outra pessoa que carimbou: só ela, ou o Nuno, anula.',
  recompensa_usada: 'A recompensa deste cartão já foi entregue.',
  cartao_seguinte: 'O cartão seguinte já tem carimbos.',
  email_ja_tem_cartao: 'Esse email já tem cartão. Procura o cliente.',
  invalido: 'Há algo por corrigir.',
  referencia: 'Isso já não existe. Recarrega.',
  rede: 'Sem ligação.',
  interno: 'Algo correu mal. Tenta outra vez.',
};

export class ErroDaBalcao extends Error {
  constructor(
    public codigo: string,
    public dados: Record<string, unknown> = {},
  ) {
    super(MENSAGENS[codigo] ?? MENSAGENS.interno);
  }
}
export const mensagemDe = (e: unknown) =>
  e instanceof ErroDaBalcao ? e.message : (MENSAGENS.interno as string);

export async function pedir<T = void>(
  caminho: string,
  { metodo = 'GET', corpo }: { metodo?: 'GET' | 'POST' | 'DELETE'; corpo?: unknown } = {},
): Promise<T> {
  const cabecalhos: Record<string, string> = {};
  const t = sessao();
  if (t) cabecalhos.Authorization = `Bearer ${t}`;
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  let r: Response;
  try {
    r = await fetch(`${API}/api/balcao${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroDaBalcao('rede');
  }
  if (r.status === 401 && !caminho.startsWith('/entrar')) {
    guardarSessao(null);
    throw new ErroDaBalcao('sessao');
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { erro?: string } & Record<string, unknown>;
    throw new ErroDaBalcao(j.erro ?? 'interno', j);
  }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

export function useEu() {
  const temSessao = useTemSessao();
  return useQuery({
    queryKey: ['balcao', 'eu'],
    queryFn: async () => {
      const eu = await pedir<EuDaBalcao>('/eu');
      escrever(CHAVE_DO_EU, JSON.stringify(eu));
      return eu;
    },
    enabled: temSessao,
    initialData: temSessao
      ? () => {
          const t = ler(CHAVE_DO_EU);
          return t ? (JSON.parse(t) as EuDaBalcao) : undefined;
        }
      : undefined,
    initialDataUpdatedAt: 0,
    networkMode: 'always',
    staleTime: 60_000,
    retry: 1,
  });
}

/** A casa activa: a fixa da pessoa, ou a guardada, ou a primeira. */
export function useCasa(eu: EuDaBalcao | undefined): number | null {
  const guardada = useCasaGuardada();
  if (!eu) return null;
  if (eu.pessoa.papel === 'barbeiro' && eu.pessoa.lojaId) return eu.pessoa.lojaId;
  if (guardada && eu.lojas.some((l) => l.id === guardada)) return guardada;
  return eu.lojas[0]?.id ?? null;
}

export function useHoje(lojaId: number | null, activo = true) {
  return useQuery({
    queryKey: ['balcao', 'hoje', lojaId],
    queryFn: () => pedir<HojeDaBalcao>(`/hoje${lojaId ? `?lojaId=${lojaId}` : ''}`),
    enabled: activo,
    networkMode: 'always',
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useResumo(periodo: 'hoje' | 'semana' | 'mes', lojaId: number | null) {
  return useQuery({
    queryKey: ['balcao', 'resumo', periodo, lojaId],
    queryFn: () =>
      pedir<ResumoDaBalcao>(`/resumo?periodo=${periodo}${lojaId ? `&lojaId=${lojaId}` : ''}`),
    networkMode: 'always',
    staleTime: 30_000,
    retry: 1,
  });
}

export const useFicha = (codigo: string) =>
  useQuery({
    queryKey: ['balcao', 'ficha', codigo],
    queryFn: () => pedir<FichaDoBalcao>(`/ficha/${encodeURIComponent(codigo)}`),
    networkMode: 'always',
    staleTime: 0,
    retry: (n, e) => !(e instanceof ErroDaBalcao && e.codigo === 'cartao_desconhecido') && n < 1,
  });

// ——— o parceiro ———

export function useHojeParceiro(activo = true) {
  return useQuery({
    queryKey: ['balcao', 'hoje-parceiro'],
    queryFn: () => pedir<HojeDoParceiro>('/hoje-parceiro'),
    enabled: activo,
    networkMode: 'always',
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export const useFichaParceiro = (codigo: string) =>
  useQuery({
    queryKey: ['balcao', 'ficha-parceiro', codigo],
    queryFn: () => pedir<FichaDoParceiro>(`/ficha-parceiro/${encodeURIComponent(codigo)}`),
    networkMode: 'always',
    staleTime: 0,
    retry: (n, e) => !(e instanceof ErroDaBalcao && e.codigo === 'cartao_desconhecido') && n < 1,
  });

export const validar = (corpo: {
  codigo: string;
  promocaoId: number;
  chave: string;
  cupaoId?: number;
}) => pedir<{ vale: Vale; ficha: FichaDoParceiro }>('/validar', { metodo: 'POST', corpo });

export function chaveNova(): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

// ——— a fila sem rede ———

export type CarimboNaFila = {
  codigo: string;
  chave: string;
  lojaId: number;
  servicoId: number | null;
  confirmar: boolean;
  quando: number;
};
const lerFila = (): CarimboNaFila[] => {
  try {
    return JSON.parse(ler(CHAVE_DA_FILA) ?? '[]') as CarimboNaFila[];
  } catch {
    return [];
  }
};
const guardarFila = (fila: CarimboNaFila[]) => {
  escrever(CHAVE_DA_FILA, fila.length ? JSON.stringify(fila) : null);
  avisar();
};
export const useFila = () =>
  useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => ler(CHAVE_DA_FILA) ?? '',
    () => '',
  );

/**
 * Carimbar: tenta já; sem rede, fica na fila (a chave garante que nunca conta
 * duas vezes) e devolve «na fila». Um 409 do limite do dia sobe como erro.
 */
export async function carimbar(
  pedido: Omit<CarimboNaFila, 'quando'>,
): Promise<{ resultado: ResultadoDoCarimbo } | { naFila: true }> {
  try {
    const resultado = await pedir<ResultadoDoCarimbo>('/carimbar', {
      metodo: 'POST',
      corpo: pedido,
    });
    return { resultado };
  } catch (e) {
    if (e instanceof ErroDaBalcao && e.codigo === 'rede') {
      guardarFila([...lerFila(), { ...pedido, quando: Date.now() }]);
      return { naFila: true };
    }
    throw e;
  }
}

/** Despeja a fila: um a um, pela ordem; pára na primeira falta de rede. */
export async function despejarFila(): Promise<number> {
  let feitos = 0;
  for (const p of lerFila()) {
    try {
      await pedir<ResultadoDoCarimbo>('/carimbar', {
        metodo: 'POST',
        corpo: {
          codigo: p.codigo,
          chave: p.chave,
          lojaId: p.lojaId,
          servicoId: p.servicoId,
          confirmar: true,
        },
      });
    } catch (e) {
      if (e instanceof ErroDaBalcao && e.codigo === 'rede') break;
      // Outra recusa (o cartão já não existe): sai da fila na mesma.
    }
    guardarFila(lerFila().filter((x) => x.chave !== p.chave));
    feitos++;
  }
  return feitos;
}

/** Tenta despejar a fila ao abrir e sempre que a rede volta. */
export function useDespejarFila() {
  const consultas = useQueryClient();
  const fila = useFila();
  useEffect(() => {
    if (!fila) return;
    let parado = false;
    const tentar = () =>
      despejarFila().then((n) => {
        if (n && !parado) consultas.invalidateQueries({ queryKey: ['balcao'] });
      });
    tentar();
    const id = setInterval(tentar, 15_000);
    globalThis.addEventListener?.('online', tentar);
    return () => {
      parado = true;
      clearInterval(id);
      globalThis.removeEventListener?.('online', tentar);
    };
  }, [fila, consultas]);
}
