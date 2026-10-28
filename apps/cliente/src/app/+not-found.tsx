import { router } from 'expo-router';
import { View } from 'react-native';
import { Botao, Ecra, Icone, T, cor } from '@nunos-lab/ui';

export default function NaoEncontrado() {
  return (
    <Ecra comBarra={false}>
      <View style={{ alignItems: 'center', paddingTop: 120, paddingHorizontal: 32, gap: 16 }}>
        <Icone nome="etiqueta" tamanho={34} cor={cor.texto3} />
        <T v="subtitulo" style={{ textAlign: 'center' }}>
          Esta página não existe
        </T>
        <Botao nome="Ver as vantagens" onPress={() => router.replace('/')} />
      </View>
    </Ecra>
  );
}
