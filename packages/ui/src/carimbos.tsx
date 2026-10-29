import { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import { cor } from './tema';
import { Icone } from './icone';

/**
 * Os círculos do cartão: os carimbos dados a cheio com a tesoura, os que
 * faltam vazios, e o último com a prenda (cheio, fica com a prenda: é o corte
 * da oferta). Em linhas de `porLinha`.
 *
 * As casas novas (de `novasDesde` até ao último carimbo) entram uma a uma com
 * uma mola, depois de uma pausa curta; a casa da prenda, quando completa o
 * cartão, salta mais. No fim, `aoAcabar`.
 */
export function Carimbos({
  carimbos,
  objectivo,
  tamanho = 44,
  porLinha = 5,
  folga = 12,
  novasDesde = null,
  aoAcabar,
}: {
  carimbos: number;
  objectivo: number;
  tamanho?: number;
  porLinha?: number;
  folga?: number;
  /** A primeira casa a animar (as que vêm antes já estavam à vista); null: nada se anima. */
  novasDesde?: number | null;
  aoAcabar?: () => void;
}) {
  const escalas = useRef(new Map<number, Animated.Value>()).current;
  const escala = (i: number) => {
    let v = escalas.get(i);
    if (!v) {
      v = new Animated.Value(1);
      escalas.set(i, v);
    }
    return v;
  };
  const animar = novasDesde !== null && novasDesde >= 0 && novasDesde < carimbos;
  // As casas novas nascem a zero ANTES da primeira pintura: num efeito chegava
  // tarde, e via-se a casa cheia a encolher antes de crescer.
  useMemo(() => {
    if (animar) for (let i = novasDesde; i < carimbos; i++) escala(i).setValue(0);
  }, [animar, novasDesde, carimbos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!animar) return;
    const completa = carimbos >= objectivo;
    const molas: Animated.CompositeAnimation[] = [];
    for (let i = novasDesde; i < carimbos; i++) {
      const prenda = completa && i === objectivo - 1;
      molas.push(
        Animated.spring(escala(i), {
          toValue: 1,
          friction: prenda ? 3.5 : 5,
          tension: prenda ? 50 : 60,
          useNativeDriver: Platform.OS !== 'web',
        }),
      );
    }
    const sequencia = Animated.sequence([Animated.delay(350), Animated.stagger(110, molas)]);
    sequencia.start(({ finished }) => {
      if (finished) aoAcabar?.();
    });
    return () => sequencia.stop();
  }, [animar, novasDesde, carimbos, objectivo]); // eslint-disable-line react-hooks/exhaustive-deps

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
              <Animated.View key={i} style={{ transform: [{ scale: escala(i) }] }}>
                <View
                  style={{
                    width: tamanho,
                    height: tamanho,
                    borderRadius: tamanho / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: cheio ? cor.claro : 'transparent',
                    borderWidth: cheio ? 0 : 1.5,
                    borderColor: ultimo ? '#5A5650' : '#3A3835',
                    ...(ultimo && !cheio
                      ? { boxShadow: '0 0 0 4px rgba(244,241,236,0.06)' }
                      : null),
                  }}
                >
                  {cheio ? (
                    <Icone
                      nome={ultimo ? 'presente' : 'tesoura'}
                      tamanho={tamanho * 0.5}
                      cor={cor.sobreClaro}
                      espessura={2.2}
                    />
                  ) : ultimo ? (
                    <Icone
                      nome="presente"
                      tamanho={tamanho * 0.48}
                      cor={cor.texto3}
                      espessura={2}
                    />
                  ) : null}
                </View>
              </Animated.View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
