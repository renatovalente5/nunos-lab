/** As peças do código por email que não falam com a base (28 nov 2026): à parte, para os testes. */
import { ALGARISMOS_DO_CODIGO } from '@nunos-lab/dominio';

const MILHAO = 10 ** ALGARISMOS_DO_CODIGO;
/** O maior múltiplo de um milhão que cabe em 32 bits: acima dele, o resto da divisão viciava os primeiros. */
const TECTO = Math.floor(2 ** 32 / MILHAO) * MILHAO;

/** Seis algarismos ao acaso, todos com a mesma probabilidade (o «000123» também). */
export function codigoNovo(): string {
  const n = new Uint32Array(1);
  do crypto.getRandomValues(n);
  while (n[0]! >= TECTO);
  return String(n[0]! % MILHAO).padStart(ALGARISMOS_DO_CODIGO, '0');
}

/**
 * A rede de um endereço, para os limites por rede: o IPv4 inteiro, e do IPv6 o /64 (o que uma casa ou
 * um telemóvel recebe: dentro dele, mudar de endereço não fura o limite).
 */
export function redeDe(ip: string): string {
  // Um IPv4 escrito à IPv6 («::ffff:203.0.113.7») é o IPv4.
  if (ip.includes('.')) return ip.slice(ip.lastIndexOf(':') + 1);
  if (!ip.includes(':')) return ip;
  const [esquerda = '', direita = ''] = ip.toLowerCase().split('::');
  const antes = esquerda ? esquerda.split(':') : [];
  const depois = ip.includes('::') && direita ? direita.split(':') : [];
  const grupos = ip.includes('::')
    ? [...antes, ...Array(Math.max(0, 8 - antes.length - depois.length)).fill('0'), ...depois]
    : antes;
  return `${grupos
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

/** Dois resumos iguais, sem parar no primeiro byte diferente. */
export function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i]! ^ b[i]!;
  return diferenca === 0;
}
