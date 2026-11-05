/**
 * O mapa das casas: a imagem vem dos Mapas da Apple (Web Snapshots), pedida
 * pelo servidor, e os pinos tocam-se na app. O enquadramento (centro e zoom)
 * calcula-se AQUI, com a mesma função nos dois lados: o servidor pede a imagem
 * com ele, e a app põe os toques exactamente sobre os pinos. Projecção Web
 * Mercator, a dos Mapas da Apple: a 256 px por volta ao mundo no zoom 0.
 */

export type PontoNoMapa = { lat: number; lng: number };
export type Enquadramento = { lat: number; lng: number; z: number };

/** As folgas, em pontos: mais por cima, porque o balão do pino desenha-se acima do ponto. */
export const FOLGAS_DO_MAPA = { cima: 64, baixo: 40, lados: 44 } as const;
/** Uma casa só (ou todas no mesmo sítio): à escala da vila, não da rua. */
const ZOOM_MAXIMO = 13;
const ZOOM_MINIMO = 3;

const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const deMercator = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
/** Pixéis por unidade de Mercator (2π por volta ao mundo) e por grau de longitude, neste zoom. */
const pixeisPorMercator = (z: number) => (256 * 2 ** z) / (2 * Math.PI);
const pixeisPorGrau = (z: number) => (256 * 2 ** z) / 360;

/** O centro e o zoom que metem os pontos todos numa imagem de largura × altura, entre as folgas. */
export function enquadrar(
  pontos: readonly PontoNoMapa[],
  largura: number,
  altura: number,
): Enquadramento | null {
  if (pontos.length === 0) return null;
  const lngs = pontos.map((p) => p.lng);
  const ys = pontos.map((p) => mercator(p.lat));
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const larguraUtil = largura - 2 * FOLGAS_DO_MAPA.lados;
  const alturaUtil = altura - FOLGAS_DO_MAPA.cima - FOLGAS_DO_MAPA.baixo;
  const zLng =
    lngMax > lngMin ? Math.log2((larguraUtil * 360) / (256 * (lngMax - lngMin))) : Infinity;
  const zLat =
    yMax > yMin ? Math.log2((alturaUtil * 2 * Math.PI) / (256 * (yMax - yMin))) : Infinity;
  // Com duas casas decimais: é assim que vai no pedido, e a app tem de calcular o mesmo.
  const z = Math.round(Math.max(ZOOM_MINIMO, Math.min(ZOOM_MAXIMO, zLng, zLat)) * 100) / 100;
  // O meio da caixa dos pontos, deslocado para norte: a caixa fica entre a folga de cima e a de baixo.
  const yCentro =
    (yMax + yMin) / 2 + (FOLGAS_DO_MAPA.cima - FOLGAS_DO_MAPA.baixo) / 2 / pixeisPorMercator(z);
  return {
    lat: Math.round(deMercator(yCentro) * 1e6) / 1e6,
    lng: Math.round(((lngMax + lngMin) / 2) * 1e6) / 1e6,
    z,
  };
}

/** Onde cai um ponto na imagem (em pontos, a partir do canto superior esquerdo). */
export function projectar(
  ponto: PontoNoMapa,
  e: Enquadramento,
  largura: number,
  altura: number,
): { x: number; y: number } {
  return {
    x: largura / 2 + (ponto.lng - e.lng) * pixeisPorGrau(e.z),
    y: altura / 2 - (mercator(ponto.lat) - mercator(e.lat)) * pixeisPorMercator(e.z),
  };
}
