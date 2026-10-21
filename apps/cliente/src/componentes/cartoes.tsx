import {
  semPartir,
  validadeEmTexto,
  type Categoria,
  type IconeDaCategoria,
  type ParceiroPublico,
  type PromocaoPublica,
} from '@nunos-lab/dominio';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { cor, raio } from '../tema';
import { Capa } from './capa';
import { Logotipo } from './logotipo';
import { EtiquetaExemplo } from './pecas';
import { T } from './texto';

export function iconeDe(parceiro: ParceiroPublico, categorias: Categoria[]): IconeDaCategoria {
  return categorias.find((k) => k.id === parceiro.categoriaId)?.icone ?? 'outro';
}

export function categoriaELocal(parceiro: ParceiroPublico, categorias: Categoria[]): string {
  const nome = categorias.find((k) => k.id === parceiro.categoriaId)?.nome;
  return [nome, parceiro.localidade].filter(Boolean).join(' · ');
}

/** Um cartão grande do carrossel «Em destaque»: a vantagem em grande, sobre a capa. */
export function CartaoDestaque({
  parceiro,
  promocao,
  icone,
  hoje,
  largura,
  onPress,
}: {
  parceiro: ParceiroPublico;
  promocao: PromocaoPublica;
  icone: IconeDaCategoria;
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
      <Capa parceiro={parceiro} icone={icone} altura={Math.round(largura * 1.2)} raio={raio.cartao}>
        <View
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            right: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Logotipo parceiro={parceiro} tamanho={34} />
          <T v="forte" style={{ color: '#FFFFFF', flexShrink: 1, fontSize: 15 }} numberOfLines={2}>
            {parceiro.nome}
          </T>
        </View>
        <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18 }}>
          <T v="destaque" style={{ color: '#FFFFFF' }} numberOfLines={1} adjustsFontSizeToFit>
            {semPartir(promocao.destaque)}
          </T>
          <T v="tituloCartao" style={{ color: '#FFFFFF' }} numberOfLines={2}>
            {semPartir(promocao.titulo)}
          </T>
          {(validade || parceiro.exemplo) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
              {validade && (
                <T v="legenda" style={{ color: 'rgba(255,255,255,0.82)' }}>
                  {validade}
                </T>
              )}
              {parceiro.exemplo && <EtiquetaExemplo sobreFoto />}
            </View>
          )}
        </View>
      </Capa>
    </Pressable>
  );
}

/** Uma linha da lista de parceiros: o logótipo, o nome, onde, e a melhor vantagem. */
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
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: pressed ? cor.superficieAlta : 'transparent',
      })}
    >
      <Logotipo parceiro={parceiro} tamanho={50} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="forte" numberOfLines={2}>
          {parceiro.nome}
        </T>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            columnGap: 8,
            rowGap: 4,
            marginTop: 3,
          }}
        >
          {parceiro.novo && (
            <View
              style={{
                backgroundColor: cor.claro,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <T
                v="rotulo"
                style={{ fontSize: 9.5, lineHeight: 12, letterSpacing: 1, color: cor.sobreClaro }}
              >
                Novo
              </T>
            </View>
          )}
          <T v="legenda" style={{ color: cor.texto2 }}>
            {onde}
          </T>
          {parceiro.exemplo && <EtiquetaExemplo />}
        </View>
      </View>
      {primeira && (
        <View
          style={{
            backgroundColor: cor.superficieAlta,
            borderRadius: raio.pilula,
            paddingHorizontal: 11,
            paddingVertical: 6,
          }}
        >
          <T v="forte" style={{ fontSize: 14, lineHeight: 18 }}>
            {semPartir(primeira.destaque)}
          </T>
        </View>
      )}
    </Pressable>
  );
}

/** Uma vantagem na página do parceiro. As condições longas abrem com um toque. */
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <T
          v="destaque"
          style={{ fontSize: 36, lineHeight: 40, letterSpacing: -1.1, flexShrink: 1 }}
        >
          {semPartir(promocao.destaque)}
        </T>
        {validade && (
          <View
            style={{
              backgroundColor: cor.superficieAlta,
              borderRadius: raio.pilula,
              paddingHorizontal: 10,
              paddingVertical: 5,
              marginTop: 4,
            }}
          >
            <T v="legenda" style={{ color: cor.texto }}>
              {validade}
            </T>
          </View>
        )}
      </View>
      <T v="tituloCartao" style={{ marginTop: 4 }}>
        {semPartir(promocao.titulo)}
      </T>
      {!!promocao.detalhe && (
        <T
          v="corpo"
          style={{ color: cor.texto2, marginTop: 6 }}
          numberOfLines={aberta || !longo ? undefined : 2}
        >
          {semPartir(promocao.detalhe)}
        </T>
      )}
    </>
  );
  const estilo = {
    backgroundColor: cor.superficie,
    borderRadius: raio.grupo,
    padding: 18,
    marginHorizontal: 20,
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
      style={({ pressed }) => [estilo, { opacity: pressed ? 0.85 : 1 }]}
    >
      {conteudo}
    </Pressable>
  );
}
