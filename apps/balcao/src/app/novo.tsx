import { normalizarEmail, type FichaDoBalcao, type ResultadoDoCarimbo } from '@nunos-lab/dominio';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { chaveNova, mensagemDe, pedir, useCasa, useEu } from '../sessao';
import { Botao, Campo, Ecra, Icone, MARGEM, T, cor } from '@nunos-lab/ui';

/** Um cliente novo ao balcão: o nome, o email para entrar na app depois, e o 1.º carimbo. */
export default function Novo() {
  const { data: eu } = useEu();
  const casa = useCasa(eu);
  const consultas = useQueryClient();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [carimbarJa, setCarimbarJa] = useState(true);
  const [erro, setErro] = useState<{ nome?: string; email?: string; geral?: string }>({});
  const [aEnviar, setAEnviar] = useState(false);
  const [feito, setFeito] = useState<FichaDoBalcao | null>(null);

  const criar = async () => {
    const e: typeof erro = {};
    if (!nome.trim()) e.nome = 'O nome faz falta.';
    const emailLimpo = email.trim() ? normalizarEmail(email) : null;
    if (email.trim() && !emailLimpo) e.email = 'Esse email não está certo.';
    setErro(e);
    if (e.nome || e.email || !casa) return;
    setAEnviar(true);
    try {
      const r = await pedir<{ ficha: FichaDoBalcao; carimbo: ResultadoDoCarimbo | null }>(
        '/clientes',
        {
          metodo: 'POST',
          corpo: {
            nome: nome.trim(),
            email: emailLimpo,
            carimbo: carimbarJa
              ? {
                  chave: chaveNova(),
                  lojaId: casa,
                  servicoId: eu?.programa.servicos ? (eu.servicos[0]?.id ?? null) : null,
                }
              : null,
          },
        },
      );
      consultas.invalidateQueries({ queryKey: ['balcao', 'hoje'] });
      setFeito(r.ficha);
    } catch (x) {
      setErro({ geral: mensagemDe(x) });
    } finally {
      setAEnviar(false);
    }
  };

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Ecra comBarra={false}>
      <View
        style={{ paddingHorizontal: MARGEM, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <Pressable
          onPress={voltar}
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
          Cliente novo
        </T>
      </View>
      {feito ? (
        <View style={{ paddingHorizontal: MARGEM, marginTop: 40, alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: cor.claro,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icone nome="certo" tamanho={44} cor={cor.sobreClaro} espessura={2.6} />
          </View>
          <T v="subtitulo" style={{ textAlign: 'center' }}>
            {feito.cliente.nome}
          </T>
          <T v="corpo" style={{ color: cor.texto2, textAlign: 'center' }}>
            {feito.cartao.carimbos > 0
              ? `${feito.cartao.carimbos} de ${feito.cartao.objectivo}. `
              : ''}
            {email.trim()
              ? 'Entra na app com esse email e encontra o cartão.'
              : 'Para ter o cartão na app, entra com a Apple ou a Google.'}
          </T>
          <View style={{ marginTop: 10 }}>
            <Botao nome="Concluir" onPress={voltar} />
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: MARGEM, marginTop: 26, gap: 16 }}>
          <Campo
            rotulo="Nome"
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
            autoFocus
            maxLength={40}
            erro={erro.nome}
          />
          <Campo
            rotulo="Email (para entrar na app)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
            erro={erro.email}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 4,
              marginTop: 4,
            }}
          >
            <T v="forte">Carimbar já</T>
            <Switch
              value={carimbarJa}
              onValueChange={setCarimbarJa}
              trackColor={{ true: cor.claro, false: cor.linha }}
              thumbColor={carimbarJa ? cor.sobreClaro : cor.texto2}
            />
          </View>
          <View style={{ marginTop: 8 }}>
            <Botao nome={aEnviar ? 'A guardar…' : 'Guardar'} onPress={criar} />
          </View>
          {erro.geral && (
            <T v="legenda" role="alert" style={{ color: '#E07A72', textAlign: 'center' }}>
              {erro.geral}
            </T>
          )}
        </View>
      )}
    </Ecra>
  );
}
