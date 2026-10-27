import type { ParceiroPublico, PromocaoPublica } from '@nunos-lab/dominio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { CartaoDestaque, iconeDe, LinhaDoParceiro } from '../../componentes/cartoes';
import { Esqueleto, SemLigacao } from '../../componentes/estados';
import { Icone } from '../../componentes/icone';
import { Ecra, Grupo, Rotulo, Separador } from '../../componentes/pecas';
import { T } from '../../componentes/texto';
import { definirTitulo, useDados } from '../../dados';
import { cor, LARGURA_MAXIMA, MARGEM, raio } from '../../tema';

const palavra = require('../../../assets/marca/palavra.png');

export default function Vantagens() {
  const { data, isPending, isError, refetch } = useDados();
  const [categoria, setCategoria] = useState<number | null>(null);
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

  const destaques = useMemo(
    () =>
      (data?.parceiros ?? []).flatMap((p) =>
        p.promocoes.filter((pr) => pr.emDestaque).map((pr) => ({ parceiro: p, promocao: pr })),
      ),
    [data],
  );
  // Uma categoria que deixou de ter parceiros (dados novos) deixa de estar escolhida.
  const escolhida = data?.categorias.some((k) => k.id === categoria) ? categoria : null;
  const lista = (data?.parceiros ?? []).filter(
    (p) => escolhida === null || p.categoriaId === escolhida,
  );
  const abrir = (p: ParceiroPublico, pr?: PromocaoPublica) =>
    router.push({
      pathname: '/parceiro/[id]',
      params: { id: String(p.id), ...(pr ? { p: String(pr.id) } : {}) },
    });

  return (
    <Ecra>
      <View
        style={{
          paddingHorizontal: MARGEM,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 44,
        }}
      >
        <Image
          source={palavra}
          style={{ width: 168, height: Math.round((168 * 227) / 1200) }}
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
          }}
          role="status"
        >
          <Icone nome="aviso" tamanho={20} />
          <T v="forte" style={{ flex: 1, fontSize: 15 }}>
            {data.aviso}
          </T>
        </View>
      )}

      {!data && isPending && <Esqueleto />}
      {!data && isError && <SemLigacao tentar={() => refetch()} />}

      {data && destaques.length > 0 && (
        <>
          <Rotulo>Em destaque</Rotulo>
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
          {data.categorias.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: MARGEM, gap: 8, marginBottom: 14 }}
              role="radiogroup"
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
                      height: 38,
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
          )}
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
