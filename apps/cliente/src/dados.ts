import { useQuery } from '@tanstack/react-query';
import { diaEmLisboa, type DadosDaApp, type TipoDeContagem } from '@nunos-lab/dominio';
import { Linking, Platform } from 'react-native';

export const API = (
  process.env.EXPO_PUBLIC_API ?? 'https://nunos-lab.renato-lima-valente-dcb.workers.dev'
).replace(/\/$/, '');

const CHAVE = 'nunoslab:dados:1';

/** A última resposta fica no aparelho: a app abre logo, mesmo sem rede. */
function lerGuardados(): DadosDaApp | undefined {
  try {
    const texto = globalThis.localStorage?.getItem(CHAVE);
    return texto ? (JSON.parse(texto) as DadosDaApp) : undefined;
  } catch {
    return undefined;
  }
}

function guardar(d: DadosDaApp) {
  try {
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(d));
  } catch {
    // Sem espaço ou em modo privado: a app funciona na mesma, só não abre sem rede.
  }
}

async function buscar(): Promise<DadosDaApp> {
  const r = await fetch(`${API}/api/app`);
  if (!r.ok) throw new Error(`A API respondeu ${r.status}`);
  const d = (await r.json()) as DadosDaApp;
  guardar(d);
  return d;
}

/**
 * Tira o que já não vale HOJE neste aparelho: com dados guardados de ontem e
 * sem rede, uma promoção que acabou ontem não pode aparecer (nem o aviso que
 * acabou, nem uma categoria que ficou sem parceiros).
 */
function soDeHoje(d: DadosDaApp): DadosDaApp {
  const hoje = diaEmLisboa();
  if (hoje === d.hoje) return d;
  const parceiros = d.parceiros
    .map((p) => ({
      ...p,
      promocoes: p.promocoes.filter(
        (pr) => (!pr.inicio || pr.inicio <= hoje) && (!pr.fim || pr.fim >= hoje),
      ),
    }))
    .filter((p) => p.promocoes.length > 0);
  const usadas = new Set(parceiros.map((p) => p.categoriaId));
  return {
    ...d,
    hoje,
    parceiros,
    aviso: d.aviso && (!d.avisoAte || hoje <= d.avisoAte) ? d.aviso : null,
    categorias: d.categorias.filter((k) => usadas.has(k.id)),
  };
}

export function useDados() {
  return useQuery({
    queryKey: ['app'],
    queryFn: buscar,
    // A lista guardada entra como dados a sério (e não como «placeholder», que
    // desaparece quando o pedido falha): sem rede, a app fica com ela. Conta
    // como velha, por isso a app pede logo a nova.
    initialData: lerGuardados,
    initialDataUpdatedAt: 0,
    // Com o telemóvel sem rede, o modo de origem PÕE A CONSULTA EM PAUSA (não
    // falha): sem lista guardada, o ecrã ficava a carregar para sempre.
    networkMode: 'always',
    select: soDeHoje,
    staleTime: 20_000,
    refetchInterval: 5 * 60_000,
    retry: 2,
  });
}

export function urlDaImagem(id: string): string {
  return `${API}/api/imagens/${id}`;
}

/**
 * Conta um toque, sem saber de quem: «abriu», «viu o parceiro 3», «carregou
 * em Ligar». Vai em texto simples, sem esperar resposta, e nunca falha à vista.
 */
export function contar(tipo: TipoDeContagem, ref = 0) {
  const corpo = JSON.stringify({ tipo, ref });
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(`${API}/api/contar`, corpo);
      return;
    }
    fetch(`${API}/api/contar`, {
      method: 'POST',
      body: corpo,
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Uma contagem perdida não estraga nada.
  }
}

/** Abre uma ligação de fora: o telefone na mesma janela, o resto num separador novo. */
export function abrir(url: string) {
  if (Platform.OS === 'web') {
    if (/^(tel|mailto):/.test(url)) window.location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(url).catch(() => {});
}

/**
 * A ligação para partilhar um parceiro: /?parceiro=N, que é o index da app e o
 * GitHub Pages serve com 200. A /parceiro/N só existe dentro da app: o GitHub
 * Pages responde 404, e as pré-visualizações do WhatsApp desistem.
 */
export function ligacaoParaPartilhar(id: number): string {
  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/parceiro\/[^/]*\/?$/, '');
  url.search = `?parceiro=${id}`;
  url.hash = '';
  return url.toString();
}

/** O título do separador do browser (no telemóvel não há separador). */
export function definirTitulo(texto: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = texto;
}

const CHAVE_DA_CASA = 'nunoslab:casa';

/** A casa do Nuno's Lab que o cliente escolheu (null: todas), guardada no aparelho. */
export function lerCasa(): number | null {
  try {
    const v = globalThis.localStorage?.getItem(CHAVE_DA_CASA);
    return v && /^\d+$/.test(v) ? Number(v) : null;
  } catch {
    return null;
  }
}

export function guardarCasa(id: number | null) {
  try {
    if (id === null) globalThis.localStorage?.removeItem(CHAVE_DA_CASA);
    else globalThis.localStorage?.setItem(CHAVE_DA_CASA, String(id));
  } catch {
    // Sem armazenamento: a escolha dura até fechar a página.
  }
}
