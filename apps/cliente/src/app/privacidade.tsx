import { useEffect } from 'react';
import { View } from 'react-native';
import { CabecalhoComVoltar } from '../componentes/cabecalho';
import { definirTitulo } from '../dados';
import { Ecra, MARGEM, T, cor } from '@nunos-lab/ui';
import { useTextos } from '../textos';

export default function Privacidade() {
  const t = useTextos();
  useEffect(() => definirTitulo(t.titulos.privacidade), [t]);
  return (
    <Ecra comBarra={false}>
      <CabecalhoComVoltar titulo={t.privacidade.titulo} semVolta="/barbearia" />
      <View style={{ paddingHorizontal: MARGEM, marginTop: 8 }}>
        {t.privacidade.paragrafos.map((p) => (
          <T
            key={p}
            v="corpo"
            style={{ color: cor.texto2, marginTop: 12, fontSize: 16, lineHeight: 24 }}
          >
            {p}
          </T>
        ))}
      </View>
    </Ecra>
  );
}
