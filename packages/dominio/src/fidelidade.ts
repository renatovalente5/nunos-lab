import type { Lingua } from './lingua.ts';
/** As regras do cartão de carimbos, escritas uma vez. */

export type Programa = {
  /** Carimbos para a recompensa (1 a 50). */
  objectivo: number;
  /** O que se ganha: «50% de desconto», «Corte grátis», «−50 % na barba»… */
  recompensa: string;
  /** Carimbos por cliente por dia; acima disto a Balcão avisa e marca «repetido». */
  porDia: number;
  /** A prenda de anos (texto livre; vazio: não há). */
  aniversario: string;
  /** As versões inglesas (vazias: o português). */
  recompensaEn?: string;
  aniversarioEn?: string;
};

export const PROGRAMA_PREDEFINIDO: Programa = {
  objectivo: 10,
  recompensa: '50% de desconto',
  porDia: 1,
  aniversario: '',
};

export const LIMITES_DO_PROGRAMA = {
  objectivo: { min: 1, max: 50 },
  porDia: { min: 1, max: 10 },
  recompensa: 40,
  aniversario: 60,
  nomeDoCliente: 40,
  codigo: 8,
} as const;

/** Quantos faltam, e se o cartão está completo. */
export function estadoDoCartao(carimbos: number, objectivo: number) {
  const faltam = Math.max(0, objectivo - carimbos);
  return { faltam, completo: carimbos >= objectivo };
}

const eCorteGratis = (recompensa: string) => /^corte gr[áa]tis$/i.test(recompensa.trim());
/** «50% de desconto», «−50 %», «metade do preço»: um desconto nesse corte, não uma coisa à parte. */
const eDesconto = (recompensa: string) => /desconto|%|metade/i.test(recompensa);
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * O prémio em inglês, quando o backoffice só o tem em português: os dois de sempre traduzem-se
 * («Corte grátis» → «Free haircut», «50% de desconto» → «50% off»); outro texto fica como está.
 */
const eCorteGratisEn = (recompensa: string) => /^free (hair)?cut$/i.test(recompensa.trim());
const eDescontoEn = (recompensa: string) => /\boff\b|discount|%|half/i.test(recompensa);
export function recompensaEmIngles(recompensa: string): string {
  const r = recompensa.trim();
  if (eCorteGratis(r)) return 'Free haircut';
  const percentagem = /^[-−]?\s*(\d+)\s*%\s*(de desconto)?$/i.exec(r);
  if (percentagem) return `${percentagem[1]}% off`;
  return r;
}

/** O prémio na língua pedida: em inglês, os dois de sempre traduzem-se; outro texto fica como está. */
export function recompensaNaLingua(recompensa: string, lingua: Lingua): string {
  return lingua === 'en' ? recompensaEmIngles(recompensa) : recompensa.trim();
}

/**
 * Quando falta um: «O próximo corte é grátis», «O próximo corte tem 50% de desconto», ou «O próximo é
 * barba grátis». Em inglês: «Your next haircut is free», «Your next haircut is 50% off», «Next: …».
 */
export function fraseDoProximo(recompensa: string, lingua: Lingua = 'pt'): string {
  const r = recompensa.trim();
  if (lingua === 'en') {
    const e = recompensaEmIngles(r);
    if (!e) return '1 to go';
    if (eCorteGratisEn(e)) return 'Your next haircut is free';
    if (eDescontoEn(e)) return `Your next haircut is ${minuscula(e)}`;
    return `Next: ${minuscula(e)}`;
  }
  if (!r) return 'Falta 1';
  if (eCorteGratis(r)) return 'O próximo corte é grátis';
  if (eDesconto(r)) return `O próximo corte tem ${minuscula(r)}`;
  return `O próximo é ${minuscula(r)}`;
}

/** O que a ficha diz ao barbeiro no corte da oferta: «Este corte é grátis», «Este corte tem 50% de desconto». */
export function fraseDesteCorte(recompensa: string, lingua: Lingua = 'pt'): string {
  const r = recompensa.trim();
  if (lingua === 'en') {
    const e = recompensaEmIngles(r);
    if (eCorteGratisEn(e)) return 'This haircut is free';
    if (eDescontoEn(e)) return `This haircut is ${minuscula(e)}`;
    return `This haircut: ${minuscula(e)}`;
  }
  if (eCorteGratis(r)) return 'Este corte é grátis';
  if (eDesconto(r)) return `Este corte tem ${minuscula(r)}`;
  return `Este corte: ${minuscula(r)}`;
}

