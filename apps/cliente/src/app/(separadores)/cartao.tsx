import {
  codigoCurto,
  dataCurta,
  diaEmLisboa,
  recompensaNaLingua,
  textoDoQr,
  type Lingua,
} from '@nunos-lab/dominio';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCarimbosNovos } from '../../carimbos-novos';
import { CartaoDoCliente } from '../../componentes/cartao';
import { CabecalhoDoSeparador } from '../../componentes/cabecalho';
import { horaDe } from '../../componentes/cartoes';
import {
  APPLE_CLIENTE,
  GOOGLE_CLIENTE,
  abrirNaCarteira,
  carteirasDaqui,
  mensagemDe,
  moradaDeRetornoDaApple,
  useConta,
  useEu,
  useTemSessao,
} from '../../conta';
import { contar, definirTitulo, useDados } from '../../dados';
import {
  BotaoDaApple,
  BotaoDoGoogle,
  CONTINUO,
  Ecra,
  Grupo,
  Icone,
  LARGURA_MAXIMA,
  MARGEM,
  QR,
  Rotulo,
  Separador,
  T,
  cor,
  raio,
  useLingua,
  useTextosDaUi,
} from '@nunos-lab/ui';
import { useTextos } from '../../textos';
// Os selos oficiais, tal como a Apple e a Google os entregam (a 3x), na língua da app: não se
// redesenham nem se recolorem. A largura é a do PNG, para 144 px de altura.
const SELOS = {
  pt: {
    apple: { fonte: require('../../../assets/selos/adicionar-a-carteira-apple.png'), largura: 491 },
    google: {
      fonte: require('../../../assets/selos/adicionar-a-carteira-google.png'),
      largura: 628,
    },
  },
  en: {
    apple: { fonte: require('../../../assets/selos/add-to-apple-wallet.png'), largura: 455 },
    google: { fonte: require('../../../assets/selos/add-to-google-wallet.png'), largura: 521 },
  },
} as const;

// Array.from: um emoji não se parte a meio.
const primeiraLetra = (palavra?: string) => Array.from(palavra ?? '')[0] ?? '';

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return (primeiraLetra(p[0]) + primeiraLetra(p[1])).toUpperCase() || '·';
}

/** «14:05» se foi hoje, senão «28 out»: a última vez que o cartão veio da rede. */
function quandoFoi(instante: number, lingua: Lingua): string {
  const hoje = diaEmLisboa();
  const dia = diaEmLisboa(instante);
  return dia === hoje ? horaDe(instante / 1000) : dataCurta(dia, hoje, lingua);
}

