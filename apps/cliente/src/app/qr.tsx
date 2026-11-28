/**
 * Ler o QR do balcão (o Nuno, 27 nov 2026): a câmara lê o QR da barbearia, a app confirma que o
 * telemóvel está lá e o carimbo entra. Diz-se «Carimbado em …» e volta-se ao Cartão, onde o carimbo novo
 * aparece com a festa de sempre (carimbos-novos.ts). Também abre com o código já dado (/qr?codigo=…):
 * quando o QR se lê com a câmara do telemóvel, abre a app da web na página inicial, que o manda para aqui.
 *
 * Chamava-se /balcao, mas na web essa morada é a da for partners: o GitHub Pages servia a app dos
 * barbeiros a quem recarregasse a página (revisão de 27 nov 2026).
 */
import { codigoDoBalcaoLido, dentroDasHorasDoQr } from '@nunos-lab/dominio';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao, Icone, LARGURA_MAXIMA, MARGEM, T, cor, useTextosDaUi, vibrar } from '@nunos-lab/ui';
import { LeitorDoBalcao, type EstadoDaCamara } from '../componentes/leitor-do-balcao';
import { temCamara } from '../componentes/tem-camara';
import { ErroDaConta, carimbarPeloQr, mensagemDe, useEu, useTemSessao } from '../conta';
import { definirTitulo } from '../dados';
import { ErroDaLocalizacao, ondeEstou, temLocalizacao } from '../localizacao';
import { guardarQrPendente } from '../qr-pendente';
import { useTextos } from '../textos';

type Estado =
  | { fase: 'a-ler' }
  | { fase: 'a-confirmar' }
  | { fase: 'a-carimbar' }
  | { fase: 'feito'; loja: string }
  | { fase: 'erro'; codigo: string; mensagem: string; definicoes: boolean; lerOutraVez: boolean };

/** A chave de idempotência deste ecrã: tentar outra vez manda a mesma (o carimbo conta uma vez). */
function chaveNova(): string {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let chave = 'qr';
  for (let i = 0; i < 22; i++) chave += letras[Math.floor(Math.random() * letras.length)];
  return chave;
}

/**
 * Os erros em que tentar outra vez pode dar certo: um QR errado, a rede, o GPS que não respondeu ou que
 * errou (de mais perto da porta), e a autorização ou a localização exacta dadas nas Definições (o iPhone
 * não reabre a app ao mudá-las).
 */
const DA_PARA_TENTAR = [
  'qr_desconhecido',
  'nao_e_o_qr',
  'rede',
  'interno',
  'sem_localizacao',
  'sem_permissao_de_localizacao',
  'localizacao_aproximada',
  'localizacao_imprecisa',
  'longe_do_balcao',
];
/**
 * Os que se resolvem nas Definições da app: a autorização e a localização exacta. A «imprecisa» do
 * servidor (a exacta ligada, mas sem sinal bom) não: aí é chegar à porta (2.ª revisão de 27 nov 2026).
 */
const PEDE_DEFINICOES = ['sem_permissao_de_localizacao', 'localizacao_aproximada'];
/**
 * Os da localização (o QR lido estava certo: o servidor confere-o antes do sítio). Tentar outra vez não
 * volta à câmara: manda o mesmo QR com uma posição nova, e não a de há pouco.
 */
const DA_LOCALIZACAO = [
  'sem_localizacao',
  'localizacao_imprecisa',
  'longe_do_balcao',
  ...PEDE_DEFINICOES,
];

/** A app da web num iPhone ou iPad (o iPad diz-se Mac, com toque): a app está na App Store. */
const webNoIphone =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

