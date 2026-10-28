import { fraseDoCartao, type ClienteEu } from '@nunos-lab/dominio';
import { Image, View } from 'react-native';
import { CONTINUO, Carimbos, T, cor, raio } from '@nunos-lab/ui';

const palavra = require('../../assets/marca/palavra.png');

/** O cartão de cliente: o logótipo oficial, o nome, os carimbos, a conta. */
export function CartaoDoCliente({
  eu,
  largura,
}: {
  eu: Pick<ClienteEu, 'nome' | 'criadoEm' | 'cortes' | 'cartao' | 'programa'> | null;
  largura: number;
}) {
  const carimbos = eu?.cartao.carimbos ?? 0;
  const objectivo = eu?.cartao.objectivo ?? eu?.programa.objectivo ?? 10;
  const recompensa = eu?.cartao.recompensa ?? eu?.programa.recompensa ?? 'Corte grátis';
  const desde = eu ? new Date(eu.criadoEm * 1000).getFullYear() : null;
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
          ? `Cliente desde ${desde} · ${eu.cortes} ${eu.cortes === 1 ? 'corte' : 'cortes'}`
          : 'Um carimbo por corte'}
      </T>
      <View style={{ marginTop: 22 }}>
        <Carimbos carimbos={carimbos} objectivo={objectivo} tamanho={tamanho} porLinha={5} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 22 }}>
        <T v="destaque">{carimbos}</T>
        <T v="forte" style={{ color: cor.texto2, fontSize: 18 }}>
          de {objectivo}
        </T>
      </View>
      <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
        {fraseDoCartao(carimbos, { objectivo, recompensa })}
      </T>
    </View>
  );
}
