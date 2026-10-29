import { codigoLido } from '@nunos-lab/dominio';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Leitor } from '../componentes/leitor';
import { useEu } from '../sessao';
import { Botao, Campo, Icone, LARGURA_MAXIMA, MARGEM, T, cor } from '@nunos-lab/ui';

/** A câmara a ecrã inteiro; por baixo, o código escrito à mão. */
export default function Ler() {
  const margens = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [activo, setActivo] = useState(true);
  const [semCamara, setSemCamara] = useState(false);
  const { data: eu } = useEu();
  const abrir = (lido: string) => {
    const codigo = codigoLido(lido);
    if (!codigo) {
      setErro('Isso não é um cartão do Nuno’s Lab.');
      return;
    }
    setActivo(false);
    router.replace(eu?.pessoa.papel === 'parceiro' ? `/vale/${codigo}` : `/ficha/${codigo}`);
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Leitor activo={activo} aoLer={abrir} aoSemCamara={() => setSemCamara(true)} />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: '22%', alignItems: 'center' }}
      >
        <View style={{ width: 230, height: 230 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                width: 34,
                height: 34,
                borderColor: 'rgba(244,241,236,0.8)',
                borderTopWidth: i < 2 ? 3 : 0,
                borderBottomWidth: i >= 2 ? 3 : 0,
                borderLeftWidth: i % 2 === 0 ? 3 : 0,
                borderRightWidth: i % 2 === 1 ? 3 : 0,
                top: i < 2 ? 0 : undefined,
                bottom: i >= 2 ? 0 : undefined,
                left: i % 2 === 0 ? 0 : undefined,
                right: i % 2 === 1 ? 0 : undefined,
                borderTopLeftRadius: i === 0 ? 14 : 0,
                borderTopRightRadius: i === 1 ? 14 : 0,
                borderBottomLeftRadius: i === 2 ? 14 : 0,
                borderBottomRightRadius: i === 3 ? 14 : 0,
              }}
            />
          ))}
        </View>
      </View>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        role="button"
        aria-label="Fechar"
        style={({ pressed }) => ({
          position: 'absolute',
          top: margens.top + 12,
          left: MARGEM,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: pressed ? 'rgba(10,10,10,0.7)' : 'rgba(10,10,10,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Icone nome="fechar" tamanho={20} espessura={2.4} />
      </Pressable>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: LARGURA_MAXIMA,
          marginHorizontal: 'auto',
          paddingHorizontal: MARGEM,
          paddingTop: 18,
          paddingBottom: margens.bottom + 18,
          backgroundColor: cor.fundo,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          gap: 12,
        }}
      >
        <T v="legenda" style={{ color: cor.texto2 }}>
          {semCamara ? 'Escreve o código' : 'Ou escreve o código'}
        </T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Campo
              value={texto}
              onChangeText={(v) => {
                setTexto(v.toUpperCase());
                setErro(null);
              }}
              placeholder="7K3Q 9M2X"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              onSubmitEditing={() => abrir(texto)}
              style={{ letterSpacing: 2, fontSize: 18 }}
              erro={erro}
            />
          </View>
          <Botao nome="Abrir" onPress={() => abrir(texto)} />
        </View>
      </View>
    </View>
  );
}
