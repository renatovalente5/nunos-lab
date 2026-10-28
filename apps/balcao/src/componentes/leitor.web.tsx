import jsQR from 'jsqr';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';
import { T, cor } from '@nunos-lab/ui';

/**
 * A câmara na web: um <video> com a câmara de trás, e o jsQR a ler uns dez
 * fotogramas por segundo numa tela escondida. O Safari não tem BarcodeDetector,
 * por isso é assim em todos os telemóveis.
 */
export function Leitor({ aoLer, activo }: { aoLer: (texto: string) => void; activo: boolean }) {
  const caixa = useRef<ComponentRef<typeof View>>(null);
  const [estado, setEstado] = useState<'a-abrir' | 'aberta' | 'sem-camara'>('a-abrir');
  const ultimo = useRef(aoLer);
  ultimo.current = aoLer;
  useEffect(() => {
    if (!activo) return;
    const onde = caixa.current as unknown as HTMLElement | null;
    if (!onde || !navigator.mediaDevices?.getUserMedia) {
      setEstado('sem-camara');
      return;
    }
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.muted = true;
    Object.assign(video.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      position: 'absolute',
      inset: '0',
    });
    onde.appendChild(video);
    const tela = document.createElement('canvas');
    const ctx = tela.getContext('2d', { willReadFrequently: true });
    let fluxo: MediaStream | null = null;
    let vivo = true;
    let temporizador = 0;
    let lido = '';
    const ler = () => {
      if (!vivo) return;
      if (video.readyState >= 2 && ctx) {
        const escala = Math.min(1, 640 / Math.max(video.videoWidth, 1));
        tela.width = Math.round(video.videoWidth * escala);
        tela.height = Math.round(video.videoHeight * escala);
        ctx.drawImage(video, 0, 0, tela.width, tela.height);
        const imagem = ctx.getImageData(0, 0, tela.width, tela.height);
        const codigo = jsQR(imagem.data, imagem.width, imagem.height, {
          inversionAttempts: 'dontInvert',
        });
        if (codigo?.data && codigo.data !== lido) {
          lido = codigo.data;
          ultimo.current(codigo.data);
        }
      }
      temporizador = window.setTimeout(ler, 100);
    };
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((f) => {
        if (!vivo) {
          f.getTracks().forEach((t) => t.stop());
          return;
        }
        fluxo = f;
        video.srcObject = f;
        return video.play().then(() => {
          setEstado('aberta');
          ler();
        });
      })
      .catch(() => vivo && setEstado('sem-camara'));
    return () => {
      vivo = false;
      clearTimeout(temporizador);
      fluxo?.getTracks().forEach((t) => t.stop());
      video.remove();
    };
  }, [activo]);
  return (
    <View ref={caixa} style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}>
      {estado !== 'aberta' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <T v="legenda" style={{ color: cor.texto2 }}>
            {estado === 'a-abrir' ? 'A abrir a câmara…' : 'Sem câmara. Escreve o código.'}
          </T>
        </View>
      )}
    </View>
  );
}
