import { dataCurta, diaEmLisboa } from '@nunos-lab/dominio';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import {
  APPLE_CLIENTE,
  ErroDaBalcao,
  GOOGLE_CLIENTE,
  guardarSessao,
  mensagemDe,
  pedir,
  useCasa,
  useDespejarFila,
  useEu,
  useHoje,
  useHojeParceiro,
  useTemSessao,
} from '../sessao';
import {
  Botao,
  BotaoDaApple,
  BotaoDoGoogle,
  CONTINUO,
  Ecra,
  Grupo,
  Icone,
  MARGEM,
  Rotulo,
  Separador,
  T,
  cor,
  raio,
  useLingua,
} from '@nunos-lab/ui';
import { useTextos } from '../textos';

const palavra = require('../../assets/marca/palavra.png');

/** Na web, o 404.html da raiz manda para cá as moradas da app que não têm index («?p=/ficha/XXXX»). */
function caminhoNaMorada(): string | null {
  if (Platform.OS !== 'web' || typeof location === 'undefined') return null;
  const p = new URLSearchParams(location.search).get('p');
  return p && /^\/[A-Za-z0-9/_-]*$/.test(p) ? p : null;
}

export default function Inicio() {
  const temSessao = useTemSessao();
  useEffect(() => {
    const p = caminhoNaMorada();
    if (!p) return;
    history.replaceState(null, '', location.pathname + location.hash);
    router.replace(p as never);
  }, []);
  // Entra-se com a Apple ou o Google do email que o Nuno registou (as ligações de acesso saíram a 8 nov).
  if (!temSessao) return <Entrar />;
  return <Dia />;
}

/** A barbearia carimba; o parceiro valida. */
function Dia() {
  const { data: eu } = useEu();
  if (eu?.pessoa.papel === 'parceiro') return <HojeParceiro />;
  return <Hoje />;
}