export default function Cartao() {
  const t = useTextos();
  const lingua = useLingua();
  const temSessao = useTemSessao();
  // A cerimónia do carimbo novo, e os pedidos de 15 em 15 s, só com este separador à frente.
  const [focado, setFocado] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocado(true);
      return () => setFocado(false);
    }, []),
  );
  const { data: eu, isError, isFetching, dataUpdatedAt, refetch } = useEu(focado);
  const { data: dadosDaApp } = useDados();
  const { width } = useWindowDimensions();
  const largura = Math.min(width, LARGURA_MAXIMA) - MARGEM * 2;
  const [qrAberto, setQrAberto] = useState(false);
  useEffect(() => contar('cartao'), []);
  useEffect(() => definirTitulo(t.titulos.cartao), [t]);
  const { novasDesde, aoAcabar } = useCarimbosNovos(temSessao ? eu?.cartao : null, focado);
  // Com sessão e ainda sem «eu»: o cartão diz que está a carregar ou sem ligação, em vez de um «0 de 10» a mentir.
  const espera = !temSessao || eu ? null : isError && !isFetching ? 'sem-ligacao' : 'a-carregar';

  return (
    <Ecra>
      <CabecalhoDoSeparador titulo={t.cartao.titulo}>
        {temSessao && (
          // Sem <Link asChild>: o Slot espalha um estilo em função num objecto e o círculo perdia-se.
          <Pressable
            onPress={() => router.push('/conta')}
            role="link"
            aria-label={t.cartao.conta}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: pressed ? cor.linha : cor.superficieAlta,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            {eu?.nome ? (
              <T v="forte" style={{ fontSize: 15 }}>
                {iniciais(eu.nome)}
              </T>
            ) : (
              <Icone nome="pessoa" tamanho={20} espessura={2} />
            )}
          </Pressable>
        )}
      </CabecalhoDoSeparador>

      <View style={{ paddingHorizontal: MARGEM, marginTop: 18 }}>
        <CartaoDoCliente
          eu={temSessao ? (eu ?? null) : null}
          programa={dadosDaApp?.programa ?? null}
          recompensas={eu?.recompensas.length ?? 0}
          largura={largura}
          novasDesde={novasDesde}
          aoAcabar={aoAcabar}
          espera={espera}
          tentar={() => refetch()}
          rodape={
            temSessao && eu ? (
              <Carteiras
                apple={eu.wallet.apple && !eu.wallet.appleNaCarteira}
                google={eu.wallet.google}
              />
            ) : undefined
          }
        />
      </View>

      {!temSessao && <Entrar />}

      {temSessao && eu && (
        <>
          {eu.recompensas.length > 0 && (
            <View
              style={{
                marginHorizontal: MARGEM,
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                borderRadius: raio.grupo,
                backgroundColor: cor.claro,
                ...CONTINUO,
              }}
            >
              <Icone nome="presente" tamanho={24} cor={cor.sobreClaro} espessura={2} />
              <View style={{ flex: 1 }}>
                <T v="forte" style={{ color: cor.sobreClaro }}>
                  {eu.recompensas.length === 1
                    ? t.cartao.tensUma(recompensaNaLingua(eu.recompensas[0]!.recompensa, lingua))
                    : t.cartao.tensVarias(eu.recompensas.length)}
                </T>
                <T v="legenda" style={{ color: 'rgba(10,10,10,0.6)' }}>
                  {t.cartao.mostraOCartao}
                </T>
              </View>
            </View>
          )}

          <Pressable
            onPress={() => setQrAberto(true)}
            role="button"
            aria-label={t.cartao.verOCodigo}
            style={({ pressed }) => ({
              marginHorizontal: MARGEM,
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 18,
              padding: 16,
              borderRadius: raio.grupo,
              backgroundColor: pressed ? cor.superficieAlta : cor.superficie,
              ...CONTINUO,
            })}
          >
            <QR texto={textoDoQr(eu.codigo)} tamanho={128} margem={10} raio={14} />
            <View style={{ flex: 1 }}>
              {/* Com um espaço normal entre os dois grupos: o codigoCurto junta-os com um espaço
                  inseparável, e num ecrã estreito (ou com letra grande) o código partia-se a meio
                  de um grupo («8ZPP MC» / «DE»). Assim, se não couber, fica um grupo por linha. */}
              <T v="subtitulo" style={{ letterSpacing: 1.5 }}>
                {codigoCurto(eu.codigo).replace('\u00a0', ' ')}
              </T>
              <T v="legenda" style={{ color: cor.texto2, marginTop: 6 }}>
                {t.cartao.mostraAoBalcao}
              </T>
            </View>
          </Pressable>

          {eu.prenda && (
            <View
              style={{
                marginHorizontal: MARGEM,
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                borderRadius: raio.grupo,
                backgroundColor: cor.superficie,
                ...CONTINUO,
              }}
            >
              <Icone nome="bolo" tamanho={24} espessura={2} />
              <View style={{ flex: 1 }}>
                <T v="forte">{t.cartao.parabens}</T>
                <T v="legenda" style={{ color: cor.texto2 }}>
                  {eu.prenda}
                </T>
              </View>
            </View>
          )}

          {eu.visitas.length > 0 && (
            <>
              <Rotulo>{t.cartao.ultimasVisitas}</Rotulo>
              <Grupo>
                {eu.visitas.slice(0, 5).map((v, i) => (
                  <View key={v.id}>
                    {i > 0 && <Separador />}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <T v="forte">{v.loja ?? "Nuno's Lab"}</T>
                        {v.pessoa && (
                          <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
                            {v.pessoa}
                          </T>
                        )}
                      </View>
                      <T v="legenda" style={{ color: cor.texto2 }}>
                        {dataCurta(diaEmLisboa(v.quando * 1000), diaEmLisboa(), lingua)}
                      </T>
                    </View>
                  </View>
                ))}
              </Grupo>
            </>
          )}

          {eu.vales.length > 0 && (
            <>
              <Rotulo>{t.cartao.nosParceiros}</Rotulo>
              <Grupo>
                {eu.vales.slice(0, 5).map((v, i) => (
                  <View key={v.id}>
                    {i > 0 && <Separador />}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <T v="forte" numberOfLines={1}>
                          {v.parceiro}
                        </T>
                        <T
                          v="legenda"
                          style={{ color: cor.texto2, marginTop: 2 }}
                          numberOfLines={1}
                        >
                          {v.destaque} · {v.titulo}
                        </T>
                      </View>
                      <T v="legenda" style={{ color: cor.texto2 }}>
                        {dataCurta(diaEmLisboa(v.quando * 1000), diaEmLisboa(), lingua)}
                      </T>
                    </View>
                  </View>
                ))}
              </Grupo>
            </>
          )}

          {isError && (
            <T v="legenda" style={{ color: cor.texto3, textAlign: 'center', marginTop: 20 }}>
              {dataUpdatedAt
                ? t.cartao.semLigacaoDesde(
                    quandoFoi(dataUpdatedAt, lingua),
                    diaEmLisboa(dataUpdatedAt) === diaEmLisboa(),
                  )
                : t.cartao.semLigacao}
            </T>
          )}

          <QrEmGrande
            aberto={qrAberto}
            fechar={() => setQrAberto(false)}
            codigo={eu.codigo}
            nome={eu.nome}
          />
        </>
      )}
    </Ecra>
  );
}

