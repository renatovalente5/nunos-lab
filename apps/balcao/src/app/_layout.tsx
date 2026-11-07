import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Botao, T, carregarArmazem, cor } from '@nunos-lab/ui';
import { CHAVES_DO_ARMAZEM, CHAVES_SECRETAS, haEscritaEmCurso } from '../sessao';

const consultas = new QueryClient();

/**
 * As actualizações OTA, como na app do cliente: descarregam em fundo e, por omissão, só
 * entravam no arranque a frio seguinte — que no iPhone pode levar dias (a folha corrigida a
 * 6 nov ainda não tinha chegado ao iPhone do Renato a 7 nov). A que já está descarregada
 * entra quando a app volta depois de um minuto no fundo, e ao voltar do fundo passadas mais
 * de duas horas pede-se uma nova (entra na volta seguinte). A que acaba de descarregar nos
 * primeiros segundos depois do arranque entra logo, mas só no ecrã de início: com um cliente
 * lido ou um cliente novo a meio, espera pela próxima saída da app. E nunca com um pedido a
 * meio (um carimbo, a fila a despejar).
 * Só num build instalado: em desenvolvimento e na web o módulo lança erros.
 */
const COM_ACTUALIZACOES = !__DEV__ && Platform.OS !== 'web' && Updates.isEnabled;
const DUAS_HORAS = 2 * 60 * 60_000;
/** Até quando, depois do arranque, uma actualização acabada de descarregar entra logo. */
const INICIO = 15_000;
/** Quanto tempo no fundo conta como «saiu da app» (e não uma folha do sistema por cima dela). */
const UM_MINUTO = 60_000;

function Actualizacoes() {
  const { isUpdatePending } = Updates.useUpdates();
  const rota = usePathname();
  const emFundoDesde = useRef(0);
  const arrancouEm = useRef(Date.now());
  // Entrar com a Apple ou a Google, a autorização da câmara, o Face ID ou o Centro de Controlo
  // põem a app em «inactive» e devolvem-na a «active». Depois de uma destas, nunca logo.
  const houveFolhaDoSistema = useRef(false);
  useEffect(() => {
    if (!isUpdatePending || AppState.currentState !== 'active') return;
    if (houveFolhaDoSistema.current || Date.now() - arrancouEm.current > INICIO) return;
    if (rota !== '/' || haEscritaEmCurso()) return;
    void Updates.reloadAsync().catch(() => {});
  }, [isUpdatePending, rota]);
  useEffect(() => {
    const ouvinte = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') {
        houveFolhaDoSistema.current = true;
        if (estado === 'background' && !emFundoDesde.current) emFundoDesde.current = Date.now();
        return;
      }
      const haQuanto = emFundoDesde.current ? Date.now() - emFundoDesde.current : 0;
      emFundoDesde.current = 0;
      // A pendente entra só quando a pessoa saiu mesmo da app (um minuto ou mais no fundo).
      if (isUpdatePending) {
        if (haQuanto >= UM_MINUTO && !haEscritaEmCurso())
          void Updates.reloadAsync().catch(() => {});
        return;
      }
      if (haQuanto < DUAS_HORAS) return;
      void Updates.checkForUpdateAsync()
        .then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : null))
        .catch(() => {});
    });
    return () => ouvinte.remove();
  }, [isUpdatePending]);
  return null;
}

export default function Raiz() {
  const [prontas, erro] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [armazemPronto, setArmazemPronto] = useState(Platform.OS === 'web');
  useEffect(() => {
    carregarArmazem(CHAVES_DO_ARMAZEM, CHAVES_SECRETAS).finally(() => setArmazemPronto(true));
  }, []);
  if ((!prontas && !erro) || !armazemPronto)
    return <View style={{ flex: 1, backgroundColor: cor.fundo }} />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={consultas}>
        <StatusBar style="light" />
        {COM_ACTUALIZACOES && <Actualizacoes />}
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cor.fundo } }}
        />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Quando um ecrã não carrega (na web, um pedaço do código que uma publicação
 * trocou), recarrega a página uma vez; se voltar a falhar, diz e deixa tentar.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const chave = 'nunoslab:recarregou';
    const semCodigo = /import|chunk|fetch|script|module|load/i.test(String(error?.message));
    try {
      if (semCodigo && !sessionStorage.getItem(chave)) {
        sessionStorage.setItem(chave, String(Date.now()));
        location.reload();
      }
    } catch {
      // Sem sessionStorage: fica o ecrã de baixo.
    }
  }, [error]);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cor.fundo,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 14,
      }}
    >
      <T v="titulo">Algo correu mal</T>
      <T v="legenda" style={{ color: cor.texto2, textAlign: 'center' }}>
        A app não conseguiu abrir este ecrã.
      </T>
      <T v="legenda" style={{ color: cor.texto3, textAlign: 'center', fontSize: 11 }}>
        {String(error?.message ?? error).slice(0, 160)}
      </T>
      <Botao
        nome="Tentar outra vez"
        onPress={() => {
          if (Platform.OS === 'web') location.reload();
          else void retry();
        }}
      />
    </View>
  );
}
