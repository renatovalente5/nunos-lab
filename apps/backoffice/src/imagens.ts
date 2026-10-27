import { BYTES_DA_IMAGEM } from '@nunos-lab/dominio';
import { ErroDaApi, pedir } from './api';

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
