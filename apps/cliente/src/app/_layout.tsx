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
import { AvisoDoSaldo } from '../componentes/saldo';
import { registarAoPerderSessao } from '../conta';
import { CHAVES_DO_ARMAZEM, CHAVES_SECRETAS, contar } from '../dados';
import { Botao, T, carregarArmazem, cor, useLangDaPagina, useTextosDaUi } from '@nunos-lab/ui';
import { useTextos } from '../textos';

// O splash nativo fica até as letras e o armazém estarem prontos: sem isto
// escondia-se na primeira View vazia, um clarão preto em cada arranque.
try {
  void SplashScreen.preventAutoHideAsync().catch(() => {});
} catch {
  // Na web não há splash.
}

const cliente = new QueryClient();
// Quando a sessão cai num pedido (401), o «eu» de quem saiu não fica à espera da conta seguinte.
registarAoPerderSessao(() => {
  cliente.removeQueries({ queryKey: ['eu'] });
  cliente.removeQueries({ queryKey: ['carteira'] });
});

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
 * está descarregada entra quando a app volta depois de um minuto no fundo, e ao voltar do
 * fundo passadas mais de duas horas pede-se uma nova (entra na volta seguinte).
 * E a que acaba de descarregar nos primeiros segundos depois do arranque entra
 * logo: um reinício de um segundo antes de a pessoa se instalar no ecrã, em vez
 * de um segundo arranque a frio que pode nunca vir.
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
  const emFundoDesde = useRef(0);
  const arrancouEm = useRef(Date.now());
  // Entrar com a Apple ou a Google, o Face ID, um aviso de permissão ou o Centro de Controlo
  // põem a app em «inactive» e devolvem-na a «active». Reiniciar aí perdia a entrada a meio
  // e o texto de uma folha (achado da revisão de 7 nov). Depois de uma destas, nunca logo.
  const houveFolhaDoSistema = useRef(false);
  useEffect(() => {
    if (!isUpdatePending || AppState.currentState !== 'active') return;
    if (houveFolhaDoSistema.current || Date.now() - arrancouEm.current > INICIO) return;
    void Updates.reloadAsync().catch(() => {});
  }, [isUpdatePending]);
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
        if (haQuanto >= UM_MINUTO) void Updates.reloadAsync().catch(() => {});
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
  // No telemóvel, o que está guardado (a sessão, a lista) lê-se antes do primeiro ecrã.
  const [armazemPronto, setArmazemPronto] = useState(Platform.OS === 'web');
  useEffect(() => {
    carregarArmazem(CHAVES_DO_ARMAZEM, CHAVES_SECRETAS).finally(() => setArmazemPronto(true));
  }, []);
  useEffect(() => contar('abrir'), []);
  useLangDaPagina();
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
        {/* Por cima de todos os ecrãs: o saldo que mudou (um amigo foi à barbearia, o barbeiro usou-o). */}
        <AvisoDoSaldo />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Quando um ecrã não carrega (na web, um pedaço do código que uma publicação
 * trocou), recarrega a página uma vez; se voltar a falhar, diz e deixa tentar.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const t = useTextos();
  const ui = useTextosDaUi();
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
      <T v="titulo">{t.erroDoEcra.titulo}</T>
      <T v="legenda" style={{ color: cor.texto2, textAlign: 'center' }}>
        {t.erroDoEcra.texto}
      </T>
      <T v="legenda" style={{ color: cor.texto3, textAlign: 'center', fontSize: 11 }}>
        {String(error?.message ?? error).slice(0, 160)}
      </T>
      <Botao
        nome={ui.tentarOutraVez}
        onPress={() => {
          if (Platform.OS === 'web') location.reload();
          else void retry();
        }}
      />
    </View>
  );
}
