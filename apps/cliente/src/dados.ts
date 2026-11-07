import { useQuery } from '@tanstack/react-query';
import { type Lingua, diaEmLisboa, type DadosDaApp, type TipoDeContagem } from '@nunos-lab/dominio';
import { Linking, Platform } from 'react-native';
import {
  CHAVE_DA_LINGUA,
  guardar as guardarNoArmazem,
  lerSincrono,
  useLingua,
} from '@nunos-lab/ui';

/** A morada da app na web (o telemóvel partilha ligações para aqui). */
export const SITIO = process.env.EXPO_PUBLIC_SITIO ?? 'https://renatovalente5.github.io/nunos-lab';
export const API = (
  process.env.EXPO_PUBLIC_API ?? 'https://nunos-lab.renato-lima-valente-dcb.workers.dev'
).replace(/\/$/, '');
/** Quanto tempo um pedido espera pela API: sem prazo, numa rede fraca ficava preso até ao limite do sistema (60 s no iOS). */
export const PRAZO_DO_PEDIDO = 15_000;

const CHAVE = 'nunoslab:dados:1';

/**
 * A última resposta fica no aparelho: a app abre logo, mesmo sem rede. Só se tiver a forma de
 * agora: uma guardada antes de as casas terem sítio (5 nov) não traz `lat` nem `lng`, e o mapa
 * rebentava a app inteira na primeira abertura (visto a 7 nov, no Chrome do Renato).
 */
function lerGuardados(): DadosDaApp | undefined {
  try {
    const texto = lerSincrono(CHAVE);
    if (!texto) return undefined;
    const d = JSON.parse(texto) as Partial<DadosDaApp>;
    const inteira =
      !!d &&
      typeof d.hoje === 'string' &&
      Array.isArray(d.categorias) &&
      Array.isArray(d.parceiros) &&
      d.parceiros.every((p) => !!p && Array.isArray(p.promocoes)) &&
      !!d.barbearia &&
      Array.isArray(d.barbearia.lojas) &&
      d.barbearia.lojas.every((l) => !!l && 'lat' in l && 'lng' in l);
    if (!inteira) {
      guardarNoArmazem(CHAVE, null);
      return undefined;
    }
    return d as DadosDaApp;
  } catch {
    return undefined;
  }
}

function guardar(d: DadosDaApp) {
  guardarNoArmazem(CHAVE, JSON.stringify(d));
}

async function buscar(lingua: Lingua): Promise<DadosDaApp> {
  const prazo = new AbortController();
  const temporizador = setTimeout(() => prazo.abort(), PRAZO_DO_PEDIDO);
  try {
    // Os textos do backoffice vêm na língua da app (o inglês que o Nuno escreveu, senão o português).
    const r = await fetch(`${API}/api/app?lingua=${lingua}`, { signal: prazo.signal });
    if (!r.ok) throw new Error(`A API respondeu ${r.status}`);
    const d = (await r.json()) as DadosDaApp;
    guardar(d);
    return d;
  } catch (e) {
    throw prazo.signal.aborted ? new Error('A API não respondeu a tempo') : e;
  } finally {
    clearTimeout(temporizador);
  }
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
  const lingua = useLingua();
  return useQuery({
    // Mudar de língua pede a lista outra vez; a guardada (da língua de antes) fica à vista entretanto.
    queryKey: ['app', lingua],
    queryFn: () => buscar(lingua),
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
  if (Platform.OS !== 'web') return `${SITIO}/?parceiro=${id}`;
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
  const v = lerSincrono(CHAVE_DA_CASA);
  return v && /^\d+$/.test(v) ? Number(v) : null;
}

export function guardarCasa(id: number | null) {
  guardarNoArmazem(CHAVE_DA_CASA, id === null ? null : String(id));
}

/** As chaves que a app guarda no aparelho (o telemóvel carrega-as ao arrancar). */
// A língua escolhida lê-se com o resto, antes do primeiro ecrã: sem ela, a app abria na do aparelho e mudava logo.
export const CHAVES_DO_ARMAZEM = [
  CHAVE,
  CHAVE_DA_CASA,
  'nunoslab:eu:2',
  'nunoslab:cartao-visto',
  CHAVE_DA_LINGUA,
];
export const CHAVES_SECRETAS = ['nunoslab:sessao'];
