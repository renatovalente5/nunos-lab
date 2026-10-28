import { codigoCurto, dataCurta, diaEmLisboa, textoDoQr } from '@nunos-lab/dominio';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartaoDoCliente } from '../../componentes/cartao';
import {
  APPLE_CLIENTE,
  GOOGLE_CLIENTE,
  mensagemDe,
  moradaDeRetornoDaApple,
  useConta,
  useEu,
  useTemSessao,
} from '../../conta';
import { contar, definirTitulo } from '../../dados';
import {
  BotaoDaApple,
  BotaoDoGoogle,
  CONTINUO,
  Ecra,
  Grupo,
  Icone,
  LARGURA_MAXIMA,
  MARGEM,
  QR,
  Rotulo,
  Separador,
  T,
  cor,
  raio,
} from '@nunos-lab/ui';

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '·';
}

export default function Cartao() {
  const temSessao = useTemSessao();
  const { data: eu, isError, refetch } = useEu(true);
  const { width } = useWindowDimensions();
  const largura = Math.min(width, LARGURA_MAXIMA) - MARGEM * 2;
  const [qrAberto, setQrAberto] = useState(false);
  useEffect(() => {
    definirTitulo("Nuno's Lab · Cartão");
    contar('cartao');
  }, []);

  return (
    <Ecra>
      <View
        style={{
          paddingHorizontal: MARGEM,
          paddingTop: 10,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <T v="titulo" role="heading" aria-level={1}>
          Cartão
        </T>
        {temSessao && (
          <Link href="/conta" asChild>
            <Pressable
              role="link"
              aria-label="Conta"
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: pressed ? cor.linha : cor.superficieAlta,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              {eu?.nome ? (
                <T v="forte" style={{ fontSize: 15 }}>
                  {iniciais(eu.nome)}
                </T>
              ) : (
                <Icone nome="pessoa" tamanho={20} espessura={2} />
              )}
            </Pressable>
          </Link>
        )}
      </View>

      <View style={{ paddingHorizontal: MARGEM, marginTop: 18 }}>
        <CartaoDoCliente eu={temSessao ? (eu ?? null) : null} largura={largura} />
      </View>

      {!temSessao && <Entrar />}

      {temSessao && eu && (
        <>
          {eu.recompensas.length > 0 && (
            <View
              style={{
                marginHorizontal: MARGEM,
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                borderRadius: raio.grupo,
                backgroundColor: cor.claro,
                ...CONTINUO,
              }}
            >
              <Icone nome="presente" tamanho={24} cor={cor.sobreClaro} espessura={2} />
              <View style={{ flex: 1 }}>
                <T v="forte" style={{ color: cor.sobreClaro }}>
                  {eu.recompensas.length === 1
                    ? `Tens ${eu.recompensas[0]!.recompensa.toLowerCase()}`
                    : `Tens ${eu.recompensas.length} recompensas`}
                </T>
                <T v="legenda" style={{ color: 'rgba(10,10,10,0.6)' }}>
                  Mostra o cartão ao balcão.
                </T>
              </View>
            </View>
          )}

          <Pressable
            onPress={() => setQrAberto(true)}
            role="button"
            aria-label="Ver o código em grande"
            style={({ pressed }) => ({
              marginHorizontal: MARGEM,
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 18,
              padding: 16,
              borderRadius: raio.grupo,
              backgroundColor: pressed ? cor.superficieAlta : cor.superficie,
              ...CONTINUO,
            })}
          >
            <QR texto={textoDoQr(eu.codigo)} tamanho={128} margem={10} raio={14} />
            <View style={{ flex: 1 }}>
              <T v="subtitulo" style={{ letterSpacing: 1.5 }}>
                {codigoCurto(eu.codigo)}
              </T>
              <T v="legenda" style={{ color: cor.texto2, marginTop: 6 }}>
                Mostra ao balcão.{'\n'}Serve nas três casas.
              </T>
            </View>
          </Pressable>

          {eu.visitas.length > 0 && (
            <>
              <Rotulo>Últimas visitas</Rotulo>
              <Grupo>
                {eu.visitas.slice(0, 5).map((v, i) => (
                  <View key={v.id}>
                    {i > 0 && <Separador />}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <T v="forte">{v.loja ?? "Nuno's Lab"}</T>
                        {(v.pessoa || v.servico) && (
                          <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
                            {[v.pessoa, v.servico].filter(Boolean).join(' · ')}
                          </T>
                        )}
                      </View>
                      <T v="legenda" style={{ color: cor.texto2 }}>
                        {dataCurta(diaEmLisboa(v.quando * 1000), diaEmLisboa())}
                      </T>
                    </View>
                  </View>
                ))}
              </Grupo>
            </>
          )}

          {eu.vales.length > 0 && (
            <>
              <Rotulo>Nos parceiros</Rotulo>
              <Grupo>
                {eu.vales.slice(0, 5).map((v, i) => (
                  <View key={v.id}>
                    {i > 0 && <Separador />}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <T v="forte" numberOfLines={1}>
                          {v.parceiro}
                        </T>
                        <T
                          v="legenda"
                          style={{ color: cor.texto2, marginTop: 2 }}
                          numberOfLines={1}
                        >
                          {v.destaque} · {v.titulo}
                        </T>
                      </View>
                      <T v="legenda" style={{ color: cor.texto2 }}>
                        {dataCurta(diaEmLisboa(v.quando * 1000), diaEmLisboa())}
                      </T>
                    </View>
                  </View>
                ))}
              </Grupo>
            </>
          )}

          {isError && !eu && (
            <T v="legenda" style={{ color: cor.texto3, textAlign: 'center', marginTop: 20 }}>
              Sem ligação.
            </T>
          )}

          <QrEmGrande
            aberto={qrAberto}
            fechar={() => setQrAberto(false)}
            codigo={eu.codigo}
            nome={eu.nome}
          />
        </>
      )}
      {temSessao && !eu && isError && (
        <Pressable onPress={() => refetch()} style={{ alignItems: 'center', marginTop: 24 }}>
          <T v="legenda" style={{ color: cor.texto2 }}>
            Sem ligação. Tocar para tentar outra vez.
          </T>
        </Pressable>
      )}
    </Ecra>
  );
}

/** Sem conta: um toque na Apple ou no Google e o cartão nasce. */
function Entrar() {
  const { entrarComGoogle, entrarComApple } = useConta();
  const [erro, setErro] = useState<string | null>(null);
  const [aEntrar, setAEntrar] = useState(false);
  const correr = async (f: () => Promise<void>) => {
    setAEntrar(true);
    setErro(null);
    try {
      await f();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setAEntrar(false);
    }
  };
  return (
    <View style={{ paddingHorizontal: MARGEM, marginTop: 26, gap: 12, alignItems: 'center' }}>
      <T v="corpo" style={{ color: cor.texto2, textAlign: 'center', marginBottom: 6 }}>
        Entra para ter o teu cartão.
      </T>
      {APPLE_CLIENTE ? (
        <BotaoDaApple
          clienteId={APPLE_CLIENTE}
          redirectURI={moradaDeRetornoDaApple()}
          aoEntrar={(d) => correr(() => entrarComApple(d))}
        />
      ) : null}
      {GOOGLE_CLIENTE ? (
        <BotaoDoGoogle
          clienteId={GOOGLE_CLIENTE}
          aoEntrar={(c) => correr(() => entrarComGoogle(c))}
        />
      ) : null}
      {aEntrar && (
        <T v="legenda" style={{ color: cor.texto2 }}>
          A entrar…
        </T>
      )}
      {erro && (
        <T v="legenda" style={{ color: '#E07A72', textAlign: 'center' }} role="alert">
          {erro}
        </T>
      )}
    </View>
  );
}

/** O QR a ecrã inteiro, para ler ao balcão. */
function QrEmGrande({
  aberto,
  fechar,
  codigo,
  nome,
}: {
  aberto: boolean;
  fechar: () => void;
  codigo: string;
  nome: string;
}) {
  const margens = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const lado = Math.min(width - 64, 340);
  return (
    <Modal visible={aberto} transparent animationType="fade" onRequestClose={fechar}>
      <Pressable
        onPress={fechar}
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: margens.top,
          paddingBottom: margens.bottom,
        }}
        aria-label="Fechar"
      >
        <QR texto={textoDoQr(codigo)} tamanho={lado} margem={0} raio={0} />
        <T v="titulo" style={{ color: '#0A0A0A', marginTop: 28, letterSpacing: 2 }}>
          {codigoCurto(codigo)}
        </T>
        {!!nome && (
          <T v="forte" style={{ color: '#6B6760', marginTop: 6 }}>
            {nome}
          </T>
        )}
      </Pressable>
    </Modal>
  );
}
