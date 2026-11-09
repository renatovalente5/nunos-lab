/**
 * O horário de um parceiro, por dias (o Renato, 9 nov 2026): grupos de dias com as mesmas horas,
 * cada um com um intervalo ou dois (o segundo depois da pausa do almoço). O Nuno escolhe os dias e
 * as horas no backoffice; o texto escreve-se daqui, igual em todos os parceiros e nas duas línguas,
 * e a app diz se está aberto. Os dias vão de 1 (segunda) a 7 (domingo); as horas são «HH:MM», e um
 * intervalo que acaba antes de começar passa a meia-noite (22:00–02:00).
 */
import { diaDaSemana, diaEmLisboa, nomeDoDia, somarDias } from './datas.ts';
import type { Lingua } from './lingua.ts';

export type Hora = string;
export type Intervalo = [Hora, Hora];
export type DiasComHoras = { dias: number[]; horas: Intervalo[] };
export type HorarioDaSemana = DiasComHoras[];

/** De segunda a domingo, como nos botões do backoffice. */
export const DIAS_DO_HORARIO = [1, 2, 3, 4, 5, 6, 7] as const;
export const DIAS_CURTOS: Record<Lingua, readonly string[]> = {
  pt: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
/** O da manhã e o da tarde: um terceiro já não se lê numa linha. */
export const INTERVALOS_POR_DIA = 2;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIA_INTEIRO = 24 * 60;

export function eHora(valor: unknown): valor is Hora {
  return typeof valor === 'string' && HORA.test(valor);
}

/** Os minutos desde a meia-noite: «14:30» é 870. */
export function minutosDe(hora: Hora): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

/** «HH:MM» de um número de minutos (com os dias a mais ou a menos tirados). */
export function horaDosMinutos(minutos: number): Hora {
  const m = ((minutos % DIA_INTEIRO) + DIA_INTEIRO) % DIA_INTEIRO;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** O nome do dia (1 = segunda … 7 = domingo) na língua pedida: «segunda», «Monday». */
export function nomeDoDiaDoHorario(dia: number, lingua: Lingua = 'pt'): string {
  return nomeDoDia(dia % 7, lingua);
}

/**
 * Um horário que se pode guardar: de um a sete grupos, cada dia num grupo só, e em cada grupo os
 * intervalos por ordem, sem se tocarem, com horas diferentes no início e no fim. Só o último
 * intervalo do dia pode passar a meia-noite.
 */
export function eHorarioValido(valor: unknown): valor is HorarioDaSemana {
  if (!Array.isArray(valor) || !valor.length || valor.length > DIAS_DO_HORARIO.length) return false;
  const vistos = new Set<number>();
  for (const grupo of valor as unknown[]) {
    if (!grupo || typeof grupo !== 'object') return false;
    const { dias, horas } = grupo as { dias?: unknown; horas?: unknown };
    if (!Array.isArray(dias) || !dias.length) return false;
    for (const d of dias) {
      if (!Number.isInteger(d) || d < 1 || d > 7 || vistos.has(d)) return false;
      vistos.add(d);
    }
    if (!Array.isArray(horas) || !horas.length || horas.length > INTERVALOS_POR_DIA) return false;
    if (!horas.every((h) => Array.isArray(h) && h.length === 2 && eHora(h[0]) && eHora(h[1])))
      return false;
    const porOrdem = (horas as Intervalo[])
      .map(([a, b]) => [minutosDe(a), minutosDe(b)] as const)
      .sort((x, y) => x[0] - y[0]);
    for (const [i, [a, b]] of porOrdem.entries()) {
      if (a === b) return false;
      const seguinte = porOrdem[i + 1];
      if (seguinte && (b < a || seguinte[0] <= b)) return false;
    }
  }
  return true;
}

/**
 * O horário arrumado: os dias e os intervalos por ordem, e os grupos pelo primeiro dia. É assim
 * que se guarda e se escreve; arrumar duas vezes dá o mesmo.
 */
export function arrumarHorario(horario: HorarioDaSemana): HorarioDaSemana {
  return horario
    .map((g) => ({
      dias: [...new Set(g.dias)].sort((a, b) => a - b),
      horas: g.horas
        .map(([a, b]) => [a, b] as Intervalo)
        .sort((x, y) => minutosDe(x[0]) - minutosDe(y[0])),
    }))
    .sort((x, y) => (x.dias[0] ?? 8) - (y.dias[0] ?? 8));
}

/** O horário guardado na base (JSON), ou null se não houver ou não servir. */
export function lerHorarioDaSemana(json: string | null | undefined): HorarioDaSemana | null {
  if (!json) return null;
  try {
    const valor: unknown = JSON.parse(json);
    return eHorarioValido(valor) ? arrumarHorario(valor) : null;
  } catch {
    return null;
  }
}

/**
 * Uma hora escrita: «9h», «12h30» em português; «9:00», «12:30» em inglês. A meia-noite no fim de
 * um intervalo é o fim do dia: «24h», «24:00».
 */
export function horaEscrita(hora: Hora, lingua: Lingua = 'pt', noFim = false): string {
  const m = minutosDe(hora);
  const h = noFim && m === 0 ? 24 : Math.floor(m / 60);
  const min = String(m % 60).padStart(2, '0');
  if (lingua === 'en') return `${h}:${min}`;
  return m % 60 ? `${h}h${min}` : `${h}h`;
}

/** A hora numa frase: «às 9h», «à 1h», «à meia-noite»; «at 9:00», «at midnight». */
export function aHora(hora: Hora, lingua: Lingua = 'pt'): string {
  const m = minutosDe(hora);
  if (lingua === 'en') return m === 0 ? 'at midnight' : `at ${horaEscrita(hora, 'en')}`;
  if (m === 0) return 'à meia-noite';
  return `${Math.floor(m / 60) === 1 ? 'à' : 'às'} ${horaEscrita(hora)}`;
}

/** Os dias de um grupo: «Seg a sáb», «Sáb e dom», «Seg, qua e sex»; «Mon to Sat», «Every day». */
function diasEscritos(dias: number[], lingua: Lingua): string {
  if (dias.length === DIAS_DO_HORARIO.length)
    return lingua === 'en' ? 'Every day' : 'Todos os dias';
  const nome = (d: number) => DIAS_CURTOS[lingua][d - 1] ?? '';
  // Três ou mais dias seguidos juntam-se («Seg a qua»); dois seguidos ficam dois nomes.
  const pedacos: string[] = [];
  for (let i = 0; i < dias.length;) {
    let j = i;
    while (j + 1 < dias.length && dias[j + 1] === dias[j]! + 1) j++;
    if (j - i >= 2)
      pedacos.push(`${nome(dias[i]!)} ${lingua === 'en' ? 'to' : 'a'} ${nome(dias[j]!)}`);
    else for (let k = i; k <= j; k++) pedacos.push(nome(dias[k]!));
    i = j + 1;
  }
  const e = lingua === 'en' ? 'and' : 'e';
  const texto =
    pedacos.length < 2
      ? (pedacos[0] ?? '')
      : `${pedacos.slice(0, -1).join(', ')} ${e} ${pedacos.at(-1)}`;
  // Em português, só a primeira letra é grande.
  return lingua === 'pt' ? texto.charAt(0) + texto.slice(1).toLowerCase() : texto;
}

/**
 * O horário em texto, uma linha por grupo: «Seg a sáb · 9h–12h30 e 14h30–19h». É o que a app
 * mostra, e o que vai no campo `horario` para as apps instaladas antes de 9 nov 2026.
 */
export function textoDoHorario(horario: HorarioDaSemana, lingua: Lingua = 'pt'): string {
  const e = lingua === 'en' ? ' and ' : ' e ';
  return arrumarHorario(horario)
    .map(
      (g) =>
        `${diasEscritos(g.dias, lingua)} · ${g.horas
          .map(([a, b]) => `${horaEscrita(a, lingua)}–${horaEscrita(b, lingua, true)}`)
          .join(e)}`,
    )
    .join('\n');
}

// ——— feriados ———

/** O domingo de Páscoa de um ano, no calendário gregoriano (o cálculo de Meeus, Jones e Butcher). */
export function domingoDePascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const h =
    (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Os feriados nacionais de data fixa (Código do Trabalho, art. 234.º). */
const FERIADOS_FIXOS = [
  '01-01',
  '04-25',
  '05-01',
  '06-10',
  '08-15',
  '10-05',
  '11-01',
  '12-01',
  '12-08',
  '12-25',
];

/**
 * Um dos 13 feriados nacionais obrigatórios: os de data fixa, a Sexta-feira Santa, o domingo de
 * Páscoa e o Corpo de Deus. Os municipais e o Carnaval ficam de fora (mudam de terra para terra).
 */
export function eFeriadoNacional(dia: string): boolean {
  if (FERIADOS_FIXOS.includes(dia.slice(5))) return true;
  const pascoa = domingoDePascoa(Number(dia.slice(0, 4)));
  return dia === pascoa || dia === somarDias(pascoa, -2) || dia === somarDias(pascoa, 60);
}

// ——— aberto ou fechado ———

const FORMATO_DA_HORA = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Lisbon',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** A hora de Lisboa num instante, em minutos desde a meia-noite (por omissão, agora). */
export function minutosEmLisboa(instante: Date | number = Date.now()): number {
  const m = /(\d{1,2})\D+(\d{2})/.exec(FORMATO_DA_HORA.format(new Date(instante)));
  return m ? (Number(m[1]) % 24) * 60 + Number(m[2]) : 0;
}

export type EstadoDoHorario =
  | { tipo: 'aberto'; fecha: Hora }
  /** `daquiA`: 0 é hoje, 1 é amanhã; `dia` vai de 1 (segunda) a 7. Sem `abre`, não se promete. */
  | { tipo: 'fechado'; abre: { hora: Hora; daquiA: number; dia: number } | null }
  /** Feriado nacional num dia em que abriria: pode estar fechado. */
  | { tipo: 'feriado' };

/**
 * Aberto ou fechado num instante, pela hora de Lisboa: aberto, até quando; fechado, quando abre.
 * Num feriado nacional em que abriria, não se sabe (muitos fecham); se a próxima abertura calhar num
 * feriado, também não se promete. Null se o horário não tiver horas nenhumas.
 */
export function estadoDoHorario(
  horario: HorarioDaSemana,
  instante: Date | number = Date.now(),
): EstadoDoHorario | null {
  const hoje = diaEmLisboa(instante);
  const agora = minutosEmLisboa(instante);
  const semana = ((diaDaSemana(hoje) + 6) % 7) + 1;
  // Os intervalos de ontem (o que passa a meia-noite) até daqui a uma semana, em minutos desde a
  // meia-noite de hoje.
  const intervalos: { de: number; ate: number }[] = [];
  for (let k = -1; k <= 7; k++) {
    const dia = ((semana - 1 + k + 7) % 7) + 1;
    for (const [a, b] of horario.find((g) => g.dias.includes(dia))?.horas ?? []) {
      const de = minutosDe(a);
      const ate = minutosDe(b);
      intervalos.push({
        de: k * DIA_INTEIRO + de,
        ate: k * DIA_INTEIRO + (ate > de ? ate : ate + DIA_INTEIRO),
      });
    }
  }
  intervalos.sort((x, y) => x.de - y.de);
  const feriado = eFeriadoNacional(hoje);
  const aberto = intervalos.find((i) => i.de <= agora && agora < i.ate);
  if (aberto) {
    if (feriado) return { tipo: 'feriado' };
    // Intervalos colados (até à meia-noite e a seguir dela) fecham uma vez só.
    let ate = aberto.ate;
    for (const i of intervalos) if (i.de <= ate && i.ate > ate) ate = i.ate;
    return { tipo: 'aberto', fecha: horaDosMinutos(ate) };
  }
  const seguinte = intervalos.find((i) => i.de > agora);
  if (!seguinte) return null;
  const daquiA = Math.floor(seguinte.de / DIA_INTEIRO);
  if (daquiA === 0 && feriado) return { tipo: 'feriado' };
  if (eFeriadoNacional(somarDias(hoje, daquiA))) return { tipo: 'fechado', abre: null };
  return {
    tipo: 'fechado',
    abre: { hora: horaDosMinutos(seguinte.de), daquiA, dia: ((semana - 1 + daquiA) % 7) + 1 },
  };
}
