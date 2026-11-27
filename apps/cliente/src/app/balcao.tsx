/**
 * Ler o QR do balcão (o Nuno, 27 nov 2026): a câmara lê o QR da barbearia, a app confirma que o
 * telemóvel está lá e o carimbo entra. Volta-se ao Cartão, onde o carimbo novo aparece com a festa de
 * sempre (carimbos-novos.ts). Também abre com o código já dado (/balcao?codigo=…): quando o QR se lê
 * com a câmara do telemóvel, abre a app da web na página inicial, que o manda para aqui.
 */
import { codigoDoBalcaoLido } from '@nunos-lab/dominio';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao, Icone, LARGURA_MAXIMA, MARGEM, T, cor, useTextosDaUi, vibrar } from '@nunos-lab/ui';
import { LeitorDoBalcao } from '../componentes/leitor-do-balcao';
import { temCamara } from '../componentes/tem-camara';
import { ErroDaConta, carimbarPeloQr, mensagemDe, useTemSessao } from '../conta';
import { definirTitulo } from '../dados';
import { ErroDaLocalizacao, ondeEstou } from '../localizacao';
import { useTextos } from '../textos';

type Estado =
  | { fase: 'a-ler' }
  | { fase: 'a-confirmar' }
  | { fase: 'a-carimbar' }
  | { fase: 'erro'; mensagem: string; definicoes: boolean; lerOutraVez: boolean };

/** A chave de idempotência deste ecrã: tentar outra vez manda a mesma (o carimbo conta uma vez). */
function chaveNova(): string {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let chave = 'qr';
  for (let i = 0; i < 22; i++) chave += letras[Math.floor(Math.random() * letras.length)];
  return chave;
}

/** Os erros em que ler outra vez pode dar certo (um QR errado, a rede, o GPS que não respondeu). */
const DA_PARA_TENTAR = ['qr_desconhecido', 'nao_e_o_qr', 'rede', 'interno', 'sem_localizacao'];

