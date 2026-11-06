import jsQR from 'jsqr';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';
import { T, cor } from '@nunos-lab/ui';

/**
 * A câmara na web: um <video> com a câmara de trás, e o jsQR a ler uns dez
 * fotogramas por segundo numa tela escondida. O Safari não tem BarcodeDetector,
 * por isso é assim em todos os telemóveis.
 */
export function Leitor({
  aoLer,
  activo,
  aoSemCamara,
  lanterna = false,
  aoAbrir,
}: {
  aoLer: (texto: string) => void;
  activo: boolean;
  /** Chamado quando não há câmara: o ecrã pede o código escrito sem o «Ou». */
  aoSemCamara?: () => void;
  /** A lanterna acesa (só quando a câmara diz que a tem). */
  lanterna?: boolean;
  /** A câmara abriu: o ecrã fica a saber se pode mostrar o botão da lanterna. */
  aoAbrir?: (capacidades: { lanterna: boolean }) => void;
}) {
  const caixa = useRef<ComponentRef<typeof View>>(null);
  const [estado, setEstado] = useState<'a-abrir' | 'aberta' | 'sem-camara'>('a-abrir');
  const ultimo = useRef(aoLer);
  ultimo.current = aoLer;
  const avisarSemCamara = useRef(aoSemCamara);
  avisarSemCamara.current = aoSemCamara;
  const avisarAbriu = useRef(aoAbrir);
  avisarAbriu.current = aoAbrir;
  // A faixa de vídeo com lanterna (null: a câmara não a tem), para a acender e apagar.
  const faixaComLanterna = useRef<MediaStreamTrack | null>(null);
  useEffect(() => {
    if (estado === 'sem-camara') avisarSemCamara.current?.();
  }, [estado]);
  useEffect(() => {
    // A restrição «torch» não está nos tipos do DOM, mas o Chrome do Android aceita-a.
    faixaComLanterna.current
      ?.applyConstraints({ advanced: [{ torch: lanterna } as MediaTrackConstraintSet] })
      .catch(() => {});
  }, [lanterna]);
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
        const faixa = f.getVideoTracks()[0] ?? null;
        const capacidades = faixa?.getCapabilities?.() as { torch?: boolean } | undefined;
        faixaComLanterna.current = capacidades?.torch ? faixa : null;
        return video.play().then(() => {
          setEstado('aberta');
          avisarAbriu.current?.({ lanterna: !!faixaComLanterna.current });
          ler();
        });
      })
      .catch(() => vivo && setEstado('sem-camara'));
    return () => {
      vivo = false;
      clearTimeout(temporizador);
      faixaComLanterna.current = null;
      fluxo?.getTracks().forEach((t) => t.stop());
      video.remove();
    };
  }, [activo]);
  return (
    <View ref={caixa} style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}>
      {estado !== 'aberta' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <T v="legenda" style={{ color: cor.texto2 }}>
            {estado === 'a-abrir' ? 'A abrir a câmara…' : 'Sem acesso à câmara.'}
          </T>
        </View>
      )}
    </View>
  );
}
