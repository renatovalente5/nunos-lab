import { diaDaSemana, somarDias } from './datas.ts';
import type { Lingua } from './lingua.ts';

/**
 * As vantagens que o parceiro valida ao ler o cartão: quantas vezes cada
 * cliente pode usar uma (por dia, semana, mês, ou no total) e quantas no total
 * para toda a gente. Todas são só para clientes activos (corte no último ano).
 */
export const PERIODOS_DO_LIMITE = ['dia', 'semana', 'mes', 'sempre'] as const;
export type PeriodoDoLimite = (typeof PERIODOS_DO_LIMITE)[number];

export const NOME_DO_PERIODO: Record<PeriodoDoLimite, string> = {
  dia: 'por dia',
  semana: 'por semana',
  mes: 'por mês',
  sempre: 'no total',
};

export const LIMITES_DOS_VALES = {
  porCliente: { min: 1, max: 100 },
  total: { min: 1, max: 100_000 },
} as const;

/** O primeiro dia que conta para o limite, dado o dia de hoje (Lisboa). */
export function inicioDoPeriodo(periodo: PeriodoDoLimite, hoje: string): string {
  switch (periodo) {
    case 'dia':
      return hoje;
    case 'semana':
      // A semana começa à segunda.
      return somarDias(hoje, -((diaDaSemana(hoje) + 6) % 7));
    case 'mes':
      return `${hoje.slice(0, 7)}-01`;
    case 'sempre':
      return '0000-00-00';
  }
}

export type MotivoDaVantagem =
  'ok' | 'ja_usou' | 'limite_do_cliente' | 'limite_total' | 'cliente_inactivo';

export type RegrasDaVantagem = {
  limitePorCliente: number | null;
  periodoDoLimite: PeriodoDoLimite;
  limiteTotal: number | null;
};

/** Pode este cliente usar a vantagem agora? E, se não, porquê (por esta ordem). */
export function motivoDaVantagem(
  regras: RegrasDaVantagem,
  estado: { usadasNoPeriodo: number; usadasTotal: number; activo: boolean },
): MotivoDaVantagem {
  // Todas as vantagens são só para clientes activos (o Renato, 8 nov 2026).
  if (!estado.activo) return 'cliente_inactivo';
  if (regras.limiteTotal !== null && estado.usadasTotal >= regras.limiteTotal)
    return 'limite_total';
  if (regras.limitePorCliente !== null && estado.usadasNoPeriodo >= regras.limitePorCliente)
    return regras.periodoDoLimite === 'dia' && regras.limitePorCliente === 1
      ? 'ja_usou'
      : 'limite_do_cliente';
  return 'ok';
}

export const NOME_DO_PERIODO_EN: Record<PeriodoDoLimite, string> = {
  dia: 'per day',
  semana: 'per week',
  mes: 'per month',
  sempre: 'in total',
};

/** «por dia», «per day». */
export function nomeDoPeriodo(periodo: PeriodoDoLimite, lingua: Lingua = 'pt'): string {
  return (lingua === 'en' ? NOME_DO_PERIODO_EN : NOME_DO_PERIODO)[periodo];
}

const VEZES_EN: Record<PeriodoDoLimite, string> = {
  dia: 'a day',
  semana: 'a week',
  mes: 'a month',
  sempre: 'in total',
};

/** «1 vez por dia», «2 vezes por semana», «3 vezes no total»; «Once a day», «Twice a week», «Once only»; ou nada. */
export function limiteEmTexto(
  regras: Pick<RegrasDaVantagem, 'limitePorCliente' | 'periodoDoLimite'>,
  lingua: Lingua = 'pt',
) {
  const n = regras.limitePorCliente;
  if (n === null) return null;
  if (lingua === 'en') {
    if (n === 1 && regras.periodoDoLimite === 'sempre') return 'Once only';
    const vezes = n === 1 ? 'Once' : n === 2 ? 'Twice' : `${n} times`;
    return `${vezes} ${VEZES_EN[regras.periodoDoLimite]}`;
  }
  return `${n} ${n === 1 ? 'vez' : 'vezes'} ${NOME_DO_PERIODO[regras.periodoDoLimite]}`;
}
