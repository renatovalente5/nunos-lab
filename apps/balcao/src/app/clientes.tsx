import { dataCurta, diaEmLisboa, type ClienteProcurado } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { mensagemDe, pedir } from '../sessao';
import { Campo, Ecra, Grupo, Icone, MARGEM, Separador, T, cor } from '@nunos-lab/ui';

/** Procurar um cliente pelo nome, pelo email ou pelo código (quando não há QR à mão). */
export default function Clientes() {
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(texto.trim()), 250);
    return () => clearTimeout(id);
  }, [texto]);
  const { data, error } = useQuery({
    queryKey: ['balcao', 'clientes', q],
    queryFn: () => pedir<ClienteProcurado[]>(`/clientes?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    networkMode: 'always',
    staleTime: 10_000,
    retry: 1,
  });
  return (
    <Ecra comBarra={false}>
      <View
        style={{ paddingHorizontal: MARGEM, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          role="button"
          aria-label="Voltar"
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
        <T v="titulo" role="heading" aria-level={1}>
          Procurar
        </T>
      </View>
      <View style={{ paddingHorizontal: MARGEM, marginTop: 20 }}>
        <Campo
          value={texto}
          onChangeText={setTexto}
          placeholder="Nome, email ou código"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      {data && data.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Grupo>
            {data.map((k, i) => (
              <View key={k.id}>
                {i > 0 && <Separador />}
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/ficha/[codigo]',
                      params: { codigo: k.codigo, semLeitura: '1' },
                    })
                  }
                  role="link"
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    backgroundColor: pressed ? cor.superficieAlta : 'transparent',
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <T v="forte" numberOfLines={1}>
                      {k.nome || 'Sem nome'}
                    </T>
                    <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }} numberOfLines={1}>
                      {[
                        k.email,
                        k.ultimo
                          ? dataCurta(diaEmLisboa(k.ultimo * 1000), diaEmLisboa())
                          : 'sem visitas',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </T>
                  </View>
                  <T v="forte" style={{ color: cor.texto2 }}>
                    {k.carimbos}/{k.objectivo}
                  </T>
                  <Icone nome="seguinte" tamanho={16} cor={cor.texto3} espessura={2.2} />
                </Pressable>
              </View>
            ))}
          </Grupo>
        </View>
      )}
      {data && data.length === 0 && q.length >= 2 && (
        <T v="legenda" style={{ color: cor.texto3, textAlign: 'center', marginTop: 30 }}>
          Ninguém com «{q}».
        </T>
      )}
      {!!error && (
        <T
          v="legenda"
          role="alert"
          style={{ color: '#E07A72', textAlign: 'center', marginTop: 30 }}
        >
          {mensagemDe(error)}
        </T>
      )}
    </Ecra>
  );
}
