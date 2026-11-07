import {
  FOLGAS_DO_MAPA_VIVO,
  enquadrar,
  regiaoDoEnquadramento,
  type Loja,
  type PontoNoMapa,
} from '@nunos-lab/dominio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import {
  ALTURA_DO_BALAO,
  BalaoDaCasa,
  PinoDaCasa,
  balaoPorBaixo,
  cimoDoBalao,
  quantoAndarParaCaber,
  temBalao,
} from './pino-da-casa';

/**
 * O mapa vivo no telemóvel. No iPhone é o dos Mapas da Apple, do próprio sistema (sem chave).
 * No Android seria o da Google, que pede uma chave com facturação e rebenta sem ela: até haver
 * chave, o Android fica com a imagem. (Lá os pinos da Google são imagens: o balão terá de ser outro.)
 */
export const HA_MAPA_VIVO = Platform.OS === 'ios';

export type PropsDoMapaVivo = {
  /** Só as casas com sítio. */
  lojas: Loja[];
  largura: number;
  altura: number;
  aberta: number | null;
  escolher: (id: number | null) => void;
  aoIr: (loja: Loja) => void;
  /** O mapa não pôde vir (na web: a Apple ou a autorização): fica a imagem. */
  falhou: () => void;
};

export function MapaVivo({ lojas, largura, altura, aberta, escolher, aoIr }: PropsDoMapaVivo) {
  const mapa = useRef<MapView>(null);
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
  const escolhida = lojas.find((l) => l.id === aberta && temBalao(l)) ?? null;
  // De que lado abre o balão, que depende de onde estão as outras casas no ecrã.
  const [balao, setBalao] = useState<{ id: number; porBaixo: boolean } | null>(null);

  // Com o lado escolhido, e se a casa está perto da borda, o mapa anda o que falta para o balão caber.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !escolhida) return;
    let vivo = true;
    void (async () => {
      const pontos = await Promise.all(
        lojas.map((l) => m.pointForCoordinate({ latitude: l.lat!, longitude: l.lng! })),
      );
      const i = lojas.indexOf(escolhida);
      const p = pontos[i]!;
      const outras = pontos
        .map((q, j) => ({ ...q, nome: lojas[j]!.nome }))
        .filter((_, j) => j !== i);
      const porBaixo = balaoPorBaixo(escolhida, p, outras);
      if (!vivo) return;
      setBalao({ id: escolhida.id, porBaixo });
      const { dx, dy } = quantoAndarParaCaber(escolhida, p, porBaixo, largura, altura);
      if (!dx && !dy) return;
      const centro = await m.coordinateForPoint({ x: largura / 2 - dx, y: altura / 2 - dy });
      if (vivo) m.animateCamera({ center: centro }, { duration: 250 });
    })().catch(() => {});
    return () => {
      vivo = false;
    };
  }, [escolhida, lojas, largura, altura]);

  return (
    <MapView
      ref={mapa}
      style={{ width: largura, height: altura }}
      initialRegion={regiao}
      userInterfaceStyle="dark"
      showsPointsOfInterests={false}
      pitchEnabled={false}
      rotateEnabled={false}
      showsCompass={false}
      toolbarEnabled={false}
      // Um toque no mapa, fora dos pinos, fecha o balão.
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
          zIndex={aberta === l.id ? 1 : 0}
          accessibilityLabel={l.nome}
        >
          <PinoDaCasa nome={l.nome} escolhido={aberta === l.id} />
        </Marker>
      ))}
      {/* O balão é um marcador à parte, que só existe aberto: o do pino não encolhe depois de crescer. */}
      {escolhida && balao?.id === escolhida.id && (
        <Marker
          key={`balao-${escolhida.id}-${balao.porBaixo}`}
          coordinate={{ latitude: escolhida.lat!, longitude: escolhida.lng! }}
          onPress={() => {}}
          stopPropagation
          // O MapKit põe o meio do marcador no sítio: desce (ou sobe) até ao meio do balão.
          centerOffset={{ x: 0, y: cimoDoBalao(balao.porBaixo) + ALTURA_DO_BALAO / 2 }}
          zIndex={2}
        >
          <BalaoDaCasa loja={escolhida} aoIr={() => aoIr(escolhida)} emBaixo={balao.porBaixo} />
        </Marker>
      )}
    </MapView>
  );
}