function HojeParceiro() {
  const t = useTextos();
  const lingua = useLingua();
  const { data: eu } = useEu();
  const { data: hoje, refetch } = useHojeParceiro(!!eu);
  const [aviso, setAviso] = useState<string | null>(null);
  const anular = async (id: number) => {
    setAviso(null);
    try {
      await pedir('/anular-vale', { metodo: 'POST', corpo: { valeId: id } });
      await refetch();
    } catch (e) {
      // Os textos gerais falam do Nuno, que anula carimbos; uma validação só a anula quem a fez.
      const codigo = e instanceof ErroDaBalcao ? e.codigo : '';
      setAviso(
        codigo === 'tarde_para_anular'
          ? t.parceiro.tardeParaAnular
          : codigo === 'de_outra_pessoa'
            ? t.parceiro.deOutraPessoa
            : mensagemDe(e),
      );
    }
  };
  return (
    <Ecra comBarra={false}>
      <View
        style={{
          paddingHorizontal: MARGEM,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1 }}>
          <T
            v="legenda"
            style={{ color: cor.texto3, letterSpacing: 1.2, textTransform: 'uppercase' }}
          >
            {t.parceiro.parceiroDoNunosLab}
          </T>
          <T v="titulo" numberOfLines={1}>
            {eu?.parceiro?.nome ?? t.parceiro.parceiro}
          </T>
        </View>
        <Pressable
          onPress={() => router.push('/conta')}
          role="link"
          aria-label={t.geral.conta}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: pressed ? cor.linha : cor.superficieAlta,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <T v="forte" style={{ fontSize: 15 }}>
            {(eu?.pessoa.nome ?? '·').trim().charAt(0).toUpperCase()}
          </T>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: MARGEM, marginTop: 22, flexDirection: 'row', gap: 10 }}>
        <Numero valor={hoje?.validacoes ?? 0} nome={t.parceiro.validacoesHoje} />
      </View>
      <View style={{ paddingHorizontal: MARGEM, marginTop: 18 }}>
        <Pressable
          onPress={() => router.push('/ler')}
          role="button"
          aria-label={t.geral.lerOCartao}
          style={({ pressed }) => ({
            height: 72,
            borderRadius: raio.grupo,
            backgroundColor: pressed ? cor.claroPremido : cor.claro,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            transform: [{ scale: pressed ? 0.99 : 1 }],
            ...CONTINUO,
          })}
        >
          <Icone nome="camara" tamanho={26} cor={cor.sobreClaro} espessura={2.4} />
          <T v="subtitulo" style={{ color: cor.sobreClaro }}>
            {t.geral.lerOCartao}
          </T>
        </Pressable>
      </View>
      {aviso && (
        <T
          v="legenda"
          role="alert"
          style={{ color: '#E07A72', textAlign: 'center', marginTop: 16 }}
        >
          {aviso}
        </T>
      )}
      {hoje && hoje.ultimos.length > 0 && (
        <>
          <Rotulo>{t.geral.hoje}</Rotulo>
          <Grupo>
            {hoje.ultimos.map((u, i) => {
              const podeAnular =
                u.pessoa === eu?.pessoa.nome && Date.now() / 1000 - u.quando < 600 && !u.anulado;
              return (
                <View key={u.id}>
                  {i > 0 && <Separador />}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      opacity: u.anulado ? 0.5 : 1,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <T
                        v="forte"
                        numberOfLines={1}
                        style={u.anulado ? { textDecorationLine: 'line-through' } : null}
                      >
                        {u.destaque} · {u.titulo}
                      </T>
                      <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
                        {[hora(u.quando), u.cliente || t.parceiro.cliente, u.pessoa]
                          .filter(Boolean)
                          .join(' · ')}
                      </T>
                    </View>
                    {podeAnular && (
                      <Pressable
                        onPress={() => anular(u.id)}
                        role="button"
                        aria-label={t.geral.anular}
                        hitSlop={8}
                        style={({ pressed }) => ({
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: pressed ? cor.linha : cor.superficieAlta,
                        })}
                      >
                        <T v="legenda">{t.geral.anular}</T>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </Grupo>
        </>
      )}
      {hoje && hoje.ultimos.length === 0 && (
        <T v="legenda" style={{ color: cor.texto3, textAlign: 'center', marginTop: 40 }}>
          {t.parceiro.semValidacoes(dataCurta(hoje.dia, diaEmLisboa(), lingua))}
        </T>
      )}
    </Ecra>
  );
}

function Entrar() {
  const t = useTextos();
  const [erro, setErro] = useState<unknown>(null);
  const correr = async (f: () => Promise<{ sessao: string }>) => {
    setErro(null);
    try {
      guardarSessao((await f()).sessao);
    } catch (e) {
      setErro(e);
    }
  };
  return (
    <Ecra comBarra={false}>
      {/* A língua escolhe-se só na Conta; antes de entrar, a do telemóvel (o Renato, 8 nov). O botão
          que estava aqui tinha 36 px: o logótipo fica no mesmo sítio. */}
      <View style={{ paddingHorizontal: MARGEM, paddingTop: 40, alignItems: 'center', gap: 14 }}>
        <PalavraDaMarca />
        <T
          v="legenda"
          style={{ color: cor.texto2, letterSpacing: 1.4, textTransform: 'uppercase' }}
        >
          for partners
        </T>
        <View style={{ height: 30 }} />
        <>
          {APPLE_CLIENTE ? (
            <BotaoDaApple
              clienteId={APPLE_CLIENTE}
              redirectURI={
                Platform.OS === 'web'
                  ? `${location.origin}${(process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '')}/`
                  : ''
              }
              aoEntrar={(d) => correr(() => pedir('/entrar/apple', { metodo: 'POST', corpo: d }))}
            />
          ) : null}
          {GOOGLE_CLIENTE ? (
            <BotaoDoGoogle
              clienteId={GOOGLE_CLIENTE}
              aoEntrar={(credencial) =>
                correr(() => pedir('/entrar/google', { metodo: 'POST', corpo: { credencial } }))
              }
            />
          ) : null}
          <T v="legenda" style={{ color: cor.texto3, textAlign: 'center', marginTop: 10 }}>
            {t.entrar.comAConta}
          </T>
        </>
        {erro !== null && (
          <T v="legenda" role="alert" style={{ color: '#E07A72', textAlign: 'center' }}>
            {mensagemDe(erro)}
          </T>
        )}
      </View>
    </Ecra>
  );
}

export function PalavraDaMarca({ largura = 150 }: { largura?: number }) {
  const { Image } = require('react-native') as typeof import('react-native');
  return (
    <Image
      source={palavra}
      style={{ width: largura, height: Math.round((largura * 227) / 1200) }}
      resizeMode="contain"
      accessibilityLabel="Nuno's Lab"
      role="img"
    />
  );
}

function hora(unix: number): string {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Hoje() {
  const t = useTextos();
  const lingua = useLingua();
  const { data: eu } = useEu();
  const casa = useCasa(eu);
  const { data: hoje } = useHoje(casa, !!eu);
  // Envia o que ainda estiver na fila de quando se carimbava sem rede (até 9 nov 2026).
  useDespejarFila(eu?.pessoa.id);
  const nomeDaCasa = eu?.lojas.find((l) => l.id === casa)?.nome ?? '';
  return (
    <Ecra comBarra={false}>
      <View
        style={{
          paddingHorizontal: MARGEM,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        {/* O nome da casa encolhe (uma linha) para a pastilha ficar dentro da margem a 320 px. */}
        <Pressable
          onPress={() => router.push('/conta')}
          role="link"
          aria-label={t.inicio.casaEConta}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexShrink: 1 })}
        >
          <T
            v="legenda"
            style={{ color: cor.texto3, letterSpacing: 1.2, textTransform: 'uppercase' }}
          >
            Nuno's Lab
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T v="titulo" numberOfLines={1} style={{ flexShrink: 1 }}>
              {nomeDaCasa || "Nuno's Lab"}
            </T>
            {eu && eu.lojas.length > 1 && eu.pessoa.papel !== 'barbeiro' && (
              <Icone nome="seguinte" tamanho={18} cor={cor.texto3} espessura={2.4} />
            )}
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push('/conta')}
          role="link"
          aria-label={t.geral.conta}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: pressed ? cor.linha : cor.superficieAlta,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <T v="forte" style={{ fontSize: 15 }}>
            {(eu?.pessoa.nome ?? '·').trim().charAt(0).toUpperCase()}
          </T>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: MARGEM, marginTop: 22, flexDirection: 'row', gap: 10 }}>
        <Numero valor={hoje?.carimbos ?? 0} nome={t.inicio.carimbos} />
        <Numero valor={hoje?.novos ?? 0} nome={t.inicio.novos} />
        <Numero valor={hoje?.recompensas ?? 0} nome={t.inicio.premios} />
      </View>

      <View style={{ paddingHorizontal: MARGEM, marginTop: 18, gap: 10 }}>
        <Pressable
          onPress={() => router.push('/ler')}
          role="button"
          aria-label={t.geral.lerOCartao}
          style={({ pressed }) => ({
            height: 72,
            borderRadius: raio.grupo,
            backgroundColor: pressed ? cor.claroPremido : cor.claro,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            transform: [{ scale: pressed ? 0.99 : 1 }],
            ...CONTINUO,
          })}
        >
          <Icone nome="camara" tamanho={26} cor={cor.sobreClaro} espessura={2.4} />
          <T v="subtitulo" style={{ color: cor.sobreClaro }}>
            {t.geral.lerOCartao}
          </T>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Botao
            nome={t.inicio.procurar}
            icone="procurar"
            secundario
            largo
            onPress={() => router.push('/clientes')}
          />
          <Botao
            nome={t.inicio.clienteNovo}
            icone="mais"
            secundario
            largo
            onPress={() => router.push('/novo')}
          />
        </View>
        {eu?.pessoa.papel === 'dono' && (
          <Botao
            nome={t.inicio.resumo}
            icone="grafico"
            secundario
            onPress={() => router.push('/resumo')}
          />
        )}
      </View>

      {hoje && hoje.ultimos.length > 0 && (
        <>
          <Rotulo>{t.geral.hoje}</Rotulo>
          <Grupo>
            {hoje.ultimos.map((u, i) => (
              <View key={u.id}>
                {i > 0 && <Separador />}
                {/* Um toque abre a ficha deste carimbo, e é lá que se anula (o Renato, 9 nov). */}
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/ficha/[codigo]',
                      params: { codigo: u.codigo, carimbo: String(u.id) },
                    })
                  }
                  role="link"
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: pressed ? cor.superficieAlta : 'transparent',
                    opacity: u.anulado ? 0.5 : 1,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <T
                      v="forte"
                      numberOfLines={1}
                      style={u.anulado ? { textDecorationLine: 'line-through' } : null}
                    >
                      {u.cliente || t.geral.semNome}
                    </T>
                    <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
                      {[hora(u.quando), u.pessoa, u.repetido ? t.inicio.repetido : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </T>
                  </View>
                  {u.recompensa && (
                    <Icone nome="presente" tamanho={18} cor={cor.texto2} espessura={2} />
                  )}
                  <T v="forte" style={{ color: cor.texto2 }}>
                    {u.carimbos}/{u.objectivo}
                  </T>
                  <Icone nome="seguinte" tamanho={18} cor={cor.texto3} espessura={2.4} />
                </Pressable>
              </View>
            ))}
          </Grupo>
        </>
      )}
      {hoje && hoje.ultimos.length === 0 && (
        <T v="legenda" style={{ color: cor.texto3, textAlign: 'center', marginTop: 40 }}>
          {t.inicio.semCarimbos(dataCurta(hoje.dia, diaEmLisboa(), lingua))}
        </T>
      )}
    </Ecra>
  );
}

function Numero({ valor, nome }: { valor: number; nome: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cor.superficie,
        borderRadius: raio.grupo,
        paddingVertical: 14,
        paddingHorizontal: 14,
        ...CONTINUO,
      }}
    >
      <T v="titulo">{valor}</T>
      <T
        v="legenda"
        style={{ color: cor.texto2, marginTop: 2, fontSize: 12, letterSpacing: -0.2 }}
        numberOfLines={1}
      >
        {nome}
      </T>
    </View>
  );
}
