import { TextInput, View, type TextInputProps } from 'react-native';
import { CONTINUO, cor, letra } from './tema';
import { T } from './texto';

/** Um campo de texto da app: a superfície, cantos redondos, a letra da casa. */
export function Campo({
  rotulo,
  erro,
  style,
  ...resto
}: TextInputProps & { rotulo?: string; erro?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      {rotulo && (
        <T v="legenda" style={{ color: cor.texto2, marginLeft: 4 }}>
          {rotulo}
        </T>
      )}
      <TextInput
        placeholderTextColor={cor.texto3}
        aria-label={rotulo}
        aria-invalid={!!erro}
        {...resto}
        style={[
          {
            height: 52,
            paddingHorizontal: 16,
            borderRadius: 16,
            backgroundColor: cor.superficieAlta,
            color: cor.texto,
            fontFamily: letra.semi,
            fontSize: 16,
            borderWidth: 1,
            borderColor: erro ? '#C9463D' : 'transparent',
            ...CONTINUO,
          },
          style,
        ]}
      />
      {!!erro && (
        <T v="legenda" style={{ color: '#E07A72', marginLeft: 4 }}>
          {erro}
        </T>
      )}
    </View>
  );
}
