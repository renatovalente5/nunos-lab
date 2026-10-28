import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { BarraDeBaixo, BotaoDoSeparador } from '@nunos-lab/ui';

export default function Separadores() {
  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <BarraDeBaixo>
          <TabTrigger name="vantagens" href="/" asChild>
            <BotaoDoSeparador icone="etiqueta" nome="Vantagens" />
          </TabTrigger>
          <TabTrigger name="cartao" href="/cartao" asChild>
            <BotaoDoSeparador icone="cartao" nome="Cartão" />
          </TabTrigger>
          <TabTrigger name="barbearia" href="/barbearia" asChild>
            <BotaoDoSeparador icone="tesoura" nome="Barbearia" />
          </TabTrigger>
        </BarraDeBaixo>
      </TabList>
    </Tabs>
  );
}
