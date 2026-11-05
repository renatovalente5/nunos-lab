import { ligacoesDosMapas } from '@nunos-lab/dominio';
import { Folha, Icone, MARGEM, T, cor } from '@nunos-lab/ui';
import { Platform, Pressable, View } from 'react-native';
import { abrir } from '../dados';

export type DestinoNoMapa = {
  /** O título da folha: a casa ou o parceiro. */
  nome: string;
  morada: string;
  /** O nome que vai na procura, à frente da morada. */
  procurar: string;
};

/**
 * O «Ir»: escolher em que app de mapas abrir a morada. Os Mapas da Apple não
 * aparecem no Android.
 */
export function EscolherMapa({
  destino,
  fechar,
  aoEscolher,
}: {
  destino: DestinoNoMapa | null;
  fechar: () => void;
  aoEscolher?: () => void;
}) {
  const ligacoes = destino ? ligacoesDosMapas(destino.morada, destino.procurar) : null;
  const mapas = [
    ...(Platform.OS === 'android' ? [] : [{ nome: 'Mapas da Apple', url: ligacoes?.apple }]),
    { nome: 'Google Maps', url: ligacoes?.google },
    { nome: 'Waze', url: ligacoes?.waze },
  ];
  return (
    <Folha aberta={!!destino} fechar={fechar} titulo={destino?.nome ?? ''}>
      {mapas.map((m, i) => (
        <View key={m.nome}>
          {i > 0 && <View style={{ height: 1, backgroundColor: cor.linha, marginLeft: MARGEM }} />}
          <Pressable
            onPress={() => {
              if (!m.url) return;
              aoEscolher?.();
              fechar();
              abrir(m.url);
            }}
            role="link"
            aria-label={`Abrir em ${m.nome}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 56,
              paddingHorizontal: MARGEM,
              backgroundColor: pressed ? cor.superficieAlta : 'transparent',
            })}
          >
            <T v="forte" style={{ flex: 1 }}>
              {m.nome}
            </T>
            <Icone nome="seguinte" tamanho={18} cor={cor.texto3} />
          </Pressable>
        </View>
      ))}
    </Folha>
  );
}
