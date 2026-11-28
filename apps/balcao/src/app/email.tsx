import { ALGARISMOS_DO_CODIGO } from '@nunos-lab/dominio';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Botao, Campo, Ecra, Icone, MARGEM, T, cor } from '@nunos-lab/ui';
import { CaixasDoCodigo, type CaixasDoCodigoRef } from '../componentes/caixas-do-codigo';
import {
  ErroDaBalcao,
  formaPorLigar,
  guardarSessao,
  largarFormaPorLigar,
  mensagemDe,
  pedir,
  useTemSessao,
} from '../sessao';
import { useTextos } from '../textos';

/**
 * Entrar com um código mandado ao email que o Nuno registou (28 nov 2026): o email, e depois as seis
 * casas, que entram sozinhas ao último algarismo. Uma Apple ou Google que não deu com ninguém (a
 * ligação guardada em formaPorLigar) segue com o código e fica ligada à pessoa.
 */
export default function EntrarComEmail() {
  const t = useTextos();
  const temSessao = useTemSessao();
  // Com sessão já aberta (a página recarregada na web), não há nada a fazer aqui.
  const [tinhaSessao] = useState(temSessao);
  const [forma] = useState(formaPorLigar);
  const [fase, setFase] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [reenviarAs, setReenviarAs] = useState(0);
  const [agora, setAgora] = useState(Date.now());
  const caixas = useRef<CaixasDoCodigoRef>(null);
  const aEntrar = useRef(false);

  const faltam = Math.max(0, Math.ceil((reenviarAs - agora) / 1000));
  const aContar = fase === 'codigo' && faltam > 0;
  useEffect(() => {
    if (!aContar) return;
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(relogio);
  }, [aContar]);

  const pedirCodigo = async () => {
    const r = await pedir<{ reenviarEm: number }>('/entrar/email', {
      metodo: 'POST',
      corpo: { email: email.trim() },
    });
    setAgora(Date.now());
    setReenviarAs(Date.now() + r.reenviarEm * 1000);
  };

  const enviar = async () => {
    if (ocupado) return;
    setErro(null);
    if (!email.trim()) return setErro(new ErroDaBalcao('email_invalido'));
    setOcupado(true);
    try {
      await pedirCodigo();
      setCodigo('');
      setAviso(null);
      setFase('codigo');
    } catch (e) {
      setErro(e);
    } finally {
      setOcupado(false);
    }
  };

  const reenviar = async () => {
    if (ocupado || faltam > 0) return;
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await pedirCodigo();
      setCodigo('');
      setAviso(t.email.reenviado);
    } catch (e) {
      setErro(e);
    } finally {
      setOcupado(false);
      caixas.current?.focar();
    }
  };

  const confirmar = async (escrito: string) => {
    aEntrar.current = true;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await pedir<{ sessao: string }>('/entrar/email/codigo', {
        metodo: 'POST',
        corpo: { email: email.trim(), codigo: escrito, ...(forma ? { ligar: forma.ligar } : {}) },
      });
      largarFormaPorLigar();
      guardarSessao(r.sessao);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      aEntrar.current = false;
      setOcupado(false);
      setCodigo('');
      setErro(e);
      caixas.current?.focar();
    }
  };

  useEffect(() => {
    if (fase === 'codigo' && codigo.length === ALGARISMOS_DO_CODIGO && !aEntrar.current)
      void confirmar(codigo);
    // A cada código completo, uma vez (o confirmar volta a pôr o campo vazio se falhar).
  }, [codigo, fase]);

  if (tinhaSessao) return <Redirect href="/" />;

  const textoDoErro = erro ? mensagemDe(erro) : null;

  return (
    <Ecra comBarra={false}>
      <View
        style={{ paddingHorizontal: MARGEM, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
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
        {/* Sem cortar: a 320 px, «Sign in with email» passa à linha seguinte. */}
        <T v="titulo" role="heading" aria-level={1} style={{ flexShrink: 1 }}>
          {fase === 'email' ? t.email.titulo : t.email.tituloDoCodigo}
        </T>
      </View>

      {fase === 'email' ? (
        <View style={{ paddingHorizontal: MARGEM, marginTop: 28, gap: 14 }}>
          <Campo
            rotulo={t.email.oTeuEmail}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (erro) setErro(null);
            }}
            autoFocus
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            enterKeyHint="send"
            onSubmitEditing={() => void enviar()}
            maxLength={254}
            erro={textoDoErro}
          />
          {forma && (
            <T v="legenda" style={{ color: cor.texto2, marginLeft: 4 }}>
              {t.email.ficaLigada(forma.tipo)}
            </T>
          )}
          <Botao nome={t.email.enviarCodigo} onPress={() => void enviar()} ocupado={ocupado} />
        </View>
      ) : (
        <View style={{ paddingHorizontal: MARGEM, marginTop: 18, gap: 18 }}>
          <T v="corpo" style={{ color: cor.texto2 }}>
            {t.email.enviadoPara(email.trim())}
          </T>
          <CaixasDoCodigo
            ref={caixas}
            valor={codigo}
            aoMudar={(v) => {
              if (aEntrar.current) return;
              setCodigo(v);
              if (erro) setErro(null);
            }}
            rotulo={t.email.rotuloDoCodigo}
            errado={!!erro}
          />
          <T
            v="legenda"
            role="alert"
            style={{
              color: erro ? cor.perigo : cor.texto2,
              textAlign: 'center',
              minHeight: 18,
            }}
          >
            {textoDoErro ?? (ocupado && aEntrar.current ? t.email.aEntrar : (aviso ?? ''))}
          </T>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              flexWrap: 'wrap',
              columnGap: 28,
              rowGap: 8,
            }}
          >
            <Ligacao
              nome={faltam > 0 ? t.email.reenviarDaqui(faltam) : t.email.reenviar}
              onPress={() => void reenviar()}
              desligada={faltam > 0 || ocupado}
            />
            <Ligacao
              nome={t.email.mudarEmail}
              desligada={ocupado && aEntrar.current}
              onPress={() => {
                setFase('email');
                setCodigo('');
                setErro(null);
                setAviso(null);
              }}
            />
          </View>
          <T v="legenda" style={{ color: cor.texto3, textAlign: 'center' }}>
            {t.email.soChegaAoRegistado}
          </T>
        </View>
      )}
    </Ecra>
  );
}

/** Um botão só de texto (Reenviar, Mudar o email). Desligado com `disabled`: na web é o que conta. */
function Ligacao({
  nome,
  onPress,
  desligada = false,
}: {
  nome: string;
  onPress: () => void;
  desligada?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desligada}
      role="button"
      aria-label={nome}
      hitSlop={10}
      style={({ pressed }) => ({
        paddingVertical: 6,
        opacity: desligada ? 0.45 : pressed ? 0.6 : 1,
      })}
    >
      <T v="forte" style={{ fontSize: 15 }}>
        {nome}
      </T>
    </Pressable>
  );
}
