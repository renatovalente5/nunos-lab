import { CONTINUO, T, cor } from '@nunos-lab/ui';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

/** Uma linha da roda, em pontos; cinco linhas à vista, a do meio escolhida. */
const LINHA = 44;
const A_VISTA = 5;
const MESES_POR_EXTENSO = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const DIAS_DO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** O dia e o mês do aniversário, como a API os guarda: «MM-DD». */
export const paraAniversario = (dia: number, mes: number) =>
  `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/**
 * O aniversário escolhe-se em duas rodas, dia e mês, como nas do iPhone: sem
 * teclado, sem formato para acertar, e Fevereiro só vai até 29. Funciona com
 * o dedo no telemóvel e com a roda do rato na web.
 */
export function RodaDeData({
  valor,
  aoMudar,
}: {
  /** «MM-DD», ou null para hoje. */
  valor: string | null;
  aoMudar: (valor: string) => void;
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(valor ? Number(valor.slice(0, 2)) : hoje.getMonth() + 1);
  const [dia, setDia] = useState(valor ? Number(valor.slice(3)) : hoje.getDate());
  const dias = DIAS_DO_MES[mes - 1]!;
  const diaValido = Math.min(dia, dias);
  useEffect(() => {
    aoMudar(paraAniversario(diaValido, mes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaValido, mes]);
  return (
    <View
      style={{ height: LINHA * A_VISTA, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
    >
      {/* A faixa da linha escolhida, atrás das duas rodas. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: LINHA * 2,
          height: LINHA,
          borderRadius: 12,
          backgroundColor: cor.superficieAlta,
          ...CONTINUO,
        }}
      />
      <Roda
        itens={Array.from({ length: dias }, (_, i) => String(i + 1))}
        indice={diaValido - 1}
        aoEscolher={(i) => setDia(i + 1)}
        largura={96}
        alinhar="flex-end"
        rotulo="Dia"
      />
      <Roda
        itens={MESES_POR_EXTENSO}
        indice={mes - 1}
        aoEscolher={(i) => setMes(i + 1)}
        largura={168}
        alinhar="flex-start"
        rotulo="Mês"
      />
    </View>
  );
}

function Roda({
  itens,
  indice,
  aoEscolher,
  largura,
  alinhar,
  rotulo,
}: {
  itens: string[];
  indice: number;
  aoEscolher: (indice: number) => void;
  largura: number;
  alinhar: 'flex-start' | 'flex-end';
  rotulo: string;
}) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const [aVer, setAVer] = useState(indice);
  // Ao abrir, a roda põe-se na linha guardada (sem animação); se a lista encolher (Fevereiro), acompanha.
  useEffect(() => {
    ref.current?.scrollTo({ y: indice * LINHA, animated: false });
    setAVer(indice);
  }, [indice, itens.length]);
  // Na web (roda do rato) os eventos de «parou» não vêm: a escolha fixa-se quando o rolar sossega.
  const sossego = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aoRolar = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(
      itens.length - 1,
      Math.max(0, Math.round(ev.nativeEvent.contentOffset.y / LINHA)),
    );
    setAVer(i);
    if (sossego.current) clearTimeout(sossego.current);
    sossego.current = setTimeout(() => aoEscolher(i), 160);
  };
  const aoParar = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(
      itens.length - 1,
      Math.max(0, Math.round(ev.nativeEvent.contentOffset.y / LINHA)),
    );
    setAVer(i);
    if (i !== indice) aoEscolher(i);
  };
  return (
    <ScrollView
      ref={ref}
      style={{ width: largura, height: LINHA * A_VISTA }}
      contentContainerStyle={{ paddingVertical: LINHA * 2 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={LINHA}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={aoRolar}
      onMomentumScrollEnd={aoParar}
      onScrollEndDrag={aoParar}
      role="list"
      aria-label={rotulo}
    >
      {itens.map((item, i) => {
        const distancia = Math.abs(i - aVer);
        return (
          <View
            key={item}
            style={{
              height: LINHA,
              justifyContent: 'center',
              alignItems: alinhar,
              paddingHorizontal: 14,
            }}
            role="option"
            aria-selected={i === aVer}
          >
            <T
              v={distancia === 0 ? 'subtitulo' : 'corpo'}
              style={{
                fontSize: distancia === 0 ? 22 : 19,
                color: cor.texto,
                opacity: distancia === 0 ? 1 : distancia === 1 ? 0.5 : 0.25,
              }}
            >
              {item}
            </T>
          </View>
        );
      })}
    </ScrollView>
  );
}
