/**
 * O saldo e os convites (o Renato, 10 nov 2026). Os valores andam sempre em cêntimos, inteiros (a base
 * aceita cêntimos), e mostram-se em euros; ao balcão usam-se euros inteiros (1 €, 2 €, 3 €…).
 */
import { codigoValido, normalizarCodigo } from './cartao.ts';
import type { Programa } from './fidelidade.ts';
import type { Lingua } from './lingua.ts';

/** O que o Nuno define no backoffice. Sem nada escrito, valem as predefinições. */
export type DefinicoesDosConvites = {
  /** Há convites: a carteira mostra a ligação e os códigos aceitam-se. */
  ligado: boolean;
  /** Em cêntimos: o que ganha quem convida, quando o convidado vai à barbearia. */
  valorPadrinho: number;
  /** Em cêntimos: o que ganha o convidado, logo ao aceitar o convite. */
  valorConvidado: number;
  /** Quantos convites aceites pode ter cada cliente (null: sem limite). */
  limite: number | null;
};

/** O programa como o backoffice o lê e grava (GET/PUT /api/bo/programa): com os convites. */
export type ProgramaDoBackoffice = Programa & { convites: DefinicoesDosConvites };

/**
 * Desligados até o Nuno os ligar no backoffice: ao publicar, o saldo e os convites não aparecem aos
 * clientes antes de os telemóveis do balcão terem a versão que os usa (revisão de 11 nov 2026).
 */
export const CONVITES_PREDEFINIDOS: DefinicoesDosConvites = {
  ligado: false,
  valorPadrinho: 100,
  valorConvidado: 100,
  limite: 10,
};

/** Os limites dos campos do backoffice e do balcão (em cêntimos onde é dinheiro). */
export const LIMITES_DO_SALDO = {
  /** O prémio de cada lado de um convite: até 50 €. */
  premio: { min: 0, max: 5000 },
  /** Convites aceites por cliente. */
  convites: { min: 1, max: 100 },
  /** Um uso ao balcão, ou um acerto no backoffice: até 500 €. */
  movimento: { max: 50000 },
  /** A nota de um acerto no backoffice. */
  nota: 140,
} as const;

/**
 * De onde veio um movimento: «convidado» (ganhou ao aceitar um convite), «convite» (alguém que
 * convidou foi à barbearia), «uso» (o barbeiro usou o saldo ao balcão), «acerto» (o Nuno, no
 * backoffice).
 */
export const TIPOS_DE_MOVIMENTO = ['convidado', 'convite', 'uso', 'acerto'] as const;
export type TipoDeMovimento = (typeof TIPOS_DE_MOVIMENTO)[number];

/** «1 €», «2,50 €», «−3 €» em português; «€1», «€2.50», «−€3» em inglês. */
export function euros(centimos: number, lingua: Lingua = 'pt'): string {
  const absoluto = Math.abs(Math.round(centimos));
  const inteiros = Math.floor(absoluto / 100);
  const resto = absoluto % 100;
  const separador = lingua === 'en' ? '.' : ',';
  const numero = resto
    ? `${inteiros}${separador}${String(resto).padStart(2, '0')}`
    : String(inteiros);
  const sinal = centimos < 0 ? '−' : '';
  return lingua === 'en' ? `${sinal}€${numero}` : `${sinal}${numero} €`;
}

/** Com o sinal à frente também quando entra: «+1 €», «−2 €». */
export function eurosComSinal(centimos: number, lingua: Lingua = 'pt'): string {
  return centimos > 0 ? `+${euros(centimos, lingua)}` : euros(centimos, lingua);
}

/** Os euros inteiros que se podem usar ao balcão de um saldo (0 se não chega a 1 €). */
export function eurosParaUsar(saldo: number): number {
  return Math.max(0, Math.floor(saldo / 100));
}

/**
 * Como um cliente vê o outro num convite: o primeiro nome e a inicial do último («Pedro S.»). Quem
 * convida vê se o convidado já foi à barbearia, e o convidado vê quem o convidou: só isto, mais nada.
 */
export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  // O primeiro nome até 20 letras: um nome comprido não vira uma frase na faixa do convite.
  const primeiro = Array.from(partes[0]!).slice(0, 20).join('');
  if (partes.length === 1) return primeiro;
  const inicial = Array.from(partes[partes.length - 1]!)[0]!;
  return `${primeiro} ${inicial.toLocaleUpperCase('pt')}.`;
}

/** Quantos convites ainda cabem (null: sem limite). */
export function convitesQueFaltam(limite: number | null, aceites: number): number | null {
  return limite === null ? null : Math.max(0, limite - aceites);
}

/**
 * O código de convite que a pessoa escreveu ou colou: a ligação inteira (`…?convite=CODIGO&…`), o código
 * com ou sem espaço, em minúsculas, ou a frase da partilha («Código: ABCD1234»). Devolve o código
 * arrumado; quem chama confere se é válido (11 nov 2026: a ligação colada era recusada).
 */
export function codigoDoConviteEscrito(escrito: string): string {
  const daLigacao = /[?&]convite=([0-9A-Za-z -]+)/i.exec(escrito)?.[1];
  if (daLigacao) return normalizarCodigo(daLigacao);
  const tudo = normalizarCodigo(escrito);
  if (codigoValido(tudo)) return tudo;
  const pedacos = escrito
    .trim()
    .split(/[\s:=/]+/)
    .filter(Boolean);
  for (const n of [1, 2]) {
    const codigo = normalizarCodigo(pedacos.slice(-n).join(''));
    if (codigoValido(codigo)) return codigo;
  }
  return tudo;
}

/** A app dos clientes na Play Store (o Android). */
export const PACOTE_DA_APP_ANDROID = 'pt.nunoslab.app';

/**
 * A morada da app na Play Store com o código de um convite (o Renato, 11 nov 2026): a Play Store guarda o
 * `referrer` e a app lê-o uma vez, no primeiro arranque (o Install Referrer, a partir da 1.0.4 do Android).
 */
export function ligacaoDaPlayStore(codigo: string): string {
  return `https://play.google.com/store/apps/details?id=${PACOTE_DA_APP_ANDROID}&referrer=${encodeURIComponent(`convite=${codigo}`)}`;
}

/**
 * O código de um convite no `referrer` que a Play Store entrega à app: «convite=CODIGO», às vezes com mais
 * campos («utm_source=…&convite=…») ou ainda codificado («convite%3DCODIGO»). Sem um código válido, null
 * (quem instalou sem convite traz «utm_source=google-play&utm_medium=organic»).
 */
export function codigoDoReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  let texto = referrer;
  try {
    texto = decodeURIComponent(referrer);
  } catch {
    // Um «%» solto: fica como veio.
  }
  const m = /(?:^|[?&])convite=([0-9A-Za-z -]{1,20})(?:&|$)/i.exec(texto.trim());
  if (!m) return null;
  const codigo = normalizarCodigo(m[1]!);
  return codigoValido(codigo) ? codigo : null;
}
