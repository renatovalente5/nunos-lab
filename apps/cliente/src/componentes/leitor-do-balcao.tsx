/**
 * A câmara para o QR do balcão (27 nov 2026). A expo-camera chegou na 1.0.6: as apps de antes recebem
 * este código por OTA sem o módulo nativo, e importá-lo lá rebentava logo ao abrir. Por isso a app
 * confere se o tem (tem-camara.ts) e só o carrega dentro do leitor.
 */
import { PermissionStatus } from 'expo';
import { useEffect, useRef } from 'react';
import { AppState, Linking, View } from 'react-native';
import { Botao, T, cor } from '@nunos-lab/ui';
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
  const { CameraView, useCameraPermissions } =
    require('expo-camera') as typeof import('expo-camera');
  const [permissao, pedir, ler] = useCameraPermissions();
  const ultimo = useRef('');
  const pediu = useRef(false);
  const estado: EstadoDaCamara =
    !permissao || permissao.status === PermissionStatus.UNDETERMINED
      ? 'a-abrir'
      : permissao.granted
        ? 'aberta'
        : 'sem-camara';
  const avisar = useRef(aoMudar);
  avisar.current = aoMudar;
  useEffect(() => avisar.current?.(estado), [estado]);
  // Pede sozinho só da primeira vez: no Android, depois de um «Não permitir», ainda diz que se pode pedir,
  // e a janela aparecia logo outra vez (revisão de 27 nov 2026). Depois disso, pede o botão «Permitir».
  useEffect(() => {
    if (permissao?.status === PermissionStatus.UNDETERMINED && !pediu.current) {
      pediu.current = true;
      pedir().catch(() => {});
    }
  }, [permissao, pedir]);
  // De volta das Definições, a autorização pode ter mudado lá: lê-se outra vez.
  useEffect(() => {
    const ouvinte = AppState.addEventListener('change', (e) => {
      if (e === 'active') ler().catch(() => {});
    });
    return () => ouvinte.remove();
  }, [ler]);
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