/**
 * Os selos oficiais «Adicionar à Carteira Apple» e «Adicionar a Carteira do
 * Google», no fundo do cartão (o Renato quis os selos dentro do cartão): 48 pt
 * de altura (o mínimo que a Google pede, com 8 de folga à volta; a Apple pede um
 * décimo da altura) e a proporção de cada um. O passe actualiza-se a cada carimbo.
 */
const ALTURA_DO_SELO = 48;
function Carteiras({ apple, google }: { apple: boolean; google: boolean }) {
  const t = useTextos();
  const daqui = carteirasDaqui();
  const [aAbrir, setAAbrir] = useState<'apple' | 'google' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // O «A preparar…» fica 1,5 s; se o ecrã sair antes, o temporizador morre com ele.
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );
  const mostrarApple = apple && daqui.apple;
  const mostrarGoogle = google && daqui.google;
  if (!mostrarApple && !mostrarGoogle) return null;
  const abrir = async (qual: 'apple' | 'google') => {
    setAAbrir(qual);
    setErro(null);
    try {
      await abrirNaCarteira(qual);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      temporizador.current = setTimeout(() => setAAbrir(null), 1500);
    }
  };
  return (
    <View style={{ gap: 10, alignItems: 'flex-start' }}>
      {mostrarApple && (
        <Selo qual="apple" nome={t.cartao.adicionarApple} aAbrir={aAbrir} abrir={abrir} />
      )}
      {mostrarGoogle && (
        <Selo qual="google" nome={t.cartao.adicionarGoogle} aAbrir={aAbrir} abrir={abrir} />
      )}
      {aAbrir && (
        <T v="legenda" style={{ color: cor.texto2 }}>
          {t.cartao.aPreparar}
        </T>
      )}
      {erro && (
        <T v="legenda" role="alert" style={{ color: '#E07A72' }}>
          {erro}
        </T>
      )}
    </View>
  );
}

