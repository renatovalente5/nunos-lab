import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { definirTitulo } from '../dados';
import { Ecra, Icone, MARGEM, T, cor } from '@nunos-lab/ui';
import { useTextos } from '../textos';

export default function Privacidade() {
  const t = useTextos();
  useEffect(() => definirTitulo(t.titulos.privacidade), [t]);
  return (
    <Ecra comBarra={false}>
      <View style={{ paddingHorizontal: MARGEM }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/barbearia'))}
          role="button"
          aria-label={t.parceiro.voltar}
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: cor.superficieAlta,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icone nome="voltar" tamanho={21} espessura={2.2} />
        </Pressable>
        <T v="titulo" style={{ marginTop: 22, marginBottom: 8 }} role="heading" aria-level={1}>
          {t.privacidade.titulo}
        </T>
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
