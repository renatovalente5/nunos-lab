/**
 * O saldo à vista (o Renato, 10 nov 2026): a pílula no topo das Vantagens e o aviso que desce por
 * cima de qualquer ecrã quando o saldo mexe (um amigo foi à barbearia, o barbeiro usou-o ao balcão,
 * o Nuno acertou-o). «O cliente tem de conseguir perceber isso»: o aviso diz o quê e quanto, com um
 * toque no pulso; a pílula conta do valor antigo ao novo quando as Vantagens estão à frente.
 */
import { eurosComSinal, euros } from '@nunos-lab/dominio';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CONTINUO,
  Icone,
  LARGURA_MAXIMA,
  MARGEM,
  T,
  cor,
  raio,
  useLingua,
  vibrar,
} from '@nunos-lab/ui';
import {
  chaveDoMovimento,
  fraseDoMovimento,
  guardarConvite,
  lerVisto,
  marcarVisto,
  useConviteGuardado,
  useQrAberto,
} from '../carteira';
import { ErroDaConta, aceitarConvite, mensagemDe, useEuDaCache, useTemSessao } from '../conta';
import { useTextos } from '../textos';

/** Na web não há módulo nativo de animações: aí o Animated corre em JavaScript. */
const NATIVO = Platform.OS !== 'web';
/** O verde de «entrou dinheiro», o mesmo do «Aberto» das barbearias. */
const VERDE = cor.aberto;

function semMovimento(): Promise<boolean> {
  return typeof AccessibilityInfo.isReduceMotionEnabled === 'function'
    ? AccessibilityInfo.isReduceMotionEnabled().catch(() => false)
    : Promise.resolve(false);
}

/**
 * A pílula do saldo, no topo direito das Vantagens. Começa no valor que o cliente viu da última vez
 * e, com o ecrã à frente, conta até ao de agora, com um pulo (verde quando entrou).
 */
export function PilulaDoSaldo({ saldo, focado }: { saldo: number; focado: boolean }) {
  const t = useTextos();
  const lingua = useLingua();
  const [mostrado, setMostrado] = useState(() => lerVisto()?.saldo ?? saldo);
  const naVista = useRef(mostrado);
  const [escala] = useState(() => new Animated.Value(1));
  const [entrou, setEntrou] = useState(false);
  useEffect(() => {
    if (!focado || naVista.current === saldo) return;
    const de = naVista.current;
    const para = saldo;
    let vivo = true;
    let passo: ReturnType<typeof setInterval> | undefined;
    void semMovimento().then((sem) => {
      if (!vivo) return;
      if (sem) {
        naVista.current = para;
        setMostrado(para);
        return;
      }
      setEntrou(para > de);
      Animated.sequence([
        Animated.spring(escala, {
          toValue: 1.12,
          useNativeDriver: NATIVO,
          speed: 40,
          bounciness: 12,
        }),
        Animated.spring(escala, { toValue: 1, useNativeDriver: NATIVO, speed: 12, bounciness: 10 }),
      ]).start();
      // Em euros inteiros, um a um (até 12 passos); com cêntimos, salta logo para o fim.
      const inteiros = de % 100 === 0 && para % 100 === 0;
      const passos = inteiros ? Math.min(Math.abs(para - de) / 100, 12) : 1;
      let i = 0;
      passo = setInterval(
        () => {
          i += 1;
          const v = i >= passos ? para : de + Math.round(((para - de) * i) / passos / 100) * 100;
          naVista.current = v;
          setMostrado(v);
          if (i >= passos) {
            clearInterval(passo);
            setTimeout(() => setEntrou(false), 1200);
          }
        },
        Math.max(70, Math.round(560 / passos)),
      );
    });
    return () => {
      vivo = false;
      if (passo) clearInterval(passo);
    };
  }, [focado, saldo, escala]);
  return (
    <Animated.View style={{ transform: [{ scale: escala }] }}>
      <Pressable
        onPress={() => router.push('/carteira')}
        role="link"
        aria-label={t.carteira.abrir(euros(saldo, lingua))}
        hitSlop={6}
        style={({ pressed }) => ({
          height: 40,
          paddingLeft: 12,
          paddingRight: 15,
          borderRadius: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          backgroundColor: pressed ? cor.linha : cor.superficieAlta,
        })}
      >
        <Icone nome="carteira" tamanho={19} espessura={2} cor={entrou ? VERDE : cor.texto} />
        <T
          v="forte"
          maxFontSizeMultiplier={1.4}
          style={{ fontSize: 15, fontVariant: ['tabular-nums'], color: entrou ? VERDE : cor.texto }}
        >
          {euros(mostrado, lingua)}
        </T>
      </Pressable>
    </Animated.View>
  );
}

