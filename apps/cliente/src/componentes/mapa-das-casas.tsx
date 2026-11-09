import { enquadrar, projectar, semPartir, versaoDasCasas, type Loja } from '@nunos-lab/dominio';
import { CONTINUO, Grupo, LARGURA_MAXIMA, MARGEM, Separador, T, cor, raio } from '@nunos-lab/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PixelRatio, Pressable, View, useWindowDimensions } from 'react-native';
import { API, abrir, contar, useDados } from '../dados';
import { HA_MAPA_VIVO, MapaVivo } from './mapa-vivo';
import {
  ALTURA_DO_BALAO,
  ALTURA_DO_PINO,
  BalaoDaCasa,
  FOLGA_NA_BORDA,
  LARGURA_DO_PINO,
  Pilula,
  PinoDaCasa,
  balaoPorBaixo,
  cimoDoBalao,
  larguraDoBalao,
  temBalao,
} from './pino-da-casa';
import { useTextos } from '../textos';

/**
 * O mapa é ao alto: as casas estendem-se de norte a sul, e assim o mapa aproxima-se mais. Era
 * 1,05; passou a 1,25 para o balão de uma casa caber sem tapar a de cima (7 nov); e a 1,2 para o
 * «Mais» por baixo não encostar ao menu num iPhone de 844 pontos (ficavam a 3; o Renato, 9 nov).
 */
const ALTO = 1.2;

/** A moldura dos dois mapas: cantos redondos, à largura da coluna. */
const MOLDURA = {
  alignSelf: 'center',
  borderRadius: raio.grupo,
  overflow: 'hidden',
  backgroundColor: cor.superficie,
  ...CONTINUO,
} as const;

/**
 * Um lado do mapa em degraus de 16 px, entre 112 e 640: a API guarda uma imagem
 * por tamanho (e arredonda da mesma forma), por isso arrastar a janela no
 * computador deixa de pedir uma imagem por píxel. Para baixo, para o mapa
 * nunca sair da coluna.
 */
function degrau(px: number): number {
  return Math.min(640, Math.max(112, Math.floor(px / 16) * 16));
}

/** O tamanho do mapa para esta janela e a morada da imagem: a mesma conta no mapa e no pré-carregamento. */
function medidasDoMapa(lojas: Loja[], larguraDaJanela: number) {
  const comSitio = lojas.filter((l) => l.lat !== null && l.lng !== null);
  const w = degrau(Math.min(larguraDaJanela, LARGURA_MAXIMA) - 2 * MARGEM);
  const h = degrau(w * ALTO);
  const e = enquadrar(comSitio as { lat: number; lng: number }[], w, h);
  const escala = Math.min(3, Math.max(1, Math.round(PixelRatio.get())));
  const v = versaoDasCasas(comSitio);
  return { comSitio, w, h, e, uri: `${API}/api/mapa?w=${w}&h=${h}&s=${escala}&pinos=0&v=${v}` };
}

