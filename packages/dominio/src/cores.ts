/** Contas de cor: o contraste da WCAG, para escolher a tinta que se lê sobre uma cor. */

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function eCor(valor: unknown): valor is string {
  return typeof valor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(valor);
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Branco ou quase preto, o que se ler melhor sobre `fundo`. */
export function tintaSobre(fundo: string): '#FFFFFF' | '#111111' {
  return contraste(fundo, '#FFFFFF') >= contraste(fundo, '#111111') ? '#FFFFFF' : '#111111';
}

/** Mistura `a` com `b` (t = 0 dá `a`, t = 1 dá `b`). */
export function misturar(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/**
 * A cor de um parceiro pronta para levar texto branco por cima (capa, cartão em
 * destaque, iniciais): escurece aos poucos até o branco passar `minimo` (WCAG
 * AA, 4,5:1). As cores da lista já passam e ficam iguais; uma «outra cor» clara
 * escolhida no backoffice (um amarelo dá 1,6:1) desce até se ler.
 */
export function corParaBranco(cor: string, minimo = 4.5): string {
  if (!eCor(cor)) return '#26303D';
  for (let t = 0; t <= 1; t += 0.04) {
    const escura = misturar(cor, '#000000', t);
    if (contraste(escura, '#FFFFFF') >= minimo) return escura;
  }
  return '#000000';
}
