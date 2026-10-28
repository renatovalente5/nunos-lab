import {
  degrauDoDesconto,
  semPartir,
  validadeEmTexto,
  type Categoria,
  type ParceiroPublico,
  type PromocaoPublica,
} from '@nunos-lab/dominio';
import { useState } from 'react';
import { Platform, Pressable, View, type TextStyle } from 'react-native';
import { cor, letra, MARGEM, raio } from '../tema';
import { Capa } from './capa';
import { Logotipo } from './logotipo';
import { EtiquetaExemplo, EtiquetaNovo } from './pecas';
import { T } from './texto';

export function categoriaELocal(parceiro: ParceiroPublico, categorias: Categoria[]): string {
  const nome = categorias.find((k) => k.id === parceiro.categoriaId)?.nome;
  return [nome, parceiro.localidade].filter(Boolean).join(' · ');
}

/**
 * O tamanho do desconto em cada sítio, por degraus de letras (até às 12 do
 * campo). Medidos em Manrope 800 para caberem num telemóvel de 360 px: a placa
 * do destaque tem lá 226 px úteis («−25% em tudo» a 34 px ocupa 217).
 */
const ESCALA_DO_DESTAQUE = [84, 64, 50, 34] as const;
const ESCALA_DO_BILHETE = [64, 56, 44, 36] as const;
const ESCALA_DA_LISTA = [18, 18, 16, 14] as const;

/**
 * O desconto em grande, preto sobre a placa branca (19,8:1). A entrelinha fica
 * acima de 0,92 do tamanho, para o acento de «Grátis» não se cortar no Android.
 */
function letraDoDesconto(destaque: string, escala: readonly number[]): TextStyle {
  const tamanho = escala[degrauDoDesconto(destaque)]!;
  return {
    color: cor.sobreClaro,
    fontFamily: letra.extra,
    fontSize: tamanho,
    lineHeight: Math.round(tamanho * 0.96),
    letterSpacing: -tamanho * 0.045,
  };
}

/** Até quando vale, numa etiqueta preta sobre a placa. */
function EtiquetaDoPrazo({ texto }: { texto: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: cor.sobreClaro,
        borderRadius: raio.etiqueta,
        paddingHorizontal: 7,
        paddingVertical: 3,
      }}
    >
      <T style={{ fontFamily: letra.forte, fontSize: 13, lineHeight: 17, color: '#FFFFFF' }}>
        {semPartir(texto)}
      </T>
    </View>
  );
}

/**
 * Um cartão grande do carrossel «Em destaque»: em cima, quem é (sobre a cor ou
 * a fotografia do parceiro); em baixo, a placa branca com o desconto.
 */
export function CartaoDestaque({
  parceiro,
  promocao,
  hoje,
  largura,
  onPress,
}: {
  parceiro: ParceiroPublico;
  promocao: PromocaoPublica;
  hoje: string;
  largura: number;
  onPress: () => void;
}) {
  const validade = validadeEmTexto(promocao, hoje);
  return (
    <Pressable
      onPress={onPress}
      role="link"
      aria-label={`${promocao.destaque} ${promocao.titulo}, ${parceiro.nome}${validade ? `, ${validade}` : ''}`}
      style={({ pressed }) => [
        { width: largura, transform: [{ scale: pressed ? 0.98 : 1 }] },
        Platform.OS === 'web' ? ({ scrollSnapAlign: 'start' } as object) : null,
      ]}
    >
      <Capa parceiro={parceiro} altura={parceiro.capa ? 340 : 276} raio={raio.cartao} veu="cima">
        <View style={{ flex: 1, padding: 8, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 6 }}>
            <Logotipo parceiro={parceiro} tamanho={34} sobreCor />
            <T v="nomeCartao" style={{ flex: 1, color: '#FFFFFF' }} numberOfLines={2}>
              {parceiro.nome}
            </T>
            {parceiro.exemplo && <EtiquetaExemplo sobreFoto />}
          </View>
          <View
            style={{
              backgroundColor: cor.claro,
              borderRadius: raio.placa,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 16,
            }}
          >
            <T style={letraDoDesconto(promocao.destaque, ESCALA_DO_DESTAQUE)} numberOfLines={1}>
              {semPartir(promocao.destaque)}
            </T>
            <T v="tituloCartao" style={{ color: cor.sobreClaro, marginTop: 2 }} numberOfLines={2}>
              {semPartir(promocao.titulo)}
            </T>
            {validade && (
              <View style={{ marginTop: 10 }}>
                <EtiquetaDoPrazo texto={validade} />
              </View>
            )}
          </View>
        </View>
      </Capa>
    </Pressable>
  );
}

