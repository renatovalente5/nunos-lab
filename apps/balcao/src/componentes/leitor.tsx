import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Linking, View } from 'react-native';
import { Botao, T, cor } from '@nunos-lab/ui';
import { useTextos } from '../textos';

/** A câmara no telemóvel: a expo-camera lê o QR sozinha. */
export function Leitor({
  aoLer,
  activo,
  lanterna = false,
  aoAbrir,
}: {
  aoLer: (texto: string) => void;
  activo: boolean;
  /** Só a web fica sem câmara; no telemóvel pede-se a permissão. */
  aoSemCamara?: () => void;
  /** A lanterna acesa (a câmara de trás do telemóvel tem sempre uma). */
  lanterna?: boolean;
  /** A câmara abriu: o ecrã fica a saber se pode mostrar o botão da lanterna. */
  aoAbrir?: (capacidades: { lanterna: boolean }) => void;
}) {
  const t = useTextos();
  const [permissao, pedir] = useCameraPermissions();
  const ultimo = useRef<string>('');
  useEffect(() => {
    if (permissao && !permissao.granted && permissao.canAskAgain) pedir().catch(() => {});
  }, [permissao, pedir]);
  if (!permissao?.granted)
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}
      >
        <T v="legenda" style={{ color: cor.texto2, textAlign: 'center' }}>
          {t.camara.precisa}
        </T>
        {permissao?.canAskAgain && <Botao nome={t.camara.permitir} onPress={() => pedir()} />}
        {permissao && !permissao.canAskAgain && (
          <Botao
            nome={t.camara.abrirDefinicoes}
            onPress={() => Linking.openSettings().catch(() => {})}
          />
        )}
      </View>
    );
  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      enableTorch={lanterna}
      onCameraReady={() => aoAbrir?.({ lanterna: true })}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={(r) => {
        if (!activo || r.data === ultimo.current) return;
        ultimo.current = r.data;
        aoLer(r.data);
      }}
    />
  );
}
