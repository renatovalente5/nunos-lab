import { NativeTabs } from 'expo-router/native-tabs';
import { cor } from '@nunos-lab/ui';
import { PrecarregarMapa } from './mapa-das-casas';

/**
 * A barra dos três separadores no iPhone: a do PRÓPRIO SISTEMA, como no
 * Carimbo Digital. No iOS 26 é a cápsula de vidro líquido da Apple, com a lente
 * que desliza de separador em separador; desenha-a o sistema, por isso não há
 * medidas nossas para partir. Só desenhos, sem nomes (7 nov 2026): o nome fica
 * para o VoiceOver (`accessibilityLabel`). O desenho do separador escolhido
 * fica na cor da marca (o creme do logótipo); os outros no cinzento do texto.
 * Os nomes dos `Trigger` são os dos ficheiros em `src/app/(separadores)/`.
 *
 * Na web e no Android continua a cápsula desenhada à mão (separadores.tsx).
 */
export default function Separadores() {
  return (
    <>
      <PrecarregarMapa />
      <NativeTabs tintColor={cor.texto} iconColor={{ default: cor.texto2, selected: cor.texto }}>
        {/* A etiqueta é o desenho das vantagens dentro da app; o bilhete parecia uma película. */}
        <NativeTabs.Trigger name="index" accessibilityLabel="Vantagens">
          <NativeTabs.Trigger.Icon sf={{ default: 'tag', selected: 'tag.fill' }} />
          <NativeTabs.Trigger.Label hidden />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="cartao" accessibilityLabel="Cartão">
          <NativeTabs.Trigger.Icon sf="qrcode" />
          <NativeTabs.Trigger.Label hidden />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="barbearia" accessibilityLabel="Barbearia">
          <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} />
          <NativeTabs.Trigger.Label hidden />
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
