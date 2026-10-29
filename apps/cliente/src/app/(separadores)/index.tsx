import type { ParceiroPublico, PromocaoPublica } from '@nunos-lab/dominio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, useRef, type ComponentRef } from 'react';
import { Image, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { CartaoDestaque, iconeDe, LinhaDoParceiro } from '../../componentes/cartoes';
import { definirTitulo, guardarCasa, lerCasa, useDados } from '../../dados';
import {
  CONTINUO,
  Ecra,
  Esqueleto,
  Folha,
  Grupo,
  Icone,
  LARGURA_MAXIMA,
  MARGEM,
  OpcaoDaFolha,
  Rotulo,
  SemLigacao,
  Separador,
  T,
  cor,
  raio,
} from '@nunos-lab/ui';
/** Um desvanecimento no lado direito de uma fila que rola, a dizer que continua (só na web). */
function FadeDireita() {
  const caixa = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // O React Native Web não conhece esta propriedade: vai directa ao elemento.
    const el = caixa.current as unknown as HTMLElement | null;
    if (el) el.style.backgroundImage = `linear-gradient(to right, rgba(10,10,10,0), ${cor.fundo})`;
  }, []);
  if (Platform.OS !== 'web') return null;
  return (
    <View
      ref={caixa}
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 56 }}
    />
  );
}

const palavra = require('../../../assets/marca/palavra.png');