/**
 * Uma linha da lista de parceiros: o logótipo, o nome, onde, e à direita a
 * placa com o melhor desconto, numa coluna, como uma tabela de preços.
 */
export function LinhaDoParceiro({
  parceiro,
  categorias,
  onPress,
}: {
  parceiro: ParceiroPublico;
  categorias: Categoria[];
  onPress: () => void;
}) {
  const primeira = parceiro.promocoes[0];
  const onde = categoriaELocal(parceiro, categorias);
  return (
    <Pressable
      onPress={onPress}
      role="link"
      aria-label={[parceiro.nome, onde, primeira && `${primeira.destaque} ${primeira.titulo}`]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 78,
        paddingVertical: 14,
        backgroundColor: pressed ? cor.superficie : 'transparent',
      })}
    >
      <Logotipo parceiro={parceiro} tamanho={50} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="forte" numberOfLines={2}>
          {parceiro.nome}
        </T>
        <T v="legenda" style={{ color: cor.texto2, marginTop: 3 }} numberOfLines={2}>
          {onde}
        </T>
      </View>
      {primeira && (
        <View style={{ minWidth: 84, maxWidth: 136, alignItems: 'center', gap: 6 }}>
          <View
            style={{
              alignSelf: 'stretch',
              minHeight: 38,
              paddingHorizontal: 8,
              borderRadius: raio.placa,
              backgroundColor: cor.claro,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T style={letraDoDesconto(primeira.destaque, ESCALA_DA_LISTA)} numberOfLines={1}>
              {semPartir(primeira.destaque)}
            </T>
          </View>
          {parceiro.novo ? <EtiquetaNovo /> : parceiro.exemplo ? <EtiquetaExemplo /> : null}
        </View>
      )}
    </Pressable>
  );
}

/**
 * Uma vantagem na página do parceiro: um bilhete branco, com o desconto em
 * grande. As condições longas abrem com um toque.
 */
export function CartaoDaPromocao({
  promocao,
  hoje,
  aoAbrir,
}: {
  promocao: PromocaoPublica;
  hoje: string;
  aoAbrir?: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const validade = validadeEmTexto(promocao, hoje);
  const longo = promocao.detalhe.length > 90;
  const conteudo = (
    <>
      {/* O prazo fica ao lado do número quando cabe, e desce quando não cabe. */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          columnGap: 12,
          rowGap: 4,
        }}
      >
        <T style={letraDoDesconto(promocao.destaque, ESCALA_DO_BILHETE)}>
          {semPartir(promocao.destaque)}
        </T>
        {validade && (
          <View style={{ marginTop: 6 }}>
            <EtiquetaDoPrazo texto={validade} />
          </View>
        )}
      </View>
      <T
        v="tituloCartao"
        style={{ color: cor.sobreClaro, fontSize: 20, lineHeight: 25, marginTop: 6 }}
      >
        {semPartir(promocao.titulo)}
      </T>
      {!!promocao.detalhe && (
        <T
          v="corpo"
          style={{ color: cor.tintaDaPlaca, marginTop: 4 }}
          numberOfLines={aberta || !longo ? undefined : 2}
        >
          {semPartir(promocao.detalhe)}
        </T>
      )}
    </>
  );
  const estilo = {
    backgroundColor: cor.claro,
    borderRadius: raio.bilhete,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    marginHorizontal: MARGEM,
    marginBottom: 12,
  };
  if (!longo) return <View style={estilo}>{conteudo}</View>;
  return (
    <Pressable
      onPress={() => {
        if (!aberta) aoAbrir?.();
        setAberta((a) => !a);
      }}
      aria-expanded={aberta}
      role="button"
      style={({ pressed }) => [estilo, { opacity: pressed ? 0.9 : 1 }]}
    >
      {conteudo}
    </Pressable>
  );
}
