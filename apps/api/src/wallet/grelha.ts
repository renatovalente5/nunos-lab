import { buffer, deBase64 } from './bytes.ts';
import { GLIFOS, LADO_DO_GLIFO } from './glifos.ts';
import { inflar, png } from './png.ts';
import { mascara, Tela, type Cor, type Mascara } from './tela.ts';

/**
 * A grelha dos carimbos, desenhada na hora para o estado de um cartão
 * (carimbos de objectivo): a faixa do storeCard, a arte do poster do iOS 27
 * e a hero da Google. As mesmas casas da app: a dada é um disco creme com a
 * tesoura, a por dar é um aro fino, a última leva a prenda. As imagens só
 * dependem do estado, não do cliente, por isso ficam na cache do Worker.
 */

/** Muda quando o desenho muda: faz parte da chave da cache e do URL da hero. */
export const VERSAO_DO_DESENHO = 'v1';

export type Grelha = { carimbos: number; objectivo: number };

const FUNDO: Cor = [10, 10, 10]; // cor.fundo
const CREME: Cor = [244, 241, 236]; // cor.claro
const SOBRE_CREME: Cor = [10, 10, 10]; // cor.sobreClaro
const ARO: Cor = [58, 56, 53];
const ARO_DA_ULTIMA: Cor = [90, 86, 80];
const PRENDA: Cor = [138, 133, 125]; // cor.texto3

/** A casa da app mede 44; os traços escalam com ela. */
const CASA = 44;

export type Zona = { x: number; y: number; largura: number; altura: number };

/** Onde vão `n` casas numa zona: em linhas, do maior lado que caiba (até `maximo`), centradas. Nas unidades da zona. */
export function dispor(n: number, zona: Zona, maximo = CASA, folga = 0.3) {
  const linhas = n <= 5 ? 1 : n <= 10 ? 2 : Math.ceil(n / 10);
  const colunas = Math.ceil(n / linhas);
  const lado = Math.min(
    maximo,
    zona.largura / (colunas + (colunas - 1) * folga),
    zona.altura / (linhas + (linhas - 1) * folga),
  );
  const passo = lado * (1 + folga);
  const x0 =
    zona.x + (zona.largura - (colunas * lado + (colunas - 1) * lado * folga)) / 2 + lado / 2;
  const y0 = zona.y + (zona.altura - (linhas * lado + (linhas - 1) * lado * folga)) / 2 + lado / 2;
  const centros: [number, number][] = [];
  for (let i = 0; i < n; i++)
    centros.push([x0 + (i % colunas) * passo, y0 + Math.floor(i / colunas) * passo]);
  return { lado, centros };
}

let glifos: Promise<Record<'tesoura' | 'presente', Mascara>> | null = null;
function osGlifos() {
  return (glifos ??= (async () => ({
    tesoura: mascara(await inflar(deBase64(GLIFOS.tesoura)), LADO_DO_GLIFO),
    presente: mascara(await inflar(deBase64(GLIFOS.presente)), LADO_DO_GLIFO),
  }))());
}

/** As casas, em pixels: `lado` e `centros` já na escala da tela. */
async function casas(tela: Tela, g: Grelha, lado: number, centros: [number, number][]) {
  const { tesoura, presente } = await osGlifos();
  const r = lado / 2;
  const traco = lado / CASA;
  for (let i = 0; i < g.objectivo; i++) {
    const [cx, cy] = centros[i]!;
    const ultima = i === g.objectivo - 1;
    if (i < g.carimbos) {
      tela.disco(cx, cy, r, CREME);
      const l = lado * 0.5;
      tela.glifo(tesoura, cx - l / 2, cy - l / 2, l, SOBRE_CREME);
      continue;
    }
    if (ultima) tela.anel(cx, cy, r + 2 * traco, 4 * traco, CREME, 0.06);
    tela.anel(cx, cy, r - 0.75 * traco, 1.5 * traco, ultima ? ARO_DA_ULTIMA : ARO);
    if (ultima) {
      const l = lado * 0.48;
      tela.glifo(presente, cx - l / 2, cy - l / 2, l, PRENDA);
    }
  }
}

