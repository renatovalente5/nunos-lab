import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Um toque no pulso ao carimbar: «feito» é um aviso curto; «festa», o de sucesso. Na web não há. */
export function vibrar(tipo: 'feito' | 'festa'): void {
  if (Platform.OS === 'web') return;
  const p =
    tipo === 'festa'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  p.catch(() => {});
}
