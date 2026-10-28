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
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { contar } from '../dados';
import { cor } from '@nunos-lab/ui';

const cliente = new QueryClient();

export default function Raiz() {
  const [prontas, erro] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  useEffect(() => contar('abrir'), []);
  if (!prontas && !erro) return <View style={{ flex: 1, backgroundColor: cor.fundo }} />;
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
