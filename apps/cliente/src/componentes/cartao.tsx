import {
  PROGRAMA_PREDEFINIDO,
  fraseDoCartao,
  fraseDoCorteOferecido,
  type ClienteEu,
} from '@nunos-lab/dominio';
import type { ReactNode } from 'react';
import { Image, View } from 'react-native';
import { CONTINUO, Carimbos, T, cor, raio } from '@nunos-lab/ui';

const palavra = require('../../assets/marca/palavra.png');

/** O cartão de cliente: o logótipo oficial, o nome, os carimbos, a conta. */
export function CartaoDoCliente({
  eu,
  recompensas,
  largura,
  novasDesde = null,
  aoAcabar,
  rodape,
}: {
  eu: Pick<ClienteEu, 'nome' | 'criadoEm' | 'cortes' | 'cartao' | 'programa'> | null;
  /** Cartões cheios por entregar (eu.recompensas.length). */
  recompensas: number;
  largura: number;
  /** As casas novas desde a última vez que o cliente viu o cartão (ver useCarimbosNovos). */
  novasDesde?: number | null;
  aoAcabar?: () => void;
  /** Os selos das carteiras: à direita do «0 de 10» quando cabem, senão por baixo. */
  rodape?: ReactNode;
}) {
  const carimbos = eu?.cartao.carimbos ?? 0;
  const objectivo = eu?.cartao.objectivo ?? eu?.programa.objectivo ?? 10;
  const recompensa = eu?.cartao.recompensa ?? eu?.programa.recompensa ?? PROGRAMA_PREDEFINIDO.recompensa;
  const desde = eu ? new Date(eu.criadoEm * 1000).getFullYear() : null;
  // Cheio e sem nada por entregar: o carimbo que o completou já foi o corte da oferta.
  const entregue = carimbos >= objectivo && recompensas === 0;
  // Antes da primeira medição a largura pode vir a zero: nunca um círculo negativo.
  const tamanho = Math.max(28, Math.floor((largura - 44 - 4 * 12) / 5));
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
    >
      <View
        aria-hidden
        style={{
          position: 'absolute',
          top: -90,
          right: -70,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: 'rgba(244,241,236,0.05)',
        }}
      />
      <Image
        source={palavra}
        style={{ width: 120, height: Math.round((120 * 227) / 1200) }}
        resizeMode="contain"
        accessibilityLabel="Nuno's Lab"
        role="img"
      />
      <T v="subtitulo" style={{ marginTop: 24 }} numberOfLines={1}>
        {eu?.nome || 'O teu cartão'}
      </T>
      <T v="legenda" style={{ color: cor.texto2, marginTop: 3 }}>
        {eu
          ? `Cliente desde ${desde} · ${eu.cortes} ${eu.cortes === 1 ? 'corte' : 'cortes'}${eu.cartao.numero > 1 ? ` · ${eu.cartao.numero}.º cartão` : ''}`
          : 'Um carimbo por corte'}
      </T>
      <View style={{ marginTop: 22 }}>
        <Carimbos
          carimbos={carimbos}
          objectivo={objectivo}
          tamanho={tamanho}
          porLinha={5}
          novasDesde={novasDesde}
          aoAcabar={aoAcabar}
        />
      </View>
      {/* O «0 de 10» e a frase à esquerda; o selo da carteira à direita quando cabe, senão por baixo. */}
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
        <View style={{ flexGrow: 1, flexBasis: 0, minWidth: 110 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <T v="destaque">{carimbos}</T>
            <T v="forte" style={{ color: cor.texto2, fontSize: 18 }}>
              de {objectivo}
            </T>
          </View>
          <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
            {entregue
              ? fraseDoCorteOferecido(recompensa)
              : fraseDoCartao(carimbos, { objectivo, recompensa })}
          </T>
          {entregue && (
            <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
              O próximo carimbo abre um cartão novo
            </T>
          )}
        </View>
        {rodape}
      </View>
    </View>
  );
}
