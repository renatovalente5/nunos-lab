import { View } from 'react-native';
import { cor } from './tema';
import { Icone } from './icone';

/**
 * Os círculos do cartão: os carimbos dados a cheio com a tesoura, os que
 * faltam vazios, e o último com a prenda. Em linhas de `porLinha`.
 */
export function Carimbos({
  carimbos,
  objectivo,
  tamanho = 44,
  porLinha = 5,
  folga = 12,
}: {
  carimbos: number;
  objectivo: number;
  tamanho?: number;
  porLinha?: number;
  folga?: number;
}) {
  const linhas: number[][] = [];
  for (let i = 0; i < objectivo; i += porLinha)
    linhas.push(Array.from({ length: Math.min(porLinha, objectivo - i) }, (_, k) => i + k));
  return (
    <View style={{ gap: folga }} aria-label={`${carimbos} de ${objectivo} carimbos`} role="img">
      {linhas.map((linha, li) => (
        <View key={li} style={{ flexDirection: 'row', gap: folga }}>
          {linha.map((i) => {
            const cheio = i < carimbos;
            const ultimo = i === objectivo - 1;
            return (
              <View
                key={i}
                style={{
                  width: tamanho,
                  height: tamanho,
                  borderRadius: tamanho / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: cheio ? cor.claro : 'transparent',
                  borderWidth: cheio ? 0 : 1.5,
                  borderColor: ultimo ? '#5A5650' : '#3A3835',
                  ...(ultimo && !cheio ? { boxShadow: '0 0 0 4px rgba(244,241,236,0.06)' } : null),
                }}
              >
                {cheio ? (
                  <Icone
                    nome="tesoura"
                    tamanho={tamanho * 0.5}
                    cor={cor.sobreClaro}
                    espessura={2.2}
                  />
                ) : ultimo ? (
                  <Icone nome="presente" tamanho={tamanho * 0.48} cor={cor.texto3} espessura={2} />
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
