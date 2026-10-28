import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CHAVES_DO_ARMAZEM, CHAVES_SECRETAS, contar } from '../dados';
import { carregarArmazem, cor } from '@nunos-lab/ui';

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
