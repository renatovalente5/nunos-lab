import { dataCurta, diaDaSemana, diasEntre, nomeDoDia } from './datas.ts';
import type { Lingua } from './lingua.ts';

export type EstadoDaPromocao = 'activa' | 'agendada' | 'terminada' | 'pausada';

type ComDatas = { inicio: string | null; fim: string | null };

/**
 * O estado de uma promoção num dia. Uma promoção só aparece na app quando
 * está «activa»: ligada, já começou e ainda não acabou (o início e o fim
 * contam os dois, inteiros).
 */
export function estadoDaPromocao(
  p: ComDatas & { activa: boolean },
  hoje: string,
): EstadoDaPromocao {
  if (!p.activa) return 'pausada';
  if (p.inicio && hoje < p.inicio) return 'agendada';
  if (p.fim && hoje > p.fim) return 'terminada';
  return 'activa';
}

export const NOME_DO_ESTADO: Record<EstadoDaPromocao, string> = {
  activa: 'Na app',
  agendada: 'Agendada',
  terminada: 'Terminou',
  pausada: 'Pausada',
};

export const NOME_DO_ESTADO_EN: Record<EstadoDaPromocao, string> = {
  activa: 'In the app',
  agendada: 'Scheduled',
  terminada: 'Ended',
  pausada: 'Paused',
};

/** «Na app», «In the app». */
export function nomeDoEstado(estado: EstadoDaPromocao, lingua: Lingua = 'pt'): string {
  return (lingua === 'en' ? NOME_DO_ESTADO_EN : NOME_DO_ESTADO)[estado];
}

/**
 * Até quando vale, dito como se diz ao balcão: «Só hoje», «Até amanhã»,
 * «Até sexta», «Até 31 dez». Sem data de fim não se diz nada: o que não
 * acaba não precisa de aviso.
 */
export function validadeEmTexto(p: ComDatas, hoje: string, lingua: Lingua = 'pt'): string | null {
  if (!p.fim) return null;
  const faltam = diasEntre(hoje, p.fim);
  const en = lingua === 'en';
  if (faltam < 0) return en ? 'Ended' : 'Terminou';
  if (faltam === 0) return en ? 'Today only' : 'Só hoje';
  if (faltam === 1) return en ? 'Until tomorrow' : 'Até amanhã';
  const ate = en ? 'Until' : 'Até';
  if (faltam < 7) return `${ate} ${nomeDoDia(diaDaSemana(p.fim), lingua)}`;
  return `${ate} ${dataCurta(p.fim, hoje, lingua)}`;
}

/** Para o backoffice: «Desde 1 nov», «1 nov – 31 dez», «Até 31 dez», «Sempre». */
export function periodoEmTexto(p: ComDatas, hoje: string, lingua: Lingua = 'pt'): string {
  const en = lingua === 'en';
  if (p.inicio && p.fim)
    return `${dataCurta(p.inicio, hoje, lingua)} – ${dataCurta(p.fim, hoje, lingua)}`;
  if (p.inicio) return `${en ? 'From' : 'Desde'} ${dataCurta(p.inicio, hoje, lingua)}`;
  if (p.fim) return `${en ? 'Until' : 'Até'} ${dataCurta(p.fim, hoje, lingua)}`;
  return en ? 'Always' : 'Sempre';
}

/**
 * O texto grande de uma promoção, arrumado: o hífen no início passa a sinal
 * de menos («-10%» → «−10%»), «2x1» passa a «2×1», e os espaços repetidos
 * caem. Aplicar duas vezes dá o mesmo que uma.
 */
export function normalizarDestaque(texto: string): string {
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[-–—]\s*(?=\d)/, '−')
    .replace(/(\d)\s*[xX]\s*(\d)/g, '$1×$2')
    .replace(/(\d)\s+%/g, '$1%');
}

/**
 * O degrau do tamanho do desconto, pelo número de letras: 0 até 4 («−10%»),
 * 1 até 6 («−300 €»), 2 até 9, 3 até 12 (o máximo do campo). Cada sítio da app
 * tem a sua escala; o React Native Web não encolhe o texto sozinho.
 */
export function degrauDoDesconto(destaque: string): 0 | 1 | 2 | 3 {
  const n = Array.from(destaque.trim()).length;
  return n <= 4 ? 0 : n <= 6 ? 1 : n <= 9 ? 2 : 3;
}