/** Um selo: a imagem oficial da língua da app, com a largura na proporção do PNG. */
function Selo({
  qual,
  nome,
  aAbrir,
  abrir,
}: {
  qual: 'apple' | 'google';
  nome: string;
  aAbrir: 'apple' | 'google' | null;
  abrir: (qual: 'apple' | 'google') => void;
}) {
  const selo = SELOS[useLingua()][qual];
  return (
    <Pressable
      onPress={() => abrir(qual)}
      role="button"
      aria-label={nome}
      aria-disabled={aAbrir !== null}
      aria-busy={aAbrir === qual}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Image
        source={selo.fonte}
        style={{ width: (ALTURA_DO_SELO * selo.largura) / 144, height: ALTURA_DO_SELO }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Pressable>
  );
}

/** Sem conta: um toque na Apple ou no Google e o cartão nasce. */
function Entrar() {
  const t = useTextos();
  const { entrarComGoogle, entrarComApple } = useConta();
  const [erro, setErro] = useState<string | null>(null);
  const [aEntrar, setAEntrar] = useState(false);
  const correr = async (f: () => Promise<void>) => {
    setAEntrar(true);
    setErro(null);
    try {
      await f();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setAEntrar(false);
    }
  };
  return (
    <View style={{ paddingHorizontal: MARGEM, marginTop: 26, gap: 12, alignItems: 'center' }}>
      <T v="corpo" style={{ color: cor.texto2, textAlign: 'center', marginBottom: 6 }}>
        {t.cartao.entraParaTer}
      </T>
      {APPLE_CLIENTE ? (
        <BotaoDaApple
          clienteId={APPLE_CLIENTE}
          redirectURI={moradaDeRetornoDaApple()}
          aoEntrar={(d) => correr(() => entrarComApple(d))}
        />
      ) : null}
      {GOOGLE_CLIENTE ? (
        <BotaoDoGoogle
          clienteId={GOOGLE_CLIENTE}
          aoEntrar={(c) => correr(() => entrarComGoogle(c))}
        />
      ) : null}
      {/* O cartão feito ao balcão junta-se pelo email provado; com a Apple a esconder o email nascia um segundo cartão. */}
      <T v="legenda" style={{ color: cor.texto3, textAlign: 'center', marginTop: 4 }}>
        {t.cartao.jaTensCartao}
      </T>
      {aEntrar && (
        <T v="legenda" style={{ color: cor.texto2 }}>
          {t.cartao.aEntrar}
        </T>
      )}
      {erro && (
        <T v="legenda" style={{ color: '#E07A72', textAlign: 'center' }} role="alert">
          {erro}
        </T>
      )}
    </View>
  );
}

/** O QR a ecrã inteiro, para ler ao balcão. */
function QrEmGrande({
  aberto,
  fechar,
  codigo,
  nome,
}: {
  aberto: boolean;
  fechar: () => void;
  codigo: string;
  nome: string;
}) {
  const ui = useTextosDaUi();
  const margens = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const lado = Math.min(width - 64, 340);
  return (
    <Modal visible={aberto} transparent animationType="fade" onRequestClose={fechar}>
      <Pressable
        onPress={fechar}
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: margens.top,
          paddingBottom: margens.bottom,
        }}
        aria-label={ui.fechar}
      >
        <QR texto={textoDoQr(codigo)} tamanho={lado} margem={0} raio={0} />
        <T v="titulo" style={{ color: '#0A0A0A', marginTop: 28, letterSpacing: 2 }}>
          {codigoCurto(codigo)}
        </T>
        {!!nome && (
          <T v="forte" style={{ color: '#6B6760', marginTop: 6 }}>
            {nome}
          </T>
        )}
      </Pressable>
    </Modal>
  );
}
