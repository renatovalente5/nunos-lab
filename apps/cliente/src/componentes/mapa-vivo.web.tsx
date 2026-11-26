import {
  ETIQUETA_DA_LINGUA,
  FOLGAS_DO_MAPA_VIVO,
  enquadrar,
  folgasAoCentro,
  regiaoDoEnquadramento,
  versaoDasCasas,
  type Loja,
  type PontoNoMapa,
} from '@nunos-lab/dominio';
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { View } from 'react-native';
import { linguaActual, useLingua } from '@nunos-lab/ui';
import { API, PRAZO_DO_PEDIDO } from '../dados';
import type { PropsDoMapaVivo } from './mapa-vivo';
import { BotaoDeRecentrar, saiuDoInicio, type Enquadramento } from './recentrar';
import {
  ALTURA_DO_PINO,
  BalaoDaCasa,
  LARGURA_DO_PINO,
  PinoDaCasa,
  balaoPorBaixo,
  caixaComBalao,
  quantoAndarParaCaber,
  temBalao,
} from './pino-da-casa';

/** Na web, o mapa vivo é o dos Mapas da Apple (MapKit JS), como no iPhone. */
export const HA_MAPA_VIVO = true;

/** O que se usa do MapKit JS (a Apple não publica os tipos). */
type Anotacao = {
  selected: boolean;
  coordinate: object;
  size: { width: number; height: number };
  anchorOffset: DOMPoint;
  addEventListener(tipo: 'select' | 'deselect', f: () => void): void;
};
type Mapa = {
  center: object;
  region: {
    center: { latitude: number; longitude: number };
    span: { latitudeDelta: number; longitudeDelta: number };
  };
  setRegionAnimated(regiao: object, animar: boolean): void;
  addEventListener(tipo: 'region-change-end', f: () => void): void;
  addAnnotations(a: Anotacao[]): void;
  convertCoordinateToPointOnPage(sitio: object): DOMPoint;
  convertPointOnPageToCoordinate(ponto: DOMPoint): object;
  setCenterAnimated(sitio: object, animar: boolean): void;
  destroy(): void;
};
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

let script: Promise<MapKit> | null = null;

/** O script do MapKit JS, uma vez por página: a chamada de volta diz quando está pronto. */
function scriptDoMapKit(): Promise<MapKit> {
  script ??= new Promise<MapKit>((resolver, rejeitar) => {
    const janela = window as unknown as { mapkit?: MapKit; mapkitDoNunosLab?: () => void };
    janela.mapkitDoNunosLab = () => resolver(janela.mapkit!);
    const s = document.createElement('script');
    s.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js';
    s.crossOrigin = 'anonymous';
    s.async = true;
    s.dataset.callback = 'mapkitDoNunosLab';
    s.dataset.libraries = 'map,annotations';
    s.onerror = () => {
      // Sem rede, por exemplo: a próxima vez põe-se outro.
      script = null;
      s.remove();
      rejeitar(new Error('O MapKit JS não carregou'));
    };
    document.head.appendChild(s);
  });
  return script;
}

let carregamento: Promise<MapKit> | null = null;

/**
 * O MapKit JS carrega-se uma vez, do sítio da Apple: uns segundos depois de a app abrir
 * (aquecerMapaVivo) ou, se a Barbearia abrir antes, quando o mapa aparece. A primeira autorização
 * pede-se ao mesmo tempo que o script (era uma depois da outra); sem ela o mapa não vem, e fica a
 * imagem.
 */
function carregarMapKit(): Promise<MapKit> {
  carregamento ??= Promise.all([pedirToken(), scriptDoMapKit()])
    .then(([primeiro, mk]) => {
      let token: string | null = primeiro;
      mk.init({
        language: ETIQUETA_DA_LINGUA[linguaActual()],
        authorizationCallback: (feito) => {
          // A primeira vez usa a que já veio; as seguintes (a cada meia hora) pedem outra.
          if (token) feito(token);
          else void pedirToken().then(feito, () => {});
          token = null;
        },
      });
      return mk;
    })
    .catch((erro: unknown) => {
      // Uma falha (rede, a API) não fica guardada: a próxima vez tenta outra vez.
      carregamento = null;
      throw erro;
    });
  return carregamento;
}

type Regiao = { lat: number; lng: number; latDelta: number; lngDelta: number };

