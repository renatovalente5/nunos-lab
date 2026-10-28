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
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { cor } from '@nunos-lab/ui';

const consultas = new QueryClient();

export default function Raiz() {
  const [prontas, erro] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  if (!prontas && !erro) return <View style={{ flex: 1, backgroundColor: cor.fundo }} />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={consultas}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cor.fundo } }}
        />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
