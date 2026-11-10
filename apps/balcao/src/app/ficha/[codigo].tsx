import {
  codigoCurto,
  dataCurta,
  diaEmLisboa,
  diasEntre,
  fraseDesteCorte,
  fraseDoCartao,
  recompensaNaLingua,
  type Lingua,
} from '@nunos-lab/dominio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useConfirmacao } from '../../componentes/confirmar';
import {
  carimbar,
  chaveNova,
  entregarPremioAMeio,
  entregarPrenda,
  mensagemDe,
  pedir,
  semRemedio,
  useCasa,
  useEu,
  useFicha,
  useHoje,
  ErroDaBalcao,
} from '../../sessao';
import {
  Botao,
  CONTINUO,
  Carimbos,
  Icone,
  LARGURA_MAXIMA,
  MARGEM,
  T,
  cor,
  useLingua,
  useTextosDaUi,
  vibrar,
} from '@nunos-lab/ui';
import { useTextos, type Textos } from '../../textos';

function haQuanto(unix: number, t: Textos, lingua: Lingua): string {
  // Dias de calendário em Lisboa: ontem às 23 h é «ontem», não «hoje».
  const dias = diasEntre(diaEmLisboa(unix * 1000), diaEmLisboa());
  if (dias === 0) return t.ficha.hoje;
  if (dias === 1) return t.ficha.ontem;
  if (dias < 14) return t.ficha.haDias(dias);
  if (dias < 60) return t.ficha.haSemanas(Math.round(dias / 7));
  return dataCurta(diaEmLisboa(unix * 1000), diaEmLisboa(), lingua);
}

/**
 * A ficha de um cartão lido: o nome, os carimbos, a última visita, e um toque
 * para carimbar ou entregar a recompensa. Depois do carimbo, o ecrã confirma e
 * fecha sozinho.
 */
type Feito = {
  carimbos: number;
  objectivo: number;
  completo: boolean;
  recompensa: string | null;
  /** Este carimbo ganhou o prémio a meio: o barbeiro di-lo ao cliente (e pode logo entregá-lo). */
  premioAMeio: string | null;
};

