import type { Loja } from '@nunos-lab/dominio';
import { CONTINUO, T, cor } from '@nunos-lab/ui';
import { useRef, type ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { abrir, contar } from '../dados';
import { useTextos } from '../textos';
// O «n» já em preto: pintar o branco com tintColor não funciona na web.
const simboloPreto = require('../../assets/marca/simbolo-preto.png');

/** O pino é o ícone da app em branco (o Renato escolheu o D2): o quadrado branco com o «n» preto, aro preto e uma ponta até ao sítio. */
const ICONE = 24;
const ARO = 1;
const PONTA = 5;
export const ALTURA_DO_PINO = ICONE + 2 * ARO + PONTA;
/** A largura do pino com o nome, que é também a do toque. */
export const LARGURA_DO_PINO = 150;
/** Do sítio ao fundo da pastilha do nome (a letra do nome não cresce). */
const ATE_AO_FIM_DO_NOME = 25;

/**
 * O balão da casa escolhida tem tudo de medida fixa (a letra não cresce), para os mapas saberem
 * onde cabe: o de antes contava com 118 px e, no iPhone do Renato, saía mais alto e cortava-se.
 */
const BOTAO = 34;
const RODA = 6;
const SETA = 7;
const MARCAR = 80;
const IR = 50;
const FUNDO_DO_BALAO = '#1C1C1C';
/** O balão, com a seta. */
export const ALTURA_DO_BALAO = BOTAO + 2 * RODA + SETA;
/** Entre a seta e o cimo do pino: o aro creme sobe 5. */
const FOLGA_DO_ARO = 7;
/** O mínimo entre o balão e as bordas do mapa. */
export const FOLGA_NA_BORDA = 8;

type Ponto = { x: number; y: number };
/** Outra casa no mapa: o sítio e o nome, que mede a pastilha por baixo do pino. */
type Vizinha = Ponto & { nome: string };

export function temBalao(l: Loja): boolean {
  return !!l.marcar || !!l.morada;
}

export function larguraDoBalao(l: Loja): number {
  return RODA + (l.marcar ? MARCAR + RODA : 0) + (l.morada ? IR + RODA : 0);
}

/** O cimo do balão a contar do sítio: por cima, acima da ponta e do aro; por baixo, debaixo do nome. */
export function cimoDoBalao(porBaixo: boolean): number {
  return porBaixo ? ATE_AO_FIM_DO_NOME + 5 : -(ALTURA_DO_PINO + FOLGA_DO_ARO + ALTURA_DO_BALAO);
}

/**
 * O balão abre por cima do pino, como nos Mapas, a não ser que por baixo do nome tape menos das
 * outras casas: o de Nogueira do Cravo tapava o nome de Santa Maria da Feira (visto a 7 nov).
 */
export function balaoPorBaixo(l: Loja, p: Ponto, outras: Vizinha[]): boolean {
  const meia = larguraDoBalao(l) / 2;
  const tapa = (porBaixo: boolean) => {
    const cimo = p.y + cimoDoBalao(porBaixo);
    return outras.reduce((soma, o) => {
      // A pastilha do nome mede-se por alto: 6,6 pontos por letra, a 12 pontos.
      const meioNome = Math.min(LARGURA_DO_PINO, o.nome.length * 6.6 + 18) / 2;
      const lado = Math.max(ICONE / 2 + ARO + 5, meioNome);
      const largura = Math.min(p.x + meia, o.x + lado) - Math.max(p.x - meia, o.x - lado);
      const altura =
        Math.min(cimo + ALTURA_DO_BALAO, o.y + ATE_AO_FIM_DO_NOME) -
        Math.max(cimo, o.y - ALTURA_DO_PINO - 5);
      return soma + Math.max(0, largura) * Math.max(0, altura);
    }, 0);
  };
  return tapa(true) < tapa(false);
}

/**
 * Nos mapas vivos, se o balão do pino em `p` não cabe no mapa, quanto tem o mapa de andar
 * (positivo: para a direita e para baixo).
 */
export function quantoAndarParaCaber(
  l: Loja,
  p: Ponto,
  porBaixo: boolean,
  largura: number,
  altura: number,
) {
  const meia = larguraDoBalao(l) / 2 + FOLGA_NA_BORDA;
  const cimo = p.y + cimoDoBalao(porBaixo);
  const fundo = cimo + ALTURA_DO_BALAO;
  return {
    dx: p.x < meia ? meia - p.x : p.x > largura - meia ? largura - meia - p.x : 0,
    dy:
      cimo < FOLGA_NA_BORDA
        ? FOLGA_NA_BORDA - cimo
        : fundo > altura - FOLGA_NA_BORDA
          ? altura - FOLGA_NA_BORDA - fundo
          : 0,
  };
}

/**
 * Na web o balão vai dentro da caixa do pino, que cresce para o lado dele: o MapKit só conta os
 * toques dentro da caixa (um toque no balão, fora dela, fechava-o). Quanto cresce por cima e
 * por baixo; o MapKit segura a caixa pelo fundo, que desce o que ela crescer por baixo.
 */
export function caixaComBalao(porBaixo: boolean) {
  return porBaixo
    ? { cima: 0, baixo: cimoDoBalao(true) + ALTURA_DO_BALAO - ALTURA_DO_PINO }
    : { cima: -cimoDoBalao(false) - ALTURA_DO_PINO, baixo: 0 };
}

/**
 * Um pino com o nome por baixo, numa caixa com a ponta a meio da altura: os mapas vivos põem o
 * meio da caixa no sítio, e na imagem a caixa sobe metade (ALTURA_DO_PINO). O escolhido ganha um
 * aro creme (o Renato escolheu o 5). Com o balão (só na web), a caixa cresce para o lado dele.
 */
export function PinoDaCasa({
  nome,
  escolhido,
  balao,
  balaoPorBaixo = false,
}: {
  nome: string;
  escolhido: boolean;
  balao?: ReactNode;
  balaoPorBaixo?: boolean;
}) {
  const { cima, baixo } = balao ? caixaComBalao(balaoPorBaixo) : { cima: 0, baixo: 0 };
  return (
    // Sem «collapsable», o React Native funde esta caixa (só tem medidas) e o pino do iPhone ficava
    // com o tamanho do quadrado: desenhado 62 pontos ao lado do sítio, e sem responder ao toque.
    <View
      collapsable={false}
      style={{
        width: LARGURA_DO_PINO,
        height: cima + 2 * ALTURA_DO_PINO + baixo,
        paddingTop: cima,
        alignItems: 'center',
      }}
    >
      {escolhido && (
        <View
          style={{
            position: 'absolute',
            top: cima - 5,
            width: ICONE + 2 * ARO + 10,
            height: ALTURA_DO_PINO + 4,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: cor.claro,
            ...CONTINUO,
          }}
        />
      )}
      <View
        style={{
          width: ICONE + 2 * ARO,
          height: ICONE + 2 * ARO,
          borderRadius: 7,
          backgroundColor: cor.sobreClaro,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(0,0,0,0.55)',
          ...CONTINUO,
        }}
      >
        <View
          style={{
            width: ICONE,
            height: ICONE,
            borderRadius: 6,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            ...CONTINUO,
          }}
        >
          <Image
            source={simboloPreto}
            style={{ width: 12.4, height: 13 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: 4,
          borderRightWidth: 4,
          borderTopWidth: PONTA + 1,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: cor.sobreClaro,
        }}
      />
      {/* O nome numa pastilha escura, para se ler por cima das etiquetas do mapa. */}
      <View
        style={{
          marginTop: 3,
          paddingHorizontal: 9,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: 'rgba(10,10,10,0.78)',
        }}
      >
        <T
          v="legenda"
          numberOfLines={1}
          maxFontSizeMultiplier={1}
          style={{ fontSize: 12, lineHeight: 16 }}
        >
          {nome}
        </T>
      </View>
      {!!balao && (
        <View
          style={{
            position: 'absolute',
            top: cima + ALTURA_DO_PINO + cimoDoBalao(balaoPorBaixo),
            width: LARGURA_DO_PINO,
            alignItems: 'center',
          }}
        >
          {balao}
        </View>
      )}
    </View>
  );
}

/**
 * O balão da casa escolhida: só «Marcar» e «Ir», numa cápsula escura (o nome já está no pino; o
 * Renato preferiu-o ao cartão por baixo do mapa, 7 nov). A seta aponta ao pino: ao meio, ou em
 * `seta` quando o balão encosta a uma borda; `emBaixo` põe-no por baixo do nome, a apontar para cima.
 */
export function BalaoDaCasa({
  loja,
  aoIr,
  seta,
  emBaixo = false,
}: {
  loja: Loja;
  aoIr: () => void;
  seta?: number;
  emBaixo?: boolean;
}) {
  const t = useTextos();
  const largura = larguraDoBalao(loja);
  // A seta não passa para os cantos redondos.
  const meio = Math.min(
    Math.max(seta ?? largura / 2, BOTAO / 2 + RODA),
    largura - BOTAO / 2 - RODA,
  );
  const triangulo = (
    <View
      style={{
        marginLeft: meio - SETA,
        width: 0,
        height: 0,
        borderLeftWidth: SETA,
        borderRightWidth: SETA,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        ...(emBaixo
          ? { marginBottom: -1, borderBottomWidth: SETA + 1, borderBottomColor: FUNDO_DO_BALAO }
          : { marginTop: -1, borderTopWidth: SETA + 1, borderTopColor: FUNDO_DO_BALAO }),
      }}
    />
  );
  return (
    <View
      collapsable={false}
      role="group"
      aria-label={loja.nome}
      style={{ width: largura, height: ALTURA_DO_BALAO }}
    >
      {emBaixo && triangulo}
      <View
        style={{
          flexDirection: 'row',
          gap: RODA,
          padding: RODA,
          borderRadius: BOTAO / 2 + RODA,
          backgroundColor: FUNDO_DO_BALAO,
          boxShadow: '0 6px 18px rgba(0,0,0,0.55)',
          ...CONTINUO,
        }}
      >
        {!!loja.marcar && (
          <Pilula
            nome={t.mapa.marcar}
            rotulo={t.mapa.marcarEm(loja.nome)}
            principal
            largura={MARCAR}
            noMapa
            onPress={() => {
              contar('marcar', loja.id);
              abrir(loja.marcar);
            }}
          />
        )}
        {!!loja.morada && (
          <Pilula
            nome={t.mapa.ir}
            rotulo={t.mapa.irA(loja.nome)}
            largura={IR}
            noMapa
            onPress={aoIr}
          />
        )}
      </View>
      {!emBaixo && triangulo}
    </View>
  );
}

/**
 * No mapa do iPhone o balão anda com o mapa, fora do React: o Pressable mede-o noutro sítio e, com
 * o dedo a tremer, largava o toque. Lá a retenção não tem limite, e um arrasto não conta como toque.
 */
const SEM_LIMITE = { top: 4000, bottom: 4000, left: 4000, right: 4000 };

export function Pilula({
  nome,
  rotulo,
  principal = false,
  largura,
  noMapa = false,
  onPress,
}: {
  nome: string;
  rotulo: string;
  principal?: boolean;
  /** Fixa; sem ela, a pílula mede o nome. */
  largura?: number;
  noMapa?: boolean;
  onPress: () => void;
}) {
  const inicio = useRef<{ x: number; y: number } | null>(null);
  return (
    <Pressable
      onPressIn={(e) => {
        inicio.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      }}
      onPress={(e) => {
        const i = inicio.current;
        inicio.current = null;
        if (noMapa && i && Math.hypot(e.nativeEvent.pageX - i.x, e.nativeEvent.pageY - i.y) > 10)
          return;
        onPress();
      }}
      pressRetentionOffset={noMapa ? SEM_LIMITE : undefined}
      role="button"
      aria-label={rotulo}
      style={({ pressed }) => ({
        width: largura,
        paddingHorizontal: largura ? 0 : 18,
        height: BOTAO,
        borderRadius: BOTAO / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: principal
          ? pressed
            ? cor.claroPremido
            : cor.claro
          : pressed
            ? cor.linha
            : cor.superficieAlta,
      })}
    >
      <T
        v="forte"
        numberOfLines={1}
        maxFontSizeMultiplier={1}
        style={{ fontSize: 14, color: principal ? cor.sobreClaro : cor.texto }}
      >
        {nome}
      </T>
    </Pressable>
  );
}
