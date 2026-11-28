/**
 * A câmara para o QR do balcão na app da web (27 nov 2026): um <video> com a câmara de trás e o jsQR a
 * ler uns dez fotogramas por segundo, como na for partners (o Safari não tem BarcodeDetector).
 */
import jsQR from 'jsqr';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';
import { T, cor } from '@nunos-lab/ui';
import { useTextos } from '../textos';

/** Como está a câmara: o ecrã do QR diz em baixo o que fazer (sem câmara, não «Aponta ao QR»). */
export type EstadoDaCamara = 'a-abrir' | 'aberta' | 'sem-camara';

export function LeitorDoBalcao({
  aoLer,
  activo,
  aoMudar,
}: {
  aoLer: (texto: string) => void;
  activo: boolean;
  aoMudar?: (estado: EstadoDaCamara) => void;
}) {
  const t = useTextos();
  const caixa = useRef<ComponentRef<typeof View>>(null);
  const [estado, setEstado] = useState<EstadoDaCamara>('a-abrir');
  const avisar = useRef(aoMudar);
  avisar.current = aoMudar;
  useEffect(() => avisar.current?.(estado), [estado]);
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
          f.getTracks().forEach((faixa) => faixa.stop());
          return;
        }
        fluxo = f;
        // A câmara perdida a meio (outra app, o sistema) diz-se, com o «Tentar outra vez», em vez de o
        // ecrã ficar parado a pedir para apontar ao QR.
        const perdida = () => {
          if (!vivo) return;
          clearTimeout(temporizador);
          video.style.visibility = 'hidden';
          setEstado('sem-camara');
        };
        for (const faixa of f.getVideoTracks()) {
          if (faixa.readyState === 'ended') throw new Error('camara_perdida');
          faixa.addEventListener('ended', perdida);
        }
        video.srcObject = f;
        return video.play().then(() => {
          setEstado('aberta');
          ler();
        });
      })
      .catch(() => {
        fluxo?.getTracks().forEach((faixa) => faixa.stop());
        if (vivo) setEstado('sem-camara');
      });
    return () => {
      vivo = false;
      clearTimeout(temporizador);
      fluxo?.getTracks().forEach((faixa) => faixa.stop());
      video.remove();
    };
  }, [activo]);
  return (
    <View ref={caixa} style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}>
      {estado !== 'aberta' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <T v="legenda" style={{ color: cor.texto2, textAlign: 'center' }}>
            {estado === 'a-abrir' ? t.qr.aAbrir : t.qr.semCamara}
          </T>
        </View>
      )}
    </View>
  );
}
