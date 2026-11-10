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
