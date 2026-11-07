import { router } from 'expo-router';
import { View } from 'react-native';
import { Botao, Ecra, Icone, T, cor } from '@nunos-lab/ui';
import { useTextos } from '../textos';

export default function NaoEncontrado() {
  const t = useTextos();
  return (
    <Ecra comBarra={false}>
      <View style={{ alignItems: 'center', paddingTop: 120, paddingHorizontal: 32, gap: 16 }}>
        <Icone nome="etiqueta" tamanho={34} cor={cor.texto3} />
        <T v="subtitulo" style={{ textAlign: 'center' }}>
          {t.naoEncontrado.texto}
        </T>
        <Botao nome={t.naoEncontrado.verAsVantagens} onPress={() => router.replace('/')} />
      </View>
    </Ecra>
  );
}
