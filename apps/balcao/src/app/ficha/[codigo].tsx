import {
  codigoCurto,
  codigoValido,
  dataCurta,
  diaEmLisboa,
  diasEntre,
  fraseDesteCorte,
  fraseDoCartao,
  normalizarCodigo,
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
  dispensarRecusa,
  entregarPrenda,
  fichaVista,
  guardarNaFila,
  lerFila,
  lerRecusas,
  mensagemDe,
  pedir,
  semRemedio,
  useCasa,
  useEu,
  useFicha,
  useFila,
  useHoje,
  useRecusas,
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
  /** Sem ficha nem nada guardado (sem rede), o título é o código: «1 de 10» seria inventado. */
  titulo?: string;
  nome?: string;
};

export default function Ficha() {
  const { codigo, semLeitura, carimbo, recusa } = useLocalSearchParams<{
    codigo: string;
    semLeitura?: string;
    /** Aberta de uma linha do «Hoje»: o id desse carimbo. */
    carimbo?: string;
    /** Aberta dos «Não entraram»: a chave do carimbo recusado. */
    recusa?: string;
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
  const filaTexto = useFila();
  // Aberta de uma linha do «Hoje», a ficha mostra esse carimbo e só deixa anulá-lo: o «Carimbar na
  // mesma» estava onde se carrega para carimbar, e um toque à pressa dava outro (o Renato, 9 nov).
  const carimboId = carimbo && /^\d+$/.test(carimbo) ? Number(carimbo) : null;
  const daLinhaDoHoje = carimboId !== null;
  const { data: hojeDaCasa } = useHoje(casa, !!eu && daLinhaDoHoje);
  const doHoje = hojeDaCasa?.ultimos.find((u) => u.id === carimboId) ?? null;
  // Quem carimbou anula até ao instante que o servidor diz; o dono sempre.
  const podeAnular =
    !!doHoje &&
    !doHoje.anulado &&
    !!eu &&
    (eu.pessoa.papel === 'dono' ||
      (doHoje.pessoaId === eu.pessoa.id && Date.now() / 1000 < doHoje.anulavelAte));
  // Aberta dos «Não entraram»: é aqui que se carimba na mesma ou se dispensa.
  const recusasTexto = useRecusas();
  const comRecusa = !!recusa && !!recusasTexto && lerRecusas().some((r) => r.chave === recusa);
  const [confirmar, folhaDeConfirmacao] = useConfirmacao();
  const [estado, setEstado] = useState<'pronto' | 'a-enviar' | 'feito' | 'na-fila' | 'erro'>(
    'pronto',
  );
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

  // Sem rede a ficha não abre, mas o código lido chega para carimbar: a letra de controlo diz se é um cartão.
  const codigoLimpo = normalizarCodigo(codigo ?? '');
  const codigoOk = codigoValido(codigoLimpo);
  const vista = !ficha && codigoOk ? fichaVista(codigoLimpo) : null;
  // Os carimbos deste cartão ainda na fila sem rede contam como dados: nos círculos, no número e no «já hoje».
  const naFila =
    filaTexto && codigoOk ? lerFila().filter((p) => p.codigo === codigoLimpo).length : 0;
  const carimbos = (ficha?.cartao.carimbos ?? 0) + naFila;
  // Os 10 círculos numa linha cabem nas margens em qualquer largura (a 320 px eram 334 px).
  const tamanho = Math.min(
    28,
    Math.floor((Math.min(width, LARGURA_MAXIMA) - 2 * MARGEM - 9 * 6) / 10),
  );
  // Com o limite do dia já atingido, o botão diz logo «Carimbar na mesma»: antes só o dizia depois de
  // a API recusar, e o barbeiro tinha de carregar duas vezes.
  const jaHoje = !!ficha && ficha.hoje.carimbos + naFila >= (eu?.programa.porDia ?? 1);
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
        pessoaId: eu?.pessoa.id,
      });
      if ('naFila' in r) {
        setEstado('na-fila');
        setFeito({
          carimbos: carimbos + 1,
          objectivo: ficha.cartao.objectivo,
          completo: false,
          recompensa: null,
        });
      } else {
        setEstado('feito');
        vibrar(r.resultado.completo ? 'festa' : 'feito');
        setFeito({
          carimbos: r.resultado.cartao.carimbos,
          objectivo: r.resultado.cartao.objectivo,
          completo: r.resultado.completo,
          recompensa: r.resultado.recompensa,
        });
      }
      Animated.spring(escala, { toValue: 1, useNativeDriver: false, friction: 5 }).start();
      // Com um prémio fica até «Concluir»: o barbeiro tem de o dizer ao cliente.
      if (!('resultado' in r && r.resultado.completo)) concluir();
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

  /** A ficha não abriu por falta de rede: o carimbo vai para a fila só com o código, a chave e a casa. */
  const guardarSemRede = () => {
    if (!codigoOk || !casa || estado === 'na-fila') return;
    guardarNaFila({
      codigo: codigoLimpo,
      chave: chave.current,
      lojaId: casa,
      confirmar: false,
      semLeitura: semLeitura === '1',
      pessoaId: eu?.pessoa.id,
    });
    setEstado('na-fila');
    setFeito({
      carimbos: (vista?.carimbos ?? 0) + naFila + 1,
      objectivo: vista?.objectivo ?? eu?.programa.objectivo ?? 10,
      completo: false,
      recompensa: null,
      titulo: vista ? undefined : codigoCurto(codigoLimpo),
      nome: vista?.nome || undefined,
    });
    Animated.spring(escala, { toValue: 1, useNativeDriver: false, friction: 5 }).start();
    concluir();
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

  const dispensar = () => {
    if (recusa) dispensarRecusa(recusa);
    sair();
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
      {!ficha && error && estado !== 'na-fila' && (
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
          {/* O que se sabe do cartão sem rede: o nome da última vez, ou só o código. */}
          {error instanceof ErroDaBalcao && error.codigo === 'rede' && codigoOk && (
            <T v="legenda" style={{ color: cor.texto2, textAlign: 'center', marginTop: -6 }}>
              {[vista?.nome, codigoCurto(codigoLimpo)].filter(Boolean).join(' · ')}
            </T>
          )}
          {semRemedio(error) ? (
            <Botao nome={ui.fechar} secundario onPress={sair} />
          ) : (
            <>
              {/* Sem rede carimba-se na mesma: a fila leva o código, a chave e a casa, e envia depois.
                  Vinda do «Hoje» não: aí só se vê um carimbo já dado. */}
              {error instanceof ErroDaBalcao &&
                error.codigo === 'rede' &&
                codigoOk &&
                !!casa &&
                !daLinhaDoHoje && <Botao nome={t.ficha.carimbarSemRede} onPress={guardarSemRede} />}
              <Botao nome={ui.tentarOutraVez} secundario onPress={() => refetch()} />
            </>
          )}
        </View>
      )}

      {(estado === 'feito' || estado === 'na-fila') && feito && (
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
              nome={feito.completo || feito.recompensa ? 'presente' : 'certo'}
              tamanho={56}
              cor={cor.sobreClaro}
              espessura={2.6}
            />
          </Animated.View>
          <T v="titulo" style={{ marginTop: 28, textAlign: 'center' }}>
            {feito.titulo ??
              (feito.recompensa && !feito.completo
                ? feito.recompensa
                : feito.completo
                  ? t.ficha.cartaoCompleto
                  : t.geral.carimbosDe(feito.carimbos, feito.objectivo))}
          </T>
          {!!feito.nome && (
            <T v="subtitulo" style={{ color: cor.texto2, marginTop: 8, textAlign: 'center' }}>
              {feito.nome}
            </T>
          )}
          {feito.completo && feito.recompensa && (
            <T v="subtitulo" style={{ color: cor.texto2, marginTop: 8, textAlign: 'center' }}>
              {fraseDesteCorte(feito.recompensa, lingua)}
            </T>
          )}
          {estado === 'na-fila' && (
            <T v="legenda" style={{ color: cor.texto2, marginTop: 10 }}>
              {t.ficha.semRedeGuardado}
            </T>
          )}
          <View style={{ marginTop: 28 }}>
            <Botao nome={t.geral.concluir} onPress={sair} />
          </View>
        </View>
      )}

      {ficha && estado !== 'feito' && estado !== 'na-fila' && (
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
            {naFila > 0 && (
              <T v="legenda" style={{ color: cor.texto2, paddingHorizontal: MARGEM, marginTop: 6 }}>
                {t.ficha.porEnviar(naFila)}
              </T>
            )}

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
            {/* Ao 9.º (sem carimbo hoje) este corte é o grátis; e também quando o 10.º já está na fila por enviar. */}
            {!daLinhaDoHoje &&
              (carimbos === ficha.cartao.objectivo - 1
                ? !jaHoje
                : naFila > 0 && carimbos >= ficha.cartao.objectivo) && (
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
                  {comRecusa && <Botao nome={t.ficha.dispensar} secundario onPress={dispensar} />}
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
