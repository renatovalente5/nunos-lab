import { View } from 'react-native';
import { cor, MARGEM, raio } from '../tema';
import { Icone } from './icone';
import { Botao } from './pecas';
import { T } from './texto';

/** Enquanto chegam os dados pela primeira vez: a forma do ecrã, sem texto. */
export function Esqueleto() {
  const bloco = (largura: number | `${number}%`, altura: number, r: number = raio.grupo) => (
    <View
      style={{ width: largura, height: altura, borderRadius: r, backgroundColor: cor.superficie }}
    />
  );
  return (
    <View style={{ paddingHorizontal: MARGEM, gap: 14, marginTop: 28 }} aria-busy>
      {bloco(110, 12, 6)}
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {bloco(260, 312, raio.cartao)}
        {bloco(60, 312, raio.cartao)}
      </View>
      {bloco(90, 12, 6)}
      {bloco('100%', 78)}
      {bloco('100%', 78)}
    </View>
  );
}

/** Sem rede e sem nada guardado: diz-se em duas palavras e dá-se o botão. */
export function SemLigacao({ tentar }: { tentar: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 80, gap: 14 }}>
      <Icone nome="site" tamanho={34} cor={cor.texto3} />
      <T v="subtitulo" style={{ textAlign: 'center' }}>
        Sem ligação
      </T>
      <Botao nome="Tentar outra vez" onPress={tentar} />
    </View>
  );
}
