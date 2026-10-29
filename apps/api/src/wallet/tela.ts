/**
 * Uma tela de pixels de 8 bits (RGB opaca, ou RGBA transparente), com as
 * linhas já na forma que o PNG quer (um byte de filtro, a zero, à frente de
 * cada linha), e o pouco desenho de que o passe precisa: encher, discos e
 * anéis suavizados, e glifos pintados por uma máscara.
 */

export type Cor = readonly [number, number, number];

export class Tela {
  readonly canais: 3 | 4;
  /** Bytes por linha, com o byte do filtro. */
  readonly passo: number;
  readonly dados: Uint8Array;
  readonly largura: number;
  readonly altura: number;

  constructor(largura: number, altura: number, fundo: Cor | null) {
    this.largura = largura;
    this.altura = altura;
    this.canais = fundo ? 3 : 4;
    this.passo = 1 + largura * this.canais;
    this.dados = new Uint8Array(this.passo * altura);
    if (fundo) {
      // A primeira linha à mão; as outras são cópias dela.
      const d = this.dados;
      for (let x = 0; x < largura; x++) {
        const i = 1 + x * 3;
        d[i] = fundo[0];
        d[i + 1] = fundo[1];
        d[i + 2] = fundo[2];
      }
      for (let y = 1; y < altura; y++) d.copyWithin(y * this.passo, 0, this.passo);
    }
  }

  /** Mistura uma cor num pixel, com a cobertura dada (0 a 1). */
  pintar(x: number, y: number, cor: Cor, a: number) {
    if (!(a > 0) || x < 0 || y < 0 || x >= this.largura || y >= this.altura) return;
    if (a > 1) a = 1;
    const d = this.dados;
    const i = y * this.passo + 1 + x * this.canais;
    if (this.canais === 3) {
      d[i] = d[i]! + (cor[0] - d[i]!) * a + 0.5;
      d[i + 1] = d[i + 1]! + (cor[1] - d[i + 1]!) * a + 0.5;
      d[i + 2] = d[i + 2]! + (cor[2] - d[i + 2]!) * a + 0.5;
      return;
    }
    // «Sobre», com o alfa à parte (straight alpha).
    const da = d[i + 3]! / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    for (let c = 0; c < 3; c++) d[i + c] = (cor[c]! * a + d[i + c]! * da * (1 - a)) / oa + 0.5;
    d[i + 3] = oa * 255 + 0.5;
  }

  /** Um disco cheio, com a borda suavizada. */
  disco(cx: number, cy: number, r: number, cor: Cor, alfa = 1) {
    this.varrer(cx, cy, r + 1, (x, y, dist) => cobertura(r - dist) * alfa, cor);
  }

  /** Um anel de raio `r` (ao meio do traço) e espessura `e`, suavizado. */
  anel(cx: number, cy: number, r: number, e: number, cor: Cor, alfa = 1) {
    const fora = r + e / 2;
    const dentro = r - e / 2;
    this.varrer(
      cx,
      cy,
      fora + 1,
      (x, y, dist) => (cobertura(fora - dist) - cobertura(dentro - dist)) * alfa,
      cor,
    );
  }

  private varrer(
    cx: number,
    cy: number,
    alcance: number,
    f: (x: number, y: number, dist: number) => number,
    cor: Cor,
  ) {
    const x0 = Math.max(0, Math.floor(cx - alcance));
    const x1 = Math.min(this.largura - 1, Math.ceil(cx + alcance));
    const y0 = Math.max(0, Math.floor(cy - alcance));
    const y1 = Math.min(this.altura - 1, Math.ceil(cy + alcance));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        this.pintar(x, y, cor, f(x, y, Math.sqrt(dx * dx + dy * dy)));
      }
    }
  }

  /** Um glifo (máscara quadrada) pintado de `cor`, com `lado` pixels, com o canto em (x, y). */
  glifo(m: Mascara, x: number, y: number, lado: number, cor: Cor) {
    const n = Math.max(1, Math.round(lado));
    const razao = m.lado / n;
    const px = Math.round(x);
    const py = Math.round(y);
    const L = m.lado + 1;
    for (let dy = 0; dy < n; dy++) {
      const sy0 = Math.floor(dy * razao);
      const sy1 = Math.max(sy0 + 1, Math.min(m.lado, Math.floor((dy + 1) * razao)));
      for (let dx = 0; dx < n; dx++) {
        const sx0 = Math.floor(dx * razao);
        const sx1 = Math.max(sx0 + 1, Math.min(m.lado, Math.floor((dx + 1) * razao)));
        const soma =
          m.integral[sy1 * L + sx1]! -
          m.integral[sy0 * L + sx1]! -
          m.integral[sy1 * L + sx0]! +
          m.integral[sy0 * L + sx0]!;
        this.pintar(px + dx, py + dy, cor, soma / ((sx1 - sx0) * (sy1 - sy0) * 255));
      }
    }
  }
}

/** A cobertura de um pixel a `d` da borda (positivo = dentro): 0 fora, 1 dentro, a meio na borda. */
const cobertura = (d: number) => (d <= -0.5 ? 0 : d >= 0.5 ? 1 : d + 0.5);

/** Uma máscara (o alfa de um glifo) com a tabela das somas, para a reduzir a qualquer tamanho. */
export type Mascara = { lado: number; integral: Uint32Array };

export function mascara(alfa: Uint8Array, lado: number): Mascara {
  if (alfa.length !== lado * lado) throw new RangeError('A máscara não tem o tamanho que diz.');
  const L = lado + 1;
  const integral = new Uint32Array(L * L);
  for (let y = 1; y <= lado; y++) {
    let linha = 0;
    for (let x = 1; x <= lado; x++) {
      linha += alfa[(y - 1) * lado + (x - 1)]!;
      integral[y * L + x] = integral[(y - 1) * L + x]! + linha;
    }
  }
  return { lado, integral };
}
