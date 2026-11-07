import {
  FOLGAS_DO_MAPA_VIVO,
  enquadrar,
  regiaoDoEnquadramento,
  type Loja,
  type PontoNoMapa,
} from '@nunos-lab/dominio';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { PinoDaCasa } from './pino-da-casa';

/**
 * O mapa vivo no telemóvel. No iPhone é o dos Mapas da Apple, do próprio sistema (sem chave).
 * No Android seria o da Google, que pede uma chave com facturação e rebenta sem ela: até haver
 * chave, o Android fica com a imagem.
 */
export const HA_MAPA_VIVO = Platform.OS === 'ios';

export type PropsDoMapaVivo = {
  /** Só as casas com sítio. */
  lojas: Loja[];
  largura: number;
  altura: number;
  aberta: number | null;
  escolher: (id: number | null) => void;
  /** O mapa não pôde vir (na web: a Apple ou a autorização): fica a imagem. */
  falhou: () => void;
};

export function MapaVivo({ lojas, largura, altura, aberta, escolher }: PropsDoMapaVivo) {
  // Abre com o enquadramento da imagem; depois é do cliente (arrastar, aproximar).
  const regiao = useMemo(() => {
    const e = enquadrar(lojas as PontoNoMapa[], largura, altura, FOLGAS_DO_MAPA_VIVO);
    if (!e) return undefined;
    const r = regiaoDoEnquadramento(e, largura, altura);
    return {
      latitude: r.lat,
      longitude: r.lng,
      latitudeDelta: r.latDelta,
      longitudeDelta: r.lngDelta,
    };
  }, [lojas, largura, altura]);
  return (
    <MapView
      style={{ width: largura, height: altura }}
      initialRegion={regiao}
      userInterfaceStyle="dark"
      showsPointsOfInterests={false}
      pitchEnabled={false}
      rotateEnabled={false}
      showsCompass={false}
      toolbarEnabled={false}
      // Um toque no mapa, fora dos pinos, tira a casa de baixo.
      onPress={(ev) => {
        if (ev.nativeEvent.action !== 'marker-press') escolher(null);
      }}
    >
      {lojas.map((l) => (
        <Marker
          key={l.id}
          coordinate={{ latitude: l.lat!, longitude: l.lng! }}
          onPress={() => escolher(l.id)}
          stopPropagation
          anchor={{ x: 0.5, y: 0.5 }}
          accessibilityLabel={l.nome}
        >
          <PinoDaCasa nome={l.nome} escolhido={aberta === l.id} />
        </Marker>
      ))}
    </MapView>
  );
}
