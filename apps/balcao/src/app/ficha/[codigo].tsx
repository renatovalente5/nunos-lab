import { codigoCurto, dataCurta, diaEmLisboa, fraseDoCartao } from '@nunos-lab/dominio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  carimbar,
  chaveNova,
  mensagemDe,
  pedir,
  semRemedio,
  useCasa,
  useEu,
  useFicha,
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
  raio,
  vibrar,
} from '@nunos-lab/ui';

function haQuanto(unix: number): string {
  const dias = Math.floor((Date.now() / 1000 - unix) / 86400);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 14) return `há ${dias} dias`;
  if (dias < 60) return `há ${Math.round(dias / 7)} semanas`;
  return dataCurta(diaEmLisboa(unix * 1000), diaEmLisboa());
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
  cupao?: { parceiro: string; destaque: string; titulo: string; validoAte: string } | null;
};

export default function Ficha() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const margens = useSafeAreaInsets();
  const consultas = useQueryClient();
  const { data: eu } = useEu();
  const casa = useCasa(eu);
  const { data: ficha, error, refetch, isPending } = useFicha(codigo ?? '');
  const [servico, setServico] = useState<number | null>(null);
  const [estado, setEstado] = useState<'pronto' | 'a-enviar' | 'feito' | 'na-fila' | 'erro'>(
    'pronto',
  );
  const [feito, setFeito] = useState<Feito | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ quando: number; pessoa: string | null } | null>(null);
  const escala = useRef(new Animated.Value(0.6)).current;
  const chave = useRef(chaveNova());

  useEffect(() => {
    if (eu?.programa.servicos && eu.servicos[0] && servico === null) setServico(eu.servicos[0].id);
  }, [eu, servico]);

  // Com o limite do dia já atingido, o botão diz logo «Carimbar na mesma»: antes só o dizia depois de
  // a API recusar, e o barbeiro tinha de carregar duas vezes.
  const jaHoje = !!ficha && ficha.hoje.carimbos >= (eu?.programa.porDia ?? 1);
  // O prémio entregue hoje: o corte grátis não leva carimbo, e carimbar pede confirmação.
  const entregueHoje = ficha?.hoje.entregue ?? null;
  const precisaConfirmar = jaHoje || !!entregueHoje;
  const sair = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const concluir = () => {
    consultas.invalidateQueries({ queryKey: ['balcao', 'hoje'] });
    // 1,4 s passava despercebido e o barbeiro carregava outra vez; 3 s, e o «Concluir» para quem tem pressa.
    setTimeout(sair, 3000);
  };

  const dar = async (confirmar = false) => {
    if (!ficha || !casa) return;
    setEstado('a-enviar');
    setErro(null);
    try {
      const r = await carimbar({
        codigo: ficha.cliente.codigo,
        chave: chave.current,
        lojaId: casa,
        servicoId: eu?.programa.servicos ? servico : null,
        confirmar,
      });
      if ('naFila' in r) {
        setEstado('na-fila');
        setFeito({
          carimbos: ficha.cartao.carimbos + 1,
          objectivo: ficha.cartao.objectivo,
          completo: false,
          recompensa: null,
        });
      } else {
        setEstado('feito');
        vibrar(r.resultado.completo || r.resultado.cupao ? 'festa' : 'feito');
        setFeito({
          carimbos: r.resultado.cartao.carimbos,
          objectivo: r.resultado.cartao.objectivo,
          completo: r.resultado.completo,
          recompensa: r.resultado.recompensa,
          cupao: r.resultado.cupao,
        });
      }
      Animated.spring(escala, { toValue: 1, useNativeDriver: false, friction: 5 }).start();
      // Com um prémio ou um cupão fica até «Concluir»: o barbeiro tem de o dizer ao cliente.
      if (!('resultado' in r && (r.resultado.completo || r.resultado.cupao))) concluir();
    } catch (e) {
      if (
        e instanceof ErroDaBalcao &&
        (e.codigo === 'limite_do_dia' || e.codigo === 'entregue_hoje')
      ) {
        setAviso(
          (e.dados.ultimo as { quando: number; pessoa: string | null } | undefined) ?? {
            quando: 0,
            pessoa: null,
          },
        );
        setEstado('pronto');
        return;
      }
      setEstado('erro');
      setErro(mensagemDe(e));
    }
  };

  const usar = async (cartaoId: number) => {
    if (!ficha || !casa) return;
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
        recompensa: `${ficha.recompensas[0]?.recompensa ?? 'Recompensa'} entregue`,
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
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

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
          aria-label="Fechar"
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
            A abrir…
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
            <Botao nome="Fechar" secundario onPress={sair} />
          ) : (
            <Botao nome="Tentar outra vez" secundario onPress={() => refetch()} />
          )}
        </View>
      )}

      {ficha && (estado === 'feito' || estado === 'na-fila') && feito && (
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
            {feito.recompensa && !feito.completo
              ? feito.recompensa
              : feito.completo
                ? 'Cartão completo'
                : `${feito.carimbos} de ${feito.objectivo}`}
          </T>
          {feito.completo && feito.recompensa && (
            <T v="subtitulo" style={{ color: cor.texto2, marginTop: 8, textAlign: 'center' }}>
              {feito.recompensa} · entregue neste corte
            </T>
          )}
          {estado === 'na-fila' && (
            <T v="legenda" style={{ color: cor.texto2, marginTop: 10 }}>
              Sem rede: guardado, envia-se depois.
            </T>
          )}
          {feito.cupao && (
            <View
              style={{
                marginTop: 24,
                paddingHorizontal: 18,
                paddingVertical: 14,
                borderRadius: raio.grupo,
                backgroundColor: cor.superficie,
                alignItems: 'center',
                gap: 4,
                ...CONTINUO,
              }}
            >
              <T
                v="legenda"
                style={{ color: cor.texto2, letterSpacing: 1.2, textTransform: 'uppercase' }}
              >
                Saiu um cupão
              </T>
              <T v="subtitulo" style={{ textAlign: 'center' }}>
                {feito.cupao.destaque} · {feito.cupao.titulo}
              </T>
              <T v="legenda" style={{ color: cor.texto2 }}>
                {feito.cupao.parceiro} · até {dataCurta(feito.cupao.validoAte, diaEmLisboa())}
              </T>
            </View>
          )}
          <View style={{ marginTop: 28 }}>
            <Botao nome="Concluir" onPress={sair} />
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
                  {ficha.cliente.nome || 'Sem nome'}
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
                      Faz anos
                    </T>
                  </View>
                )}
              </View>
              <T v="legenda" style={{ color: cor.texto2 }}>
                {`Cliente desde ${new Date(ficha.cliente.criadoEm * 1000).getFullYear()} · ${ficha.cliente.cortes} ${ficha.cliente.cortes === 1 ? 'corte' : 'cortes'}${ficha.cartao.numero > 1 ? ` · ${ficha.cartao.numero - 1} ${ficha.cartao.numero === 2 ? 'cartão completo' : 'cartões completos'}` : ''}`}
              </T>
            </View>

            <View style={{ paddingHorizontal: MARGEM, marginTop: 22 }}>
              <Carimbos
                carimbos={ficha.cartao.carimbos}
                objectivo={ficha.cartao.objectivo}
                tamanho={28}
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
              <T v="destaque">{ficha.cartao.carimbos}</T>
              <T v="forte" style={{ color: cor.texto2, fontSize: 18 }}>
                de {ficha.cartao.objectivo}
              </T>
              <T v="legenda" style={{ color: cor.texto2, marginLeft: 8 }}>
                {fraseDoCartao(ficha.cartao.carimbos, ficha.cartao)}
              </T>
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
              <T v="legenda" style={{ color: cor.texto2 }}>
                {ficha.ultima
                  ? `Última visita ${haQuanto(ficha.ultima.quando)}${ficha.ultima.loja ? ` · ${ficha.ultima.loja}` : ''}${ficha.ultima.pessoa ? ` · ${ficha.ultima.pessoa}` : ''}`
                  : 'Primeira visita'}
              </T>
            </View>

            {ficha.prenda && (
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
                <Icone nome="bolo" tamanho={18} cor={cor.sobreClaro} espessura={2.2} />
                <T v="forte" style={{ flex: 1, color: cor.sobreClaro }}>
                  Prenda de anos: {ficha.prenda}
                </T>
              </View>
            )}
            {ficha.cartao.carimbos === ficha.cartao.objectivo - 1 && !jaHoje && (
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
                  {ficha.cartao.recompensa}: é o {ficha.cartao.objectivo}.º corte. O carimbo
                  entrega-o.
                </T>
              </View>
            )}
            {(ficha.hoje.carimbos > 0 || aviso || entregueHoje) && (
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
                  {ficha.hoje.ultimo
                    ? `Já carimbado hoje às ${hora(ficha.hoje.ultimo.quando)}${ficha.hoje.ultimo.pessoa ? ` por ${ficha.hoje.ultimo.pessoa}` : ''}.`
                    : entregueHoje
                      ? `${eu?.programa.recompensa ?? 'Prémio'} entregue hoje às ${hora(entregueHoje.quando)}${entregueHoje.pessoa ? ` por ${entregueHoje.pessoa}` : ''}. Não leva carimbo.`
                      : 'Já carimbado hoje.'}
                </T>
              </View>
            )}
          </ScrollView>
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
            {eu?.programa.servicos && eu.servicos.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {eu.servicos.map((s) => {
                  const on = s.id === servico;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setServico(s.id)}
                      role="radio"
                      aria-checked={on}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 999,
                        backgroundColor: on ? cor.claro : cor.superficieAlta,
                      }}
                    >
                      <T
                        v="forte"
                        style={{ fontSize: 14, color: on ? cor.sobreClaro : cor.texto2 }}
                      >
                        {s.nome}
                      </T>
                    </Pressable>
                  );
                })}
              </View>
            )}
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
                  Entregar: {ficha.recompensas[0]!.recompensa.toLowerCase()}
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
                alignItems: 'center',
                justifyContent: 'center',
                opacity: estado === 'a-enviar' ? 0.6 : 1,
              })}
            >
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
                  ? 'Carimbar na mesma'
                  : estado === 'a-enviar'
                    ? 'A carimbar…'
                    : ficha.cartao.carimbos === ficha.cartao.objectivo - 1
                      ? `Carimbar: ${ficha.cartao.recompensa.toLowerCase()}`
                      : 'Carimbar'}
              </T>
            </Pressable>
            {erro && (
              <T v="legenda" role="alert" style={{ color: '#E07A72', textAlign: 'center' }}>
                {erro}
              </T>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