export default function Ficha() {
  const { codigo, semLeitura, carimbo } = useLocalSearchParams<{
    codigo: string;
    semLeitura?: string;
    /** Aberta de uma linha do «Hoje»: o id desse carimbo. */
    carimbo?: string;
  }>();
  const t = useTextos();
  const ui = useTextosDaUi();
  const lingua = useLingua();
  const margens = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const consultas = useQueryClient();
  const { data: eu } = useEu();
  const casa = useCasa(eu);
  const { data: ficha, error, refetch, isPending } = useFicha(codigo ?? '');
  // Aberta de uma linha do «Hoje», a ficha mostra esse carimbo e só deixa anulá-lo: o «Carimbar na
  // mesma» estava onde se carrega para carimbar, e um toque à pressa dava outro (o Renato, 9 nov).
  const carimboId = carimbo && /^\d+$/.test(carimbo) ? Number(carimbo) : null;
  const daLinhaDoHoje = carimboId !== null;
  const { data: hojeDaCasa } = useHoje(casa, !!eu && daLinhaDoHoje);
  const doHoje = hojeDaCasa?.ultimos.find((u) => u.id === carimboId) ?? null;
  // Quem carimbou anula até ao instante que o servidor diz; o dono sempre. O carimbo do prémio (o que
  // completou o cartão) só o dono: o corte grátis dado e anulado voltava a contar (revisão de 9 nov).
  const podeAnular =
    !!doHoje &&
    !doHoje.anulado &&
    !!eu &&
    (eu.pessoa.papel === 'dono' ||
      (doHoje.pessoaId === eu.pessoa.id &&
        Date.now() / 1000 < doHoje.anulavelAte &&
        !doHoje.recompensa));
  const [confirmar, folhaDeConfirmacao] = useConfirmacao();
  const [estado, setEstado] = useState<'pronto' | 'a-enviar' | 'feito' | 'erro'>('pronto');
  const [feito, setFeito] = useState<Feito | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{
    quando: number;
    pessoa: string | null;
    entregue?: boolean;
  } | null>(null);
  const escala = useRef(new Animated.Value(0.6)).current;
  const chave = useRef(chaveNova());
  // O «Concluir» automático: limpa-se ao sair e ao desmontar, para não fechar o ecrã seguinte.
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(temporizador.current ?? undefined), []);

  const carimbos = ficha?.cartao.carimbos ?? 0;
  // Os 10 círculos numa linha cabem nas margens em qualquer largura (a 320 px eram 334 px).
  const tamanho = Math.min(
    28,
    Math.floor((Math.min(width, LARGURA_MAXIMA) - 2 * MARGEM - 9 * 6) / 10),
  );
  // Com o limite do dia já atingido, o botão diz logo «Carimbar na mesma»: antes só o dizia depois de
  // a API recusar, e o barbeiro tinha de carregar duas vezes.
  const jaHoje = !!ficha && ficha.hoje.carimbos >= (eu?.programa.porDia ?? 1);
  // O prémio a meio por entregar (a API de antes de 10 nov não o mandava).
  const premioAMeio = ficha?.premiosAMeio?.[0] ?? null;
  const meioDoCartao = ficha?.cartao.meio ?? null;
  // O prémio entregue hoje: o corte grátis não leva carimbo, e carimbar pede confirmação.
  const entregueHoje = ficha?.hoje.entregue ?? null;
  const precisaConfirmar = jaHoje || !!entregueHoje;
  // A caixa do aviso: o 409 traz a hora e a pessoa mais frescas do que a ficha.
  const ultimoDeHoje = aviso?.quando && !aviso.entregue ? aviso : (ficha?.hoje.ultimo ?? null);
  const entregue = aviso?.quando && aviso.entregue ? aviso : entregueHoje;
  const sair = () => {
    clearTimeout(temporizador.current ?? undefined);
    return router.canGoBack() ? router.back() : router.replace('/');
  };
  const concluir = () => {
    consultas.invalidateQueries({ queryKey: ['balcao', 'hoje'] });
    // 1,4 s passava despercebido e o barbeiro carregava outra vez; 3 s, e o «Concluir» para quem tem pressa.
    temporizador.current = setTimeout(sair, 3000);
  };

  const dar = async (confirmar = false) => {
    if (!ficha || !casa || estado === 'a-enviar') return;
    setEstado('a-enviar');
    setErro(null);
    try {
      const r = await carimbar({
        codigo: ficha.cliente.codigo,
        chave: chave.current,
        lojaId: casa,
        confirmar,
        semLeitura: semLeitura === '1',
      });
      setEstado('feito');
      vibrar(r.completo || r.premioAMeio ? 'festa' : 'feito');
      setFeito({
        carimbos: r.cartao.carimbos,
        objectivo: r.cartao.objectivo,
        completo: r.completo,
        recompensa: r.recompensa,
        premioAMeio: r.premioAMeio ?? null,
      });
      Animated.spring(escala, { toValue: 1, useNativeDriver: false, friction: 5 }).start();
      // Com um prémio fica até «Concluir»: o barbeiro tem de o dizer ao cliente.
      if (!r.completo && !r.premioAMeio) concluir();
    } catch (e) {
      if (
        e instanceof ErroDaBalcao &&
        (e.codigo === 'limite_do_dia' || e.codigo === 'entregue_hoje')
      ) {
        setAviso({
          ...((e.dados.ultimo as { quando: number; pessoa: string | null } | undefined) ?? {
            quando: 0,
            pessoa: null,
          }),
          entregue: e.codigo === 'entregue_hoje',
        });
        setEstado('pronto');
        return;
      }
      setEstado('erro');
      setErro(mensagemDe(e));
    }
  };

  /** A prenda de anos: a API devolve a ficha já com «entregue às…», e o botão desaparece. */
  const entregar = async () => {
    if (!ficha || !casa || estado === 'a-enviar') return;
    setEstado('a-enviar');
    setErro(null);
    try {
      const nova = await entregarPrenda({ codigo: ficha.cliente.codigo, lojaId: casa });
      consultas.setQueryData(['balcao', 'ficha', codigo], nova);
      vibrar('feito');
      setEstado('pronto');
    } catch (e) {
      setEstado('pronto');
      setErro(mensagemDe(e));
      // Alguém a entregou entretanto, ou a prenda já não é de hoje: a ficha fresca diz o que se passa.
      if (
        e instanceof ErroDaBalcao &&
        (e.codigo === 'sem_prenda' || e.codigo === 'prenda_entregue')
      )
        refetch();
    }
  };

  /** O prémio a meio: como a prenda, a API devolve a ficha já com «entregue às…», e o botão desaparece. */
  const entregarMeio = async (cartaoId: number) => {
    if (!ficha || !casa || estado === 'a-enviar') return;
    setEstado('a-enviar');
    setErro(null);
    try {
      const nova = await entregarPremioAMeio({
        codigo: ficha.cliente.codigo,
        cartaoId,
        lojaId: casa,
      });
      consultas.setQueryData(['balcao', 'ficha', codigo], nova);
      vibrar('feito');
      setEstado('pronto');
    } catch (e) {
      setEstado('pronto');
      setErro(mensagemDe(e));
      // Outro barbeiro entregou-o entretanto: a ficha fresca já o diz.
      if (e instanceof ErroDaBalcao && e.codigo === 'premio_a_meio_entregue') refetch();
    }
  };

  const usar = async (cartaoId: number) => {
    if (!ficha || !casa || estado === 'a-enviar') return;
    setEstado('a-enviar');
    setErro(null);
    try {
      await pedir('/usar-recompensa', {
        metodo: 'POST',
        corpo: { codigo: ficha.cliente.codigo, cartaoId, lojaId: casa },
      });
      setEstado('feito');
      setFeito({
        carimbos: ficha.cartao.carimbos,
        objectivo: ficha.cartao.objectivo,
        completo: false,
        recompensa: t.ficha.recompensaEntregue(
          ficha.recompensas[0] && recompensaNaLingua(ficha.recompensas[0].recompensa, lingua),
        ),
        premioAMeio: null,
      });
      Animated.spring(escala, { toValue: 1, useNativeDriver: false, friction: 5 }).start();
      concluir();
    } catch (e) {
      setEstado('erro');
      setErro(mensagemDe(e));
    }
  };

  const hora = (unix: number) => {
    const d = new Date(unix * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const anular = async () => {
    if (!doHoje || estado === 'a-enviar') return;
    const sim = await confirmar({
      titulo: t.ficha.anularOCarimbo(doHoje.cliente || '', hora(doHoje.quando)),
      accao: t.geral.anular,
    });
    if (!sim) return;
    setEstado('a-enviar');
    setErro(null);
    try {
      await pedir('/anular', { metodo: 'POST', corpo: { carimboId: doHoje.id } });
      consultas.invalidateQueries({ queryKey: ['balcao', 'ficha', codigo] });
      // Fecha com a lista nova: a linha chega ao «Hoje» já riscada.
      await consultas.invalidateQueries({ queryKey: ['balcao', 'hoje'] });
      sair();
    } catch (e) {
      setEstado('pronto');
      setErro(mensagemDe(e));
    }
  };
  // A prenda entregue: «às 15:12» hoje, «a 3 nov» noutro dia.
  const prendaEntregueHoje =
    !!ficha?.prendaEntregue && diaEmLisboa(ficha.prendaEntregue.quando * 1000) === diaEmLisboa();

  return (
    <View style={{ flex: 1, backgroundColor: cor.fundo, paddingTop: margens.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: MARGEM,
          paddingTop: 10,
        }}
      >
        <Pressable
          onPress={sair}
          role="button"
          aria-label={ui.fechar}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: pressed ? cor.linha : cor.superficieAlta,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Icone nome="fechar" tamanho={20} espessura={2.4} />
        </Pressable>
        {ficha && (
          <T v="legenda" style={{ color: cor.texto3, marginLeft: 14, letterSpacing: 1.5 }}>
            {codigoCurto(ficha.cliente.codigo)}
          </T>
        )}
      </View>

      {!ficha && isPending && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <T v="legenda" style={{ color: cor.texto2 }}>
            {t.geral.aAbrir}
          </T>
        </View>
      )}
      {!ficha && error && (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            paddingHorizontal: 32,
          }}
        >
          <T v="subtitulo" style={{ textAlign: 'center' }}>
            {mensagemDe(error)}
          </T>
          {semRemedio(error) ? (
            <Botao nome={ui.fechar} secundario onPress={sair} />
          ) : (
            <Botao nome={ui.tentarOutraVez} secundario onPress={() => refetch()} />
          )}
        </View>
      )}

      {estado === 'feito' && feito && (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: MARGEM,
          }}
        >
          <Animated.View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: cor.claro,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: escala }],
            }}
          >
            <Icone
              nome={
                feito.completo || feito.recompensa
                  ? 'presente'
                  : feito.premioAMeio
                    ? 'saco'
                    : 'certo'
              }
              tamanho={56}
              cor={cor.sobreClaro}
              espessura={2.6}
            />
          </Animated.View>
          <T v="titulo" style={{ marginTop: 28, textAlign: 'center' }}>
            {feito.recompensa && !feito.completo
              ? feito.recompensa
              : feito.completo
                ? t.ficha.cartaoCompleto
                : feito.premioAMeio
                  ? feito.premioAMeio
                  : t.geral.carimbosDe(feito.carimbos, feito.objectivo)}
          </T>
          {feito.premioAMeio && (
            <T v="subtitulo" style={{ color: cor.texto2, marginTop: 8, textAlign: 'center' }}>
              {t.ficha.ganhouPremioAMeio}
            </T>
          )}
          {feito.completo && feito.recompensa && (
            <T v="subtitulo" style={{ color: cor.texto2, marginTop: 8, textAlign: 'center' }}>
              {fraseDesteCorte(feito.recompensa, lingua)}
            </T>
          )}
          <View style={{ marginTop: 28 }}>
            <Botao nome={t.geral.concluir} onPress={sair} />
          </View>
        </View>
      )}

      {ficha && estado !== 'feito' && (
        <View style={{ flex: 1, width: '100%', maxWidth: LARGURA_MAXIMA, alignSelf: 'center' }}>
          {/* A ficha lê-se de cima; as acções ficam presas ao fundo, à mão. */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ paddingHorizontal: MARGEM, paddingTop: 24, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T v="titulo" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {ficha.cliente.nome || t.geral.semNome}
                </T>
                {ficha.cliente.aniversario && (
                  <View
                    style={{
                      backgroundColor: cor.claro,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      flexDirection: 'row',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    <Icone nome="bolo" tamanho={16} cor={cor.sobreClaro} espessura={2.2} />
                    <T v="legenda" style={{ color: cor.sobreClaro }}>
                      {t.ficha.fazAnos}
                    </T>
                  </View>
                )}
              </View>
              <T v="legenda" style={{ color: cor.texto2 }}>
                {t.ficha.clienteDesde(
                  new Date(ficha.cliente.criadoEm * 1000).getFullYear(),
                  ficha.cliente.cortes,
                  ficha.cartao.numero - 1,
                )}
              </T>
            </View>

            <View style={{ paddingHorizontal: MARGEM, marginTop: 22 }}>
              <Carimbos
                carimbos={carimbos}
                objectivo={ficha.cartao.objectivo}
                meio={meioDoCartao?.carimbos ?? null}
                tamanho={tamanho}
                porLinha={10}
                folga={6}
              />
            </View>
            <View
              style={{
                paddingHorizontal: MARGEM,
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 6,
                marginTop: 18,
              }}
            >
              <T v="destaque">{carimbos}</T>
              <T v="forte" style={{ color: cor.texto2, fontSize: 18 }}>
                {t.ficha.deObjectivo(ficha.cartao.objectivo)}
              </T>
              {/* Aos 9 a faixa creme já diz «Este corte é grátis»: «O próximo corte é grátis» aqui contradizia-a. */}
              {carimbos !== ficha.cartao.objectivo - 1 && (
                <T v="legenda" style={{ color: cor.texto2, marginLeft: 8 }}>
                  {fraseDoCartao(carimbos, ficha.cartao, lingua)}
                </T>
              )}
            </View>

            <View
              style={{
                paddingHorizontal: MARGEM,
                marginTop: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icone nome="relogio" tamanho={16} cor={cor.texto2} espessura={2} />
              <T v="legenda" style={{ color: cor.texto2, flex: 1 }}>
                {doHoje
                  ? doHoje.anulado
                    ? t.ficha.carimboAnulado(hora(doHoje.quando))
                    : t.ficha.carimbadoAs(hora(doHoje.quando), doHoje.pessoa)
                  : ficha.ultima
                    ? [
                        t.ficha.ultimaVisita(haQuanto(ficha.ultima.quando, t, lingua)),
                        ficha.ultima.loja,
                        ficha.ultima.pessoa,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : t.ficha.primeiraVisita}
              </T>
            </View>

            {ficha.prenda && !daLinhaDoHoje && (
              <View
                style={{
                  marginHorizontal: MARGEM,
                  marginTop: 14,
                  backgroundColor: cor.claro,
                  borderRadius: 16,
                  padding: 12,
                  gap: 10,
                  ...CONTINUO,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Icone nome="bolo" tamanho={18} cor={cor.sobreClaro} espessura={2.2} />
                  <T v="forte" style={{ flex: 1, color: cor.sobreClaro }}>
                    {t.ficha.prendaDeAnos(ficha.prenda)}
                  </T>
                </View>
                {/* Entregar fica registado (quem e quando): a prenda é uma por ano. */}
                <Pressable
                  onPress={entregar}
                  role="button"
                  aria-disabled={estado === 'a-enviar'}
                  style={({ pressed }) => ({
                    height: 44,
                    borderRadius: 999,
                    backgroundColor: pressed ? cor.superficieAlta : cor.sobreClaro,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: estado === 'a-enviar' ? 0.6 : 1,
                  })}
                >
                  <T v="forte" style={{ color: cor.claro, fontSize: 15 }}>
                    {t.ficha.entregarAPrenda}
                  </T>
                </Pressable>
              </View>
            )}
            {!ficha.prenda && ficha.prendaEntregue && (
              <View
                style={{
                  paddingHorizontal: MARGEM,
                  marginTop: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icone nome="bolo" tamanho={16} cor={cor.texto2} espessura={2} />
                <T v="legenda" style={{ color: cor.texto2, flex: 1 }}>
                  {t.ficha.prendaEntregue(
                    prendaEntregueHoje
                      ? hora(ficha.prendaEntregue.quando)
                      : dataCurta(
                          diaEmLisboa(ficha.prendaEntregue.quando * 1000),
                          diaEmLisboa(),
                          lingua,
                        ),
                    prendaEntregueHoje,
                    ficha.prendaEntregue.pessoa,
                  )}
                </T>
              </View>
            )}
            {/* O prémio a meio ganho (10 nov 2026): é num produto, entrega-se quando o cliente quiser. */}
            {premioAMeio && !daLinhaDoHoje && (
              <View
                style={{
                  marginHorizontal: MARGEM,
                  marginTop: 14,
                  backgroundColor: cor.claro,
                  borderRadius: 16,
                  padding: 12,
                  gap: 10,
                  ...CONTINUO,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Icone nome="saco" tamanho={18} cor={cor.sobreClaro} espessura={2.2} />
                  <T v="forte" style={{ flex: 1, color: cor.sobreClaro }}>
                    {t.ficha.premioAMeio(premioAMeio.carimbos, premioAMeio.recompensa)}
                  </T>
                </View>
                <Pressable
                  onPress={() => entregarMeio(premioAMeio.cartaoId)}
                  role="button"
                  aria-disabled={estado === 'a-enviar'}
                  style={({ pressed }) => ({
                    height: 44,
                    borderRadius: 999,
                    backgroundColor: pressed ? cor.superficieAlta : cor.sobreClaro,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: estado === 'a-enviar' ? 0.6 : 1,
                  })}
                >
                  <T v="forte" style={{ color: cor.claro, fontSize: 15 }}>
                    {t.ficha.entregarOPremio}
                  </T>
                </Pressable>
              </View>
            )}
            {!premioAMeio && ficha.premioAMeioEntregue && !daLinhaDoHoje && (
              <View
                style={{
                  paddingHorizontal: MARGEM,
                  marginTop: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icone nome="saco" tamanho={16} cor={cor.texto2} espessura={2} />
                <T v="legenda" style={{ color: cor.texto2, flex: 1 }}>
                  {t.ficha.premioAMeioEntregue(
                    ficha.premioAMeioEntregue.recompensa,
                    hora(ficha.premioAMeioEntregue.quando),
                    ficha.premioAMeioEntregue.pessoa,
                  )}
                </T>
              </View>
            )}
            {/* No corte antes do prémio a meio: este dá-o (o barbeiro pode logo falar do produto). */}
            {!daLinhaDoHoje &&
              meioDoCartao &&
              !meioDoCartao.ganho &&
              carimbos === meioDoCartao.carimbos - 1 &&
              !jaHoje && (
                <View
                  style={{
                    marginHorizontal: MARGEM,
                    marginTop: 14,
                    backgroundColor: cor.claro,
                    borderRadius: 16,
                    padding: 12,
                    flexDirection: 'row',
                    gap: 10,
                    alignItems: 'center',
                    ...CONTINUO,
                  }}
                >
                  <Icone nome="saco" tamanho={18} cor={cor.sobreClaro} espessura={2.2} />
                  <T v="forte" style={{ flex: 1, color: cor.sobreClaro }}>
                    {t.ficha.esteCorteDa(meioDoCartao.recompensa)}
                  </T>
                </View>
              )}
            {/* Ao 9.º (sem carimbo hoje) este corte é o grátis. */}
            {!daLinhaDoHoje && carimbos === ficha.cartao.objectivo - 1 && !jaHoje && (
              <View
                style={{
                  marginHorizontal: MARGEM,
                  marginTop: 14,
                  backgroundColor: cor.claro,
                  borderRadius: 16,
                  padding: 12,
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'center',
                  ...CONTINUO,
                }}
              >
                <Icone nome="presente" tamanho={18} cor={cor.sobreClaro} espessura={2.2} />
                <T v="forte" style={{ flex: 1, color: cor.sobreClaro }}>
                  {fraseDesteCorte(ficha.cartao.recompensa, lingua)}
                </T>
              </View>
            )}
            {!daLinhaDoHoje && (ficha.hoje.carimbos > 0 || aviso || entregueHoje) && (
              <View
                style={{
                  marginHorizontal: MARGEM,
                  marginTop: 14,
                  backgroundColor: cor.superficieAlta,
                  borderRadius: 16,
                  padding: 12,
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'center',
                  ...CONTINUO,
                }}
              >
                <Icone nome="atencao" tamanho={18} cor={cor.texto} espessura={2} />
                <T v="legenda" style={{ flex: 1 }}>
                  {ultimoDeHoje
                    ? t.ficha.jaCarimbadoAs(hora(ultimoDeHoje.quando), ultimoDeHoje.pessoa)
                    : entregue
                      ? t.ficha.premioEntregueHoje(
                          recompensaNaLingua(ficha.cartao.recompensa, lingua),
                          hora(entregue.quando),
                          entregue.pessoa,
                        )
                      : t.ficha.jaCarimbado}
                </T>
              </View>
            )}
          </ScrollView>
          {/* Vinda do «Hoje», a barra só aparece a quem pode anular (ou para dizer porque não anulou). */}
          {(!daLinhaDoHoje || podeAnular || !!erro) && (
            <View
              style={{
                backgroundColor: cor.superficie,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingHorizontal: MARGEM,
                paddingTop: 20,
                paddingBottom: margens.bottom + 20,
                gap: 12,
                ...CONTINUO,
              }}
            >
              {daLinhaDoHoje ? (
                podeAnular && (
                  <Pressable
                    onPress={anular}
                    role="button"
                    aria-disabled={estado === 'a-enviar'}
                    style={({ pressed }) => ({
                      height: 56,
                      borderRadius: 999,
                      backgroundColor: pressed ? cor.linha : cor.superficieAlta,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: estado === 'a-enviar' ? 0.6 : 1,
                    })}
                  >
                    <T v="forte" style={{ color: cor.perigo, fontSize: 17 }}>
                      {t.ficha.anularCarimbo}
                    </T>
                  </Pressable>
                )
              ) : (
                <>
                  {ficha.recompensas.length > 0 && (
                    <Pressable
                      onPress={() => usar(ficha.recompensas[0]!.cartaoId)}
                      role="button"
                      aria-disabled={estado === 'a-enviar'}
                      style={({ pressed }) => ({
                        height: 56,
                        borderRadius: 999,
                        backgroundColor: pressed ? cor.claroPremido : cor.claro,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        opacity: estado === 'a-enviar' ? 0.6 : 1,
                      })}
                    >
                      <Icone nome="presente" tamanho={22} cor={cor.sobreClaro} espessura={2.2} />
                      <T v="forte" style={{ color: cor.sobreClaro, fontSize: 17 }}>
                        {t.ficha.entregar(
                          recompensaNaLingua(ficha.recompensas[0]!.recompensa, lingua),
                        )}
                      </T>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => dar(!!aviso || precisaConfirmar)}
                    role="button"
                    aria-disabled={estado === 'a-enviar'}
                    style={({ pressed }) => ({
                      height: 56,
                      borderRadius: 999,
                      backgroundColor:
                        ficha.recompensas.length > 0 || aviso || precisaConfirmar
                          ? pressed
                            ? cor.linha
                            : cor.superficieAlta
                          : pressed
                            ? cor.claroPremido
                            : cor.claro,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      opacity: estado === 'a-enviar' ? 0.6 : 1,
                    })}
                  >
                    {/* O carimbo da prenda (o 10.º) leva a prenda no botão. */}
                    {carimbos === ficha.cartao.objectivo - 1 && (
                      <Icone
                        nome="presente"
                        tamanho={22}
                        cor={
                          ficha.recompensas.length > 0 || aviso || precisaConfirmar
                            ? cor.texto
                            : cor.sobreClaro
                        }
                        espessura={2.2}
                      />
                    )}
                    <T
                      v="forte"
                      style={{
                        color:
                          ficha.recompensas.length > 0 || aviso || precisaConfirmar
                            ? cor.texto
                            : cor.sobreClaro,
                        fontSize: 17,
                      }}
                    >
                      {aviso || precisaConfirmar
                        ? t.ficha.carimbarNaMesma
                        : estado === 'a-enviar'
                          ? t.ficha.aCarimbar
                          : t.ficha.carimbar}
                    </T>
                  </Pressable>
                </>
              )}
              {erro && (
                <T v="legenda" role="alert" style={{ color: '#E07A72', textAlign: 'center' }}>
                  {erro}
                </T>
              )}
            </View>
          )}
        </View>
      )}
      {folhaDeConfirmacao}
    </View>
  );
}
