/**
 * A sessão da Balcão fica no aparelho (um ano sem uso), e o «eu» (a pessoa, as
 * casas, o programa) em cache. Os carimbos sem rede ficam numa
 * fila com a chave de idempotência, e seguem quando houver rede; os que a API
 * recusa de vez ficam à vista («Não entraram») até alguém os dispensar. As
 * últimas fichas vistas ficam guardadas para a ficha ter um nome sem rede.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EuDaBalcao,
  FichaDepoisDoUso,
  FichaDoBalcao,
  FichaDoParceiro,
  HojeDaBalcao,
  HojeDoParceiro,
  ResultadoDoCarimbo,
  ResumoDaBalcao,
  Vale,
} from '@nunos-lab/dominio';
import { getRandomBytes } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  CHAVE_DA_LINGUA,
  cabecalhoDoAparelho,
  guardar as guardarNoArmazem,
  lerSincrono,
  linguaActual,
} from '@nunos-lab/ui';
import { textos } from './textos';

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

// O carimbo sem rede saiu a 9 nov 2026 (o Renato: o cliente tem de ver o carimbo a aparecer na app
// dele): as fichas guardadas para o mostrar, com nomes de clientes, e os «Não entraram» saem do aparelho.
for (const antiga of ['nunoslab:balcao:fichas:1', 'nunoslab:balcao:recusas'])
  escrever(antiga, null);

/** As chaves que a app guarda no aparelho (o telemóvel carrega-as ao arrancar). */
export const CHAVES_DO_ARMAZEM = [CHAVE_DA_LINGUA, CHAVE_DO_EU, CHAVE_DA_CASA, CHAVE_DA_FILA];
export const CHAVES_SECRETAS = [CHAVE_DA_SESSAO];