/** O mapa escuro da Barbearia, sem pontos de interesse nem bússola, a abrir na região das casas. */
function novoMapa(mk: MapKit, el: HTMLElement, r: Regiao): Mapa {
  return new mk.Map(el, {
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
}

/** Para que casas (os sítios) e para que medidas foi feito um mapa. */
const chaveDoMapa = (lojas: Loja[], largura: number, altura: number) =>
  `${versaoDasCasas(lojas)}|${Math.round(largura)}x${Math.round(altura)}`;

/** O mapa feito de antemão, escondido, à espera de a Barbearia o levar. */
let reserva: { el: HTMLDivElement; mapa: Mapa; chave: string } | null = null;
let aquecido = false;
let mapasAbertos = 0;

/**
 * Faz o mapa da Barbearia escondido, uns segundos depois de a app abrir (o PrecarregarMapa da
 * barra dos separadores): o MapKit, a autorização e os mosaicos chegam antes de a pessoa abrir a
 * Barbearia, e ela leva-o já feito. Antes, tudo isto só começava ao abrir a Barbearia e o mapa
 * levava uns 3 s a aparecer (o Renato: «demora muito a carregar», 26 nov 2026). Uma vez por página.
 */
export function aquecerMapaVivo(lojas: Loja[], largura: number, altura: number): void {
  // Uma janela ainda sem tamanho (um separador escondido): fica para quando a Barbearia abrir.
  if (aquecido || mapasAbertos > 0 || typeof document === 'undefined') return;
  if (!(largura >= 100 && altura >= 100)) return;
  aquecido = true;
  let el: HTMLDivElement | null = null;
  carregarMapKit()
    .then((mk) => {
      // A Barbearia abriu entretanto: o mapa dela já está a nascer.
      if (mapasAbertos > 0) return;
      const e = enquadrar(
        lojas as PontoNoMapa[],
        largura,
        altura,
        folgasAoCentro(FOLGAS_DO_MAPA_VIVO, largura, altura),
      );
      if (!e) return;
      el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      el.inert = true;
      Object.assign(el.style, {
        position: 'fixed',
        left: '0px',
        top: '0px',
        width: `${largura}px`,
        height: `${altura}px`,
        opacity: '0',
        pointerEvents: 'none',
        zIndex: '-1',
      });
      document.body.appendChild(el);
      reserva = {
        el,
        mapa: novoMapa(mk, el, regiaoDoEnquadramento(e, largura, altura)),
        chave: chaveDoMapa(lojas, largura, altura),
      };
    })
    .catch(() => {
      el?.remove();
      aquecido = false;
    });
}

type Pino = { anotacao: Anotacao; raiz: Root; loja: Loja };

/** Corre `feito` depois de o React pôr o pino na página: só então se muda a caixa no MapKit. */
function DepoisDePintar({ feito, children }: { feito: () => void; children: ReactNode }) {
  useLayoutEffect(feito);
  return children;
}

export function MapaVivo({
  lojas,
  largura,
  altura,
  aberta,
  escolher,
  aoIr,
  falhou,
}: PropsDoMapaVivo) {
  const caixa = useRef<ComponentRef<typeof View>>(null);
  const pinos = useRef(new Map<number, Pino>());
  const mapaFeito = useRef<Mapa | null>(null);
  // O enquadramento do início e o MapKit, para o botão de voltar a ele.
  const inicio = useRef<Enquadramento | null>(null);
  const mkFeito = useRef<MapKit | null>(null);
  const [mexido, setMexido] = useState(false);
  // As etiquetas do mapa, o logótipo e o «Legal» mudam com a língua da app, sem refazer o mapa.
  const lingua = useLingua();
  useEffect(() => {
    const mk = (window as unknown as { mapkit?: { language: string } }).mapkit;
    if (mk && mapaFeito.current) mk.language = ETIQUETA_DA_LINGUA[lingua];
  }, [lingua]);
  const aoEscolher = useEffectEvent(escolher);
  const aoIrA = useEffectEvent(aoIr);
  const aoFalhar = useEffectEvent(falhou);
  // O aro e o balão no pino da casa escolhida, e a selecção do MapKit igual à da app.
  const pintar = useEffectEvent((porBaixo: boolean) => {
    for (const [id, p] of pinos.current) {
      const aberto = id === aberta;
      const comBalao = aberto && temBalao(p.loja);
      const { cima, baixo } = comBalao ? caixaComBalao(porBaixo) : { cima: 0, baixo: 0 };
      p.raiz.render(
        <DepoisDePintar
          feito={() => {
            p.anotacao.size = {
              width: LARGURA_DO_PINO,
              height: cima + 2 * ALTURA_DO_PINO + baixo,
            };
            p.anotacao.anchorOffset = new DOMPoint(0, -(ALTURA_DO_PINO + baixo));
          }}
        >
          <PinoDaCasa
            nome={p.loja.nome}
            escolhido={aberto}
            balao={
              comBalao ? (
                <BalaoDaCasa loja={p.loja} aoIr={() => aoIrA(p.loja)} emBaixo={porBaixo} />
              ) : undefined
            }
            balaoPorBaixo={porBaixo}
          />
        </DepoisDePintar>,
      );
      if (p.anotacao.selected !== aberto) p.anotacao.selected = aberto;
    }
  });
  // O balão abre do lado que não tapa outra casa; perto da borda, o mapa anda o que falta.
  const abrirBalao = useEffectEvent(() => {
    const mapa = mapaFeito.current;
    const p = aberta === null ? undefined : pinos.current.get(aberta);
    if (!mapa || !p || !temBalao(p.loja)) return pintar(false);
    const centro = mapa.convertCoordinateToPointOnPage(mapa.center);
    const noMapa = (q: Pino) => {
      const ponto = mapa.convertCoordinateToPointOnPage(q.anotacao.coordinate);
      return { x: ponto.x - centro.x + largura / 2, y: ponto.y - centro.y + altura / 2 };
    };
    const sitio = noMapa(p);
    const outras = [...pinos.current.values()]
      .filter((q) => q !== p)
      .map((q) => ({ ...noMapa(q), nome: q.loja.nome }));
    const porBaixo = balaoPorBaixo(p.loja, sitio, outras);
    pintar(porBaixo);
    const { dx, dy } = quantoAndarParaCaber(p.loja, sitio, porBaixo, largura, altura);
    if (!dx && !dy) return;
    mapa.setCenterAnimated(
      mapa.convertPointOnPageToCoordinate(new DOMPoint(centro.x - dx, centro.y - dy)),
      true,
    );
  });
  const medidas = useEffectEvent(() => ({ largura, altura }));

  // O mapa faz-se uma vez por lista de casas: mudar o tamanho da janela não o refaz.
  useEffect(() => {
    const el = caixa.current as unknown as HTMLElement | null;
    if (!el) return;
    let vivo = true;
    let mapa: Mapa | null = null;
    // O mapa feito de antemão, quando a Barbearia o leva: sai com ela.
    let deAntes: HTMLDivElement | null = null;
    const deste = pinos.current;
    mapasAbertos++;
    carregarMapKit()
      .then((mk) => {
        if (!vivo) return;
        const { largura: w, altura: h } = medidas();
        const e = enquadrar(
          lojas as PontoNoMapa[],
          w,
          h,
          folgasAoCentro(FOLGAS_DO_MAPA_VIVO, w, h),
        );
        if (!e) return;
        const r = regiaoDoEnquadramento(e, w, h);
        const feitoAntes = reserva;
        reserva = null;
        if (feitoAntes && feitoAntes.chave === chaveDoMapa(lojas, w, h)) {
          // Já com os mosaicos: passa do canto escondido para aqui, e vê-se logo.
          Object.assign(feitoAntes.el.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            width: '100%',
            height: '100%',
            opacity: '',
            pointerEvents: '',
            zIndex: '',
          });
          feitoAntes.el.removeAttribute('aria-hidden');
          feitoAntes.el.inert = false;
          el.appendChild(feitoAntes.el);
          deAntes = feitoAntes.el;
          mapa = feitoAntes.mapa;
        } else {
          // Feito para outras casas ou outro tamanho de janela: não serve.
          if (feitoAntes) {
            feitoAntes.mapa.destroy();
            feitoAntes.el.remove();
          }
          mapa = novoMapa(mk, el, r);
        }
        inicio.current = { lat: r.lat, lng: r.lng, latDelta: r.latDelta, lngDelta: r.lngDelta };
        mkFeito.current = mk;
        const feito = mapa;
        feito.addEventListener('region-change-end', () => {
          const g = feito.region;
          setMexido(
            saiuDoInicio(
              {
                lat: g.center.latitude,
                lng: g.center.longitude,
                latDelta: g.span.latitudeDelta,
                lngDelta: g.span.longitudeDelta,
              },
              { lat: r.lat, lng: r.lng, latDelta: r.latDelta, lngDelta: r.lngDelta },
            ),
          );
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
          deste.set(l.id, { anotacao, raiz, loja: l });
          return anotacao;
        });
        mapa.addAnnotations(anotacoes);
        mapaFeito.current = mapa;
        abrirBalao();
      })
      .catch(() => {
        if (vivo) aoFalhar();
      });
    return () => {
      vivo = false;
      mapasAbertos--;
      mapaFeito.current = null;
      mapa?.destroy();
      deAntes?.remove();
      const raizes = [...deste.values()].map((p) => p.raiz);
      deste.clear();
      // Desmontar outra raiz a meio de um render do React dá aviso: fica para a seguir.
      setTimeout(() => raizes.forEach((r) => r.unmount()), 0);
    };
  }, [lojas]);

  useEffect(() => abrirBalao(), [aberta]);

  const recentrar = () => {
    const m = mapaFeito.current;
    const mk = mkFeito.current;
    const i = inicio.current;
    escolher(null);
    if (m && mk && i)
      m.setRegionAnimated(
        new mk.CoordinateRegion(
          new mk.Coordinate(i.lat, i.lng),
          new mk.CoordinateSpan(i.latDelta, i.lngDelta),
        ),
        true,
      );
  };

  return (
    <View style={{ width: largura, height: altura }}>
      <View ref={caixa} style={{ width: largura, height: altura }} />
      <BotaoDeRecentrar visivel={mexido} onPress={recentrar} />
    </View>
  );
}