export default function Balcao() {
  const t = useTextos();
  const ui = useTextosDaUi();
  const margens = useSafeAreaInsets();
  const temSessao = useTemSessao();
  const consultas = useQueryClient();
  const { codigo: daMorada } = useLocalSearchParams<{ codigo?: string }>();
  const codigoDaMorada = daMorada ? codigoDoBalcaoLido(daMorada) : null;
  const [estado, setEstado] = useState<Estado>({ fase: 'a-ler' });
  // Cada «Ler outra vez» monta o leitor de novo (que esquece o último QR lido).
  const [leitura, setLeitura] = useState(0);
  const chave = useRef(chaveNova());
  const aCorrer = useRef(false);
  useEffect(() => definirTitulo(t.qr.titulo), [t]);

  const sair = () => (router.canGoBack() ? router.back() : router.replace('/cartao'));

  const carimbar = async (codigo: string) => {
    if (aCorrer.current) return;
    aCorrer.current = true;
    try {
      setEstado({ fase: 'a-confirmar' });
      const onde = await ondeEstou();
      setEstado({ fase: 'a-carimbar' });
      await carimbarPeloQr({ codigo, chave: chave.current, ...onde });
      // O «eu» fresco: o Cartão vê o carimbo novo e faz a festa, com o toque no pulso.
      await consultas.invalidateQueries({ queryKey: ['eu'] });
      vibrar('feito');
      sair();
    } catch (e) {
      const codigoDoErro =
        e instanceof ErroDaLocalizacao ? e.codigo : e instanceof ErroDaConta ? e.codigo : 'interno';
      setEstado({
        fase: 'erro',
        mensagem:
          e instanceof ErroDaLocalizacao ? (t.erros[e.codigo] ?? t.erros.interno) : mensagemDe(e),
        definicoes: codigoDoErro === 'sem_permissao_de_localizacao' && Platform.OS !== 'web',
        lerOutraVez: DA_PARA_TENTAR.includes(codigoDoErro),
      });
    } finally {
      aCorrer.current = false;
    }
  };

  // Com o código na morada (a câmara do telemóvel abriu a app da web), carimba logo, com sessão.
  useEffect(() => {
    if (codigoDaMorada && temSessao) void carimbar(codigoDaMorada);
  }, [codigoDaMorada, temSessao]); // eslint-disable-line react-hooks/exhaustive-deps

  const aoLer = (texto: string) => {
    if (estado.fase !== 'a-ler') return;
    const codigo = codigoDoBalcaoLido(texto);
    if (!codigo) {
      setEstado({ fase: 'erro', mensagem: t.qr.naoEOQr, definicoes: false, lerOutraVez: true });
      return;
    }
    void carimbar(codigo);
  };

  const lerOutraVez = () => {
    setEstado({ fase: 'a-ler' });
    if (codigoDaMorada) void carimbar(codigoDaMorada);
    else setLeitura((n) => n + 1);
  };

  const comCamara = !codigoDaMorada && temCamara && temSessao;
  const aMeio = estado.fase === 'a-confirmar' || estado.fase === 'a-carimbar';
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {comCamara && <LeitorDoBalcao key={leitura} aoLer={aoLer} activo={estado.fase === 'a-ler'} />}
      {comCamara && estado.fase === 'a-ler' && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: '22%', alignItems: 'center' }}
        >
          <View style={{ width: 230, height: 230 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  width: 34,
                  height: 34,
                  borderColor: 'rgba(244,241,236,0.8)',
                  borderTopWidth: i < 2 ? 3 : 0,
                  borderBottomWidth: i >= 2 ? 3 : 0,
                  borderLeftWidth: i % 2 === 0 ? 3 : 0,
                  borderRightWidth: i % 2 === 1 ? 3 : 0,
                  top: i < 2 ? 0 : undefined,
                  bottom: i >= 2 ? 0 : undefined,
                  left: i % 2 === 0 ? 0 : undefined,
                  right: i % 2 === 1 ? 0 : undefined,
                  borderTopLeftRadius: i === 0 ? 14 : 0,
                  borderTopRightRadius: i === 1 ? 14 : 0,
                  borderBottomLeftRadius: i === 2 ? 14 : 0,
                  borderBottomRightRadius: i === 3 ? 14 : 0,
                }}
              />
            ))}
          </View>
        </View>
      )}
      <Pressable
        onPress={sair}
        role="button"
        aria-label={ui.fechar}
        style={({ pressed }) => ({
          position: 'absolute',
          top: margens.top + 12,
          left: MARGEM,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: pressed ? 'rgba(10,10,10,0.7)' : 'rgba(10,10,10,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Icone nome="fechar" tamanho={20} espessura={2.4} />
      </Pressable>
      {/* Em baixo: o que fazer, o que está a acontecer, ou o que correu mal (com o que se pode fazer). */}
      <View
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        aria-live="polite"
        role={estado.fase === 'erro' ? 'alert' : undefined}
      >
        <View
          style={{
            width: '100%',
            maxWidth: LARGURA_MAXIMA,
            marginHorizontal: 'auto',
            paddingHorizontal: MARGEM,
            paddingTop: 20,
            paddingBottom: margens.bottom + 20,
            backgroundColor: cor.fundo,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            gap: 14,
          }}
        >
          {!temSessao ? (
            <>
              <T v="corpo">{t.qr.entraPrimeiro}</T>
              <Botao nome={t.qr.irAoCartao} largo onPress={() => router.replace('/cartao')} />
            </>
          ) : estado.fase === 'erro' ? (
            <>
              <T v="corpo">{estado.mensagem}</T>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {estado.definicoes && (
                  <Botao
                    nome={t.qr.definicoes}
                    largo
                    onPress={() => Linking.openSettings().catch(() => {})}
                  />
                )}
                {estado.lerOutraVez && (
                  <Botao nome={t.qr.lerOutraVez} largo onPress={lerOutraVez} />
                )}
                <Botao nome={t.qr.fechar} largo secundario onPress={sair} />
              </View>
            </>
          ) : (
            <T v="corpo" style={{ color: aMeio ? cor.texto : cor.texto2, textAlign: 'center' }}>
              {estado.fase === 'a-confirmar'
                ? t.qr.aConfirmar
                : estado.fase === 'a-carimbar'
                  ? t.qr.aCarimbar
                  : !codigoDaMorada && !temCamara
                    ? t.qr.semCamara
                    : t.qr.aponta}
            </T>
          )}
        </View>
      </View>
    </View>
  );
}
