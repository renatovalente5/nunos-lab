import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Icone } from '../componentes/icone';
import { Ecra } from '../componentes/pecas';
import { T } from '../componentes/texto';
import { definirTitulo } from '../dados';
import { cor, MARGEM } from '../tema';

const PARAGRAFOS = [
  'A app mostra as vantagens dos parceiros do Nuno’s Lab. Não pede o teu nome, o teu email nem o teu telefone, não usa cookies e não tem publicidade.',
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
