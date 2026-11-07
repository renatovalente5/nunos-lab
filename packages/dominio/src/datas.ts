/**
 * Datas como a pessoa as vê em Portugal continental: um dia é «AAAA-MM-DD» no
 * fuso de Lisboa. As promoções começam e acabam em dias, e «hoje» decide-se
 * aqui, igual no servidor, na app e no backoffice.
 */
const FORMATO_DO_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Lisbon',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

import type { Lingua } from './lingua.ts';

export const MESES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;
export const MESES_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
export const DIAS_DA_SEMANA = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
] as const;

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** O dia de Lisboa num instante (por omissão, agora). */
export function diaEmLisboa(instante: Date | number = Date.now()): string {
  return FORMATO_DO_DIA.format(new Date(instante));
}

/** «AAAA-MM-DD» que existe mesmo no calendário (o 31 de fevereiro não passa). */
export function eDiaValido(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const m = DIA.exec(valor);
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const data = new Date(Date.UTC(a, me - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === me - 1 && data.getUTCDate() === d;
}

function emUTC(dia: string): Date {
  const m = DIA.exec(dia);
  if (!m) throw new Error(`Dia inválido: ${dia}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** O dia `n` dias depois (ou antes, com `n` negativo). */
export function somarDias(dia: string, n: number): string {
  const d = emUTC(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Quantos dias vão de `de` até `ate` (0 no mesmo dia; negativo se `ate` já passou). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((emUTC(ate).getTime() - emUTC(de).getTime()) / 86_400_000);
}

/** O dia da semana de um dia (0 = domingo). */
export function diaDaSemana(dia: string): number {
  return emUTC(dia).getUTCDay();
}

/** «31 dez», ou «31 dez 2027» quando não é o ano de `hoje` (com espaços que não partem). */
export const DIAS_DA_SEMANA_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** O nome de um dia da semana (0 = domingo) na língua pedida. */
/** O mês curto, de 0 a 11: «out», «Oct». */
export function nomeDoMes(n: number, lingua: Lingua = 'pt'): string {
  return (lingua === 'en' ? MESES_EN : MESES)[n] as string;
}

export function nomeDoDia(n: number, lingua: Lingua = 'pt'): string {
  return (lingua === 'en' ? DIAS_DA_SEMANA_EN : DIAS_DA_SEMANA)[n] as string;
}

export function dataCurta(dia: string, hoje: string, lingua: Lingua = 'pt'): string {
  const d = emUTC(dia);
  // O espaço que não parte: «31 dez» lê-se de uma vez e nunca fica partido.
  const texto = `${d.getUTCDate()}\u00A0${(lingua === 'en' ? MESES_EN : MESES)[d.getUTCMonth()]}`;
  return dia.slice(0, 4) === hoje.slice(0, 4) ? texto : `${texto}\u00A0${dia.slice(0, 4)}`;
}
