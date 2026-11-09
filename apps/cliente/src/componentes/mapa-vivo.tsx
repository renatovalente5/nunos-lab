import {
  FOLGAS_DO_MAPA_VIVO,
  enquadrar,
  regiaoDoEnquadramento,
  type Loja,
  type PontoNoMapa,
} from '@nunos-lab/dominio';
import { cor } from '@nunos-lab/ui';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
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
import { BotaoDeRecentrar, saiuDoInicio } from './recentrar';

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

/**
 * O mapa da Apple nasce claro e só meio segundo depois de aparecer passa ao escuro da app, mesmo com
 * o telemóvel em modo escuro (visto no simulador, 9 nov). Uma capa da cor da moldura tapa-o até lá e
 * depois sai devagar: só se vê o mapa escuro.
 */
function useCapa() {
  // Os separadores montam-se todos ao abrir a app: o mapa só começa a desenhar quando aparece.
  const aFrente = useIsFocused();
  const [comecou, setComecou] = useState(false);
  const [tapado, setTapado] = useState(true);
  const opacidade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!tapado || !aFrente) return;
    // 0,8 s depois de o mapa começar a desenhar; se ele nunca avisar, 3 s depois de o separador abrir.
    const t = setTimeout(
      () =>
        Animated.timing(opacidade, { toValue: 0, duration: 250, useNativeDriver: true }).start(
          ({ finished }) => {
            if (finished) setTapado(false);
          },
        ),
      comecou ? 800 : 3000,
    );
    return () => clearTimeout(t);
  }, [aFrente, comecou, tapado, opacidade]);
  return { tapado, opacidade, comecou: () => setComecou(true) };
}

export function MapaVivo({ lojas, largura, altura, aberta, escolher, aoIr }: PropsDoMapaVivo) {
  const mapa = useRef<MapView>(null);
  const capa = useCapa();
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
  // O cliente tirou o mapa do enquadramento do início: aparece o botão de voltar.
  const [mexido, setMexido] = useState(false);
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
    <View style={{ width: largura, height: altura }}>
      <MapView
        ref={mapa}
        style={{ width: largura, height: altura }}
        initialRegion={regiao}
        onMapReady={capa.comecou}
        onRegionChangeComplete={(r) => {
          if (!regiao) return;
          setMexido(
            saiuDoInicio(
              {
                lat: r.latitude,
                lng: r.longitude,
                latDelta: r.latitudeDelta,
                lngDelta: r.longitudeDelta,
              },
              {
                lat: regiao.latitude,
                lng: regiao.longitude,
                latDelta: regiao.latitudeDelta,
                lngDelta: regiao.longitudeDelta,
              },
            ),
          );
        }}
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
      {capa.tapado && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: largura,
            height: altura,
            backgroundColor: cor.superficie,
            opacity: capa.opacidade,
          }}
        />
      )}
      <BotaoDeRecentrar
        visivel={mexido}
        onPress={() => {
          escolher(null);
          if (regiao) mapa.current?.animateToRegion(regiao, 350);
        }}
      />
    </View>
  );
}
