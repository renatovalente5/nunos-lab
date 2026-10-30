import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Linking, View } from 'react-native';
import { Botao, T, cor } from '@nunos-lab/ui';

/** A câmara no telemóvel: a expo-camera lê o QR sozinha. */
export function Leitor({
  aoLer,
  activo,
}: {
  aoLer: (texto: string) => void;
  activo: boolean;
  /** Só a web fica sem câmara; no telemóvel pede-se a permissão. */
  aoSemCamara?: () => void;
}) {
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
          A app precisa da câmara para ler o cartão.
        </T>
        {permissao?.canAskAgain && <Botao nome="Permitir a câmara" onPress={() => pedir()} />}
        {permissao && !permissao.canAskAgain && (
          <Botao
            nome="Abrir as definições"
            onPress={() => Linking.openSettings().catch(() => {})}
          />
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
