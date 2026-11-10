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
 * As cores principais de uma imagem, pelos píxeis RGBA (os de um `getImageData`): as que ocupam mais,
 * por ordem, com os tons quase iguais juntos, sem o transparente e sem as que mal se vêem (os tons de
 * passagem nas bordas das letras). Para sugerir as cores do logótipo (o Renato, 10 nov).
 */
export function coresPrincipais(pixeis: ArrayLike<number>, maximo = 4, minimo = 0.03): string[] {
  // Primeiro em caixas de 16 tons por canal, com a média do que caiu em cada uma.
  const caixas = new Map<number, { n: number; r: number; g: number; b: number }>();
  let opacos = 0;
  for (let i = 0; i + 3 < pixeis.length; i += 4) {
    if ((pixeis[i + 3] ?? 0) < 200) continue;
    const [r, g, b] = [pixeis[i] ?? 0, pixeis[i + 1] ?? 0, pixeis[i + 2] ?? 0];
    const chave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const caixa = caixas.get(chave) ?? { n: 0, r: 0, g: 0, b: 0 };
    caixa.n++;
    caixa.r += r;
    caixa.g += g;
    caixa.b += b;
    caixas.set(chave, caixa);
    opacos++;
  }
  if (!opacos) return [];
  // Depois, da caixa mais cheia para a mais vazia: a que fica perto de um grupo já feito junta-se a ele.
  const grupos: { n: number; cor: [number, number, number] }[] = [];
  for (const c of [...caixas.values()].sort((a, b) => b.n - a.n)) {
    const cor: [number, number, number] = [c.r / c.n, c.g / c.n, c.b / c.n];
    const perto = grupos.find(
      (g) => Math.hypot(g.cor[0] - cor[0], g.cor[1] - cor[1], g.cor[2] - cor[2]) < 48,
    );
    if (perto) perto.n += c.n;
    else grupos.push({ n: c.n, cor });
  }
  return grupos
    .filter((g) => g.n / opacos >= minimo)
    .sort((a, b) => b.n - a.n)
    .slice(0, maximo)
    .map((g) =>
      `#${g.cor.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase(),
    );
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
