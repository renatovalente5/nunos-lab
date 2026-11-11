import {
  codigoCurto,
  codigoValido,
  limparNome,
  normalizarEmail,
  type FichaDoBalcao,
  type ResultadoDoCarimbo,
} from '@nunos-lab/dominio';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ErroDaBalcao, chaveNova, mensagemDe, pedir, useCasa, useEu } from '../sessao';
import {
  Botao,
  Campo,
  Ecra,
  Icone,
  Interruptor,
  MARGEM,
  T,
  cor,
  useTextosDaUi,
} from '@nunos-lab/ui';
import { useTextos } from '../textos';
import { pt } from '../textos/pt';

/** A app do cliente, para ir na mensagem com o código. */
const LIGACAO_DA_APP = 'https://renatovalente5.github.io/nunos-lab/';

/** Um cliente novo ao balcão: o nome, o email para entrar na app depois, e o 1.º carimbo. */
export default function Novo() {
  const t = useTextos();
  const tUi = useTextosDaUi();
  const { data: eu } = useEu();
  const casa = useCasa(eu);
  const consultas = useQueryClient();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [carimbarJa, setCarimbarJa] = useState(true);
  const [erro, setErro] = useState<{ nome?: string; email?: string; geral?: string }>({});
  const [aEnviar, setAEnviar] = useState(false);
  const [feito, setFeito] = useState<FichaDoBalcao | null>(null);
  const [copiado, setCopiado] = useState(false);
  // Uma chave por formulário, não por toque: dois «Guardar» (ou a resposta perdida) devolvem
  // o cliente que já nasceu com ela, em vez de criarem um segundo.
  const chave = useRef(chaveNova());

  const criar = async () => {
    if (aEnviar) return;
    const e: typeof erro = {};
    if (!limparNome(nome)) e.nome = t.novo.faltaONome;
    const emailLimpo = email.trim() ? normalizarEmail(email) : null;
    if (email.trim() && !emailLimpo) e.email = t.novo.emailErrado;
    setErro(e);
    if (e.nome || e.email || !casa) return;
    setAEnviar(true);
    try {
      const r = await pedir<{ ficha: FichaDoBalcao; carimbo: ResultadoDoCarimbo | null }>(
        '/clientes',
        {
          metodo: 'POST',
          corpo: {
            nome: limparNome(nome),
            email: emailLimpo,
            carimbo: carimbarJa
              ? {
                  chave: chave.current,
                  lojaId: casa,
                }
              : null,
          },
        },
      );
      consultas.invalidateQueries({ queryKey: ['balcao', 'hoje'] });
      setFeito(r.ficha);
    } catch (x) {
      // O email já tem cartão: a API diz qual, e abre-se logo essa ficha em vez de mandar procurar.
      const codigo = x instanceof ErroDaBalcao ? x.dados.codigo : null;
      if (
        x instanceof ErroDaBalcao &&
        x.codigo === 'email_ja_tem_cartao' &&
        typeof codigo === 'string' &&
        codigoValido(codigo)
      ) {
        router.replace({ pathname: '/ficha/[codigo]', params: { codigo } });
        return;
      }
      setErro({ geral: mensagemDe(x) });
    } finally {
      setAEnviar(false);
    }
  };

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /** O código para o cliente levar: a folha de partilha, ou copiado quando o browser não a tem. */
  const partilhar = async (codigo: string) => {
    // Em português, seja qual for a língua da for partners: a mensagem é para o cliente.
    const texto = pt.novo.mensagem(codigoCurto(codigo), LIGACAO_DA_APP);
    try {
      if (Platform.OS !== 'web') {
        await Share.share({ message: texto });
      } else if (typeof navigator.share === 'function') {
        await navigator.share({ text: texto });
      } else {
        await navigator.clipboard.writeText(texto);
        setCopiado(true);
      }
    } catch {
      // Fechou a folha de partilha, ou o browser não deixou copiar.
    }
  };

  return (
    <Ecra comBarra={false}>
      <View
        style={{ paddingHorizontal: MARGEM, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <Pressable
          onPress={voltar}
          role="button"
          aria-label={t.geral.voltar}
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
          {t.novo.titulo}
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
          {/* O código em grande: é com ele que o cliente sem app volta (e puxa o cartão na app). */}
          <T v="titulo" style={{ letterSpacing: 2, textAlign: 'center' }} selectable>
            {codigoCurto(feito.cliente.codigo)}
          </T>
          <T v="corpo" style={{ color: cor.texto2, textAlign: 'center' }}>
            {feito.cartao.carimbos > 0
              ? `${tUi.carimbosDe(feito.cartao.carimbos, feito.cartao.objectivo)}. `
              : ''}
            {email.trim() ? t.novo.entraComOEmail : t.novo.entraComAppleOuGoogle}
          </T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Botao
              nome={copiado ? t.novo.copiado : t.novo.partilhar}
              icone="partilhar"
              secundario
              onPress={() => partilhar(feito.cliente.codigo)}
            />
            <Botao nome={t.geral.concluir} onPress={voltar} />
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: MARGEM, marginTop: 26, gap: 16 }}>
          <Campo
            rotulo={t.novo.nome}
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
            autoFocus
            maxLength={40}
            erro={erro.nome}
          />
          <Campo
            rotulo={t.novo.email}
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
            <T v="forte">{t.novo.carimbarJa}</T>
            <Interruptor ligado={carimbarJa} mudar={setCarimbarJa} rotulo={t.novo.carimbarJa} />
          </View>
          <View style={{ marginTop: 8 }}>
            <Botao
              nome={aEnviar ? t.novo.aGuardar : t.novo.guardar}
              ocupado={aEnviar}
              onPress={criar}
            />
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