/** Depois do carimbo que completa o cartão: «Este corte foi grátis», «Este corte teve 50% de desconto». */
export function fraseDoCorteOferecido(recompensa: string, lingua: Lingua = 'pt'): string {
  const r = recompensa.trim();
  if (lingua === 'en') {
    const e = recompensaEmIngles(r);
    if (eCorteGratisEn(e)) return 'This haircut was free';
    if (eDescontoEn(e)) return `This haircut was ${minuscula(e)}`;
    return `${e} · given`;
  }
  if (eCorteGratis(r)) return 'Este corte foi grátis';
  if (eDesconto(r)) return `Este corte teve ${minuscula(r)}`;
  return `${r} · entregue`;
}

/**
 * «Prémio: corte grátis», «O próximo corte é grátis», ou «Cartão completo»; sem prémio, «Faltam 3».
 * O «3 de 10» ao lado já diz quantos faltam: era «Faltam 7 para corte grátis» até 7 nov (o Renato).
 */
export function fraseDoCartao(
  carimbos: number,
  programa: Pick<Programa, 'objectivo' | 'recompensa'>,
  lingua: Lingua = 'pt',
) {
  const { faltam, completo } = estadoDoCartao(carimbos, programa.objectivo);
  const en = lingua === 'en';
  if (completo) return en ? 'Card complete' : 'Cartão completo';
  const recompensa = programa.recompensa.trim();
  if (faltam === 1) return fraseDoProximo(recompensa, lingua);
  if (en)
    return recompensa ? `Reward: ${minuscula(recompensaEmIngles(recompensa))}` : `${faltam} to go`;
  return recompensa ? `Prémio: ${minuscula(recompensa)}` : `Faltam ${faltam}`;
}

/** Quanto tempo vale uma sessão da Balcão parada (um barbeiro não volta a entrar). */
export const DIAS_DA_SESSAO_DA_EQUIPA = 365;
/** E a de um cliente. */
export const DIAS_DA_SESSAO_DO_CLIENTE = 365;
/** O tecto de uma sessão da equipa desde que abriu, por mais que se use: um telemóvel perdido não vale para sempre. */
export const DIAS_MAXIMOS_DA_SESSAO_DA_EQUIPA = 180;
/** E o tecto de qualquer outra sessão (cliente, backoffice). */
export const DIAS_MAXIMOS_DA_SESSAO = 365;
/** Uma forma de entrar nova fica «à experiência» estes dias: não pode ficar sozinha. */
export const DIAS_A_EXPERIENCIA = 7;
/** Quem carimbou pode anular nestes minutos; o dono anula sempre. */
export const MINUTOS_PARA_ANULAR = 10;
/** Um cliente conta como activo com um carimbo nestes dias (as vantagens dos parceiros). */
export const DIAS_DE_CLIENTE_ACTIVO = 365;

/** «MM-DD» que existe no calendário (29 de fevereiro conta). */
export function eAniversarioValido(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const m = /^(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const mes = Number(m[1]);
  const dia = Number(m[2]);
  const dias = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= dias[mes - 1]!;
}

/** Uma caixa de correio que nunca muda de dono (Gmail e iCloud não reciclam moradas). */
export function donaDaCaixa(email: string): boolean {
  const dominio = email.toLowerCase().split('@')[1] ?? '';
  return ['gmail.com', 'googlemail.com', 'icloud.com', 'me.com', 'mac.com'].includes(dominio);
}

/** Um email de retransmissão da Apple («ocultar o meu email»): não identifica a pessoa. */
export function eEmailDeRelay(email: string): boolean {
  return /@privaterelay\.appleid\.com$/i.test(email);
}

/** A prenda de anos só conta com a data dada há pelo menos estes dias: senão mudava-se a data na véspera. */
export const DIAS_PARA_A_PRENDA = 30;

/** Faz anos hoje E deu a data há 30 dias ou mais (`desde`: quando a deu, em segundos; null: nunca). */
export function temPrendaHoje(
  aniversario: string | null | undefined,
  desde: number | null | undefined,
  hoje: string,
  agoraS: number,
): boolean {
  if (!fazAnosHoje(aniversario, hoje)) return false;
  return typeof desde === 'number' && desde <= agoraS - DIAS_PARA_A_PRENDA * 86400;
}

/** Faz anos hoje? Quem nasceu a 29 de Fevereiro faz anos a 28 nos anos sem 29. */
export function fazAnosHoje(aniversario: string | null | undefined, hoje: string): boolean {
  if (!aniversario) return false;
  const diaDeHoje = hoje.slice(5);
  if (diaDeHoje === aniversario) return true;
  if (aniversario !== '02-29' || diaDeHoje !== '02-28') return false;
  const ano = Number(hoje.slice(0, 4));
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  return !bissexto;
}