/** O valor só muda depois de ficar quieto `ms`: arrastar a janela muda a largura dezenas de vezes por segundo. */
function useSossegado<V>(valor: V, ms: number): V {
  const [sossegado, setSossegado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setSossegado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return sossegado;
}

/**
 * Pede a imagem do mapa logo que a app tem as lojas, dois segundos depois (para não
 * atrasar o que a app mostra primeiro): quando se entra na Barbearia, a imagem
 * já está no aparelho. Vive na barra de separadores, que está sempre montada. Com
 * o mapa vivo não há imagem a pedir.
 */
export function PrecarregarMapa() {
  const { data } = useDados();
  const { width } = useWindowDimensions();
  const lojas = data?.barbearia.lojas;
  useEffect(() => {
    if (HA_MAPA_VIVO || !lojas?.length) return;
    const { e, uri } = medidasDoMapa(lojas, width);
    if (!e) return;
    const t = setTimeout(() => void Image.prefetch(uri).catch(() => {}), 2000);
    return () => clearTimeout(t);
  }, [lojas, width]);
  return null;
}

/**
 * O mapa das casas. No iPhone e no site é o mapa vivo dos Mapas da Apple (arrastar,
 * aproximar); no Android, até haver a chave da Google, e quando o mapa vivo não vem, é
 * uma imagem dos Mapas da Apple pedida pela API, com os pinos desenhados por cima. Ao
 * tocar num pino abre-se junto dele um balão só com «Marcar» e «Ir» (por cima, ou por
 * baixo do nome se em cima tapar outra casa); tocar no mapa fecha-o. Sem mapa nenhum (a Apple, a rede, o travão), as casas aparecem em lista, com
 * a morada, «Marcar» e «Ir». Uma casa ainda sem coordenadas vai para a lista por baixo
 * do mapa.
 */
export function MapaDasCasas({ lojas, aoIr }: { lojas: Loja[]; aoIr: (loja: Loja) => void }) {
  const { width } = useWindowDimensions();
  const [aberta, setAberta] = useState<number | null>(null);
  const [vivoFalhou, setVivoFalhou] = useState(false);
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const comSitio = useMemo(() => lojas.filter((l) => l.lat !== null && l.lng !== null), [lojas]);
  const vivo = HA_MAPA_VIVO && !vivoFalhou;
  if (comSitio.length === 0 || (!vivo && imagemFalhou))
    return <ListaDasCasas lojas={lojas} aoIr={aoIr} />;
  const semSitio = lojas.filter((l) => l.lat === null || l.lng === null);
  const w = Math.min(width, LARGURA_MAXIMA) - 2 * MARGEM;
  const h = Math.min(640, Math.round(w * ALTO));
  return (
    <>
      {vivo ? (
        <View style={{ ...MOLDURA, width: w, height: h }}>
          <MapaVivo
            lojas={comSitio}
            largura={w}
            altura={h}
            aberta={aberta}
            escolher={setAberta}
            aoIr={aoIr}
            falhou={() => setVivoFalhou(true)}
          />
        </View>
      ) : (
        <MapaEstatico
          lojas={comSitio}
          aberta={aberta}
          escolher={setAberta}
          aoIr={aoIr}
          falhou={() => setImagemFalhou(true)}
        />
      )}
      {semSitio.length > 0 && <ListaDasCasas lojas={semSitio} aoIr={aoIr} depoisDoMapa />}
    </>
  );
}

/**
 * A imagem do mapa (os Mapas da Apple, pedidos pelo servidor, sem os balões da Apple)
 * com um pino por casa desenhado por cima. O enquadramento é o mesmo do servidor
 * (packages/dominio, mapa.ts), por isso os pinos caem no sítio certo.
 */
function MapaEstatico({
  lojas,
  aberta,
  escolher,
  aoIr,
  falhou,
}: {
  lojas: Loja[];
  aberta: number | null;
  escolher: (id: number | null) => void;
  aoIr: (loja: Loja) => void;
  falhou: () => void;
}) {
  const t = useTextos();
  const { width } = useWindowDimensions();
  // A largura só conta 300 ms depois de sossegar.
  const larguraSossegada = useSossegado(width, 300);
  const pedido = useMemo(() => medidasDoMapa(lojas, larguraSossegada), [lojas, larguraSossegada]);
  // A imagem à vista: a primeira pede-se logo; uma de outro tamanho só entra
  // depois de descarregada, para o mapa que já está à vista não piscar.
  const [aVista, setAVista] = useState(pedido);
  useEffect(() => {
    if (pedido.uri === aVista.uri) {
      if (pedido !== aVista) setAVista(pedido);
      return;
    }
    let vivo = true;
    Image.prefetch(pedido.uri)
      .then(() => {
        if (vivo) setAVista(pedido);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [pedido, aVista]);
  const [pronta, setPronta] = useState(false);
  // Se a imagem falhar (rede, um soluço do servidor), tenta mais uma vez passados 2 s;
  // se a Barbearia sair antes, o temporizador morre com ela.
  const [tentativa, setTentativa] = useState(0);
  const novaTentativa = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (novaTentativa.current) clearTimeout(novaTentativa.current);
    },
    [],
  );
  const { comSitio, w, h, e, uri } = aVista;
  if (!e) return null;
  const posicoes = comSitio.map((l) => ({
    loja: l,
    ...projectar({ lat: l.lat!, lng: l.lng! }, e, w, h),
  }));
  const escolhida = posicoes.find((p) => p.loja.id === aberta && temBalao(p.loja));
  return (
    <View style={{ ...MOLDURA, width: w, height: h }}>
      <Pressable onPress={() => escolher(null)} disabled={aberta === null} aria-hidden>
        <Image
          source={{ uri: `${uri}${tentativa ? `&t=${tentativa}` : ''}` }}
          style={{ width: w, height: h }}
          onLoad={() => setPronta(true)}
          onError={() => {
            if (tentativa === 0) novaTentativa.current = setTimeout(() => setTentativa(1), 2000);
            else falhou();
          }}
          accessibilityLabel={t.mapa.mapaComAsCasas}
        />
      </Pressable>
      {pronta &&
        posicoes.map(({ loja: l, x, y }) => (
          <Pressable
            key={l.id}
            onPress={() => escolher(aberta === l.id ? null : l.id)}
            role="button"
            aria-label={l.nome}
            aria-expanded={aberta === l.id}
            style={{
              position: 'absolute',
              left: x - LARGURA_DO_PINO / 2,
              top: y - ALTURA_DO_PINO,
            }}
          >
            <PinoDaCasa nome={l.nome} escolhido={aberta === l.id} />
          </Pressable>
        ))}
      {pronta && escolhida && (
        <BalaoNaImagem
          loja={escolhida.loja}
          sitio={escolhida}
          outras={posicoes.filter((p) => p !== escolhida).map((p) => ({ ...p, nome: p.loja.nome }))}
          largura={w}
          altura={h}
          aoIr={() => aoIr(escolhida.loja)}
        />
      )}
    </View>
  );
}

/**
 * Na imagem o mapa não anda: o balão encosta às bordas quando o pino está perto delas, e passa
 * para baixo do nome quando não cabe em cima (ou quando em cima tapa outra casa).
 */
function BalaoNaImagem({
  loja,
  sitio: { x, y },
  outras,
  largura,
  altura,
  aoIr,
}: {
  loja: Loja;
  sitio: { x: number; y: number };
  outras: { x: number; y: number; nome: string }[];
  largura: number;
  altura: number;
  aoIr: () => void;
}) {
  const w = larguraDoBalao(loja);
  const esquerda = Math.min(Math.max(FOLGA_NA_BORDA, x - w / 2), largura - FOLGA_NA_BORDA - w);
  const cabeEmCima = y + cimoDoBalao(false) >= FOLGA_NA_BORDA;
  const cabeEmBaixo = y + cimoDoBalao(true) + ALTURA_DO_BALAO <= altura - FOLGA_NA_BORDA;
  const porBaixo = !cabeEmCima || (cabeEmBaixo && balaoPorBaixo(loja, { x, y }, outras));
  return (
    <View style={{ position: 'absolute', left: esquerda, top: y + cimoDoBalao(porBaixo) }}>
      <BalaoDaCasa loja={loja} aoIr={aoIr} seta={x - esquerda} emBaixo={porBaixo} />
    </View>
  );
}

/**
 * As casas em lista, quando o mapa não as pode mostrar: sem ela, um mapa que não veio
 * deixava a Barbearia sem moradas nem «Marcar» (visto a 7 nov, com a Apple a responder
 * 403 no servidor local). E as casas ainda sem sítio, por baixo do mapa.
 */
function ListaDasCasas({
  lojas,
  aoIr,
  depoisDoMapa = false,
}: {
  lojas: Loja[];
  aoIr: (loja: Loja) => void;
  depoisDoMapa?: boolean;
}) {
  const t = useTextos();
  return (
    <Grupo style={depoisDoMapa ? { marginTop: 14 } : undefined}>
      {lojas.map((l, i) => (
        <View key={l.id}>
          {i > 0 && <Separador recuo={16} />}
          <View style={{ padding: 16, gap: 4 }}>
            <T v="forte" numberOfLines={1}>
              {l.nome}
            </T>
            {!!l.morada && (
              <T v="legenda" style={{ color: cor.texto2 }}>
                {semPartir(l.morada)}
              </T>
            )}
            {(!!l.marcar || !!l.morada) && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {!!l.marcar && (
                  <Pilula
                    nome={t.mapa.marcar}
                    rotulo={t.mapa.marcarEm(l.nome)}
                    principal
                    onPress={() => {
                      contar('marcar', l.id);
                      abrir(l.marcar);
                    }}
                  />
                )}
                {!!l.morada && (
                  <Pilula nome={t.mapa.ir} rotulo={t.mapa.irA(l.nome)} onPress={() => aoIr(l)} />
                )}
              </View>
            )}
          </View>
        </View>
      ))}
    </Grupo>
  );
}
