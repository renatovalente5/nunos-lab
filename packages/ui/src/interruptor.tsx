import { Pressable, View } from 'react-native';
import { cor } from './tema';

/** Um interruptor da casa: a cápsula clara quando está ligado, escura quando não. */
export function Interruptor({
  ligado,
  mudar,
  rotulo,
}: {
  ligado: boolean;
  mudar: (v: boolean) => void;
  rotulo?: string;
}) {
  return (
    <Pressable
      onPress={() => mudar(!ligado)}
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      hitSlop={6}
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        padding: 3,
        backgroundColor: ligado ? cor.claro : cor.linha,
        alignItems: ligado ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: ligado ? cor.sobreClaro : cor.texto2,
        }}
      />
    </Pressable>
  );
}
