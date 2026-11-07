import {
  FOLGAS_DO_MAPA_VIVO,
  enquadrar,
  regiaoDoEnquadramento,
  type PontoNoMapa,
} from '@nunos-lab/dominio';
import { useEffect, useEffectEvent, useRef, type ComponentRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { View } from 'react-native';
import { API, PRAZO_DO_PEDIDO } from '../dados';
import type { PropsDoMapaVivo } from './mapa-vivo';
import { ALTURA_DO_PINO, LARGURA_DO_PINO, PinoDaCasa } from './pino-da-casa';

/** Na web, o mapa vivo é o dos Mapas da Apple (MapKit JS), como no iPhone. */
export const HA_MAPA_VIVO = true;

/** O que se usa do MapKit JS (a Apple não publica os tipos). */
type Anotacao = {
  selected: boolean;
  addEventListener(tipo: 'select' | 'deselect', f: () => void): void;
};
type Mapa = { addAnnotations(a: Anotacao[]): void; destroy(): void };
type MapKit = {
  init(o: {
    authorizationCallback: (feito: (token: string) => void) => void;
    language: string;
  }): void;
  Map: { new (el: HTMLElement, o: object): Mapa; ColorSchemes: { Dark: string } };
  Coordinate: new (lat: number, lng: number) => object;
  CoordinateSpan: new (lat: number, lng: number) => object;
  CoordinateRegion: new (centro: object, span: object) => object;
  Annotation: new (sitio: object, fabrica: () => HTMLElement, o: object) => Anotacao;
  FeatureVisibility: { Hidden: string };
  PointOfInterestFilter: { excludingAllCategories: object };
};

/** A autorização vem da API (um JWT de meia hora, preso a esta origem). */
async function pedirToken(): Promise<string> {
  const r = await fetch(`${API}/api/mapa/token`, { signal: AbortSignal.timeout(PRAZO_DO_PEDIDO) });
  if (!r.ok) throw new Error(`A API respondeu ${r.status}`);
  return r.text();
}

let carregamento: Promise<MapKit> | null = null;

/**
 * O MapKit JS carrega-se uma vez, do sítio da Apple, quando o mapa aparece pela primeira vez. A
 * primeira autorização pede-se antes: sem ela o mapa não vem, e fica a imagem.
 */
function carregarMapKit(): Promise<MapKit> {
  carregamento ??= pedirToken()
    .then(
      (primeiro) =>
        new Promise<MapKit>((resolver, rejeitar) => {
          const janela = window as unknown as { mapkit?: MapKit; mapkitDoNunosLab?: () => void };
          janela.mapkitDoNunosLab = () => {
            const mk = janela.mapkit!;
            let token: string | null = primeiro;
            mk.init({
              language: 'pt-PT',
              authorizationCallback: (feito) => {
                // A primeira vez usa a que já veio; as seguintes (a cada meia hora) pedem outra.
                if (token) feito(token);
                else void pedirToken().then(feito, () => {});
                token = null;
              },
            });
            resolver(mk);
          };
          const s = document.createElement('script');
          s.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js';
          s.crossOrigin = 'anonymous';
          s.async = true;
          s.dataset.callback = 'mapkitDoNunosLab';
          s.dataset.libraries = 'map,annotations';
          s.onerror = () => rejeitar(new Error('O MapKit JS não carregou'));
          document.head.appendChild(s);
        }),
    )
    .catch((erro: unknown) => {
      // Uma falha (rede, a API) não fica guardada: a próxima vez tenta outra vez.
      carregamento = null;
      throw erro;
    });
  return carregamento;
}

type Pino = { anotacao: Anotacao; raiz: Root; nome: string };

export function MapaVivo({ lojas, largura, altura, aberta, escolher, falhou }: PropsDoMapaVivo) {
  const caixa = useRef<ComponentRef<typeof View>>(null);
  const pinos = useRef(new Map<number, Pino>());
  const aoEscolher = useEffectEvent(escolher);
  const aoFalhar = useEffectEvent(falhou);
  // O aro no pino da casa escolhida, e a selecção do MapKit igual à da app.
  const pintar = useEffectEvent(() => {
    for (const [id, p] of pinos.current) {
      p.raiz.render(<PinoDaCasa nome={p.nome} escolhido={id === aberta} />);
      if (p.anotacao.selected !== (id === aberta)) p.anotacao.selected = id === aberta;
    }
  });
  const medidas = useEffectEvent(() => ({ largura, altura }));

  // O mapa faz-se uma vez por lista de casas: mudar o tamanho da janela não o refaz.
  useEffect(() => {
    const el = caixa.current as unknown as HTMLElement | null;
    if (!el) return;
    let vivo = true;
    let mapa: Mapa | null = null;
    const deste = pinos.current;
    carregarMapKit()
      .then((mk) => {
        if (!vivo) return;
        const { largura: w, altura: h } = medidas();
        const e = enquadrar(lojas as PontoNoMapa[], w, h, FOLGAS_DO_MAPA_VIVO);
        if (!e) return;
        const r = regiaoDoEnquadramento(e, w, h);
        mapa = new mk.Map(el, {
          colorScheme: mk.Map.ColorSchemes.Dark,
          pointOfInterestFilter: mk.PointOfInterestFilter.excludingAllCategories,
          showsCompass: mk.FeatureVisibility.Hidden,
          showsMapTypeControl: false,
          isRotationEnabled: false,
          region: new mk.CoordinateRegion(
            new mk.Coordinate(r.lat, r.lng),
            new mk.CoordinateSpan(r.latDelta, r.lngDelta),
          ),
        });
        const anotacoes = lojas.map((l) => {
          const no = document.createElement('div');
          const raiz = createRoot(no);
          const anotacao = new mk.Annotation(new mk.Coordinate(l.lat!, l.lng!), () => no, {
            title: l.nome,
            calloutEnabled: false,
            // O MapKit põe o fundo da caixa no sítio; a ponta do pino está a meio dela, por isso
            // o ponto de apoio sobe meia caixa (para cima é negativo).
            anchorOffset: new DOMPoint(0, -ALTURA_DO_PINO),
            size: { width: LARGURA_DO_PINO, height: 2 * ALTURA_DO_PINO },
          });
          anotacao.addEventListener('select', () => aoEscolher(l.id));
          anotacao.addEventListener('deselect', () => aoEscolher(null));
          deste.set(l.id, { anotacao, raiz, nome: l.nome });
          return anotacao;
        });
        mapa.addAnnotations(anotacoes);
        pintar();
      })
      .catch(() => {
        if (vivo) aoFalhar();
      });
    return () => {
      vivo = false;
      mapa?.destroy();
      const raizes = [...deste.values()].map((p) => p.raiz);
      deste.clear();
      // Desmontar outra raiz a meio de um render do React dá aviso: fica para a seguir.
      setTimeout(() => raizes.forEach((r) => r.unmount()), 0);
    };
  }, [lojas]);

  useEffect(() => pintar(), [aberta]);

  return <View ref={caixa} style={{ width: largura, height: altura }} />;
}
