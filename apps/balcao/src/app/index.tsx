import { dataCurta, diaEmLisboa } from '@nunos-lab/dominio';
import { Link, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import {
  APPLE_CLIENTE,
  GOOGLE_CLIENTE,
  guardarSessao,
  mensagemDe,
  pedir,
  useCasa,
  useDespejarFila,
  useEu,
  useFila,
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
} from '@nunos-lab/ui';

const palavra = require('../../assets/marca/palavra.png');

/** A ligação de acesso traz o código no fragmento: «…/balcao/#acesso=XXXX». */
function codigoNaMorada(): string | null {
  if (Platform.OS !== 'web' || typeof location === 'undefined') return null;
  return /^#acesso=([A-Za-z0-9_-]{43})$/.exec(location.hash)?.[1] ?? null;
}

export default function Inicio() {
  const temSessao = useTemSessao();
  const [entrada, setEntrada] = useState<{
    estado: 'parado' | 'a-entrar' | 'erro';
    mensagem?: string;
  }>({
    estado: 'parado',
  });
  const tentados = useRef(new Set<string>());
  useEffect(() => {
    const tentar = () => {
      const codigo = codigoNaMorada();
      if (!codigo || tentados.current.has(codigo)) return;
      tentados.current.add(codigo);
      history.replaceState(null, '', `${location.pathname}${location.search}`);
      setEntrada({ estado: 'a-entrar' });
      pedir<{ sessao: string }>('/entrar', { metodo: 'POST', corpo: { acesso: codigo } })
        .then((r) => {
          guardarSessao(r.sessao);
          setEntrada({ estado: 'parado' });
        })
        .catch((e) => setEntrada({ estado: 'erro', mensagem: mensagemDe(e) }));
    };
    tentar();
    if (Platform.OS === 'web') {
      window.addEventListener('hashchange', tentar);
      return () => window.removeEventListener('hashchange', tentar);
    }
  }, []);
  if (!temSessao || entrada.estado === 'a-entrar')
    return <Entrar estado={entrada.estado} mensagem={entrada.mensagem} />;
  return <Dia />;
}

/** A barbearia carimba; o parceiro valida. */
function Dia() {
  const { data: eu } = useEu();
  if (eu?.pessoa.papel === 'parceiro') return <HojeParceiro />;
  return <Hoje />;
}

function HojeParceiro() {
  const { data: eu } = useEu();
  const { data: hoje, refetch } = useHojeParceiro(!!eu);
  const [aviso, setAviso] = useState<string | null>(null);
  const anular = async (id: number) => {
    setAviso(null);
    try {
      await pedir('/anular-vale', { metodo: 'POST', corpo: { valeId: id } });
      await refetch();
    } catch (e) {
      setAviso(mensagemDe(e));
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
            Parceiro Nuno's Lab
          </T>
          <T v="titulo" numberOfLines={1}>
            {eu?.parceiro?.nome ?? 'Balcão'}
          </T>
        </View>
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
            <T v="forte" style={{ fontSize: 15 }}>
              {(eu?.pessoa.nome ?? '·').trim().charAt(0).toUpperCase()}
            </T>
          </Pressable>
        </Link>
      </View>

      <View style={{ paddingHorizontal: MARGEM, marginTop: 22, flexDirection: 'row', gap: 10 }}>
        <Numero valor={hoje?.validacoes ?? 0} nome="Validações hoje" />
      </View>
      <View style={{ paddingHorizontal: MARGEM, marginTop: 18 }}>
        <Pressable
          onPress={() => router.push('/ler')}
          role="button"
          aria-label="Ler o cartão"
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
            Ler o cartão
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
          <Rotulo>Hoje</Rotulo>
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
                        {[hora(u.quando), u.cliente || 'cliente', u.pessoa]
                          .filter(Boolean)
                          .join(' · ')}
                      </T>
                    </View>
                    {podeAnular && (
                      <Pressable
                        onPress={() => anular(u.id)}
                        role="button"
                        aria-label="Anular"
                        hitSlop={8}
                        style={({ pressed }) => ({
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: pressed ? cor.linha : cor.superficieAlta,
                        })}
                      >
                        <T v="legenda">Anular</T>
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
          {dataCurta(hoje.dia, diaEmLisboa())} · ainda sem validações
        </T>
      )}
    </Ecra>
  );
}

function Entrar({ estado, mensagem }: { estado: string; mensagem?: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const correr = async (f: () => Promise<{ sessao: string }>) => {
    setErro(null);
    try {
      guardarSessao((await f()).sessao);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  };
  return (
    <Ecra comBarra={false}>
      <View style={{ paddingHorizontal: MARGEM, paddingTop: 40, alignItems: 'center', gap: 14 }}>
        <PalavraDaMarca />
        <T
          v="legenda"
          style={{ color: cor.texto2, letterSpacing: 1.4, textTransform: 'uppercase' }}
        >
          Balcão
        </T>
        <View style={{ height: 30 }} />
        {estado === 'a-entrar' ? (
          <T v="forte">A entrar…</T>
        ) : (
          <>
            {APPLE_CLIENTE ? (
              <BotaoDaApple
                clienteId={APPLE_CLIENTE}
                redirectURI={`${location.origin}${(process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '')}/`}
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
              Entra com a conta que o Nuno registou,{'\n'}ou abre a ligação que te mandaram.
            </T>
          </>
        )}
        {(erro || estado === 'erro') && (
          <T v="legenda" role="alert" style={{ color: '#E07A72', textAlign: 'center' }}>
            {erro ?? mensagem}
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
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Hoje() {
  const { data: eu } = useEu();
  const casa = useCasa(eu);
  const { data: hoje, refetch } = useHoje(casa, !!eu);
  const fila = useFila();
  useDespejarFila();
  const [aviso, setAviso] = useState<string | null>(null);
  const nomeDaCasa = eu?.lojas.find((l) => l.id === casa)?.nome ?? '';
  const anular = async (id: number) => {
    setAviso(null);
    try {
      await pedir('/anular', { metodo: 'POST', corpo: { carimboId: id } });
      await refetch();
    } catch (e) {
      setAviso(mensagemDe(e));
    }
  };
  const naFila = fila ? (JSON.parse(fila) as unknown[]).length : 0;
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
        <Link href="/conta" asChild>
          <Pressable
            role="link"
            aria-label="Casa e conta"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <T
              v="legenda"
              style={{ color: cor.texto3, letterSpacing: 1.2, textTransform: 'uppercase' }}
            >
              Nuno's Lab
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T v="titulo">{nomeDaCasa || 'Balcão'}</T>
              {eu && eu.lojas.length > 1 && eu.pessoa.papel !== 'barbeiro' && (
                <Icone nome="seguinte" tamanho={18} cor={cor.texto3} espessura={2.4} />
              )}
            </View>
          </Pressable>
        </Link>
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
            <T v="forte" style={{ fontSize: 15 }}>
              {(eu?.pessoa.nome ?? '·').trim().charAt(0).toUpperCase()}
            </T>
          </Pressable>
        </Link>
      </View>

      <View style={{ paddingHorizontal: MARGEM, marginTop: 22, flexDirection: 'row', gap: 10 }}>
        <Numero valor={hoje?.carimbos ?? 0} nome="Carimbos" />
        <Numero valor={hoje?.novos ?? 0} nome="Novos" />
        <Numero valor={hoje?.recompensas ?? 0} nome="Prémios" />
      </View>

      <View style={{ paddingHorizontal: MARGEM, marginTop: 18, gap: 10 }}>
        <Pressable
          onPress={() => router.push('/ler')}
          role="button"
          aria-label="Ler o cartão"
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
            Ler o cartão
          </T>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Botao
            nome="Procurar"
            icone="procurar"
            secundario
            largo
            onPress={() => router.push('/clientes')}
          />
          <Botao
            nome="Cliente novo"
            icone="mais"
            secundario
            largo
            onPress={() => router.push('/novo')}
          />
        </View>
        {eu?.pessoa.papel === 'dono' && (
          <Botao nome="Resumo" icone="grafico" secundario onPress={() => router.push('/resumo')} />
        )}
      </View>

      {naFila > 0 && (
        <T v="legenda" style={{ color: cor.texto2, textAlign: 'center', marginTop: 16 }}>
          {naFila === 1
            ? '1 carimbo guardado, a enviar…'
            : `${naFila} carimbos guardados, a enviar…`}
        </T>
      )}
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
          <Rotulo>Hoje</Rotulo>
          <Grupo>
            {hoje.ultimos.map((u, i) => {
              const minhaEmTempo =
                u.pessoa === eu?.pessoa.nome && Date.now() / 1000 - u.quando < 600 && !u.anulado;
              const podeAnular = minhaEmTempo || eu?.pessoa.papel === 'dono';
              return (
                <View key={u.id}>
                  {i > 0 && <Separador />}
                  <Pressable
                    onPress={() => router.push(`/ficha/${u.codigo}`)}
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
                        {u.cliente || 'Sem nome'}
                      </T>
                      <T v="legenda" style={{ color: cor.texto2, marginTop: 2 }}>
                        {[hora(u.quando), u.pessoa, u.servico, u.repetido ? 'repetido' : null]
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
                    {podeAnular && !u.anulado && (
                      <Pressable
                        onPress={() => anular(u.id)}
                        role="button"
                        aria-label="Anular"
                        hitSlop={8}
                        style={({ pressed }) => ({
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: pressed ? cor.linha : cor.superficieAlta,
                        })}
                      >
                        <T v="legenda">Anular</T>
                      </Pressable>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </Grupo>
        </>
      )}
      {hoje && hoje.ultimos.length === 0 && (
        <T v="legenda" style={{ color: cor.texto3, textAlign: 'center', marginTop: 40 }}>
          {dataCurta(hoje.dia, diaEmLisboa())} · ainda sem carimbos
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
