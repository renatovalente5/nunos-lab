import {
  degrauDoDesconto,
  limiteEmTexto,
  semPartir,
  validadeEmTexto,
  type Categoria,
  type IconeDaCategoria,
  type ParceiroPublico,
  type PromocaoPublica,
} from '@nunos-lab/dominio';
import { useState } from 'react';
import { Platform, Pressable, View, type TextStyle } from 'react-native';
import { Capa } from './capa';
import { Logotipo } from './logotipo';
import {
  CONTINUO,
  EtiquetaExemplo,
  EtiquetaNovo,
  Icone,
  MARGEM,
  T,
  cor,
  letra,
  raio,
} from '@nunos-lab/ui';

export function iconeDe(parceiro: ParceiroPublico, categorias: Categoria[]): IconeDaCategoria {
  return categorias.find((k) => k.id === parceiro.categoriaId)?.icone ?? 'outro';
}

export function categoriaELocal(parceiro: ParceiroPublico, categorias: Categoria[]): string {
  const nome = categorias.find((k) => k.id === parceiro.categoriaId)?.nome;
  return [nome, parceiro.localidade].filter(Boolean).join(' · ');
}

/**
 * O tamanho do desconto em cada sítio, por degraus de letras (até às 12 do
 * campo): o React Native Web não encolhe o texto sozinho.
 */
const ESCALA_DO_DESTAQUE = [46, 38, 30, 24] as const;
const ESCALA_DO_BILHETE = [36, 30, 26, 22] as const;

function letraDoDesconto(destaque: string, escala: readonly number[], tinta: string): TextStyle {
  const tamanho = escala[degrauDoDesconto(destaque)]!;
  return {
    color: tinta,
    fontFamily: letra.extra,
    fontSize: tamanho,
    lineHeight: Math.round(tamanho * 1.08),
    letterSpacing: -tamanho * 0.035,
  };
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
      <Capa
        parceiro={parceiro}
        icone={icone}
        altura={Math.round(largura * 1.2)}
        raio={raio.cartao}
        borda
      >
        <View
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Logotipo parceiro={parceiro} tamanho={36} />
          <T v="forte" style={{ color: '#FFFFFF', flexShrink: 1 }} numberOfLines={2}>
            {parceiro.nome}
          </T>
        </View>
        <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18 }}>
          <T
            style={letraDoDesconto(promocao.destaque, ESCALA_DO_DESTAQUE, '#FFFFFF')}
            numberOfLines={1}
          >
            {semPartir(promocao.destaque)}
          </T>
          <T v="tituloCartao" style={{ color: '#FFFFFF', marginTop: 2 }} numberOfLines={2}>
            {semPartir(promocao.titulo)}
          </T>
          {(validade || parceiro.exemplo) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              {validade && (
                <T v="legenda" style={{ color: 'rgba(255,255,255,0.85)' }}>
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
        minHeight: 74,
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
          {parceiro.novo && <EtiquetaNovo />}
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
            maxWidth: 128,
          }}
        >
          <T v="forte" style={{ fontSize: 14, lineHeight: 18 }} numberOfLines={1}>
            {semPartir(primeira.destaque)}
          </T>
        </View>
      )}
    </Pressable>
  );
}

function horaDe(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Uma vantagem na página do parceiro. As condições longas abrem com um toque.
 * Com validação, diz que o cartão se mostra ao balcão — e, depois de validada
 * hoje, a que horas foi.
 */
export function CartaoDaPromocao({
  promocao,
  hoje,
  aoAbrir,
  temCartao = false,
  usadaHoje = null,
}: {
  promocao: PromocaoPublica;
  hoje: string;
  aoAbrir?: () => void;
  /** Há conta com cartão neste aparelho. */
  temCartao?: boolean;
  /** O instante em que o parceiro a validou hoje, se validou. */
  usadaHoje?: number | null;
}) {
  const [aberta, setAberta] = useState(false);
  const validade = validadeEmTexto(promocao, hoje);
  const limite = promocao.validar ? limiteEmTexto(promocao) : null;
  const longo = promocao.detalhe.length > 90;
  const conteudo = (
    <>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          columnGap: 12,
          rowGap: 6,
        }}
      >
        <T style={letraDoDesconto(promocao.destaque, ESCALA_DO_BILHETE, cor.texto)}>
          {semPartir(promocao.destaque)}
        </T>
        {(validade || limite) && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            {[validade, limite].filter(Boolean).map((texto) => (
              <View
                key={texto}
                style={{
                  backgroundColor: cor.superficieAlta,
                  borderRadius: raio.pilula,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <T v="legenda">{texto}</T>
              </View>
            ))}
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
      {longo && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
          <T v="legenda" style={{ color: cor.texto3 }}>
            {aberta ? 'Menos' : 'Ver tudo'}
          </T>
          <View style={{ transform: [{ rotate: aberta ? '-90deg' : '90deg' }] }}>
            <Icone nome="seguinte" tamanho={14} cor={cor.texto3} />
          </View>
        </View>
      )}
      {promocao.validar && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: cor.linha,
          }}
        >
          <Icone
            nome={usadaHoje ? 'certo' : 'cartao'}
            tamanho={16}
            cor={usadaHoje ? cor.texto : cor.texto2}
            espessura={2.2}
          />
          <T v="legenda" style={{ color: usadaHoje ? cor.texto : cor.texto2 }}>
            {usadaHoje
              ? `Usada hoje às ${horaDe(usadaHoje)}`
              : temCartao
                ? 'Mostra o cartão ao balcão'
                : 'Com o cartão Nuno’s Lab'}
          </T>
        </View>
      )}
    </>
  );
  const estilo = {
    backgroundColor: cor.superficie,
    borderRadius: raio.grupo,
    padding: 18,
    marginHorizontal: MARGEM,
    marginBottom: 12,
    ...CONTINUO,
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
