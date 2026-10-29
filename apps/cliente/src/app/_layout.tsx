import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CHAVES_DO_ARMAZEM, CHAVES_SECRETAS, contar } from '../dados';
import { Botao, T, carregarArmazem, cor } from '@nunos-lab/ui';

const cliente = new QueryClient();

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
  if ((!prontas && !erro) || !armazemPronto)
    return <View style={{ flex: 1, backgroundColor: cor.fundo }} />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={cliente}>
        <StatusBar style="light" />
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
