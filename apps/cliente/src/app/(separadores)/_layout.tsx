import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { BarraDeBaixo, BotaoDoSeparador } from '../../componentes/barra';

export default function Separadores() {
  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <BarraDeBaixo>
          <TabTrigger name="vantagens" href="/" asChild>
            <BotaoDoSeparador icone="etiqueta" nome="Vantagens" />
          </TabTrigger>
          <TabTrigger name="barbearia" href="/barbearia" asChild>
            <BotaoDoSeparador icone="tesoura" nome="Barbearia" />
          </TabTrigger>
        </BarraDeBaixo>
      </TabList>
    </Tabs>
  );
}
