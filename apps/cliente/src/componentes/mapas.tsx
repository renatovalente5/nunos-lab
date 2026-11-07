import { ligacoesDosMapas, semPartir } from '@nunos-lab/dominio';
import { Folha, Grupo, Icone, Separador, T, cor, type NomeDoIcone } from '@nunos-lab/ui';
import { Platform, Pressable, View } from 'react-native';
import { abrir } from '../dados';

export type DestinoNoMapa = {
  /** O título da folha: a casa ou o parceiro. */
  nome: string;
  morada: string;
  /** O nome que vai na procura, à frente da morada. */
  procurar: string;
};

/** Uma linha do cartão de uma folha: o desenho, o nome e a seta, como as linhas do «Mais». */
export function LinhaDaFolha({
  nome,
  icone,
  separador = false,
  onPress,
}: {
  nome: string;
  icone: NomeDoIcone;
  separador?: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      {separador && <Separador recuo={56} />}
      <Pressable
        onPress={onPress}
        role="link"
        aria-label={nome}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          minHeight: 56,
          backgroundColor: pressed ? cor.linha : 'transparent',
        })}
      >
        <Icone nome={icone} tamanho={22} />
        <T v="forte" style={{ marginLeft: 18, flex: 1 }}>
          {nome}
        </T>
        <Icone nome="seguinte" tamanho={18} cor={cor.texto3} />
      </Pressable>
    </View>
  );
}

/**
 * As apps de mapas em que a morada pode abrir, num cartão. Os Mapas da Apple
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
  const mapas: { nome: string; icone: NomeDoIcone; url: string }[] = [
    ...(Platform.OS === 'android'
      ? []
      : [{ nome: 'Mapas da Apple', icone: 'mapaDobrado' as const, url: ligacoes.apple }]),
    { nome: 'Google Maps', icone: 'mapa', url: ligacoes.google },
    { nome: 'Waze', icone: 'navegar', url: ligacoes.waze },
  ];
  // O cartão destaca-se da folha, que é da cor dos outros cartões.
  return (
    <Grupo style={{ marginTop: 10, backgroundColor: cor.superficieAlta }}>
      {mapas.map((m, i) => (
        <LinhaDaFolha
          key={m.nome}
          nome={m.nome}
          icone={m.icone}
          separador={i > 0}
          onPress={() => {
            aoEscolher?.();
            abrir(m.url);
          }}
        />
      ))}
    </Grupo>
  );
}

/** O «Ir» de uma casa ou de um parceiro: o nome, a morada e a escolha do mapa. */
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
    <Folha
      aberta={!!destino}
      fechar={fechar}
      titulo={destino?.nome ?? ''}
      subtitulo={destino?.morada ? semPartir(destino.morada) : undefined}
    >
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
