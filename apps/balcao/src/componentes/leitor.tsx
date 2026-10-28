import { View } from 'react-native';
import { T, cor } from '@nunos-lab/ui';

/** Na app nativa a câmara chega com a expo-camera; até lá, o código escreve-se. */
export function Leitor(_: { aoLer: (texto: string) => void; activo: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <T v="legenda" style={{ color: cor.texto2 }}>
        A câmara chega na app nativa.
      </T>
    </View>
  );
}
