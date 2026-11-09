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

export async function carregarImagem(ficheiro: File, modo: 'logotipo' | 'capa'): Promise<string> {
  // Um HEIC num PC, por exemplo: o browser não o abre, e a culpa não é do servidor.
  const imagem = await abrir(ficheiro).catch(() => {
    throw new ErroDaApi('imagem_por_abrir');
  });
  const lado = modo === 'logotipo' ? 512 : 1600;
  const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height));
  const largura = Math.max(1, Math.round(imagem.width * escala));
  const altura = Math.max(1, Math.round(imagem.height * escala));
  const tela = document.createElement('canvas');
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Sem canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagem, 0, 0, largura, altura);
  let blob: Blob | null = null;
  if (modo === 'logotipo') blob = await paraBlob(tela, 'image/png', 1);
  else {
    for (const q of [0.84, 0.72, 0.6]) {
      blob = await paraBlob(tela, 'image/webp', q);
      if (!blob || blob.type !== 'image/webp') blob = await paraBlob(tela, 'image/jpeg', q);
      if (blob && blob.size <= BYTES_DA_IMAGEM) break;
    }
  }
  if (!blob) throw new Error('Não consegui preparar a imagem');
  const { id } = await pedir<{ id: string }>(`/api/bo/imagens?l=${largura}&a=${altura}`, {
    metodo: 'POST',
    binario: blob,
  });
  return id;
}

/**
 * A cor do fundo de um logótipo: a das orlas da imagem, se forem opacas e de uma cor só (um
 * logótipo quadrado de fundo verde, por exemplo). Transparentes ou de várias cores: null.
 */
export function corDasOrlas(imagem: ImageBitmap | HTMLImageElement): string | null {
  const lado = 40;
  const tela = document.createElement('canvas');
  tela.width = lado;
  tela.height = lado;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(imagem, 0, 0, lado, lado);
  const { data } = ctx.getImageData(0, 0, lado, lado);
  const orla: number[][] = [];
  for (let i = 0; i < lado; i++)
    for (const [x, y] of [
      [i, 0],
      [i, lado - 1],
      [0, i],
      [lado - 1, i],
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

/**
 * Como pôr um logótipo novo no círculo: com fundo de uma cor só, essa cor no círculo e a imagem
 * a 90 % (o que estiver dentro do círculo da imagem vê-se todo); transparente, o de sempre.
 */
export async function sugerirAjuste(ficheiro: File): Promise<AjusteDoLogotipo> {
  const cor = corDasOrlas(await abrir(ficheiro));
  return cor ? { fundo: cor, zoom: 0.9, x: 0, y: 0 } : AJUSTE_DE_ORIGEM;
}

/** A cor das orlas de um logótipo já guardado (a API deixa o backoffice lê-lo: CORS). */
export async function corDoLogotipo(id: string): Promise<string | null> {
  const r = await fetch(`${API}/api/imagens/${id}`);
  if (!r.ok) return null;
  return corDasOrlas(await createImageBitmap(await r.blob()));
}
