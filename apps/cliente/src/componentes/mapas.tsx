import { ligacoesDosMapas } from '@nunos-lab/dominio';
import { Folha, Icone, MARGEM, T, cor, type NomeDoIcone } from '@nunos-lab/ui';
import { Platform, Pressable, View } from 'react-native';
import { abrir } from '../dados';

export type DestinoNoMapa = {
  /** O título da folha: a casa ou o parceiro. */
  nome: string;
  morada: string;
  /** O nome que vai na procura, à frente da morada. */
  procurar: string;
};

/** Uma linha de uma folha: o nome, um desenho à esquerda se houver, e a seta. */
export function LinhaDaFolha({
  nome,
  icone,
  separador = false,
  onPress,
}: {
  nome: string;
  icone?: NomeDoIcone;
  separador?: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      {separador && <View style={{ height: 1, backgroundColor: cor.linha, marginLeft: MARGEM }} />}
      <Pressable
        onPress={onPress}
        role="link"
        aria-label={nome}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          minHeight: 56,
          paddingHorizontal: MARGEM,
          backgroundColor: pressed ? cor.superficieAlta : 'transparent',
        })}
      >
        {icone && <Icone nome={icone} tamanho={20} cor={cor.texto2} />}
        <T v="forte" style={{ flex: 1 }}>
          {nome}
        </T>
        <Icone nome="seguinte" tamanho={18} cor={cor.texto3} />
      </Pressable>
    </View>
  );
}

/**
 * As apps de mapas em que a morada pode abrir, em linhas. Os Mapas da Apple
 * não aparecem no Android.
 */
export function OpcoesDeMapa({
  destino,
  aoEscolher,
}: {
  destino: DestinoNoMapa;
  aoEscolher?: () => void;
}) {
  const ligacoes = ligacoesDosMapas(destino.morada, destino.procurar);
  const mapas = [
    ...(Platform.OS === 'android' ? [] : [{ nome: 'Mapas da Apple', url: ligacoes.apple }]),
    { nome: 'Google Maps', url: ligacoes.google },
    { nome: 'Waze', url: ligacoes.waze },
  ];
  return (
    <>
      {mapas.map((m, i) => (
        <LinhaDaFolha
          key={m.nome}
          nome={m.nome}
          separador={i > 0}
          onPress={() => {
            aoEscolher?.();
            abrir(m.url);
          }}
        />
      ))}
    </>
  );
}

/** O «Ir» de um parceiro: a folha só com a escolha do mapa. */
export function EscolherMapa({
  destino,
  fechar,
  aoEscolher,
}: {
  destino: DestinoNoMapa | null;
  fechar: () => void;
  aoEscolher?: () => void;
}) {
  return (
    <Folha aberta={!!destino} fechar={fechar} titulo={destino?.nome ?? ''}>
      {destino && (
        <OpcoesDeMapa
          destino={destino}
          aoEscolher={() => {
            aoEscolher?.();
            fechar();
          }}
        />
      )}
    </Folha>
  );
}
