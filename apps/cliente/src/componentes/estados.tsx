import { View } from 'react-native';
import { cor, MARGEM, raio } from '../tema';
import { Icone } from './icone';
import { Botao } from './pecas';
import { T } from './texto';

/** Enquanto chegam os dados pela primeira vez: a forma do ecrã, sem texto. */
export function Esqueleto() {
  const bloco = (largura: number | `${number}%`, altura: number, r: number = raio.botao) => (
    <View
      style={{ width: largura, height: altura, borderRadius: r, backgroundColor: cor.superficie }}
    />
  );
  return (
    <View style={{ paddingHorizontal: MARGEM, gap: 14, marginTop: 36 }} aria-busy>
      {bloco(170, 26)}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {bloco(276, 276, raio.cartao)}
        {bloco(60, 276, raio.cartao)}
      </View>
      {bloco(130, 26)}
      {bloco('100%', 78)}
      {bloco('100%', 78)}
    </View>
  );
}

/** Sem rede e sem nada guardado: diz-se em duas palavras e dá-se o botão. */
export function SemLigacao({ tentar }: { tentar: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 80, gap: 16 }}>
      <Icone nome="site" tamanho={34} cor={cor.texto3} />
      <T v="seccao" style={{ textAlign: 'center' }}>
        Sem ligação
      </T>
      <Botao nome="Tentar outra vez" onPress={tentar} />
    </View>
  );
}
