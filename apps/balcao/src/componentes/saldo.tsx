import { euros, eurosParaUsar, type FichaDoBalcao } from '@nunos-lab/dominio';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import {
  Botao,
  CONTINUO,
  Folha,
  Icone,
  MARGEM,
  T,
  cor,
  useLingua,
  vibrar,
  type NomeDoIcone,
} from '@nunos-lab/ui';
import { ErroDaBalcao, anularSaldo, chaveNova, mensagemDe, usarSaldo } from '../sessao';
import { useTextos } from '../textos';
import { useConfirmacao } from './confirmar';

type Uso = NonNullable<NonNullable<FichaDoBalcao['saldo']>['usadoHoje']>;

/** Depois de usar: quanto, o saldo que ficou, e o uso (para o anular). Anulado, o saldo volta. */
type Feito = { valor: number; depois: number; uso: Uso | null; devolvido: boolean };

const hora = (unix: number) => {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Com «Reduzir movimento» ligado (no telemóvel ou no browser), sem mola nem contagem. */
const semMovimento = (): Promise<boolean> =>
  typeof AccessibilityInfo.isReduceMotionEnabled === 'function'
    ? AccessibilityInfo.isReduceMotionEnabled().catch(() => false)
    : Promise.resolve(false);

/**
 * O saldo na ficha (o Renato, 10 nov 2026): quanto o cliente tem e o «Usar saldo», em euros inteiros.
 * A folha escolhe quanto (de 1 € ao saldo), usa, e mostra o saldo a descer, com o «Anular» dos 10
 * minutos. O último uso de hoje fica no cartão: outro barbeiro vê que já foi, e quem usou anula-o
 * dali. Aberta de uma linha do «Hoje», a ficha só mostra o saldo.
 */
export function SaldoDaFicha({
  ficha,
  codigo,
  lojaId,
  soLeitura,
  chave,
  semLeitura,
  dono,
}: {
  ficha: FichaDoBalcao;
  /** O código com que a ficha foi pedida: a chave da consulta dela. */
  codigo: string;
  lojaId: number | null;
  soLeitura: boolean;
  /**
   * A chave do próximo uso, da ficha inteira (não desta peça): sem resposta, o uso pode ter entrado, e
   * a tentativa seguinte — nesta folha, ou no ecrã do carimbo, que monta outra peça — leva a mesma e
   * conta uma vez. Muda só depois de um uso feito (revisão de 11 nov 2026).
   */
  chave: { current: string };
  /** O cartão não foi lido (escrito à mão, ou procurado): o uso fica dito no backoffice. */
  semLeitura: boolean;
  /** O dono usa o saldo de quem já cortou; a equipa, com o cartão lido e um carimbo de hoje. */
  dono: boolean;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const consultas = useQueryClient();
  const [confirmarNaFicha, confirmacaoNaFicha] = useConfirmacao();
  // A pergunta do «Anular» da folha sobe de dentro dela: no iPhone, uma folha só abre por cima de
  // outra se for filha dela.
  const [confirmarNaFolha, confirmacaoNaFolha] = useConfirmacao();
  const [aberta, setAberta] = useState(false);
  const [quantos, setQuantos] = useState(1);
  const [feito, setFeito] = useState<Feito | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aAnular, setAAnular] = useState(false);
  const [erroNaFicha, setErroNaFicha] = useState<string | null>(null);
  // O saldo que a folha mostra enquanto conta (em cêntimos).
  const [mostrado, setMostrado] = useState(0);
  const escala = useRef(new Animated.Value(0.6)).current;
  const contador = useRef(new Animated.Value(0)).current;
  // Cada abrir e fechar conta: a resposta que chega com a folha já fechada só actualiza a ficha.
  const abertura = useRef(0);
  useEffect(
    () => () => {
      escala.stopAnimation();
      contador.stopAnimation();
      contador.removeAllListeners();
    },
    [escala, contador],
  );

  const saldo = ficha.saldo;
  // A API de antes do saldo não o manda.
  if (!saldo) return null;
  const consulta = ['balcao', 'ficha', codigo];
  const maximo = eurosParaUsar(saldo.valor);
  // A ficha fresca pode trazer menos saldo com a folha aberta: o contador nunca passa dele.
  const escolhido = Math.min(Math.max(1, quantos), maximo);
  const uso = saldo.usadoHoje;
  // Como a API: o dono usa o saldo de quem já cortou; a equipa, com o cartão lido e um carimbo de hoje
  // (sem isso, gastava-se o saldo de um cliente ausente; revisão de 11 nov 2026).
  const podeUsarAgora = dono ? ficha.cliente.cortes > 0 : ficha.hoje.carimbos > 0 && !semLeitura;

  /** A mola do círculo e o saldo a contar de um valor ao outro, de euro em euro. */
  const animar = (de: number, para: number, parado: boolean) => {
    escala.stopAnimation();
    contador.stopAnimation();
    contador.removeAllListeners();
    if (parado) {
      escala.setValue(1);
      setMostrado(para);
      return;
    }
    escala.setValue(0.6);
    Animated.spring(escala, { toValue: 1, useNativeDriver: false, friction: 5 }).start();
    setMostrado(de);
    contador.setValue(de);
    // 3 €, 2 €, 1 €: os cêntimos do saldo, se os houver, ficam como estão.
    contador.addListener(({ value }) => setMostrado(para + Math.round((value - para) / 100) * 100));
    Animated.sequence([
      Animated.delay(150),
      Animated.timing(contador, {
        toValue: para,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => finished && setMostrado(para));
  };

  const abrir = () => {
    // O saldo de agora: outro barbeiro pode ter usado entretanto (a ficha estava aberta desde a chegada).
    consultas.invalidateQueries({ queryKey: consulta });
    abertura.current++;
    setQuantos(1);
    setFeito(null);
    setErro(null);
    setErroNaFicha(null);
    setAberta(true);
  };
  // A folha desce com o que mostrava: o que se limpa, limpa-se ao abrir.
  const fechar = () => {
    abertura.current++;
    setAberta(false);
  };

  const usar = async () => {
    if (!lojaId || aEnviar || escolhido < 1) return;
    const vez = abertura.current;
    const valor = escolhido * 100;
    setAEnviar(true);
    setErro(null);
    try {
      const nova = await usarSaldo({
        codigo: ficha.cliente.codigo,
        valor,
        chave: chave.current,
        lojaId,
        semLeitura,
      });
      chave.current = chaveNova();
      consultas.setQueryData(consulta, nova);
      if (vez !== abertura.current) return;
      vibrar('feito');
      // O uso desta chave (a API di-lo); o último de hoje podia ser de outro barbeiro ao mesmo instante.
      const deHoje = nova.saldo?.usadoHoje ?? null;
      const doUso = nova.usoFeito
        ? {
            movimentoId: nova.usoFeito.movimentoId,
            valor: nova.usoFeito.valor,
            quando: nova.usoFeito.quando,
            pessoa: deHoje?.pessoa ?? null,
            podeAnular:
              deHoje?.movimentoId === nova.usoFeito.movimentoId ? deHoje.podeAnular : true,
          }
        : deHoje;
      // O que a API diz que entrou: a mesma chave de uma tentativa sem resposta devolve esse uso, e
      // o barbeiro pode ter mudado o valor entretanto.
      const usado = doUso?.valor ?? valor;
      const depois = nova.saldo?.valor ?? saldo.valor - usado;
      const parado = await semMovimento();
      if (vez !== abertura.current) return;
      setFeito({ valor: usado, depois, uso: doUso, devolvido: false });
      animar(depois + usado, depois, parado);
    } catch (e) {
      // A chave já era de outro cliente (não devia acontecer): com outra, a próxima tentativa passa.
      const repetido = e instanceof ErroDaBalcao && e.codigo === 'repetido';
      // A chave de outro cliente, ou de um uso que entretanto se anulou: a próxima tentativa leva outra.
      if (repetido || (e instanceof ErroDaBalcao && e.codigo === 'uso_anulado'))
        chave.current = chaveNova();
      if (vez !== abertura.current) return;
      setErro(repetido ? t.erros.interno : mensagemDe(e));
      // Sem resposta, o uso pode ter entrado: a ficha fresca mostra-o («Usou 2 € às…»).
      consultas.invalidateQueries({ queryKey: consulta });
    } finally {
      setAEnviar(false);
    }
  };

  /** O «Anular» da folha, logo a seguir ao uso: o saldo volta a subir à frente do cliente. */
  const anularNaFolha = async () => {
    const desfazer = feito?.uso;
    if (!feito || !desfazer || aEnviar) return;
    const sim = await confirmarNaFolha({
      titulo: t.ficha.anularOUso(desfazer.valor, hora(desfazer.quando)),
      accao: t.geral.anular,
    });
    if (!sim) return;
    const vez = abertura.current;
    setAEnviar(true);
    setErro(null);
    try {
      await anularSaldo(desfazer.movimentoId);
      // A chave desse uso já não serve: o próximo uso leva outra.
      chave.current = chaveNova();
      consultas.invalidateQueries({ queryKey: consulta });
      if (vez !== abertura.current) return;
      vibrar('feito');
      const parado = await semMovimento();
      if (vez !== abertura.current) return;
      setFeito({ ...feito, devolvido: true });
      animar(feito.depois, feito.depois + feito.valor, parado);
    } catch (e) {
      if (vez !== abertura.current) return;
      setErro(mensagemDe(e));
      consultas.invalidateQueries({ queryKey: consulta });
    } finally {
      setAEnviar(false);
    }
  };

  /** O «Anular» do cartão: o uso de hoje, feito antes (pela mesma pessoa, ou qualquer um pelo dono). */
  const anularNaFicha = async () => {
    if (!uso || aAnular) return;
    const sim = await confirmarNaFicha({
      titulo: t.ficha.anularOUso(uso.valor, hora(uso.quando)),
      accao: t.geral.anular,
    });
    if (!sim) return;
    setAAnular(true);
    setErroNaFicha(null);
    try {
      await anularSaldo(uso.movimentoId);
      chave.current = chaveNova();
      vibrar('feito');
      // A ficha fresca traz o saldo de volta (e o uso anterior, se houve outro hoje).
      await consultas.invalidateQueries({ queryKey: consulta });
    } catch (e) {
      setErroNaFicha(mensagemDe(e));
      // Já anulado, fora de prazo, ou sem resposta (e anulado na mesma): a ficha fresca diz como está.
      consultas.invalidateQueries({ queryKey: consulta });
    } finally {
      setAAnular(false);
    }
  };

  return (
    <>
      {(saldo.valor !== 0 || uso) && (
        <View
          style={{
            marginHorizontal: MARGEM,
            marginTop: 14,
            backgroundColor: cor.superficie,
            borderRadius: 16,
            padding: 14,
            gap: 10,
            ...CONTINUO,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icone nome="carteira" tamanho={16} cor={cor.texto2} espessura={2} />
                <T v="legenda" style={{ color: cor.texto2 }}>
                  {t.ficha.saldo}
                </T>
              </View>
              <T v="titulo" style={{ marginTop: 2 }}>
                {euros(saldo.valor, lingua)}
              </T>
              {saldo.valor < 0 && (
                <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
                  {t.ficha.saldoNegativo}
                </T>
              )}
              {!soLeitura && maximo >= 1 && !podeUsarAgora && (
                <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
                  {!dono && semLeitura ? t.ficha.lerParaUsar : t.ficha.saldoDepoisDoCorte}
                </T>
              )}
            </View>
            {!soLeitura && maximo >= 1 && podeUsarAgora && (
              <Botao nome={t.ficha.usarSaldo} secundario onPress={abrir} />
            )}
          </View>
          {uso && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T v="legenda" style={{ color: cor.texto2, flex: 1 }}>
                {t.ficha.usouAs(uso.valor, hora(uso.quando), uso.pessoa)}
              </T>
              {/* Anular também na ficha só de ver (a do «Hoje», onde se anulam os carimbos). */}
              {uso.podeAnular && (
                <Pressable
                  onPress={anularNaFicha}
                  role="button"
                  aria-disabled={aAnular}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    paddingVertical: 4,
                    opacity: pressed || aAnular ? 0.6 : 1,
                  })}
                >
                  <T v="forte" style={{ color: cor.perigo, fontSize: 14 }}>
                    {t.geral.anular}
                  </T>
                </Pressable>
              )}
            </View>
          )}
          {erroNaFicha && (
            <T v="legenda" role="alert" style={{ color: cor.perigo }}>
              {erroNaFicha}
            </T>
          )}
        </View>
      )}

      <Folha aberta={aberta} fechar={fechar} titulo={t.ficha.usarSaldo}>
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 12, alignItems: 'center' }}>
          {feito ? (
            <>
              <Animated.View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  backgroundColor: cor.claro,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: escala }],
                }}
              >
                <Icone
                  nome={feito.devolvido ? 'carteira' : 'certo'}
                  tamanho={44}
                  cor={cor.sobreClaro}
                  espessura={2.6}
                />
              </Animated.View>
              <T v="titulo" style={{ marginTop: 20, textAlign: 'center' }} aria-live="polite">
                {feito.devolvido ? t.ficha.devolvidos(feito.valor) : t.ficha.usados(feito.valor)}
              </T>
              <T
                v="subtitulo"
                style={{
                  color: cor.texto2,
                  marginTop: 6,
                  textAlign: 'center',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {feito.devolvido ? t.ficha.saldoDe(mostrado) : t.ficha.fica(mostrado)}
              </T>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 28, alignSelf: 'stretch' }}>
                {!feito.devolvido && feito.uso?.podeAnular && (
                  <Botao
                    nome={t.geral.anular}
                    perigo
                    largo
                    ocupado={aEnviar}
                    onPress={anularNaFolha}
                  />
                )}
                <Botao nome={t.geral.concluir} largo onPress={fechar} />
              </View>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <BotaoDoContador
                  icone="menos"
                  rotulo={t.ficha.menosUmEuro}
                  activo={escolhido > 1}
                  onPress={() => setQuantos(escolhido - 1)}
                />
                <T
                  v="destaque"
                  aria-live="polite"
                  style={{ minWidth: 132, textAlign: 'center', fontVariant: ['tabular-nums'] }}
                >
                  {euros(escolhido * 100, lingua)}
                </T>
                <BotaoDoContador
                  icone="mais"
                  rotulo={t.ficha.maisUmEuro}
                  activo={escolhido < maximo}
                  onPress={() => setQuantos(escolhido + 1)}
                />
              </View>
              <T v="corpo" style={{ color: cor.texto2, marginTop: 6 }}>
                {t.ficha.fica(saldo.valor - escolhido * 100)}
              </T>
              {/* Já houve um uso hoje (talvez de outro barbeiro): à vista antes de usar outra vez. */}
              {uso && (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}
                  role="alert"
                >
                  <Icone nome="atencao" tamanho={16} cor={cor.atencao} espessura={2} />
                  <T v="legenda" style={{ color: cor.atencao }}>
                    {t.ficha.usouAs(uso.valor, hora(uso.quando), uso.pessoa)}
                  </T>
                </View>
              )}
              <View style={{ flexDirection: 'row', marginTop: 24, alignSelf: 'stretch' }}>
                <Botao
                  nome={aEnviar ? t.ficha.aUsar : t.ficha.usar(escolhido * 100)}
                  largo
                  ocupado={aEnviar}
                  inactivo={!lojaId || escolhido < 1}
                  onPress={usar}
                />
              </View>
            </>
          )}
          {erro && (
            <T
              v="legenda"
              role="alert"
              style={{ color: cor.perigo, textAlign: 'center', marginTop: 12 }}
            >
              {erro}
            </T>
          )}
        </View>
        {confirmacaoNaFolha}
      </Folha>
      {confirmacaoNaFicha}
    </>
  );
}

/** O − e o + do contador: redondos e grandes, esbatidos no fim do intervalo. */
function BotaoDoContador({
  icone,
  rotulo,
  activo,
  onPress,
}: {
  icone: NomeDoIcone;
  rotulo: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={activo ? onPress : undefined}
      role="button"
      aria-label={rotulo}
      aria-disabled={!activo}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: pressed && activo ? cor.linha : cor.superficieAlta,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: activo ? 1 : 0.4,
        transform: [{ scale: pressed && activo ? 0.96 : 1 }],
      })}
    >
      <Icone nome={icone} tamanho={24} espessura={2.4} />
    </Pressable>
  );
}
