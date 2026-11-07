/**
 * O mapa das casas: a imagem vem dos Mapas da Apple (Web Snapshots), pedida
 * pelo servidor, e os pinos tocam-se na app. O enquadramento (centro e zoom)
 * calcula-se AQUI, com a mesma função nos dois lados: o servidor pede a imagem
 * com ele, e a app põe os toques exactamente sobre os pinos. Projecção Web
 * Mercator, a dos Mapas da Apple: a 256 px por volta ao mundo no zoom 0.
 */

export type PontoNoMapa = { lat: number; lng: number };
export type Enquadramento = { lat: number; lng: number; z: number };

export type Folgas = { cima: number; baixo: number; lados: number };
/** As folgas, em pontos: mais por cima, porque o balão do pino desenha-se acima do ponto. */
export const FOLGAS_DO_MAPA: Folgas = { cima: 64, baixo: 40, lados: 44 };
/**
 * Nos mapas vivos o logótipo e o «Legal» da Apple ficam no canto de baixo e não se podem
 * tapar: o nome do pino mais a sul tem de ficar acima deles. Por cima cabe o balão da casa
 * mais a norte: com 64, o mapa descia para o abrir e o nome de Aveiro tapava o «Legal».
 */
export const FOLGAS_DO_MAPA_VIVO: Folgas = { cima: 100, baixo: 64, lados: 44 };
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
  folgas: Folgas = FOLGAS_DO_MAPA,
): Enquadramento | null {
  if (pontos.length === 0) return null;
  const lngs = pontos.map((p) => p.lng);
  const ys = pontos.map((p) => mercator(p.lat));
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const larguraUtil = largura - 2 * folgas.lados;
  const alturaUtil = altura - folgas.cima - folgas.baixo;
  const zLng =
    lngMax > lngMin ? Math.log2((larguraUtil * 360) / (256 * (lngMax - lngMin))) : Infinity;
  const zLat =
    yMax > yMin ? Math.log2((alturaUtil * 2 * Math.PI) / (256 * (yMax - yMin))) : Infinity;
  // Com duas casas decimais: é assim que vai no pedido, e a app tem de calcular o mesmo.
  const z = Math.round(Math.max(ZOOM_MINIMO, Math.min(ZOOM_MAXIMO, zLng, zLat)) * 100) / 100;
  // O meio da caixa dos pontos, deslocado para norte: a caixa fica entre a folga de cima e a de baixo.
  const yCentro = (yMax + yMin) / 2 + (folgas.cima - folgas.baixo) / 2 / pixeisPorMercator(z);
  return {
    lat: Math.round(deMercator(yCentro) * 1e6) / 1e6,
    lng: Math.round(((lngMax + lngMin) / 2) * 1e6) / 1e6,
    z,
  };
}

/**
 * O mesmo enquadramento como região, em graus (o centro e o que cabe de alto a baixo e de lado a
 * lado): os mapas vivos, o do iPhone e o do site, abrem com ela, como a imagem.
 */
export function regiaoDoEnquadramento(
  e: Enquadramento,
  largura: number,
  altura: number,
): { lat: number; lng: number; latDelta: number; lngDelta: number } {
  const meiaAltura = altura / 2 / pixeisPorMercator(e.z);
  const y = mercator(e.lat);
  return {
    lat: e.lat,
    lng: e.lng,
    latDelta: deMercator(y + meiaAltura) - deMercator(y - meiaAltura),
    lngDelta: largura / pixeisPorGrau(e.z),
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

/**
 * Uma impressão das coordenadas das casas (na ordem em que a API as dá): muda quando uma casa
 * muda de sítio ou entra uma nova, e com ela a morada e a chave de cache da imagem do mapa.
 * Sem ela, a imagem antiga ficava até 30 h em cache e os pinos, desenhados com as coordenadas
 * novas, caíam no sítio errado (achado da revisão de 7 nov).
 */
export function versaoDasCasas(lojas: { lat: number | null; lng: number | null }[]): string {
  let h = 5381;
  for (const l of lojas) {
    if (l.lat === null || l.lng === null) continue;
    for (const letra of `${l.lat.toFixed(5)},${l.lng.toFixed(5)};`)
      h = (Math.imul(h, 33) ^ letra.charCodeAt(0)) >>> 0;
  }
  return h.toString(36);
}
