/**
 * A câmara para o QR do balcão (27 nov 2026). A expo-camera chegou na 1.0.6: as apps de antes recebem
 * este código por OTA sem o módulo nativo, e importá-lo lá rebentava logo ao abrir. Por isso a app
 * confere se o tem (tem-camara.ts) e só o carrega dentro do leitor.
 */
import { useEffect, useRef } from 'react';
import { Linking, View } from 'react-native';
import { Botao, T, cor } from '@nunos-lab/ui';
import { useTextos } from '../textos';

export function LeitorDoBalcao({
  aoLer,
  activo,
}: {
  aoLer: (texto: string) => void;
  activo: boolean;
}) {
  const t = useTextos();
  const { CameraView, useCameraPermissions } =
    require('expo-camera') as typeof import('expo-camera');
  const [permissao, pedir] = useCameraPermissions();
  const ultimo = useRef('');
  useEffect(() => {
    if (permissao && !permissao.granted && permissao.canAskAgain) pedir().catch(() => {});
  }, [permissao, pedir]);
  if (!permissao?.granted)
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}
      >
        <T v="legenda" style={{ color: cor.texto2, textAlign: 'center' }}>
          {t.qr.precisaDaCamara}
        </T>
        {permissao?.canAskAgain && <Botao nome={t.qr.permitir} onPress={() => pedir()} />}
        {permissao && !permissao.canAskAgain && (
          <Botao nome={t.qr.definicoes} onPress={() => Linking.openSettings().catch(() => {})} />
        )}
      </View>
    );
  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={(r) => {
        if (!activo || r.data === ultimo.current) return;
        ultimo.current = r.data;
        aoLer(r.data);
      }}
    />
  );
}
