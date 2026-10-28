import type { ParceiroPublico } from '@nunos-lab/dominio';
import { corParaBranco } from '@nunos-lab/dominio';
import { Image, Text, View } from 'react-native';
import { urlDaImagem } from '../dados';
import { letra } from '../tema';

const PEQUENAS = /^(do|da|dos|das|de|e|o|a|os|as)$/i;

/** As iniciais de um nome sem as palavras pequenas: «Tasca Velha do Cravo» → «TV». */
export function iniciaisDe(nome: string): string {
  const palavras = nome.split(/\s+/).filter((p) => p && !PEQUENAS.test(p));
  return ((palavras[0]?.[0] ?? '') + (palavras[1]?.[0] ?? '')).toUpperCase();
}

/**
 * O logótipo do parceiro num círculo branco; sem logótipo, as iniciais. Na lista,
 * o círculo é da cor dele com as iniciais a branco; sobre a capa (`sobreCor`), é
 * branco com as iniciais na cor dele. A cor vem escurecida se for clara, para as
 * iniciais passarem 4,5:1 nos dois casos. Está sempre ao lado do nome, por isso
 * o leitor de ecrã salta-o.
 */
export function Logotipo({
  parceiro,
  tamanho = 48,
  sobreCor = false,
}: {
  parceiro: Pick<ParceiroPublico, 'nome' | 'cor' | 'logotipo'>;
  tamanho?: number;
  sobreCor?: boolean;
}) {
  const base = {
    width: tamanho,
    height: tamanho,
    borderRadius: tamanho / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  const dele = corParaBranco(parceiro.cor);
  return (
    <View style={[base, { backgroundColor: sobreCor ? '#FFFFFF' : dele }]} aria-hidden>
      <Text
        style={{
          color: sobreCor ? dele : '#FFFFFF',
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
