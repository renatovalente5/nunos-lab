import { NativeTabs } from 'expo-router/native-tabs';
import { cor, letra } from '@nunos-lab/ui';
import { PrecarregarMapa } from './mapa-das-casas';

/**
 * A barra dos três separadores no iPhone: a do PRÓPRIO SISTEMA, como no
 * Carimbo Digital. No iOS 26 é a cápsula de vidro líquido da Apple, com a lente
 * que desliza de separador em separador; desenha-a o sistema, por isso não há
 * medidas nossas para partir. O desenho e o nome do separador escolhido ficam na
 * cor da marca (o creme do logótipo); os outros no cinzento do texto. Os nomes
 * dos `Trigger` são os dos ficheiros em `src/app/(separadores)/`.
 *
 * Na web e no Android continua a cápsula desenhada à mão (separadores.tsx).
 */
export default function Separadores() {
  return (
    <>
      <PrecarregarMapa />
      <NativeTabs
        tintColor={cor.texto}
        iconColor={{ default: cor.texto2, selected: cor.texto }}
        labelStyle={{
          default: { color: cor.texto2, fontFamily: letra.semi, fontSize: 10 },
          selected: { color: cor.texto, fontFamily: letra.forte, fontSize: 10 },
        }}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf={{ default: 'ticket', selected: 'ticket.fill' }} />
          <NativeTabs.Trigger.Label>Vantagens</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="cartao">
          <NativeTabs.Trigger.Icon sf="qrcode" />
          <NativeTabs.Trigger.Label>Cartão</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="barbearia">
          <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} />
          <NativeTabs.Trigger.Label>Barbearia</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