export const sessao = () => ler(CHAVE_DA_SESSAO);
export function guardarSessao(t: string | null) {
  escrever(CHAVE_DA_SESSAO, t);
  if (!t) {
    escrever(CHAVE_DO_EU, null);
    escrever(CHAVE_DA_CASA, null);
  }
  avisar();
  // Sem sessão volta-se ao início; a fila fica guardada para quando a pessoa voltar a entrar.
  if (!t) router.replace('/');
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

/** O texto de um código de recusa, na língua de agora (os códigos estão em textos/: «erros»). */
function textoDoCodigo(codigo: string): string {
  const erros = textos().erros;
  const texto = Object.prototype.hasOwnProperty.call(erros, codigo) ? erros[codigo] : undefined;
  return typeof texto === 'string' ? texto : erros.interno;
}

export class ErroDaBalcao extends Error {
  constructor(
    public codigo: string,
    public dados: Record<string, unknown> = {},
  ) {
    super(textoDoCodigo(codigo));
  }
}
/** Um erro que voltar a pedir não resolve: a conta não tem esse papel, a casa é outra, o código não é de ninguém. */
export const semRemedio = (e: unknown) =>
  e instanceof ErroDaBalcao &&
  ['so_parceiro', 'so_barbearia', 'outra_casa', 'cartao_desconhecido'].includes(e.codigo);

/** A mensagem de um erro na língua de agora (mudar de língua muda também o erro à vista). */
export const mensagemDe = (e: unknown) =>
  textoDoCodigo(e instanceof ErroDaBalcao ? e.codigo : 'interno');

/** Com rede fraca o sistema só desiste ao fim de ~60 s; 8 s chegam para a API e deixam o balcão seguir. */
const TEMPO_LIMITE = 8000;

/**
 * Os pedidos que mudam alguma coisa (carimbar, despejar a fila, um cliente novo) ainda sem
 * resposta. Uma actualização da app não reinicia a meio deles: o barbeiro ficava sem saber se o
 * carimbo entrou.
 */
let escritasEmCurso = 0;
export const haEscritaEmCurso = () => escritasEmCurso > 0;

export async function pedir<T = void>(
  caminho: string,
  { metodo = 'GET', corpo }: { metodo?: 'GET' | 'POST' | 'DELETE'; corpo?: unknown } = {},
): Promise<T> {
  const escrita = metodo !== 'GET';
  if (escrita) escritasEmCurso++;
  try {
    return await pedirAgora<T>(caminho, metodo, corpo);
  } finally {
    if (escrita) escritasEmCurso--;
  }
}

async function pedirAgora<T>(
  caminho: string,
  metodo: 'GET' | 'POST' | 'DELETE',
  corpo: unknown,
): Promise<T> {
  // O nome do aparelho (só nas apps nativas), para a equipa se reconhecer nas sessões.
  const cabecalhos: Record<string, string> = cabecalhoDoAparelho();
  const t = sessao();
  if (t) cabecalhos.Authorization = `Bearer ${t}`;
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  let r: Response;
  try {
    // O que vem da API (o prémio, a prenda, as vantagens) na língua da app.
    const lingua = `${caminho.includes('?') ? '&' : '?'}lingua=${linguaActual()}`;
    r = await fetch(`${API}/api/balcao${caminho}${lingua}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(TEMPO_LIMITE),
    });
  } catch {
    // Sem rede, ou o tempo esgotado: para a app é o mesmo («rede»). Um carimbo vai para a
    // fila com a mesma chave; se o pedido tiver chegado, a API devolve-o sem contar outra vez.
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

export function useResumo(
  periodo: 'hoje' | 'semana' | 'mes',
  lojaId: number | null,
  activo = true,
) {
  return useQuery({
    queryKey: ['balcao', 'resumo', periodo, lojaId],
    queryFn: () =>
      pedir<ResumoDaBalcao>(`/resumo?periodo=${periodo}${lojaId ? `&lojaId=${lojaId}` : ''}`),
    enabled: activo,
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

export const validar = (corpo: { codigo: string; promocaoId: number; chave: string }) =>
  pedir<{ vale: Vale; ficha: FichaDoParceiro }>('/validar', { metodo: 'POST', corpo });

/** Entregar a prenda de anos: a API devolve a ficha já com a prenda marcada como entregue. */
export const entregarPrenda = (corpo: { codigo: string; lojaId: number }) =>
  pedir<FichaDoBalcao>('/prenda', { metodo: 'POST', corpo });

/** O prémio a meio (10 nov 2026): entrega-se à parte, e a API devolve a ficha já com o «entregue». */
export const entregarPremioAMeio = (corpo: { codigo: string; cartaoId: number; lojaId: number }) =>
  pedir<FichaDoBalcao>('/usar-premio-a-meio', { metodo: 'POST', corpo });

/**
 * Usar o saldo do cliente (10 nov 2026): `valor` em cêntimos (ao balcão, euros inteiros × 100). A
 * mesma chave nunca conta duas vezes; a API devolve a ficha já com o saldo novo e o uso de hoje.
 */
export const usarSaldo = (corpo: {
  codigo: string;
  valor: number;
  chave: string;
  lojaId: number;
  semLeitura: boolean;
}) => pedir<FichaDepoisDoUso>('/usar-saldo', { metodo: 'POST', corpo });

/** Anular um uso do saldo: quem usou, nos 10 minutos seguintes; o dono sempre. */
export const anularSaldo = (movimentoId: number) =>
  pedir('/anular-saldo', { metodo: 'POST', corpo: { movimentoId } });

export function chaveNova(): string {
  const b = getRandomBytes(12);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

// ——— o que ficou na fila sem rede ———

// Até 9 nov 2026 carimbava-se sem rede, para uma fila que seguia quando a rede voltasse. Já não:
// sem rede o carimbo não sai, para o cliente o ver a aparecer. Esta fila só envia o que ainda
// estiver guardado num telemóvel desde então.

export type CarimboNaFila = {
  codigo: string;
  chave: string;
  lojaId: number;
  confirmar: boolean;
  semLeitura?: boolean;
  /** Quem deu o carimbo: a fila é da pessoa, só ela a despeja (sem id: a fila antiga, vai sempre). */
  pessoaId?: number;
  quando: number;
};
export const lerFila = (): CarimboNaFila[] => {
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
const useFila = () =>
  useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => ler(CHAVE_DA_FILA) ?? '',
    () => '',
  );

/** O corpo que a API espera: a pessoa fica só no aparelho. */
const corpoDoCarimbo = (p: Omit<CarimboNaFila, 'quando'>, quando?: number) => ({
  codigo: p.codigo,
  chave: p.chave,
  lojaId: p.lojaId,
  confirmar: p.confirmar,
  semLeitura: p.semLeitura,
  quando,
});

/**
 * Carimbar, só com rede. A chave é a da ficha aberta: tocar outra vez depois de um «Sem ligação»
 * nunca conta duas vezes. Um 409 do limite do dia sobe como erro.
 */
export const carimbar = (pedido: Omit<CarimboNaFila, 'quando' | 'pessoaId'>) =>
  pedir<ResultadoDoCarimbo>('/carimbar', { metodo: 'POST', corpo: corpoDoCarimbo(pedido) });

/** As recusas que voltar a enviar não resolve: o item sai da fila. */
const RECUSAS_DEFINITIVAS = [
  'cartao_desconhecido',
  'repetido',
  'limite_do_dia',
  'entregue_hoje',
  'proprio_cartao',
  'outra_casa',
  'referencia',
  'invalido',
];

/**
 * Um despejo de cada vez, venha de onde vier (o início, outro ecrã montado, a Conta ao sair):
 * cada ecrã tinha o seu trinco, e dois despejos ao mesmo tempo mandavam o mesmo carimbo duas vezes.
 */
let despejoEmCurso: Promise<number> | null = null;
export function despejarFila(pessoaId?: number): Promise<number> {
  if (despejoEmCurso) return despejoEmCurso;
  despejoEmCurso = despejarAgora(pessoaId).finally(() => {
    despejoEmCurso = null;
  });
  return despejoEmCurso;
}

/**
 * Despeja a fila desta pessoa (os itens sem pessoa, da fila antiga, vão também):
 * um a um, pela ordem, com o que foi decidido ao tocar e o instante do toque.
 * Sai da fila com sucesso ou com uma recusa definitiva; outra falha (rede,
 * sessão, limite, servidor) pára o ciclo, e tenta-se da próxima vez.
 */
async function despejarAgora(pessoaId?: number): Promise<number> {
  let feitos = 0;
  for (const p of lerFila()) {
    if (p.pessoaId !== undefined && p.pessoaId !== pessoaId) continue;
    try {
      await pedir<ResultadoDoCarimbo>('/carimbar', {
        metodo: 'POST',
        corpo: corpoDoCarimbo(p, Math.floor(p.quando / 1000)),
      });
      feitos++;
    } catch (e) {
      const codigo = e instanceof ErroDaBalcao ? e.codigo : 'interno';
      if (!RECUSAS_DEFINITIVAS.includes(codigo)) break;
    }
    guardarFila(lerFila().filter((x) => x.chave !== p.chave));
  }
  return feitos;
}

/** Tenta despejar a fila ao abrir e sempre que a rede volta; nunca dois despejos ao mesmo tempo. */
export function useDespejarFila(pessoaId?: number) {
  const consultas = useQueryClient();
  const fila = useFila();
  const aDespejar = useRef(false);
  useEffect(() => {
    if (!fila) return;
    const tentar = () => {
      // Cada item que sai muda a fila e volta a correr este efeito: o despejo a meio continua sozinho.
      if (aDespejar.current) return;
      aDespejar.current = true;
      despejarFila(pessoaId)
        .then((n) => {
          if (n) consultas.invalidateQueries({ queryKey: ['balcao'] });
        })
        .finally(() => {
          aDespejar.current = false;
        });
    };
    tentar();
    const id = setInterval(tentar, 15_000);
    globalThis.addEventListener?.('online', tentar);
    return () => {
      clearInterval(id);
      globalThis.removeEventListener?.('online', tentar);
    };
  }, [fila, pessoaId, consultas]);
}
