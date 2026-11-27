/**
 * Como o logótipo enche o círculo: a cor do fundo, o tamanho (o lado da caixa da imagem, em fracção
 * do círculo; a imagem cabe nela sem se deformar) e o desvio do centro (em fracção do círculo).
 * Sem ajuste fica o de sempre: fundo branco e a imagem a 70 %. O Nuno acerta-o no backoffice (o
 * Renato, 9 nov: um logótipo quadrado de fundo verde ficava num círculo branco).
 */
export type AjusteDoLogotipo = { fundo: string; zoom: number; x: number; y: number };

export const AJUSTE_DE_ORIGEM: AjusteDoLogotipo = { fundo: '#FFFFFF', zoom: 0.7, x: 0, y: 0 };

export const LIMITES_DO_AJUSTE = { zoom: { min: 0.3, max: 3 }, desvio: 1 } as const;

const COR = /^#[0-9A-F]{6}$/;

/** O ajuste dentro dos limites, com a cor em maiúsculas; null se não servir. */
export function limitarAjuste(a: unknown): AjusteDoLogotipo | null {
  if (!a || typeof a !== 'object') return null;
  const { fundo, zoom, x, y } = a as Record<string, unknown>;
  if (typeof fundo !== 'string' || !COR.test(fundo.toUpperCase())) return null;
  if (![zoom, x, y].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  // Três casas chegam (um píxel num círculo de 300) e o JSON fica curto.
  const entre = (n: number, min: number, max: number) =>
    Math.round(Math.min(max, Math.max(min, n)) * 1000) / 1000;
  const d = LIMITES_DO_AJUSTE.desvio;
  return {
    fundo: fundo.toUpperCase(),
    zoom: entre(zoom as number, LIMITES_DO_AJUSTE.zoom.min, LIMITES_DO_AJUSTE.zoom.max),
    x: entre(x as number, -d, d),
    y: entre(y as number, -d, d),
  };
}

/** O ajuste guardado na base (JSON); um estragado conta como nenhum. */
export function lerAjusteDoLogotipo(texto: string | null): AjusteDoLogotipo | null {
  if (!texto) return null;
  try {
    return limitarAjuste(JSON.parse(texto));
  } catch {
    return null;
  }
}

/** A caixa da imagem dentro do círculo, em fracções do lado: a mesma conta na app e no backoffice. */
export function caixaDoLogotipo(a: AjusteDoLogotipo | null | undefined) {
  const { fundo, zoom, x, y } = a ?? AJUSTE_DE_ORIGEM;
  return { fundo, lado: zoom, esquerda: (1 - zoom) / 2 + x, topo: (1 - zoom) / 2 + y };
}

/**
 * A borda do logótipo de um parceiro nas apps: um fio claro encostado ao círculo, sem folga (o Renato
 * escolheu entre quatro opções a 16 nov 2026, e depois «mais fino e junto», «como borda do ícone»). Os
 * logótipos escuros (quadrados opacos tirados do Instagram) perdiam-se no preto da app. Fica dentro do
 * mesmo tamanho, para nada mexer; `lado` é o do círculo do logótipo, dentro do fio. A mesma conta na app
 * e nas pré-visualizações do backoffice.
 */
export function anelDoLogotipo(tamanho: number): { traco: number; folga: number; lado: number } {
  const traco = Math.max(1, Math.round(tamanho * 0.04) / 2);
  return { traco, folga: 0, lado: tamanho - 2 * traco };
}

/** O fio da borda: branco translúcido, que se vê no preto e sobre a cor de um destaque. */
export const COR_DO_ANEL = 'rgba(255, 255, 255, 0.42)';

/** Um dedo no círculo, em fracções do lado, a contar do centro. */
export type PontoNoCirculo = { x: number; y: number };

/**
 * O ajuste depois de um gesto, a partir do de quando os dedos assentaram (`antes` e `agora` são os
 * mesmos dedos, pela mesma ordem). Um dedo leva a imagem com ele; dois aproximam ou afastam pela
 * distância entre eles, e o ponto da imagem que estava entre os dedos fica entre os dedos, como nas
 * fotografias do telemóvel (o Renato, 10 nov: com dois dedos a imagem fugia).
 */
export function ajusteDosDedos(
  inicio: AjusteDoLogotipo,
  antes: PontoNoCirculo[],
  agora: PontoNoCirculo[],
): AjusteDoLogotipo | null {
  const [a0, b0] = antes;
  const [a1, b1] = agora;
  if (!a0 || !a1) return limitarAjuste(inicio);
  if (!b0 || !b1)
    return limitarAjuste({ ...inicio, x: inicio.x + a1.x - a0.x, y: inicio.y + a1.y - a0.y });
  const distancia0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const distancia1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const { min, max } = LIMITES_DO_AJUSTE.zoom;
  // Dois dedos quase no mesmo sítio não dão uma escala: só se arrasta.
  const zoom =
    distancia0 > 0.01
      ? Math.min(max, Math.max(min, inicio.zoom * (distancia1 / distancia0)))
      : inicio.zoom;
  const escala = zoom / inicio.zoom;
  const meio0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const meio1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  return limitarAjuste({
    ...inicio,
    zoom,
    x: meio1.x - (meio0.x - inicio.x) * escala,
    y: meio1.y - (meio0.y - inicio.y) * escala,
  });
}

/**
 * Aproximar ou afastar (`factor` > 1 aproxima) à volta de um ponto do círculo (a contar do centro, em
 * fracções do lado): o ponto da imagem que lá estava fica lá, como ao aproximar uma fotografia com a roda
 * ou com a barra do editor grande (o Nuno, 27 nov 2026). Sem ponto, à volta do centro do círculo.
 */
export function ajusteAproximado(
  a: AjusteDoLogotipo,
  factor: number,
  ponto: PontoNoCirculo = { x: 0, y: 0 },
): AjusteDoLogotipo {
  const { min, max } = LIMITES_DO_AJUSTE.zoom;
  const zoom = Math.min(max, Math.max(min, a.zoom * (Number.isFinite(factor) ? factor : 1)));
  const escala = zoom / a.zoom;
  return (
    limitarAjuste({
      ...a,
      zoom,
      x: ponto.x - (ponto.x - a.x) * escala,
      y: ponto.y - (ponto.y - a.y) * escala,
    }) ?? a
  );
}

/**
 * O logótipo inteiro dentro do círculo, ao meio, com uma folga (o «Inteiro» do editor grande). A imagem
 * cabe sem se deformar numa caixa quadrada: com `proporcao` (largura ÷ altura) a caixa é a maior cujos
 * cantos da imagem ficam dentro do círculo.
 */
export function ajusteInteiro(a: AjusteDoLogotipo, proporcao: number): AjusteDoLogotipo {
  const r = proporcao > 0 && Number.isFinite(proporcao) ? proporcao : 1;
  // A imagem na caixa de lado s mede s × s/r (larga) ou s·r × s (alta); os cantos no círculo de lado 1.
  const lado = 1 / Math.sqrt(1 + (r >= 1 ? 1 / (r * r) : r * r));
  return limitarAjuste({ ...a, zoom: lado * 0.94, x: 0, y: 0 }) ?? a;
}

/** A imagem a encher o círculo todo, ao meio (o «Encher»): o lado mais curto da imagem do tamanho do círculo. */
export function ajusteCheio(a: AjusteDoLogotipo, proporcao: number): AjusteDoLogotipo {
  const r = proporcao > 0 && Number.isFinite(proporcao) ? proporcao : 1;
  return limitarAjuste({ ...a, zoom: r >= 1 ? r : 1 / r, x: 0, y: 0 }) ?? a;
}

/** A imagem ao meio quando quase lá (o editor grande puxa-a, e mostra a linha do meio). */
export const FOLGA_DO_MEIO = 0.012;

/** O ajuste com o desvio que está quase no meio posto no meio, e em que eixos isso aconteceu. */
export function ajusteAoMeio(a: AjusteDoLogotipo): {
  ajuste: AjusteDoLogotipo;
  x: boolean;
  y: boolean;
} {
  const x = Math.abs(a.x) < FOLGA_DO_MEIO;
  const y = Math.abs(a.y) < FOLGA_DO_MEIO;
  return { ajuste: { ...a, x: x ? 0 : a.x, y: y ? 0 : a.y }, x, y };
}
