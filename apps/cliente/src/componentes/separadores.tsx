import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { BarraDeBaixo, BotaoDoSeparador } from '@nunos-lab/ui';
import { PrecarregarMapa } from './mapa-das-casas';

/**
 * A barra dos três separadores na web e no Android: a cápsula desenhada à mão
 * (packages/ui/src/barra.tsx). No iPhone é a barra do próprio sistema
 * (separadores.ios.tsx). No Android, os ícones Material da barra nativa pedem
 * o módulo expo-symbols, que a build não tem.
 */
export default function Separadores() {
  return (
    <Tabs style={{ flex: 1 }}>
      <PrecarregarMapa />
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <BarraDeBaixo>
          <TabTrigger name="vantagens" href="/" asChild>
            <BotaoDoSeparador icone="bilhete" nome="Vantagens" />
          </TabTrigger>
          <TabTrigger name="cartao" href="/cartao" asChild>
            <BotaoDoSeparador icone="qr" nome="Cartão" />
          </TabTrigger>
          <TabTrigger name="barbearia" href="/barbearia" asChild>
            <BotaoDoSeparador icone="mapaDobrado" nome="Barbearia" />
          </TabTrigger>
        </BarraDeBaixo>
      </TabList>
    </Tabs>
  );
}
