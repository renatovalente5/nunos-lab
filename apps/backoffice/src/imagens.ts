import { AJUSTE_DE_ORIGEM, BYTES_DA_IMAGEM, type AjusteDoLogotipo } from '@nunos-lab/dominio';
import { API, ErroDaApi, pedir } from './api';

/**
 * Reduz a imagem no próprio browser antes de a mandar: a fotografia de um
 * telemóvel (4 a 8 MB) chega ao servidor com 100 a 300 KB. O logótipo fica em
 * PNG (mantém o fundo transparente); a capa em WebP, ou JPEG se o browser
 * não souber escrever WebP.
 */
async function abrir(ficheiro: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(ficheiro);
  } catch {
    const url = URL.createObjectURL(ficheiro);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function paraBlob(tela: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => tela.toBlob(resolve, tipo, qualidade));
}

/** A imagem reduzida ao lado maior, numa tela. */
async function prepararTela(ficheiro: File, lado: number): Promise<HTMLCanvasElement> {
  // Um HEIC num PC, por exemplo: o browser não o abre, e a culpa não é do servidor.
  const imagem = await abrir(ficheiro).catch(() => {
    throw new ErroDaApi('imagem_por_abrir');
  });
  const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height));
  const tela = document.createElement('canvas');
  tela.width = Math.max(1, Math.round(imagem.width * escala));
  tela.height = Math.max(1, Math.round(imagem.height * escala));
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Sem canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagem, 0, 0, tela.width, tela.height);
  return tela;
}

async function mandar(tela: HTMLCanvasElement, blob: Blob | null): Promise<string> {
  if (!blob) throw new Error('Não consegui preparar a imagem');
  const { id } = await pedir<{ id: string }>(`/api/bo/imagens?l=${tela.width}&a=${tela.height}`, {
    metodo: 'POST',
    binario: blob,
  });
  return id;
}

/**
 * Tira as orlas que um ficheiro traga de um recorte (riscos pretos, uma linha clara): linhas
 * opacas e lisas, até 3 % de cada lado, que destoam das que vêm logo a seguir. Com o fundo do
 * círculo da cor do logótipo, viam-se: o da Ourivesaria Bastos tinha 4 píxeis pretos de cada lado
 * (o Renato, 9 nov). Uma linha com desenho (não lisa) fica, e o transparente também.
 */
function aparar(tela: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  if (!ctx) return tela;
  const { width: l, height: a } = tela;
  const { data } = ctx.getImageData(0, 0, l, a);
  // A cor média de uma coluna (vertical) ou linha, a opacidade e o quanto se afasta da média.
  const linha = (vertical: boolean, i: number) => {
    const n = vertical ? a : l;
    const px = (j: number) => ((vertical ? j : i) * l + (vertical ? i : j)) * 4;
    const media = [0, 0, 0, 0];
    for (let j = 0; j < n; j++) for (let c = 0; c < 4; c++) media[c]! += data[px(j) + c]! / n;
    let desvio = 0;
    for (let j = 0; j < n; j++)
      desvio +=
        Math.hypot(
          data[px(j)]! - media[0]!,
          data[px(j) + 1]! - media[1]!,
          data[px(j) + 2]! - media[2]!,
        ) / n;
    return { media, desvio };
  };
  const aTirar = (vertical: boolean, doFim: boolean) => {
    const n = vertical ? l : a;
    const max = Math.floor(n * 0.03);
    const em = (k: number) => (doFim ? n - 1 - k : k);
    const dentro = linha(vertical, em(max + 1)).media;
    let k = 0;
    for (; k < max; k++) {
      const { media, desvio } = linha(vertical, em(k));
      const diferente =
        Math.hypot(media[0]! - dentro[0]!, media[1]! - dentro[1]!, media[2]! - dentro[2]!) > 24;
      if (media[3]! < 200 || desvio > 24 || !diferente) break;
    }
    return k;
  };
  const [esq, dir, cima, baixo] = [
    aTirar(true, false),
    aTirar(true, true),
    aTirar(false, false),
    aTirar(false, true),
  ];
  if (!esq && !dir && !cima && !baixo) return tela;
  const nova = document.createElement('canvas');
  nova.width = l - esq - dir;
  nova.height = a - cima - baixo;
  nova
    .getContext('2d')
    ?.drawImage(tela, esq, cima, nova.width, nova.height, 0, 0, nova.width, nova.height);
  return nova;
}

/** A capa, em WebP (ou JPEG se o browser não souber escrever WebP), até caber no limite. */
export async function carregarImagem(ficheiro: File): Promise<string> {
  const tela = await prepararTela(ficheiro, 1600);
  let blob: Blob | null = null;
  for (const q of [0.84, 0.72, 0.6]) {
    blob = await paraBlob(tela, 'image/webp', q);
    if (!blob || blob.type !== 'image/webp') blob = await paraBlob(tela, 'image/jpeg', q);
    if (blob && blob.size <= BYTES_DA_IMAGEM) break;
  }
  return mandar(tela, blob);
}

/**
 * O logótipo, em PNG (mantém o fundo transparente) e aparado, com o ajuste para o círculo: com
 * fundo de uma cor só, essa cor no círculo e a imagem a 90 % (o que estiver dentro do círculo da
 * imagem vê-se todo); transparente ou de várias cores, o de sempre.
 */
export async function carregarLogotipo(
  ficheiro: File,
): Promise<{ id: string; ajuste: AjusteDoLogotipo }> {
  const tela = aparar(await prepararTela(ficheiro, 512));
  const cor = corDasOrlas(tela);
  const id = await mandar(tela, await paraBlob(tela, 'image/png', 1));
  return { id, ajuste: cor ? { fundo: cor, zoom: 0.9, x: 0, y: 0 } : AJUSTE_DE_ORIGEM };
}

/**
 * A cor do fundo de um logótipo: a das orlas da imagem, se forem opacas e de uma cor só (um
 * logótipo quadrado de fundo verde, por exemplo). Lê-se um pouco para dentro, para saltar um risco
 * fino de um recorte (os logótipos carregados antes de 9 nov não vinham aparados). Transparentes
 * ou de várias cores: null.
 */
export function corDasOrlas(
  imagem: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
): string | null {
  const lado = 40;
  const tela = document.createElement('canvas');
  tela.width = lado;
  tela.height = lado;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(imagem, 0, 0, lado, lado);
  const { data } = ctx.getImageData(0, 0, lado, lado);
  const orla: number[][] = [];
  const dentro = 2;
  for (let i = dentro; i < lado - dentro; i++)
    for (const [x, y] of [
      [i, dentro],
      [i, lado - 1 - dentro],
      [dentro, i],
      [lado - 1 - dentro, i],
    ] as const) {
      const k = (y * lado + x) * 4;
      if (data[k + 3]! < 230) return null;
      orla.push([data[k]!, data[k + 1]!, data[k + 2]!]);
    }
  const media = [0, 1, 2].map((c) => orla.reduce((s, p) => s + p[c]!, 0) / orla.length);
  const longe = orla.filter(
    (p) => Math.hypot(p[0]! - media[0]!, p[1]! - media[1]!, p[2]! - media[2]!) > 40,
  ).length;
  if (longe > orla.length * 0.15) return null;
  return `#${media.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** A cor das orlas de um logótipo já guardado (a API deixa o backoffice lê-lo: CORS). */
export async function corDoLogotipo(id: string): Promise<string | null> {
  const r = await fetch(`${API}/api/imagens/${id}`);
  if (!r.ok) return null;
  return corDasOrlas(await createImageBitmap(await r.blob()));
}
