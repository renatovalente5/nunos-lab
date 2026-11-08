import type { ParceiroPublico, PromocaoPublica } from '@nunos-lab/dominio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, useRef, type ComponentRef } from 'react';
import { Image, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { CabecalhoDoSeparador } from '../../componentes/cabecalho';
import {
  alturaDoDestaque,
  CartaoDestaque,
  iconeDe,
  LinhaDoParceiro,
} from '../../componentes/cartoes';
import { definirTitulo, guardarCasa, lerCasa, useDados } from '../../dados';
import { useTextos } from '../../textos';
import {
  CONTINUO,
  Ecra,
  Folha,
  Grupo,
  Icone,
  LARGURA_MAXIMA,
  MARGEM,
  CartaoDaFolha,
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

/** Enquanto os dados chegam: o destaque, o título e a lista onde vão aparecer, para nada saltar. */
function EsqueletoDasVantagens() {
  const bloco = (largura: number | `${number}%`, altura: number, r: number = raio.grupo) => (
    <View
      style={{ width: largura, height: altura, borderRadius: r, backgroundColor: cor.superficie }}
    />
  );
  return (
    <View style={{ paddingHorizontal: MARGEM, marginTop: 18 }} aria-busy>
      {bloco('100%', 124)}
      <View style={{ height: 40, marginTop: 20, justifyContent: 'center' }}>
        {bloco(90, 14, 7)}
      </View>
      <View style={{ marginTop: 60 }}>{bloco('100%', 236)}</View>
    </View>
  );
}

export default function Vantagens() {
  const t = useTextos();
  const { data, isPending, isError, refetch } = useDados();
  const [categoria, setCategoria] = useState<number | null>(null);
  // A casa do cliente (Nogueira do Cravo, Feira, Aveiro): fica guardada no aparelho.
  const [casa, setCasa] = useState<number | null>(lerCasa);
  const [aEscolherCasa, setAEscolherCasa] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  useEffect(() => definirTitulo(t.titulos.vantagens), [t]);
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
  // Os destaques num lugar só, baixo, e a lista logo a seguir (o Renato, 8 nov: a lista ficava muito
  // em baixo). Um destaque ocupa a largura toda; com vários, rolam de lado e o seguinte espreita.
  const coluna = Math.min(width, LARGURA_MAXIMA) - 2 * MARGEM;
  const varios = destaques.length > 1;
  const larguraDoDestaque = varios ? coluna - 28 : coluna;
  const altura = alturaDoDestaque(fontScale);
  // Só as categorias com parceiros na casa escolhida; uma que deixou de ter volta a «Tudo».
  const categorias = useMemo(
    () =>
      (data?.categorias ?? []).filter((k) =>
        (data?.parceiros ?? []).some((p) => daCasa(p) && p.categoriaId === k.id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, casaEscolhida],
  );
  const escolhida = categorias.some((k) => k.id === categoria) ? categoria : null;
  const lista = (data?.parceiros ?? []).filter(
    (p) => daCasa(p) && (escolhida === null || p.categoriaId === escolhida),
  );
  // Sem parceiros nenhuns, o filtro das casas não tem nada para filtrar.
  const haParceiros = (data?.parceiros.length ?? 0) > 0;
  const escolherCasa = (id: number | null) => {
    setCasa(id);
    guardarCasa(id);
    setAEscolherCasa(false);
  };
  const nomeDaCasa = lojas.find((l) => l.id === casaEscolhida)?.nome ?? t.vantagens.todasAsCasas;
  const abrir = (p: ParceiroPublico, pr?: PromocaoPublica) =>
    router.push({
      pathname: '/parceiro/[id]',
      params: { id: String(p.id), ...(pr ? { p: String(pr.id) } : {}) },
    });
  // O primeiro bloco fica a 18 do cabeçalho, como nos outros separadores; depois do aviso, a 14.
  const primeiro = data?.aviso ? 14 : 18;
  const botaoDaCasa =
    haParceiros && lojas.length > 1 ? (
      <Pressable
        onPress={() => setAEscolherCasa(true)}
        role="button"
        aria-label={t.vantagens.mudarDeCasa(nomeDaCasa)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 40,
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
    ) : null;

  return (
    <Ecra>
      {/* A língua escolhe-se só na Conta; sem escolha, a do telemóvel (o Renato, 8 nov). O logótipo
          está no cabeçalho dos outros separadores: o primeiro bloco não salta ao trocar. */}
      <CabecalhoDoSeparador
        titulo={
          <Image
            source={palavra}
            style={{ width: 200, height: Math.round((200 * 227) / 1200) }}
            resizeMode="contain"
            accessibilityLabel="Nuno’s Lab"
            role="img"
          />
        }
      />

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

      {!data && isPending && <EsqueletoDasVantagens />}
      {!data && isError && <SemLigacao tentar={() => refetch()} />}

      {/* O título «Em destaque» saiu: a cor já o diz, e o leitor de ecrã ouve-o em cada destaque. */}
      {data &&
        destaques.length > 0 &&
        (varios ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={larguraDoDestaque + 12}
            contentContainerStyle={{ paddingHorizontal: MARGEM, gap: 12 }}
            style={[
              { marginTop: primeiro },
              Platform.OS === 'web'
                ? ({ scrollSnapType: 'x mandatory', scrollPaddingLeft: MARGEM } as object)
                : null,
            ]}
          >
            {destaques.map(({ parceiro, promocao }) => (
              <CartaoDestaque
                key={promocao.id}
                parceiro={parceiro}
                promocao={promocao}
                icone={iconeDe(parceiro, data.categorias)}
                hoje={data.hoje}
                largura={larguraDoDestaque}
                altura={altura}
                noCarrossel
                onPress={() => abrir(parceiro, promocao)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={{ marginTop: primeiro, paddingHorizontal: MARGEM }}>
            <CartaoDestaque
              parceiro={destaques[0]!.parceiro}
              promocao={destaques[0]!.promocao}
              icone={iconeDe(destaques[0]!.parceiro, data.categorias)}
              hoje={data.hoje}
              largura={larguraDoDestaque}
              altura={altura}
              noCarrossel={false}
              onPress={() => abrir(destaques[0]!.parceiro, destaques[0]!.promocao)}
            />
          </View>
        ))}

      {data && (
        <>
          {/* «Parceiros» e a casa na mesma linha, de altura certa (não salta sem o botão da casa). */}
          <Rotulo
            style={{
              marginTop: destaques.length > 0 ? 20 : primeiro,
              marginBottom: 8,
              minHeight: 40,
              ...(botaoDaCasa ? null : { justifyContent: 'center' }),
            }}
            direita={botaoDaCasa}
          >
            {t.vantagens.parceiros}
          </Rotulo>
          {categorias.length > 1 && (
            <View style={{ marginBottom: 12 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: MARGEM,
                  paddingRight: MARGEM + 32,
                  gap: 8,
                }}
                role="radiogroup"
                aria-label={t.vantagens.categorias}
              >
                {[{ id: null as number | null, nome: t.vantagens.tudo }, ...categorias].map((k) => {
                  const activa = escolhida === k.id;
                  return (
                    <Pressable
                      key={k.id ?? 'tudo'}
                      onPress={() => setCategoria(k.id)}
                      role="radio"
                      aria-checked={activa}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        minHeight: 40,
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
          <Folha
            aberta={aEscolherCasa}
            fechar={() => setAEscolherCasa(false)}
            titulo={t.vantagens.aTuaCasa}
          >
            <CartaoDaFolha role="radiogroup" aria-label={t.vantagens.aTuaCasa}>
              <OpcaoDaFolha
                nome={t.vantagens.todasAsCasas}
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
            </CartaoDaFolha>
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
            <View
              style={{
                alignItems: 'center',
                paddingVertical: 48,
                paddingHorizontal: MARGEM,
                gap: 10,
              }}
            >
              <Icone nome="etiqueta" tamanho={30} cor={cor.texto3} />
              {/* Com a margem e ao centro: com a letra grande do iPhone partia-se encostada à borda. */}
              <T v="forte" style={{ color: cor.texto2, textAlign: 'center' }}>
                {t.vantagens.emBreve}
              </T>
            </View>
          )}
        </>
      )}
    </Ecra>
  );
}
