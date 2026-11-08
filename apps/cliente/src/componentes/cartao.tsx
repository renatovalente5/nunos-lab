import {
  PROGRAMA_PREDEFINIDO,
  fraseDoCartao,
  fraseDoCorteOferecido,
  type ClienteEu,
} from '@nunos-lab/dominio';
import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { CONTINUO, Carimbos, T, cor, raio, useLingua } from '@nunos-lab/ui';
import { useTextos } from '../textos';

const palavra = require('../../assets/marca/palavra.png');
const simbolo = require('../../assets/marca/simbolo.png');

/** As barras no lugar do número enquanto o cartão não chega: creme a 8 % sobre o cartão. */
const ESBATIDO = 'rgba(244,241,236,0.08)';

/**
 * O cartão de cliente: o logótipo oficial, «Cliente desde…», os carimbos, a conta e o prémio. O nome
 * saiu a 7 nov; a frase do «Cliente desde» voltou a 8 nov (o Renato, nas notas do Notion).
 */
export function CartaoDoCliente({
  eu,
  recompensas,
  largura,
  novasDesde = null,
  aoAcabar,
  rodape,
  espera = null,
  tentar,
  programa = null,
}: {
  eu: Pick<ClienteEu, 'criadoEm' | 'cortes' | 'cartao' | 'programa'> | null;
  /** Cartões cheios por entregar (eu.recompensas.length). */
  recompensas: number;
  largura: number;
  /** As casas novas desde a última vez que o cliente viu o cartão (ver useCarimbosNovos). */
  novasDesde?: number | null;
  aoAcabar?: () => void;
  /** Os selos das carteiras: à direita do «0 de 10» quando cabem, senão por baixo. */
  rodape?: ReactNode;
  /**
   * Com sessão mas ainda sem «eu»: a carregar (os círculos esbatidos e sem
   * número, que um «0 de 10» mentia a quem tem carimbos) ou sem ligação (o
   * aviso por baixo do logótipo, com toque para tentar outra vez).
   */
  espera?: 'a-carregar' | 'sem-ligacao' | null;
  tentar?: () => void;
  /** O programa de agora (do /api/app), para o cartão sem sessão: sem ele valia o de origem da app. */
  programa?: { objectivo: number; recompensa: string } | null;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const carimbos = eu?.cartao.carimbos ?? 0;
  const objectivo =
    eu?.cartao.objectivo ??
    eu?.programa.objectivo ??
    programa?.objectivo ??
    PROGRAMA_PREDEFINIDO.objectivo;
  const recompensa =
    eu?.cartao.recompensa ??
    eu?.programa.recompensa ??
    programa?.recompensa ??
    PROGRAMA_PREDEFINIDO.recompensa;
  // Cheio e sem nada por entregar: o carimbo que o completou já foi o corte da oferta.
  const entregue = carimbos >= objectivo && recompensas === 0;
  // Antes da primeira medição a largura pode vir a zero: nunca um círculo negativo.
  const tamanho = Math.max(28, Math.floor((largura - 44 - 4 * 12) / 5));
  const aEsperar = espera !== null;
  return (
    <View
      style={{
        borderRadius: raio.cartao,
        padding: 22,
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: '#262421',
        overflow: 'hidden',
        ...CONTINUO,
      }}
      aria-busy={espera === 'a-carregar'}
    >
      {/* O fundo (escolha do Renato, 7 nov 2026: a opção 1): liso, com o «n» da marca, a imagem
          oficial, grande e quase apagado no canto. O gradiente grafite da opção 3 saiu: «não gostei». */}
      <Image
        source={simbolo}
        aria-hidden
        resizeMode="contain"
        style={{
          position: 'absolute',
          top: -24,
          right: -36,
          width: 228,
          height: 240,
          opacity: 0.07,
        }}
      />
      <Image
        source={palavra}
        style={{ width: 120, height: Math.round((120 * 227) / 1200) }}
        resizeMode="contain"
        accessibilityLabel="Nuno's Lab"
        role="img"
      />
      {eu && !aEsperar && (
        <T v="legenda" style={{ color: cor.texto2, marginTop: 10 }} numberOfLines={1}>
          {t.cartao.clienteDesde(
            new Date(eu.criadoEm * 1000).getFullYear(),
            eu.cartao.numero,
            eu.cortes,
          )}
        </T>
      )}
      {espera === 'sem-ligacao' && (
        <Pressable
          onPress={tentar}
          role="button"
          aria-label={t.cartao.semLigacaoTentar}
          hitSlop={8}
          style={({ pressed }) => ({ marginTop: 24, opacity: pressed ? 0.6 : 1 })}
        >
          <T v="subtitulo" numberOfLines={1}>
            {t.cartao.semLigacaoNoCartao}
          </T>
          <T v="legenda" style={{ color: cor.texto2, marginTop: 3 }}>
            {t.cartao.tocarParaTentar}
          </T>
        </Pressable>
      )}
      {/* À espera, os círculos ficam esbatidos e fora do leitor de ecrã: ainda não se sabe quantos estão cheios. */}
      <View style={{ marginTop: 22, opacity: aEsperar ? 0.35 : 1 }} aria-hidden={aEsperar}>
        <Carimbos
          carimbos={carimbos}
          objectivo={objectivo}
          tamanho={tamanho}
          porLinha={5}
          novasDesde={novasDesde}
          aoAcabar={aoAcabar}
        />
      </View>
      {/* O «0 de 10» à esquerda e o selo da carteira à direita quando cabe (senão por baixo). */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 12,
          rowGap: 16,
          marginTop: 22,
        }}
      >
        {aEsperar ? (
          // No lugar do «0 de 10»: uma barra sem número, porque ainda não se sabe.
          <View style={{ flexGrow: 1, flexBasis: 0, minWidth: 110 }} aria-hidden>
            <View style={{ width: 72, height: 28, borderRadius: 8, backgroundColor: ESBATIDO }} />
          </View>
        ) : (
          <View
            style={{
              flexGrow: 1,
              flexBasis: 0,
              minWidth: 110,
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 6,
            }}
          >
            <T v="destaque">{carimbos}</T>
            <T v="forte" style={{ color: cor.texto2, fontSize: 18 }}>
              {t.cartao.deObjectivo(objectivo)}
            </T>
          </View>
        )}
        {rodape}
      </View>
      {/* A frase por baixo, a toda a largura: ao lado do selo partia-se em duas linhas. */}
      {aEsperar ? (
        <View
          style={{
            width: 150,
            height: 12,
            borderRadius: 6,
            backgroundColor: ESBATIDO,
            marginTop: 12,
          }}
          aria-hidden
        />
      ) : (
        <>
          <T v="legenda" style={{ color: cor.texto2, marginTop: 8 }}>
            {entregue
              ? fraseDoCorteOferecido(recompensa, lingua)
              : fraseDoCartao(carimbos, { objectivo, recompensa }, lingua)}
          </T>
          {entregue && (
            <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
              {t.cartao.proximoCarimbo}
            </T>
          )}
        </>
      )}
    </View>
  );
}
