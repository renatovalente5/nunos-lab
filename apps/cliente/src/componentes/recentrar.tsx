import { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { Icone, cor } from '@nunos-lab/ui';
import { useTextos } from '../textos';

/** Um enquadramento do mapa: o centro e o tamanho, em graus. */
export type Enquadramento = { lat: number; lng: number; latDelta: number; lngDelta: number };

/**
 * O mapa saiu do enquadramento do início: o centro andou mais de um décimo do tamanho dele, ou a
 * aproximação mudou mais de um décimo. Um quarto era pouco: um arrasto de meio mapa no telemóvel
 * ficava por baixo (8 nov).
 */
export function saiuDoInicio(agora: Enquadramento, inicio: Enquadramento): boolean {
  return (
    Math.abs(agora.lat - inicio.lat) > inicio.latDelta / 10 ||
    Math.abs(agora.lng - inicio.lng) > inicio.lngDelta / 10 ||
    Math.abs(Math.log(agora.latDelta / inicio.latDelta)) > Math.log(1.1)
  );
}

/**
 * O botão de voltar ao mapa do início, com as barbearias todas, no canto de cima do mapa. Só aparece
 * depois de o cliente mexer no mapa (o Renato, 8 nov).
 */
export function BotaoDeRecentrar({ visivel, onPress }: { visivel: boolean; onPress: () => void }) {
  const t = useTextos();
  const opacidade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacidade, {
      toValue: visivel ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [visivel, opacidade]);
  return (
    <Animated.View
      pointerEvents={visivel ? 'auto' : 'none'}
      aria-hidden={!visivel}
      style={{ position: 'absolute', top: 12, right: 12, opacity: opacidade }}
    >
      <Pressable
        onPress={onPress}
        role="button"
        aria-label={t.mapa.verTodas}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? 'rgba(48,46,43,0.96)' : 'rgba(24,23,22,0.88)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        })}
      >
        <Icone nome="recentrar" tamanho={20} cor={cor.texto} espessura={2} />
      </Pressable>
    </Animated.View>
  );
}
