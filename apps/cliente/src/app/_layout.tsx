import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registarAoPerderSessao } from '../conta';
import { CHAVES_DO_ARMAZEM, CHAVES_SECRETAS, contar } from '../dados';
import { Botao, T, carregarArmazem, cor } from '@nunos-lab/ui';

// O splash nativo fica até as letras e o armazém estarem prontos: sem isto
// escondia-se na primeira View vazia, um clarão preto em cada arranque.
try {
  void SplashScreen.preventAutoHideAsync().catch(() => {});
} catch {
  // Na web não há splash.
}

const cliente = new QueryClient();
// Quando a sessão cai num pedido (401), o «eu» de quem saiu não fica à espera da conta seguinte.
registarAoPerderSessao(() => cliente.removeQueries({ queryKey: ['eu'] }));

// No telemóvel o TanStack não sabe quando a app volta ao primeiro plano (só
// ouve a janela do browser): diz-se-lhe pelo AppState, e o refetchOnWindowFocus
// das consultas passa a valer.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((definirFoco) => {
    const ouvinte = AppState.addEventListener('change', (estado) =>
      definirFoco(estado === 'active'),
    );
    return () => ouvinte.remove();
  });
}

/**
 * As actualizações OTA descarregam em fundo e, por omissão, só entravam no
 * arranque a frio seguinte — que no iPhone pode levar dias. Aqui, a que já
 * está descarregada entra quando a app volta ao primeiro plano, e ao voltar do
 * fundo passadas mais de duas horas pede-se uma nova (entra na volta seguinte).
 * Só num build instalado: em desenvolvimento e na web o módulo lança erros.
 */
const COM_ACTUALIZACOES = !__DEV__ && Platform.OS !== 'web' && Updates.isEnabled;
const DUAS_HORAS = 2 * 60 * 60_000;

function Actualizacoes() {
  const { isUpdatePending } = Updates.useUpdates();
  const emFundoDesde = useRef(0);
  useEffect(() => {
    const ouvinte = AppState.addEventListener('change', (estado) => {
      if (estado === 'background') emFundoDesde.current = Date.now();
      if (estado !== 'active') return;
      if (isUpdatePending) {
        void Updates.reloadAsync().catch(() => {});
        return;
      }
      const haQuanto = emFundoDesde.current ? Date.now() - emFundoDesde.current : 0;
      emFundoDesde.current = 0;
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
  // No telemóvel, o que está guardado (a sessão, a lista) lê-se antes do primeiro ecrã.
  const [armazemPronto, setArmazemPronto] = useState(Platform.OS === 'web');
  useEffect(() => {
    carregarArmazem(CHAVES_DO_ARMAZEM, CHAVES_SECRETAS).finally(() => setArmazemPronto(true));
  }, []);
  useEffect(() => contar('abrir'), []);
  // Com as letras (ou sem elas, se não vierem) e o armazém lido: a app desenha-se e o splash sai.
  const pronta = (prontas || !!erro) && armazemPronto;
  useEffect(() => {
    if (!pronta) return;
    try {
      void SplashScreen.hideAsync().catch(() => {});
    } catch {
      // Na web não há splash.
    }
  }, [pronta]);
  if (!pronta) return <View style={{ flex: 1, backgroundColor: cor.fundo }} />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={cliente}>
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