/** Uma imagem de `largura` × `altura` pontos à `escala`, com a grelha na `zona` (em pontos). */
async function imagem(g: Grelha, largura: number, altura: number, escala: number, zona: Zona) {
  const tela = new Tela(Math.round(largura * escala), Math.round(altura * escala), FUNDO);
  const d = dispor(g.objectivo, zona);
  await casas(
    tela,
    g,
    d.lado * escala,
    d.centros.map(([x, y]) => [x * escala, y * escala]),
  );
  return png(tela);
}

/** A faixa do storeCard: 375 × 144 pt. */
export const faixa = (g: Grelha, escala: 2 | 3) =>
  imagem(g, 375, 144, escala, { x: 24, y: 16, largura: 327, altura: 112 });

/**
 * A arte do poster do iOS 27: 358 × 448 pt. A Wallet estica-a ×1,085 e corta
 * ~14 pt de cada lado; o cabeçalho acaba aos ~39 pt e o quadro do código
 * começa aos ~194. As casas vão ao meio do que fica livre, com 30 pt de margem.
 */
export const arte = (g: Grelha, escala: 2 | 3) =>
  imagem(g, 358, 448, escala, { x: 30, y: 47, largura: 298, altura: 139 });

/** A hero da Google: 1032 × 812 px, com 20 dp de folga em cima e em baixo. */
export async function hero(g: Grelha) {
  const tela = new Tela(1032, 812, FUNDO);
  const d = dispor(g.objectivo, { x: 60, y: 60, largura: 912, altura: 692 }, 150);
  await casas(tela, g, d.lado, d.centros);
  return png(tela);
}

function sanear(g: Grelha): Grelha {
  const objectivo = Math.min(50, Math.max(1, Math.round(g.objectivo) || 1));
  return { objectivo, carimbos: Math.min(objectivo, Math.max(0, Math.round(g.carimbos) || 0)) };
}

/** A cache do Worker (não há nenhuma nos testes em Node). */
const cache = () => (typeof caches === 'undefined' ? null : caches.default);

async function comCache(chave: string, desenhar: () => Promise<Uint8Array>): Promise<Uint8Array> {
  const c = cache();
  const pedido = new Request(`https://passe.nunos-lab.local/imagens/${VERSAO_DO_DESENHO}/${chave}`);
  if (c) {
    const guardado = await c.match(pedido);
    if (guardado) return new Uint8Array(await guardado.arrayBuffer());
  }
  const bytes = await desenhar();
  if (c)
    await c
      .put(
        pedido,
        new Response(buffer(bytes), {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=2592000' },
        }),
      )
      .catch(() => undefined);
  return bytes;
}

/** As imagens do passe da Apple que mudam com o cartão: a faixa e a arte, a @2x e @3x. */
export async function imagensDoCartao(estado: Grelha): Promise<Record<string, Uint8Array>> {
  const g = sanear(estado);
  const pedidos: [string, () => Promise<Uint8Array>][] = [
    ['strip@2x.png', () => faixa(g, 2)],
    ['strip@3x.png', () => faixa(g, 3)],
    ['artwork@2x.png', () => arte(g, 2)],
    ['artwork@3x.png', () => arte(g, 3)],
  ];
  const saida: Record<string, Uint8Array> = {};
  for (const [nome, desenhar] of pedidos)
    saida[nome] = await comCache(`${g.objectivo}/${g.carimbos}/${nome}`, desenhar);
  return saida;
}

/** A hero da Google para um estado (servida num URL só dela). */
export async function heroDoCartao(estado: Grelha): Promise<Uint8Array> {
  const g = sanear(estado);
  return comCache(`${g.objectivo}/${g.carimbos}/hero.png`, () => hero(g));
}