export default function Vantagens() {
  const { data, isPending, isError, refetch } = useDados();
  const [categoria, setCategoria] = useState<number | null>(null);
  // A casa do cliente (Nogueira do Cravo, Feira, Aveiro): fica guardada no aparelho.
  const [casa, setCasa] = useState<number | null>(lerCasa);
  const [aEscolherCasa, setAEscolherCasa] = useState(false);
  const { width } = useWindowDimensions();
  const largura = Math.min(300, Math.round(Math.min(width, LARGURA_MAXIMA) * 0.76));
  useEffect(() => definirTitulo("Nuno's Lab · Vantagens"), []);
  // Uma ligação partilhada (/?parceiro=N) abre o parceiro; o «Voltar» de lá vem
  // para aqui, já sem o parâmetro.
  const { parceiro } = useLocalSearchParams<{ parceiro?: string }>();
  useEffect(() => {
    if (parceiro && /^\d+$/.test(parceiro))
      router.replace({ pathname: '/parceiro/[id]', params: { id: parceiro } });
  }, [parceiro]);

  const lojas = data?.barbearia.lojas ?? [];
  // Uma casa que já não existe deixa de estar escolhida. Um parceiro sem casa é de todas.
  const casaEscolhida = lojas.some((l) => l.id === casa) ? casa : null;
  const daCasa = (p: ParceiroPublico) =>
    casaEscolhida === null || p.lojaId === null || p.lojaId === casaEscolhida;
  const destaques = useMemo(
    () =>
      (data?.parceiros ?? [])
        .filter(daCasa)
        .flatMap((p) =>
          p.promocoes.filter((pr) => pr.emDestaque).map((pr) => ({ parceiro: p, promocao: pr })),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, casaEscolhida],
  );
  // Uma categoria que deixou de ter parceiros (dados novos) deixa de estar escolhida.
  const escolhida = data?.categorias.some((k) => k.id === categoria) ? categoria : null;
  const lista = (data?.parceiros ?? []).filter(
    (p) => daCasa(p) && (escolhida === null || p.categoriaId === escolhida),
  );
  const escolherCasa = (id: number | null) => {
    setCasa(id);
    guardarCasa(id);
    setAEscolherCasa(false);
  };
  const nomeDaCasa = lojas.find((l) => l.id === casaEscolhida)?.nome ?? 'Todas as casas';
  const abrir = (p: ParceiroPublico, pr?: PromocaoPublica) =>
    router.push({
      pathname: '/parceiro/[id]',
      params: { id: String(p.id), ...(pr ? { p: String(pr.id) } : {}) },
    });

  return (
    <Ecra>
      <View style={{ paddingHorizontal: MARGEM, minHeight: 44, justifyContent: 'center' }}>
        <Image
          source={palavra}
          style={{ width: 200, height: Math.round((200 * 227) / 1200) }}
          resizeMode="contain"
          accessibilityLabel="Nuno's Lab"
          role="img"
        />
      </View>

      {!!data?.aviso && (
        <View
          style={{
            marginHorizontal: MARGEM,
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: cor.superficie,
            borderRadius: raio.grupo,
            paddingHorizontal: 16,
            paddingVertical: 14,
            ...CONTINUO,
          }}
          role="status"
        >
          <Icone nome="aviso" tamanho={20} espessura={2} />
          <T v="forte" style={{ flex: 1, fontSize: 15 }}>
            {data.aviso}
          </T>
        </View>
      )}

      {!data && isPending && <Esqueleto />}
      {!data && isError && <SemLigacao tentar={() => refetch()} />}

      {data && destaques.length > 0 && (
        <>
          <Rotulo style={{ marginTop: 28 }}>Em destaque</Rotulo>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={largura + 14}
            contentContainerStyle={{ paddingHorizontal: MARGEM, gap: 14 }}
            style={
              Platform.OS === 'web'
                ? ({ scrollSnapType: 'x mandatory', scrollPaddingLeft: MARGEM } as object)
                : undefined
            }
          >
            {destaques.map(({ parceiro, promocao }) => (
              <CartaoDestaque
                key={promocao.id}
                parceiro={parceiro}
                promocao={promocao}
                icone={iconeDe(parceiro, data.categorias)}
                hoje={data.hoje}
                largura={largura}
                onPress={() => abrir(parceiro, promocao)}
              />
            ))}
          </ScrollView>
        </>
      )}

      {data && (
        <>
          <Rotulo>Parceiros</Rotulo>
          {lojas.length > 1 && (
            <View style={{ paddingHorizontal: MARGEM, marginBottom: 12, flexDirection: 'row' }}>
              <Pressable
                onPress={() => setAEscolherCasa(true)}
                role="button"
                aria-label={`A tua casa: ${nomeDaCasa}. Mudar.`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  height: 40,
                  paddingLeft: 12,
                  paddingRight: 10,
                  borderRadius: raio.pilula,
                  borderWidth: 1,
                  borderColor: cor.linha,
                  backgroundColor: pressed ? cor.superficie : 'transparent',
                })}
              >
                <Icone nome="mapa" tamanho={16} cor={cor.texto2} espessura={2} />
                <T v="legenda" style={{ color: cor.texto }}>
                  {nomeDaCasa}
                </T>
                <View style={{ transform: [{ rotate: '90deg' }] }}>
                  <Icone nome="seguinte" tamanho={14} cor={cor.texto3} espessura={2.2} />
                </View>
              </Pressable>
            </View>
          )}
          {data.categorias.length > 1 && (
            <View style={{ marginBottom: 14 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: MARGEM,
                  paddingRight: MARGEM + 32,
                  gap: 8,
                }}
                role="radiogroup"
                aria-label="Categorias"
              >
                {[{ id: null as number | null, nome: 'Tudo' }, ...data.categorias].map((k) => {
                  const activa = escolhida === k.id;
                  return (
                    <Pressable
                      key={k.id ?? 'tudo'}
                      onPress={() => setCategoria(k.id)}
                      role="radio"
                      aria-checked={activa}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        height: 40,
                        justifyContent: 'center',
                        borderRadius: raio.pilula,
                        backgroundColor: activa ? cor.claro : cor.superficie,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <T
                        v="forte"
                        style={{
                          fontSize: 14,
                          lineHeight: 18,
                          color: activa ? cor.sobreClaro : cor.texto,
                        }}
                      >
                        {k.nome}
                      </T>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <FadeDireita />
            </View>
          )}
          <Folha aberta={aEscolherCasa} fechar={() => setAEscolherCasa(false)} titulo="A tua casa">
            <View role="radiogroup" aria-label="A tua casa">
              <OpcaoDaFolha
                nome="Todas as casas"
                escolhida={casaEscolhida === null}
                onPress={() => escolherCasa(null)}
              />
              {lojas.map((l) => (
                <OpcaoDaFolha
                  key={l.id}
                  nome={l.nome}
                  escolhida={casaEscolhida === l.id}
                  onPress={() => escolherCasa(l.id)}
                  separador
                />
              ))}
            </View>
          </Folha>
          {lista.length > 0 ? (
            <Grupo>
              {lista.map((p, i) => (
                <View key={p.id}>
                  {i > 0 && <Separador recuo={80} />}
                  <LinhaDoParceiro
                    parceiro={p}
                    categorias={data.categorias}
                    onPress={() => abrir(p)}
                  />
                </View>
              ))}
            </Grupo>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 48, gap: 10 }}>
              <Icone nome="etiqueta" tamanho={30} cor={cor.texto3} />
              <T v="forte" style={{ color: cor.texto2 }}>
                Novas vantagens em breve
              </T>
            </View>
          )}
        </>
      )}
    </Ecra>
  );
}
