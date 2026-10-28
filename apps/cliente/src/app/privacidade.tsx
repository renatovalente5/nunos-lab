import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { definirTitulo } from '../dados';
import { Ecra, Icone, MARGEM, T, cor } from '@nunos-lab/ui';

const PARAGRAFOS = [
  'A app mostra as vantagens dos parceiros do Nuno’s Lab e, se quiseres, o teu cartão de carimbos. Sem conta, não pede nada: não usa cookies nem tem publicidade.',
  'Com conta (Apple, Google ou email), o Nuno’s Lab guarda o teu nome, o email, a data de anos se a deres, e os carimbos: em que casa, com quem e quando. É o que faz o cartão funcionar. A Apple e a Google só confirmam quem és; não recebem os teus carimbos.',
  'Podes mudar ou apagar a conta na app, a qualquer altura. Ao apagar, o que é teu sai; ficam só contagens sem nome, para os números da barbearia.',
  'Para o Nuno saber o que interessa, a app conta, sem saber quem és, quantas vezes é aberta e quantas vezes cada parceiro é visto ou contactado. Fica só o dia e o número.',
  'A app guarda neste aparelho a última lista de vantagens, para a mostrar quando a rede falha.',
  'A app é servida pelo GitHub Pages e os dados vêm de um servidor da Cloudflare, com a base de dados na União Europeia. Como em qualquer site, estes serviços recebem o endereço do teu aparelho para te entregar a página.',
];

export default function Privacidade() {
  useEffect(() => definirTitulo("Privacidade · Nuno's Lab"), []);
  return (
    <Ecra comBarra={false}>
      <View style={{ paddingHorizontal: MARGEM }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/barbearia'))}
          role="button"
          aria-label="Voltar"
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
          Privacidade
        </T>
        {PARAGRAFOS.map((p) => (
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
