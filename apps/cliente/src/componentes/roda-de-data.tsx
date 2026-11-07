import { CONTINUO, T, cor } from '@nunos-lab/ui';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useTextos } from '../textos';

/** Uma linha da roda, em pontos; cinco linhas à vista, a do meio escolhida. */
const LINHA = 44;
const A_VISTA = 5;
const DIAS_DO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** O dia e o mês do aniversário, como a API os guarda: «MM-DD». */
export const paraAniversario = (dia: number, mes: number) =>
  `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/**
 * O aniversário escolhe-se em duas rodas, dia e mês, como nas do iPhone: sem
 * teclado, sem formato para acertar, e Fevereiro só vai até 29. Funciona com
 * o dedo no telemóvel e com a roda do rato na web. Só chama `aoMudar` quando
 * o cliente roda: o que a roda mostra ao abrir não é uma escolha.
 */
export function RodaDeData({
  valor,
  aoMudar,
}: {
  /** «MM-DD», ou null para hoje. */
  valor: string | null;
  aoMudar: (valor: string) => void;
}) {
  const t = useTextos();
  const hoje = new Date();
  const [mes, setMes] = useState(valor ? Number(valor.slice(0, 2)) : hoje.getMonth() + 1);
  const [dia, setDia] = useState(valor ? Number(valor.slice(3)) : hoje.getDate());
  const dias = DIAS_DO_MES[mes - 1]!;
  const diaValido = Math.min(dia, dias);
  // Só o que o cliente roda conta. Ao abrir, a roda mostra hoje (ou o guardado) sem o dar
  // como escolhido: senão um «Guardar» distraído fazia anos hoje. (O rolar de arranque
  // também chega aqui, com os mesmos valores, e não conta.)
  const escolher = (d: number, m: number) => {
    if (d === dia && m === mes) return;
    setDia(d);
    setMes(m);
    aoMudar(paraAniversario(Math.min(d, DIAS_DO_MES[m - 1]!), m));
  };
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
        aoEscolher={(i) => escolher(i + 1, mes)}
        largura={96}
        alinhar="flex-end"
        rotulo={t.conta.dia}
      />
      <Roda
        itens={t.conta.meses}
        indice={mes - 1}
        aoEscolher={(i) => escolher(dia, i + 1)}
        largura={168}
        alinhar="flex-start"
        rotulo={t.conta.mes}
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
  // A linha de abertura vai na própria ScrollView: um scrollTo na montagem, dentro de um Modal,
  // pode chegar antes da medida.
  const inicial = useRef(indice * LINHA).current;
  // O que esta roda já disse ao pai. Quando o `indice` volta igual, a roda já lá está (ou a
  // encostar): mexê-la aqui era saltar debaixo do dedo. Só se mexe quando é o pai a mudar
  // (ao abrir, ou o dia a encolher em Fevereiro).
  const dito = useRef<number | null>(null);
  useEffect(() => {
    if (indice === dito.current) return;
    dito.current = indice;
    ref.current?.scrollTo({ y: indice * LINHA, animated: false });
    setAVer(indice);
  }, [indice, itens.length]);
  const escolher = (i: number) => {
    dito.current = i;
    aoEscolher(i);
  };
  const linhaDe = (ev: NativeSyntheticEvent<NativeScrollEvent>) =>
    Math.min(itens.length - 1, Math.max(0, Math.round(ev.nativeEvent.contentOffset.y / LINHA)));
  // Na web (roda do rato) os eventos de «parou» não vêm: a escolha fixa-se quando o rolar sossega.
  const sossego = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(sossego.current ?? undefined), []);
  const aoRolar = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = linhaDe(ev);
    setAVer(i);
    if (sossego.current) clearTimeout(sossego.current);
    sossego.current = setTimeout(() => escolher(i), 160);
  };
  const aoParar = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = linhaDe(ev);
    setAVer(i);
    if (i !== indice) escolher(i);
  };
  return (
    <ScrollView
      ref={ref}
      contentOffset={{ x: 0, y: inicial }}
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
