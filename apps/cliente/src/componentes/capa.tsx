import type { IconeDaCategoria, ParceiroPublico } from '@nunos-lab/dominio';
import { corParaBranco, misturar } from '@nunos-lab/dominio';
import { useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { CONTINUO, cor, Icone } from '@nunos-lab/ui';

/**
 * A capa de um parceiro: a cor dele em gradiente com o desenho da categoria em grande. Sem fotografias
 * (o Renato, 11 nov 2026: «não devemos meter fotos de capa, será só a cor»). Por cima, um véu escuro,
 * para o texto branco se ler. A cor vem escurecida se for clara, para o branco passar 4,5:1.
 */
export function Capa({
  parceiro,
  icone,
  altura,
  raio = 0,
  raioBaixo,
  veu = true,
  borda = false,
  esbater = false,
  children,
}: {
  parceiro: Pick<ParceiroPublico, 'cor'>;
  icone: IconeDaCategoria;
  altura: number;
  raio?: number;
  /** Só os cantos de baixo redondos (a capa da página do parceiro). */
  raioBaixo?: number;
  /** O véu de cima e de baixo; «lado», da esquerda para a direita (o destaque baixo das Vantagens). */
  veu?: boolean | 'lado';
  /**
   * Um fio claro à volta, para o cartão se destacar do preto. Vai por cima da cor e do véu: clareia o
   * que lá está e fica da cor do cartão. Por baixo era um traço cinzento à volta (o Renato, 9 nov).
   */
  borda?: boolean;
  /** A capa a desvanecer para o fundo da página, em baixo (sem borda). */
  esbater?: boolean;
  children?: ReactNode;
}) {
  const id = `v${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const base = corParaBranco(parceiro.cor);
  const escura = misturar(base, '#000000', 0.45);
  const cantos = {
    borderTopLeftRadius: raio,
    borderTopRightRadius: raio,
    borderBottomLeftRadius: raioBaixo ?? raio,
    borderBottomRightRadius: raioBaixo ?? raio,
    ...CONTINUO,
  };
  return (
    <View style={{ height: altura, ...cantos, overflow: 'hidden', backgroundColor: base }}>
      {
        <>
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden
          >
            <Defs>
              <LinearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={base} />
                <Stop offset="1" stopColor={escura} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}f)`} />
          </Svg>
          <View
            style={{
              position: 'absolute',
              right: -altura * 0.12,
              bottom: -altura * 0.1,
              transform: [{ rotate: '-12deg' }],
            }}
            aria-hidden
          >
            <Icone
              nome={icone}
              tamanho={altura * 0.95}
              cor="#FFFFFF"
              espessura={1.1}
              opacidade={0.13}
            />
          </View>
        </>
      }
      {veu && (
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          aria-hidden
        >
          <Defs>
            {veu === 'lado' ? (
              // O texto fica à esquerda: escurece-se esse lado e o da direita fica vivo.
              <LinearGradient id={`${id}v`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.4} />
                <Stop offset="0.6" stopColor="#000000" stopOpacity={0.1} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0} />
              </LinearGradient>
            ) : (
              <LinearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.45} />
                <Stop offset="0.3" stopColor="#000000" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#000000" stopOpacity={0.05} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0.86} />
              </LinearGradient>
            )}
          </Defs>
          <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}v)`} />
        </Svg>
      )}
      {esbater && (
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          aria-hidden
        >
          <Defs>
            <LinearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.25" stopColor={cor.fundo} stopOpacity={0} />
              <Stop offset="1" stopColor={cor.fundo} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="1" height="1" fill={`url(#${id}e)`} />
        </Svg>
      )}
      {borda && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            ...cantos,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        />
      )}
      {children}
    </View>
  );
}
