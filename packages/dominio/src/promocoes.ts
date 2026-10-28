import { DIAS_DA_SEMANA, dataCurta, diaDaSemana, diasEntre } from './datas.ts';

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

/**
 * Até quando vale, dito como se diz ao balcão: «Só hoje», «Até amanhã»,
 * «Até sexta», «Até 31 dez». Sem data de fim não se diz nada: o que não
 * acaba não precisa de aviso.
 */
export function validadeEmTexto(p: ComDatas, hoje: string): string | null {
  if (!p.fim) return null;
  const faltam = diasEntre(hoje, p.fim);
  if (faltam < 0) return 'Terminou';
  if (faltam === 0) return 'Só hoje';
  if (faltam === 1) return 'Até amanhã';
  if (faltam < 7) return `Até ${DIAS_DA_SEMANA[diaDaSemana(p.fim)]}`;
  return `Até ${dataCurta(p.fim, hoje)}`;
}

/** Para o backoffice: «Desde 1 nov», «1 nov – 31 dez», «Até 31 dez», «Sempre». */
export function periodoEmTexto(p: ComDatas, hoje: string): string {
  if (p.inicio && p.fim) return `${dataCurta(p.inicio, hoje)} – ${dataCurta(p.fim, hoje)}`;
  if (p.inicio) return `Desde ${dataCurta(p.inicio, hoje)}`;
  if (p.fim) return `Até ${dataCurta(p.fim, hoje)}`;
  return 'Sempre';
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
