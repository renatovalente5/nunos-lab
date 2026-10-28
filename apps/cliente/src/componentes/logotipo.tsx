import type { ParceiroPublico } from '@nunos-lab/dominio';
import { corParaBranco } from '@nunos-lab/dominio';
import { Image, Text, View } from 'react-native';
import { urlDaImagem } from '../dados';
import { cor, letra } from '../tema';

const PEQUENAS = /^(do|da|dos|das|de|e|o|a|os|as)$/i;

/** As iniciais de um nome sem as palavras pequenas: «Tasca Velha do Cravo» → «TV». */
export function iniciaisDe(nome: string): string {
  const palavras = nome.split(/\s+/).filter((p) => p && !PEQUENAS.test(p));
  return ((palavras[0]?.[0] ?? '') + (palavras[1]?.[0] ?? '')).toUpperCase();
}

/**
 * O logótipo do parceiro num círculo branco; sem logótipo, as iniciais a branco
 * sobre a cor dele (escurecida se for clara). Está sempre ao lado do nome, por
 * isso o leitor de ecrã salta-o.
 */
export function Logotipo({
  parceiro,
  tamanho = 48,
  anel = false,
}: {
  parceiro: Pick<ParceiroPublico, 'nome' | 'cor' | 'logotipo'>;
  tamanho?: number;
  anel?: boolean;
}) {
  const borda = anel ? Math.max(3, Math.round(tamanho / 20)) : 0;
  const base = {
    width: tamanho,
    height: tamanho,
    borderRadius: tamanho / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: borda,
    borderColor: cor.fundo,
  } as const;
  if (parceiro.logotipo)
    return (
      <View style={[base, { backgroundColor: '#FFFFFF' }]} aria-hidden>
        <Image
          source={{ uri: urlDaImagem(parceiro.logotipo) }}
          style={{ width: tamanho * 0.7, height: tamanho * 0.7 }}
          resizeMode="contain"
        />
      </View>
    );
  return (
    <View style={[base, { backgroundColor: corParaBranco(parceiro.cor) }]} aria-hidden>
      <Text
        style={{
          color: '#FFFFFF',
          fontFamily: letra.extra,
          fontSize: Math.round(tamanho * 0.36),
          letterSpacing: -0.4,
        }}
      >
        {iniciaisDe(parceiro.nome)}
      </Text>
    </View>
  );
}