export default function Qr() {
  const t = useTextos();
  const ui = useTextosDaUi();
  const margens = useSafeAreaInsets();
  const temSessao = useTemSessao();
  const consultas = useQueryClient();
  // Uma morada com o parâmetro repetido dá uma lista: só um texto serve.
  const { codigo: daMorada } = useLocalSearchParams<{ codigo?: string | string[] }>();
  const [codigoDaMorada, setCodigoDaMorada] = useState(() =>
    typeof daMorada === 'string' ? codigoDoBalcaoLido(daMorada) : null,
  );
  const [estado, setEstado] = useState<Estado>({ fase: 'a-ler' });
  const [camara, setCamara] = useState<EstadoDaCamara>('a-abrir');
  // Cada «Ler outra vez» monta o leitor de novo (que esquece o último QR lido).
  const [leitura, setLeitura] = useState(0);
  const [tentouAbrir, setTentouAbrir] = useState(false);
  const chave = useRef(chaveNova());
  // O último QR que a câmara leu: depois de uma recusa da localização, tenta-se outra vez com ele.
  const lido = useRef<string | null>(null);
  const aCorrer = useRef(false);
  // Fechado o ecrã a meio (o «X», o gesto de voltar), não se carimba nem se sai de onde a pessoa já está.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  useEffect(() => definirTitulo(t.qr.titulo), [t]);
  // As apps de antes da 1.0.6 recebem este ecrã por OTA, mas sem a localização: pede-se a versão nova.
  const appAntiga = Platform.OS !== 'web' && !temLocalizacao;

  // Antes de pedir a câmara e a localização, o que o servidor recusaria de certeza (2.ª revisão de 27 nov):
  // fora de horas, sem o primeiro carimbo do barbeiro, ou o próximo é o do prémio. Só com o «eu» de agora
  // (o guardado no aparelho pode ser de antes); sem rede, ao fim de 4 s, segue-se e o servidor decide.
  const eu = useEu();
  const [esperou, setEsperou] = useState(false);
  useEffect(() => {
    const vez = setTimeout(() => setEsperou(true), 4000);
    return () => clearTimeout(vez);
  }, []);
  const euDeAgora =
    eu.isFetchedAfterMount || (eu.dataUpdatedAt > 0 && Date.now() - eu.dataUpdatedAt < 30_000);
  const pronto = !temSessao || euDeAgora || eu.isError || esperou;
  const recusaPrevista =
    !temSessao || !euDeAgora || !eu.data || eu.data.demo
      ? null
      : !dentroDasHorasDoQr()
        ? ('fora_de_horas' as const)
        : eu.data.cortes === 0
          ? ('primeiro_com_o_barbeiro' as const)
          : eu.data.cartao.carimbos + 1 >= eu.data.cartao.objectivo
            ? ('premio_com_o_barbeiro' as const)
            : null;
  useEffect(() => {
    if (recusaPrevista)
      setEstado((e) =>
        e.fase === 'a-ler'
          ? {
              fase: 'erro',
              codigo: recusaPrevista,
              mensagem: t.erros[recusaPrevista] ?? t.erros.interno,
              definicoes: false,
              lerOutraVez: false,
            }
          : e,
      );
  }, [recusaPrevista, t]);

  const sair = () => (router.canGoBack() ? router.back() : router.replace('/cartao'));

  const carimbar = async (codigo: string, fresca = false) => {
    if (aCorrer.current || appAntiga) return;
    aCorrer.current = true;
    try {
      setEstado({ fase: 'a-confirmar' });
      const onde = await ondeEstou({ fresca });
      if (!montado.current) return;
      setEstado({ fase: 'a-carimbar' });
      const feito = await carimbarPeloQr({ codigo, chave: chave.current, ...onde });
      // O «eu» fresco: o Cartão vê o carimbo novo e faz a festa, com o toque no pulso.
      await consultas.invalidateQueries({ queryKey: ['eu'] });
      if (!montado.current) return;
      vibrar('feito');
      // Diz-se onde entrou (sobretudo na web, onde não há o toque no pulso), e depois o Cartão.
      setEstado({ fase: 'feito', loja: feito.loja });
      setTimeout(() => montado.current && sair(), 1400);
    } catch (e) {
      if (!montado.current) return;
      const codigoDoErro =
        e instanceof ErroDaLocalizacao ? e.codigo : e instanceof ErroDaConta ? e.codigo : 'interno';
      setEstado({
        fase: 'erro',
        codigo: codigoDoErro,
        mensagem:
          e instanceof ErroDaLocalizacao ? (t.erros[e.codigo] ?? t.erros.interno) : mensagemDe(e),
        definicoes: PEDE_DEFINICOES.includes(codigoDoErro) && Platform.OS !== 'web',
        lerOutraVez: DA_PARA_TENTAR.includes(codigoDoErro),
      });
    } finally {
      aCorrer.current = false;
    }
  };

  // Com o código na morada (a câmara do telemóvel abriu a app da web), carimba logo, com sessão — se
  // não for uma recusa certa (e então diz-se sem pedir a localização).
  useEffect(() => {
    if (codigoDaMorada && temSessao && pronto && !recusaPrevista) void carimbar(codigoDaMorada);
  }, [codigoDaMorada, temSessao, pronto, recusaPrevista]); // eslint-disable-line react-hooks/exhaustive-deps

  const aoLer = (texto: string) => {
    if (estado.fase !== 'a-ler') return;
    const codigo = codigoDoBalcaoLido(texto);
    if (!codigo) {
      setEstado({
        fase: 'erro',
        codigo: 'nao_e_o_qr',
        mensagem: t.qr.naoEOQr,
        definicoes: false,
        lerOutraVez: true,
      });
      return;
    }
    lido.current = codigo;
    void carimbar(codigo);
  };

  /** O QR com que se tenta outra vez sem a câmara: o da morada, ou o lido se a recusa foi do sítio. */
  const semCamaraOutraVez = (erro: string | null) =>
    codigoDaMorada && erro !== 'qr_desconhecido'
      ? codigoDaMorada
      : erro && DA_LOCALIZACAO.includes(erro)
        ? lido.current
        : null;

  const lerOutraVez = () => {
    const erro = estado.fase === 'erro' ? estado.codigo : null;
    const codigo = semCamaraOutraVez(erro);
    setEstado({ fase: 'a-ler' });
    if (codigo) {
      void carimbar(codigo, !!erro && DA_LOCALIZACAO.includes(erro));
      return;
    }
    // Abre-se a câmara de novo. O QR da morada que já não vale (trocado ou desligado no backoffice)
    // esquece-se, para ler o do balcão em vez de mandar o mesmo outra vez.
    if (codigoDaMorada) setCodigoDaMorada(null);
    setLeitura((n) => n + 1);
  };

  /** Entrar no Cartão (sem sessão): o código fica guardado, e o Cartão volta aqui depois de entrar. */
  const entrar = () => {
    if (codigoDaMorada) guardarQrPendente(codigoDaMorada);
    router.replace('/cartao');
  };
  /**
   * Na web do iPhone, a app instalada abre este ecrã com o código (a sessão está na app). Sem a app, o
   * Safari não abre nada: passado um bocado, com a página ainda à vista, diz-se o que fazer.
   */
  const abrirAApp = () => {
    if (!codigoDaMorada || typeof window === 'undefined') return;
    window.location.href = `nunoslab://qr?codigo=${codigoDaMorada}`;
    setTimeout(() => {
      if (montado.current && document.visibilityState === 'visible') setTentouAbrir(true);
    }, 1500);
  };

  // A câmara só com o ecrã a ler: com uma recusa à vista, ou já carimbado, fica desligada.
  const comCamara =
    !codigoDaMorada &&
    temCamara &&
    temSessao &&
    !appAntiga &&
    pronto &&
    !recusaPrevista &&
    estado.fase === 'a-ler';
  const aMeio = estado.fase === 'a-confirmar' || estado.fase === 'a-carimbar';
  const semCamara = comCamara && camara === 'sem-camara';
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {comCamara && (
        <LeitorDoBalcao
          key={leitura}
          aoLer={aoLer}
          activo={estado.fase === 'a-ler'}
          aoMudar={setCamara}
        />
      )}
      {comCamara && camara === 'aberta' && (
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
        hitSlop={4}
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
          {appAntiga ? (
            <>
              <T v="corpo">{t.qr.actualiza}</T>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Botao nome={t.qr.fechar} largo secundario onPress={sair} />
              </View>
            </>
          ) : !temSessao ? (
            <>
              {/* Lido com a câmara do telemóvel, o QR abre a web, que não tem a sessão da app: o caminho
                  certo é entrar aqui (o código espera); no iPhone, também a app instalada. Os botões vão
                  numa linha: um «largo» numa coluna ficava com 0 px na web. */}
              <T v="corpo">{Platform.OS === 'web' ? t.qr.abreAApp : t.qr.entraPrimeiro}</T>
              {tentouAbrir && (
                <T v="legenda" style={{ color: cor.texto2 }}>
                  {t.qr.semApp}
                </T>
              )}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Botao
                  nome={Platform.OS === 'web' ? t.qr.entrarAqui : t.qr.irAoCartao}
                  largo
                  onPress={entrar}
                />
                {webNoIphone && codigoDaMorada && (
                  <Botao nome={t.qr.abrirAApp} largo secundario onPress={abrirAApp} />
                )}
              </View>
            </>
          ) : estado.fase === 'feito' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <Icone nome="certo" tamanho={22} cor={cor.aberto} espessura={2.6} />
              <T v="forte">{t.qr.carimbado(estado.loja)}</T>
            </View>
          ) : estado.fase === 'erro' ? (
            <>
              <T v="corpo">{estado.mensagem}</T>
              {/* As Definições numa linha só (três botões lado a lado não cabem num telemóvel); depois,
                  ler outra vez quando se volta de lá (o iPhone não reabre a app). */}
              {estado.definicoes && (
                <View style={{ flexDirection: 'row' }}>
                  <Botao
                    nome={t.qr.definicoes}
                    largo
                    onPress={() => Linking.openSettings().catch(() => {})}
                  />
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {estado.lerOutraVez && (
                  <Botao
                    nome={semCamaraOutraVez(estado.codigo) ? t.qr.tentarOutraVez : t.qr.lerOutraVez}
                    largo
                    secundario={estado.definicoes}
                    onPress={lerOutraVez}
                  />
                )}
                <Botao nome={t.qr.fechar} largo secundario onPress={sair} />
              </View>
            </>
          ) : semCamara ? (
            <>
              {/* Sem a câmara (negada, ou o computador sem ela): o que fazer, e não «Aponta ao QR». */}
              <T v="corpo">{t.qr.semCamaraAjuda}</T>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Botao
                  nome={t.qr.tentarOutraVez}
                  largo
                  onPress={() => {
                    setCamara('a-abrir');
                    setLeitura((n) => n + 1);
                  }}
                />
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
                    : !pronto || (comCamara && camara === 'a-abrir')
                      ? t.qr.aAbrir
                      : t.qr.aponta}
            </T>
          )}
        </View>
      </View>
    </View>
  );
}
