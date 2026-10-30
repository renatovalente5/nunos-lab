/** As regras do cartão de carimbos, escritas uma vez. */

export type Programa = {
  /** Carimbos para a recompensa (1 a 50). */
  objectivo: number;
  /** O que se ganha: «Corte grátis», «−50 % na barba»… */
  recompensa: string;
  /** Carimbos por cliente por dia; acima disto a Balcão avisa e marca «repetido». */
  porDia: number;
  /** A prenda de anos (texto livre; vazio: não há). */
  aniversario: string;
};

export const PROGRAMA_PREDEFINIDO: Programa = {
  objectivo: 10,
  recompensa: 'Corte grátis',
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
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Quando falta um: «O próximo corte é grátis» (a oferta é o último corte), ou «O próximo é −50 % na barba». */
export function fraseDoProximo(recompensa: string): string {
  const r = recompensa.trim();
  if (!r) return 'Falta 1';
  return eCorteGratis(r) ? 'O próximo corte é grátis' : `O próximo é ${minuscula(r)}`;
}

/** O que a ficha diz ao barbeiro no corte da oferta: «Este corte é grátis». */
export function fraseDesteCorte(recompensa: string): string {
  const r = recompensa.trim();
  return eCorteGratis(r) ? 'Este corte é grátis' : `Este corte: ${minuscula(r)}`;
}

/** Depois do carimbo que completa o cartão: «Este corte foi grátis». */
export function fraseDoCorteOferecido(recompensa: string): string {
  const r = recompensa.trim();
  return eCorteGratis(r) ? 'Este corte foi grátis' : `${r} · entregue`;
}

/** «Faltam 3 para o corte grátis», «O próximo corte é grátis», ou «Cartão completo». */
export function fraseDoCartao(
  carimbos: number,
  programa: Pick<Programa, 'objectivo' | 'recompensa'>,
) {
  const { faltam, completo } = estadoDoCartao(carimbos, programa.objectivo);
  if (completo) return 'Cartão completo';
  const recompensa = programa.recompensa.trim();
  const alvo = recompensa
    ? ` para ${recompensa.charAt(0).toLowerCase()}${recompensa.slice(1)}`
    : '';
  if (faltam === 1) return fraseDoProximo(recompensa);
  return `Faltam ${faltam}${alvo}`;
}

/** Quanto tempo vale uma sessão da Balcão parada (um barbeiro não volta a entrar). */
export const DIAS_DA_SESSAO_DA_EQUIPA = 365;
/** E a de um cliente. */
export const DIAS_DA_SESSAO_DO_CLIENTE = 365;
/** Depois de entrar, quantos minutos conta como «prova recente» (juntar, tirar, apagar). */
export const MINUTOS_DE_PROVA_RECENTE = 15;
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
