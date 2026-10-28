import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Campo } from './campo';
import { Folha } from './folha';
import { Botao } from './pecas';
import { MARGEM, cor } from './tema';
import { T } from './texto';

/**
 * A porta da revisão das lojas: uma ligação discreta no ecrã de entrar, que
 * abre uma folha com o campo do código de demonstração. Só nas apps nativas
 * (é para quem avalia a app na Apple e na Google), nunca na web.
 */
export function EntradaDeDemonstracao({
  aoEnviar,
}: {
  aoEnviar: (codigo: string) => Promise<void>;
}) {
  const [aberta, setAberta] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  if (Platform.OS === 'web') return null;
  const enviar = async () => {
    if (!codigo.trim() || aEnviar) return;
    setErro(null);
    setAEnviar(true);
    try {
      await aoEnviar(codigo.trim());
      setAberta(false);
      setCodigo('');
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : 'Não deu. Tenta outra vez.');
    } finally {
      setAEnviar(false);
    }
  };
  return (
    <>
      <Pressable
        onPress={() => setAberta(true)}
        role="button"
        hitSlop={8}
        style={({ pressed }) => ({
          marginTop: 22,
          alignSelf: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <T v="legenda" style={{ color: cor.texto3, textDecorationLine: 'underline' }}>
          Tenho um código de demonstração
        </T>
      </Pressable>
      <Folha aberta={aberta} fechar={() => setAberta(false)} titulo="Código de demonstração">
        <View style={{ gap: 14, paddingHorizontal: MARGEM, paddingBottom: 8 }}>
          <T v="legenda" style={{ color: cor.texto2 }}>
            Para quem avalia a app nas lojas: entra numa conta de exemplo.
          </T>
          <Campo
            value={codigo}
            onChangeText={setCodigo}
            placeholder="Código"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={enviar}
            erro={erro}
          />
          <Botao nome={aEnviar ? 'A entrar…' : 'Entrar'} onPress={enviar} />
        </View>
      </Folha>
    </>
  );
}