type Aviso = {
  /** Em cêntimos, com o sinal; null num aviso sem valor (um convite que não serviu). */
  valor: number | null;
  texto: string;
  /** O movimento, para a carteira o acender ao abrir do aviso. */
  movimentoId: number | null;
  /** Um toque leva à carteira (os avisos de dinheiro; os de erro não). */
  abreCarteira: boolean;
};

/** Os erros que passam: o convite fica guardado e tenta-se outra vez com o próximo «eu». */
const PASSAGEIROS = new Set(['rede', 'interno', 'sessao', 'muitas_tentativas']);

/**
 * O aviso do saldo, por cima de todos os ecrãs (montado na raiz, depois das rotas). Compara o último
 * movimento do «eu» com o último que o cliente viu; a primeira vez neste aparelho só regista. Também
 * usa o convite que chegou por uma ligação, logo que a pessoa entra (e antes do primeiro corte).
 */
export function AvisoDoSaldo() {
  const t = useTextos();
  const lingua = useLingua();
  const margens = useSafeAreaInsets();
  const temSessao = useTemSessao();
  const consultas = useQueryClient();
  const { data: eu, dataUpdatedAt } = useEuDaCache();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // O último aviso, numa região que o leitor de ecrã lê quando muda (na web o anúncio não existe).
  const [anunciado, setAnunciado] = useState('');
  const [entrada] = useState(() => new Animated.Value(0));
  const [semMexer, setSemMexer] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void semMovimento().then(setSemMexer);
  }, []);

  const esconder = () => {
    clearTimeout(temporizador.current);
    Animated.timing(entrada, { toValue: 0, duration: 220, useNativeDriver: NATIVO }).start(
      ({ finished }) => finished && setAviso(null),
    );
  };
  const mostrar = (a: Aviso) => {
    setAviso(a);
    entrada.setValue(0);
    Animated.spring(entrada, {
      toValue: 1,
      useNativeDriver: NATIVO,
      speed: 14,
      bounciness: 6,
    }).start();
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(esconder, 4500);
    const lido = a.valor === null ? a.texto : `${eurosComSinal(a.valor, lingua)}. ${a.texto}`;
    setAnunciado(lido);
    try {
      AccessibilityInfo.announceForAccessibility(lido);
    } catch {
      // Sem leitor de ecrã para avisar.
    }
  };
  useEffect(() => () => clearTimeout(temporizador.current), []);

  // O saldo que mudou: um aviso com quanto mudou (a diferença, não só o último movimento) e porquê, e um
  // toque no pulso. Com o QR em grande à frente (um Modal tapa o aviso), espera que feche.
  const s = temSessao ? eu?.saldo : undefined;
  const chave = s ? chaveDoMovimento(s.ultimo) : null;
  const qrAberto = useQrAberto();
  useEffect(() => {
    if (!s || chave === null || qrAberto) return;
    const visto = lerVisto();
    if (visto?.chave === chave && visto.saldo === s.saldo) return;
    marcarVisto({ chave, saldo: s.saldo });
    // A primeira vez (a app acabada de actualizar, ou a conta acabada de entrar): só se regista.
    if (!visto) return;
    const diferenca = s.saldo - visto.saldo;
    // Um uso e o seu «anular» com a app fechada: o saldo não mudou, não há aviso.
    if (diferenca === 0) return;
    const m = s.ultimo;
    const doUltimo = m && visto.chave !== chave ? (m.anulado ? -m.valor : m.valor) : null;
    vibrar(diferenca > 0 ? 'festa' : 'feito');
    if (m && doUltimo === diferenca) {
      const frase = fraseDoMovimento(m, t);
      mostrar({
        valor: diferenca,
        texto: m.anulado ? t.carteira.foiAnulado(frase) : frase,
        movimentoId: m.id,
        abreCarteira: true,
      });
    } else {
      // Mais do que um movimento, ou um antigo anulado: diz-se só que mudou (a carteira tem o resto).
      mostrar({
        valor: diferenca,
        texto: t.carteira.saldoMudou,
        movimentoId: null,
        abreCarteira: true,
      });
    }
  }, [chave, s?.saldo, qrAberto]); // eslint-disable-line react-hooks/exhaustive-deps

  // O convite de uma ligação: usa-se logo que haja sessão (o prémio chega como um movimento novo).
  const pendente = useConviteGuardado();
  const aUsar = useRef(false);
  useEffect(() => {
    // Só com o «eu» fresco: o guardado no aparelho pode ser de quando os convites estavam desligados.
    if (!pendente || !temSessao || !eu?.saldo || !dataUpdatedAt || aUsar.current) return;
    if (!eu.saldo.convites) {
      guardarConvite(null);
      mostrar({
        valor: null,
        texto: t.erros.convites_desligados ?? t.erros.interno,
        movimentoId: null,
        abreCarteira: false,
      });
      return;
    }
    if (eu.cortes > 0) {
      guardarConvite(null);
      mostrar({
        valor: null,
        texto: t.erros.ja_cortou ?? t.erros.interno,
        movimentoId: null,
        abreCarteira: false,
      });
      return;
    }
    aUsar.current = true;
    aceitarConvite(pendente)
      .then((carteira) => {
        guardarConvite(null);
        consultas.setQueryData(['carteira'], carteira);
        void consultas.invalidateQueries({ queryKey: ['eu'] });
      })
      .catch((e: unknown) => {
        const codigo = e instanceof ErroDaConta ? e.codigo : 'interno';
        if (PASSAGEIROS.has(codigo)) return;
        guardarConvite(null);
        // Abrir outra vez a ligação de um convite já usado não merece aviso.
        if (codigo !== 'ja_convidado')
          mostrar({ valor: null, texto: mensagemDe(e), movimentoId: null, abreCarteira: false });
      })
      .finally(() => {
        aUsar.current = false;
      });
  }, [pendente, temSessao, eu?.cortes, eu?.saldo?.convites, dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sempre montada: o leitor de ecrã lê-a quando o texto muda (a região que nasce já com texto não se lê).
  const regiao = (
    <View
      aria-live="polite"
      pointerEvents="none"
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}
    >
      <T>{anunciado}</T>
    </View>
  );
  if (!aviso) return regiao;
  const positivo = aviso.valor !== null && aviso.valor > 0;
  const tocar = () => {
    esconder();
    if (!aviso.abreCarteira) return;
    if (aviso.movimentoId !== null)
      router.push({ pathname: '/carteira', params: { novo: String(aviso.movimentoId) } });
    else router.push('/carteira');
  };
  return (
    <>
      {regiao}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          // Por baixo da linha do título (os 16 do ecrã e os 50 do cabeçalho): a pílula do saldo fica à
          // vista enquanto conta.
          top: margens.top + 74,
          left: 0,
          right: 0,
          alignItems: 'center',
          paddingHorizontal: MARGEM,
          opacity: entrada,
          transform: [
            {
              translateY: entrada.interpolate({
                inputRange: [0, 1],
                outputRange: [semMexer ? 0 : -18, 0],
              }),
            },
            {
              scale: entrada.interpolate({
                inputRange: [0, 1],
                outputRange: [semMexer ? 1 : 0.96, 1],
              }),
            },
          ],
        }}
      >
        <Pressable
          onPress={tocar}
          role={aviso.abreCarteira ? 'link' : 'alert'}
          style={({ pressed }) => ({
            width: '100%',
            maxWidth: LARGURA_MAXIMA - 2 * MARGEM,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
            paddingLeft: 12,
            paddingRight: 16,
            borderRadius: raio.grupo,
            borderWidth: 1,
            borderColor: cor.linha,
            backgroundColor: pressed ? cor.linha : cor.superficieAlta,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            ...CONTINUO,
          })}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: positivo ? 'rgba(48,209,88,0.16)' : cor.linha,
            }}
          >
            <Icone
              nome={aviso.valor === null ? 'atencao' : 'carteira'}
              tamanho={20}
              espessura={2}
              cor={positivo ? VERDE : aviso.valor === null ? cor.atencao : cor.texto}
            />
          </View>
          <View style={{ flex: 1 }}>
            {aviso.valor !== null && (
              <T v="forte" style={{ color: positivo ? VERDE : cor.texto }}>
                {eurosComSinal(aviso.valor, lingua)}
              </T>
            )}
            <T
              v={aviso.valor !== null ? 'legenda' : 'forte'}
              style={{ color: aviso.valor !== null ? cor.texto2 : cor.texto }}
              numberOfLines={2}
            >
              {aviso.texto}
            </T>
          </View>
        </Pressable>
      </Animated.View>
    </>
  );
}
