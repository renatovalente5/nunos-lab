/**
 * A carteira (o Renato, 10 nov 2026): o saldo, o código para convidar e partilhar, quem já foi à
 * barbearia, o código de quem convidou (só antes do primeiro corte) e os movimentos, para o cliente
 * ver que o saldo está certo.
 */
import {
  codigoCurto,
  convitesQueFaltam,
  dataCurta,
  diaEmLisboa,
  euros,
  eurosComSinal,
  type MovimentoDoSaldo,
} from '@nunos-lab/dominio';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Platform, Pressable, Share, View } from 'react-native';
import { fraseDoMovimento } from '../carteira';
import { horaDe } from '../componentes/cartoes';
import { aceitarConvite, mensagemDe, useCarteira, useEuDaCache, useTemSessao } from '../conta';
import { definirTitulo, ligacaoDoConvite } from '../dados';
import {
  Botao,
  CONTINUO,
  Campo,
  Ecra,
  Esqueleto,
  Grupo,
  Icone,
  MARGEM,
  Rotulo,
  SemLigacao,
  Separador,
  T,
  cor,
  letra,
  raio,
  useLingua,
  type NomeDoIcone,
} from '@nunos-lab/ui';
import { useTextos, type Textos } from '../textos';

const ICONES: Record<MovimentoDoSaldo['tipo'], NomeDoIcone> = {
  convidado: 'presente',
  convite: 'pessoa',
  uso: 'tesoura',
  acerto: 'carteira',
};

function Voltar({ t }: { t: Textos }) {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      role="button"
      aria-label={t.parceiro.voltar}
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
      <Icone nome="voltar" tamanho={21} espessura={2.2} />
    </Pressable>
  );
}

/** Um movimento: o desenho, a frase, quando, e o valor (verde quando entrou; riscado se anulado). */
function LinhaDoMovimento({ m, novo, t }: { m: MovimentoDoSaldo; novo: boolean; t: Textos }) {
  const lingua = useLingua();
  // O movimento que o aviso trouxe acende-se uma vez, ao abrir.
  const [luz] = useState(() => new Animated.Value(novo ? 1 : 0));
  useEffect(() => {
    if (!novo) return;
    Animated.timing(luz, {
      toValue: 0,
      duration: 1800,
      delay: 450,
      useNativeDriver: false,
    }).start();
  }, [novo, luz]);
  const dia = diaEmLisboa(m.criadoEm * 1000);
  // A visita de um amigo diz-se pelo dia, não pela hora (a API já só manda o dia).
  const quando =
    m.tipo === 'convite'
      ? dataCurta(dia, diaEmLisboa(), lingua)
      : `${dataCurta(dia, diaEmLisboa(), lingua)} · ${horaDe(m.criadoEm)}`;
  const riscado = m.anulado ? ({ textDecorationLine: 'line-through' } as const) : null;
  const frase = fraseDoMovimento(m, t);
  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        backgroundColor: luz.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(48,209,88,0)', 'rgba(48,209,88,0.14)'],
        }),
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: cor.superficieAlta,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icone
          nome={ICONES[m.tipo] ?? 'carteira'}
          tamanho={18}
          espessura={2}
          cor={m.anulado ? cor.texto3 : cor.texto}
        />
      </View>
      <View style={{ flex: 1 }}>
        <T v="forte" style={[{ fontSize: 15, color: m.anulado ? cor.texto3 : cor.texto }, riscado]}>
          {frase}
        </T>
        <T v="legenda" style={{ color: cor.texto3, marginTop: 1 }}>
          {m.anulado ? `${quando} · ${t.carteira.anulado}` : quando}
        </T>
      </View>
      <T
        v="forte"
        style={[
          {
            fontSize: 15,
            fontVariant: ['tabular-nums'],
            color: m.anulado ? cor.texto3 : m.valor > 0 ? cor.aberto : cor.texto,
          },
          riscado,
        ]}
      >
        {eurosComSinal(m.valor, lingua)}
      </T>
    </Animated.View>
  );
}

