import type { ParceiroPublico } from '@nunos-lab/dominio';
import { anelDoLogotipo, caixaDoLogotipo, COR_DO_ANEL, corParaBranco } from '@nunos-lab/dominio';
import { Image, Text, View } from 'react-native';
import { urlDaImagem } from '../dados';
import { letra } from '@nunos-lab/ui';

const PEQUENAS = /^(do|da|dos|das|de|e|o|a|os|as)$/i;

/** As iniciais de um nome sem as palavras pequenas: «Tasca Velha do Cravo» → «TV». */
export function iniciaisDe(nome: string): string {
  const palavras = nome.split(/\s+/).filter((p) => p && !PEQUENAS.test(p));
  // Array.from: um emoji não se parte a meio.
  const primeira = (p?: string) => Array.from(p ?? '')[0] ?? '';
  return (primeira(palavras[0]) + primeira(palavras[1])).toUpperCase();
}

/**
 * O logótipo do parceiro num círculo, com o fundo, o tamanho e o sítio que o Nuno acertou no
 * backoffice (sem ajuste: branco e a 70 %); sem logótipo, as iniciais a branco sobre a cor dele
 * (escurecida se for clara). À volta, a borda: um fio claro encostado ao círculo (o Renato, 16 nov
 * 2026, «como borda do ícone»): os logótipos escuros perdiam-se no preto. Fica dentro do `tamanho`, por
 * isso nada à volta mexe. Está sempre ao lado do nome, por isso o leitor de ecrã salta-o.
 */
export function Logotipo({
  parceiro,
  tamanho = 48,
}: {
  parceiro: Pick<ParceiroPublico, 'nome' | 'cor' | 'logotipo'> &
    Partial<Pick<ParceiroPublico, 'logotipoAjuste'>>;
  tamanho?: number;
}) {
  const { traco, lado } = anelDoLogotipo(tamanho);
  const caixa = caixaDoLogotipo(parceiro.logotipoAjuste);
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        borderWidth: traco,
        borderColor: COR_DO_ANEL,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden
    >
      <View
        style={{
          width: lado,
          height: lado,
          borderRadius: lado / 2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: parceiro.logotipo ? caixa.fundo : corParaBranco(parceiro.cor),
        }}
      >
        {parceiro.logotipo ? (
          <Image
            source={{ uri: urlDaImagem(parceiro.logotipo) }}
            style={{
              position: 'absolute',
              width: lado * caixa.lado,
              height: lado * caixa.lado,
              left: lado * caixa.esquerda,
              top: lado * caixa.topo,
            }}
            resizeMode="contain"
          />
        ) : (
          // O círculo tem tamanho fixo: com a letra grande do iPhone as iniciais saíam cortadas («T» de «TV»).
          <Text
            allowFontScaling={false}
            style={{
              color: '#FFFFFF',
              fontFamily: letra.extra,
              fontSize: Math.round(lado * 0.36),
              letterSpacing: -0.4,
            }}
          >
            {iniciaisDe(parceiro.nome)}
          </Text>
        )}
      </View>
    </View>
  );
}
