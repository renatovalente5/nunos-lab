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
import { useTextos } from '../textos';
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
  useLingua,
} from '@nunos-lab/ui';

export function iconeDe(parceiro: ParceiroPublico, categorias: Categoria[]): IconeDaCategoria {
  return categorias.find((k) => k.id === parceiro.categoriaId)?.icone ?? 'outro';
}

export function categoriaELocal(parceiro: ParceiroPublico, categorias: Categoria[]): string {
  const nome = categorias.find((k) => k.id === parceiro.categoriaId)?.nome;
  return [nome, parceiro.localidade].filter(Boolean).join(' · ');
}

/**
 * O tamanho do desconto, por degraus de letras (até às 12 do campo): o React Native Web não encolhe o
 * texto sozinho. O mesmo no destaque das Vantagens e na página do parceiro.
 */
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

/** No destaque, a letra cresce com a do iPhone só até aqui: o cartão é baixo e de altura certa. */
const CRESCE_NO_DESTAQUE = 1.3;

/** A altura do destaque: 124 com a letra normal, até 144 com a letra grande. */
export function alturaDoDestaque(escalaDaLetra: number | undefined): number {
  // Na web não há escala da letra (undefined): conta como 1.
  const escala = Number.isFinite(escalaDaLetra) ? (escalaDaLetra as number) : 1;
  return 124 + Math.round(66 * (Math.min(Math.max(escala, 1), CRESCE_NO_DESTAQUE) - 1));
}

/**
 * Um destaque das Vantagens: baixo e largo, para a lista dos parceiros caber no primeiro ecrã (o Renato,
 * 8 nov). A cor (ou a fotografia) do parceiro, o desenho da categoria e o desconto em grande ficam.
 */
export function CartaoDestaque({
  parceiro,
  promocao,
  icone,
  hoje,
  largura,
  altura,
  noCarrossel,
  onPress,
}: {
  parceiro: ParceiroPublico;
  promocao: PromocaoPublica;
  icone: IconeDaCategoria;
  hoje: string;
  largura: number;
  altura: number;
  /** Com mais de um destaque, rolam de lado e encaixam no início. */
  noCarrossel: boolean;
  onPress: () => void;
}) {
  const t = useTextos();
  const validade = validadeEmTexto(promocao, hoje, useLingua());
  return (
    <Pressable
      onPress={onPress}
      role="link"
      aria-label={`${t.vantagens.emDestaque}: ${promocao.destaque} ${promocao.titulo}, ${parceiro.nome}${validade ? `, ${validade}` : ''}`}
      style={({ pressed }) => [
        { width: largura, transform: [{ scale: pressed ? 0.98 : 1 }] },
        noCarrossel && Platform.OS === 'web' ? ({ scrollSnapAlign: 'start' } as object) : null,
      ]}
    >
      <Capa parceiro={parceiro} icone={icone} altura={altura} raio={raio.grupo} borda veu="lado">
        <View
          style={{
            position: 'absolute',
            top: 14,
            left: 16,
            right: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Logotipo parceiro={parceiro} tamanho={28} />
          <T
            v="forte"
            style={{ color: '#FFFFFF', flexShrink: 1 }}
            numberOfLines={1}
            maxFontSizeMultiplier={CRESCE_NO_DESTAQUE}
          >
            {parceiro.nome}
          </T>
          {parceiro.exemplo && (
            <View style={{ marginLeft: 'auto' }}>
              <EtiquetaExemplo sobreFoto />
            </View>
          )}
        </View>
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <T
              style={[
                letraDoDesconto(promocao.destaque, ESCALA_DO_BILHETE, '#FFFFFF'),
                { flexShrink: 1 },
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={CRESCE_NO_DESTAQUE}
            >
              {semPartir(promocao.destaque)}
            </T>
            {validade && (
              <View
                style={{
                  backgroundColor: 'rgba(0,0,0,0.42)',
                  borderRadius: raio.pilula,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <T
                  v="legenda"
                  style={{ color: '#FFFFFF' }}
                  numberOfLines={1}
                  maxFontSizeMultiplier={CRESCE_NO_DESTAQUE}
                >
                  {validade}
                </T>
              </View>
            )}
          </View>
          <T
            v="forte"
            style={{ color: '#FFFFFF' }}
            numberOfLines={1}
            maxFontSizeMultiplier={CRESCE_NO_DESTAQUE}
          >
            {semPartir(promocao.titulo)}
          </T>
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
        {/* Numa linha só: com «Novo» e um sítio comprido («Nogueira do Cravo») partia-se em duas, e
            a lista descia (as Vantagens, 8 nov). As etiquetas ficam inteiras; o sítio encurta. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: 8,
            marginTop: 3,
          }}
        >
          {parceiro.novo && <EtiquetaNovo />}
          <T v="legenda" style={{ color: cor.texto2, flexShrink: 1 }} numberOfLines={1}>
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

export function horaDe(unix: number): string {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Uma vantagem na página do parceiro. As condições longas abrem com um toque.
 * Diz que o cartão se mostra ao balcão (qualquer vantagem se valida ao ler o cartão,
 * se o parceiro quiser) — só quando o parceiro vai aceitar: senão, porque não (limite
 * gasto) — e, depois de validada hoje, a que horas foi. A quem não corta o cabelo há
 * mais de um ano não diz nada: o aviso está no topo das Vantagens (o Renato, 8 nov).
 */
export function CartaoDaPromocao({
  promocao,
  hoje,
  aoAbrir,
  temCartao = false,
  activo = true,
  usadas = 0,
  usadaHoje = null,
}: {
  promocao: PromocaoPublica;
  hoje: string;
  aoAbrir?: () => void;
  /** Há conta com cartão neste aparelho. */
  temCartao?: boolean;
  /** O cliente cortou o cabelo no último ano (as vantagens só para activos). */
  activo?: boolean;
  /** Quantas vezes este cliente a usou no período do limite. */
  usadas?: number;
  /** O instante em que o parceiro a validou hoje, se validou. */
  usadaHoje?: number | null;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const [aberta, setAberta] = useState(false);
  // Todas as vantagens são só para clientes activos.
  const inactivo = !activo;
  const esgotada = promocao.limitePorCliente !== null && usadas >= promocao.limitePorCliente;
  const usada = !inactivo && (esgotada || !!usadaHoje);
  const validade = validadeEmTexto(promocao, hoje, lingua);
  const limite = limiteEmTexto(promocao, lingua);
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
            {aberta ? t.promocao.menos : t.promocao.verTudo}
          </T>
          <View style={{ transform: [{ rotate: aberta ? '-90deg' : '90deg' }] }}>
            <Icone nome="seguinte" tamanho={14} cor={cor.texto3} />
          </View>
        </View>
      )}
      {!inactivo && (
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
            nome={usada ? 'certo' : 'cartao'}
            tamanho={16}
            cor={usada ? cor.texto : cor.texto2}
            espessura={2.2}
          />
          <T v="legenda" style={{ color: usada ? cor.texto : cor.texto2 }}>
            {usadaHoje
              ? t.promocao.usadaHoje(horaDe(usadaHoje))
              : esgotada
                ? t.promocao.jaUsaste[promocao.periodoDoLimite]
                : temCartao
                  ? t.promocao.mostraOCartao
                  : t.promocao.comOCartao}
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
