import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icone, MARGEM, T, cor } from '@nunos-lab/ui';
import { useTextos } from '../textos';

/** A linha do título dos separadores tem sempre a altura do círculo da conta, haja ou não círculo. */
const ALTURA = 40;

/**
 * O título de um separador (Vantagens, Cartão, Barbearias), sempre no mesmo sítio, com ou sem o círculo
 * da conta à direita: ao trocar de separador, o título e o primeiro cartão não saltam (o Renato, 8 nov).
 * Nas Vantagens o título é o logótipo.
 */
export function CabecalhoDoSeparador({
  titulo,
  children,
}: {
  titulo: ReactNode;
  /** O que fica à direita do título (o círculo da conta). */
  children?: ReactNode;
}) {
  return (
    <View
      style={{
        paddingHorizontal: MARGEM,
        paddingTop: 10,
        minHeight: 10 + ALTURA,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      {typeof titulo === 'string' ? (
        <T v="titulo" role="heading" aria-level={1} style={{ flexShrink: 1 }}>
          {titulo}
        </T>
      ) : (
        titulo
      )}
      {children}
    </View>
  );
}

/**
 * O cabeçalho das páginas que abrem por cima (Conta, Carteira, Privacidade): o «Voltar» e o título na mesma
 * linha, como na Conta e em todas as da Balcão. A Carteira e a Privacidade tinham o título por baixo do
 * «Voltar» (o Renato, 16 nov 2026: «Conta e Carteira com o mesmo cabeçalho»). Sem página para onde voltar
 * (uma ligação aberta direto), vai para `semVolta`.
 */
export function CabecalhoComVoltar({ titulo, semVolta }: { titulo: string; semVolta: Href }) {
  const t = useTextos();
  return (
    <View
      style={{ paddingHorizontal: MARGEM, flexDirection: 'row', alignItems: 'center', gap: 14 }}
    >
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace(semVolta))}
        role="button"
        aria-label={t.conta.voltar}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: pressed ? cor.linha : cor.superficieAlta,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Icone nome="voltar" tamanho={21} espessura={2.2} />
      </Pressable>
      <T v="titulo" role="heading" aria-level={1} style={{ flexShrink: 1 }}>
        {titulo}
      </T>
    </View>
  );
}