export default function Carteira() {
  const t = useTextos();
  const lingua = useLingua();
  const temSessao = useTemSessao();
  const consultas = useQueryClient();
  const [focado, setFocado] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocado(true);
      return () => setFocado(false);
    }, []),
  );
  const { data: c, isPending, isError, refetch } = useCarteira(focado);
  // Quem ainda não cortou usa o saldo (as boas-vindas) com o primeiro corte.
  const { data: eu } = useEuDaCache();
  const { novo } = useLocalSearchParams<{ novo?: string }>();
  useEffect(() => definirTitulo(t.titulos.carteira), [t]);
  // Sem sessão (uma morada aberta à mão, ou saiu noutro sítio): o Cartão, onde se entra.
  useEffect(() => {
    if (!temSessao) router.replace('/cartao');
  }, [temSessao]);

  const [copiada, setCopiada] = useState(false);
  // Sem autorização para copiar: a ligação fica à vista, para a escolher à mão.
  const [ligacaoAVista, setLigacaoAVista] = useState(false);
  const [escrito, setEscrito] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const naWeb = Platform.OS === 'web';
  const partilhaDoBrowser =
    naWeb && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const usarCodigo = async () => {
    if (!escrito.trim() || aEnviar) return;
    setAEnviar(true);
    setErro(null);
    try {
      const nova = await aceitarConvite(escrito);
      consultas.setQueryData(['carteira'], nova);
      // O «eu» traz o movimento novo: o aviso do topo diz quanto entrou.
      void consultas.invalidateQueries({ queryKey: ['eu'] });
      setEscrito('');
    } catch (e) {
      setErro(mensagemDe(e));
      // Sem resposta, o código pode ter entrado: a carteira e o «eu» frescos dizem como ficou.
      void consultas.invalidateQueries({ queryKey: ['carteira'] });
      void consultas.invalidateQueries({ queryKey: ['eu'] });
    } finally {
      setAEnviar(false);
    }
  };

  if (!c)
    return (
      <Ecra comBarra={false}>
        <View style={{ paddingHorizontal: MARGEM }}>
          <Voltar t={t} />
        </View>
        {isError && !isPending ? <SemLigacao tentar={() => refetch()} /> : <Esqueleto />}
      </Ecra>
    );

  const { convites } = c;
  const codigo = convites.ligado ? convites.codigo : null;
  const valor = (centimos: number) => (centimos > 0 ? euros(centimos, lingua) : null);
  const faltam = convitesQueFaltam(convites.limite, convites.aceites);
  const ligacao = codigo ? ligacaoDoConvite(codigo) : '';
  const mensagem = codigo ? t.carteira.mensagem(valor(convites.valorConvidado), codigo) : '';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`${mensagem}\n${ligacao}`);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      setLigacaoAVista(true);
    }
  };
  const partilhar = () => {
    const r = naWeb
      ? navigator.share({ text: mensagem, url: ligacao })
      : Share.share(
          Platform.OS === 'ios'
            ? { message: mensagem, url: ligacao }
            : { message: `${mensagem}\n${ligacao}` },
        );
    r.catch(() => {});
  };

  return (
    <Ecra comBarra={false}>
      <View style={{ paddingHorizontal: MARGEM }}>
        <Voltar t={t} />
        <T v="titulo" style={{ marginTop: 22 }} role="heading" aria-level={1}>
          {t.carteira.titulo}
        </T>
      </View>

      {/* O saldo, grande. */}
      <View
        style={{
          marginHorizontal: MARGEM,
          marginTop: 18,
          paddingHorizontal: 22,
          paddingTop: 18,
          paddingBottom: 20,
          borderRadius: raio.cartao,
          backgroundColor: cor.superficie,
          ...CONTINUO,
        }}
      >
        <T v="legenda" style={{ color: cor.texto2 }}>
          {t.carteira.saldo}
        </T>
        <T
          v="destaque"
          style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}
          aria-label={`${t.carteira.saldo}: ${euros(c.saldo, lingua)}`}
        >
          {euros(c.saldo, lingua)}
        </T>
        <T v="corpo" style={{ color: cor.texto2, marginTop: 6 }}>
          {c.saldo < 0
            ? t.carteira.negativo
            : c.saldo > 0 && eu?.cortes === 0
              ? t.carteira.comPrimeiroCorte
              : t.carteira.comoUsar}
        </T>
      </View>

      {/* O código de quem convidou: só antes do primeiro corte, e logo aqui em cima (a faixa das Vantagens
          traz cá quem instalou a app sem passar pela ligação). */}
      {c.podeUsarCodigo && (
        <>
          <Rotulo>{t.carteira.temCodigo}</Rotulo>
          <View
            style={{
              marginHorizontal: MARGEM,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Campo
                value={escrito}
                onChangeText={(v) => {
                  setEscrito(v);
                  setErro(null);
                }}
                placeholder="ABCD 1234"
                aria-label={t.carteira.codigo}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                // A ligação do convite colada inteira também serve.
                maxLength={500}
                returnKeyType="done"
                onSubmitEditing={usarCodigo}
                erro={erro}
              />
            </View>
            <View style={{ paddingTop: 2 }}>
              <Botao
                nome={t.carteira.usar}
                onPress={usarCodigo}
                ocupado={aEnviar}
                inactivo={!escrito.trim()}
              />
            </View>
          </View>
        </>
      )}

      {/* Convidar: o que cada um ganha, o código e a partilha. No limite, nada para partilhar (o
          código já não seria aceite). */}
      {codigo && faltam === 0 && (
        <>
          <Rotulo>{t.carteira.convidaEGanha}</Rotulo>
          <Grupo style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Icone nome="presente" tamanho={22} espessura={2} cor={cor.texto3} />
              <T v="corpo" style={{ flex: 1, fontSize: 16, lineHeight: 22, color: cor.texto2 }}>
                {t.carteira.podesConvidarMais(0)}
              </T>
            </View>
          </Grupo>
        </>
      )}
      {codigo && faltam !== 0 && (
        <>
          <Rotulo>{t.carteira.convidaEGanha}</Rotulo>
          <Grupo style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Icone nome="presente" tamanho={22} espessura={2} />
              <T v="corpo" style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>
                {t.carteira.regra(valor(convites.valorPadrinho), valor(convites.valorConvidado))}
              </T>
            </View>
            <View
              style={{
                marginTop: 16,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: cor.texto3,
                borderRadius: 16,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <T v="legenda" style={{ color: cor.texto2 }}>
                {t.carteira.codigo}
              </T>
              <T
                selectable
                style={{ fontFamily: letra.extra, fontSize: 24, letterSpacing: 2.5, marginTop: 2 }}
              >
                {codigoCurto(codigo)}
              </T>
            </View>
            <View style={{ marginTop: 14, gap: 10 }}>
              {(!naWeb || partilhaDoBrowser) && (
                <Botao nome={t.carteira.partilhar} icone="partilhar" onPress={partilhar} />
              )}
              {naWeb && (
                <Botao
                  nome={copiada ? t.carteira.copiada : t.carteira.copiarLigacao}
                  icone={copiada ? 'certo' : 'copiar'}
                  secundario={partilhaDoBrowser}
                  onPress={copiar}
                />
              )}
              {ligacaoAVista && (
                <T selectable v="legenda" style={{ color: cor.texto2, textAlign: 'center' }}>
                  {ligacao}
                </T>
              )}
            </View>
          </Grupo>
          {faltam !== null && (
            <T
              v="legenda"
              style={{ color: cor.texto3, marginHorizontal: MARGEM + 4, marginTop: 10 }}
            >
              {t.carteira.podesConvidarMais(faltam)}
            </T>
          )}
        </>
      )}

      {/* Quem aceitou, e quem já foi à barbearia. */}
      {convites.lista.length > 0 && (
        <>
          <Rotulo
            direita={
              <T v="legenda" style={{ color: cor.texto2 }}>
                {t.carteira.resumo(convites.aceites, convites.visitaram)}
              </T>
            }
          >
            {t.carteira.convidados}
          </Rotulo>
          <Grupo>
            {convites.lista.map((v, i) => (
              <View key={`${v.criadoEm}-${i}`}>
                {i > 0 && <Separador />}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                >
                  {/* Quem apagou a conta fica sem nome (a conta é anonimizada). */}
                  <T
                    v="forte"
                    style={{ flex: 1, color: v.nome ? cor.texto : cor.texto3 }}
                    numberOfLines={1}
                  >
                    {v.nome || t.carteira.contaApagada}
                  </T>
                  {v.visitouEm ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icone nome="certo" tamanho={16} cor={cor.aberto} espessura={2.4} />
                      <T v="legenda" style={{ color: cor.texto }}>
                        {v.premio > 0
                          ? `${t.carteira.jaFoi} · ${eurosComSinal(v.premio, lingua)}`
                          : t.carteira.jaFoi}
                      </T>
                    </View>
                  ) : (
                    <T v="legenda" style={{ color: cor.texto3 }}>
                      {t.carteira.aindaNaoFoi}
                    </T>
                  )}
                </View>
              </View>
            ))}
          </Grupo>
        </>
      )}

      {/* Os movimentos: para ver que o saldo está certo. */}
      <Rotulo>{t.carteira.movimentos}</Rotulo>
      {c.movimentos.length > 0 ? (
        <Grupo>
          {c.movimentos.map((m, i) => (
            <View key={m.id}>
              {i > 0 && <Separador recuo={64} />}
              <LinhaDoMovimento m={m} novo={String(m.id) === novo} t={t} />
            </View>
          ))}
        </Grupo>
      ) : (
        <T v="corpo" style={{ color: cor.texto3, marginHorizontal: MARGEM }}>
          {t.carteira.semMovimentos}
        </T>
      )}
    </Ecra>
  );
}
