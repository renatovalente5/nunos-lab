import {
  NOME_DA_LINGUA,
  dataCurta,
  diaEmLisboa,
  diasEntre,
  limparNome,
  type FormaDeEntrar,
  type Loja,
} from '@nunos-lab/dominio';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import {
  APPLE_CLIENTE,
  GOOGLE_CLIENTE,
  guardarLinguaNaConta,
  mensagemDe,
  moradaDeRetornoDaApple,
  useConta,
  useEu,
  useTemSessao,
} from '../conta';
import { RodaDeData } from '../componentes/roda-de-data';
import { definirTitulo, useDados } from '../dados';
import {
  Botao,
  BotaoDaApple,
  BotaoDoGoogle,
  Campo,
  Ecra,
  Esqueleto,
  Folha,
  FolhaDaLingua,
  Grupo,
  Icone,
  MARGEM,
  CartaoDaFolha,
  OpcaoDaFolha,
  Rotulo,
  SemLigacao,
  Separador,
  T,
  cor,
  useLingua,
  type NomeDoIcone,
} from '@nunos-lab/ui';
import { useTextos } from '../textos';

const NOME_DA_FORMA: Record<FormaDeEntrar['tipo'], string> = {
  apple: 'Apple',
  google: 'Google',
  email: 'Email',
};

/** «DD/MM» ↔ «MM-DD». */
const paraEcra = (a: string | null) => (a ? `${a.slice(3)}/${a.slice(0, 2)}` : '');
/** Uma sessão aberta num browser («Mac · Safari»): o globo em vez do telemóvel. */
const NO_BROWSER = /· (Safari|Chrome|Firefox|Edge|Opera)$/;

function Linha({
  icone,
  nome,
  valor,
  onPress,
  perigo = false,
}: {
  icone: NomeDoIcone;
  nome: string;
  valor?: string;
  onPress?: () => void;
  perigo?: boolean;
}) {
  const tinta = perigo ? '#E07A72' : cor.texto;
  const conteudo = (
    <>
      <Icone nome={icone} tamanho={20} cor={perigo ? tinta : cor.texto2} espessura={2} />
      <T v="forte" style={{ flex: 1, color: tinta }}>
        {nome}
      </T>
      {valor !== undefined && (
        <T v="legenda" style={{ color: cor.texto2, maxWidth: 170 }} numberOfLines={1}>
          {valor}
        </T>
      )}
      {onPress && <Icone nome="seguinte" tamanho={16} cor={cor.texto3} espessura={2.2} />}
    </>
  );
  const estilo = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 16,
  };
  if (!onPress) return <View style={estilo}>{conteudo}</View>;
  return (
    <Pressable
      onPress={onPress}
      role="button"
      style={({ pressed }) => [
        estilo,
        { backgroundColor: pressed ? cor.superficieAlta : 'transparent' },
      ]}
    >
      {conteudo}
    </Pressable>
  );
}

/** «Voltar» e o título: ficam sempre, mesmo sem o «eu» (um ecrã vazio não tinha saída). */
function Cabecalho() {
  const t = useTextos();
  return (
    <View
      style={{ paddingHorizontal: MARGEM, flexDirection: 'row', alignItems: 'center', gap: 14 }}
    >
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/cartao'))}
        role="button"
        aria-label={t.conta.voltar}
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
        {t.conta.titulo}
      </T>
    </View>
  );
}

export default function Conta() {
  const t = useTextos();
  const lingua = useLingua();
  const temSessao = useTemSessao();
  const { data: eu, isError, isFetching, refetch } = useEu();
  const { data: dados } = useDados();
  const conta = useConta();
  const [aviso, setAviso] = useState<string | null>(null);
  const [folha, setFolha] = useState<
    'nome' | 'aniversario' | 'casa' | 'juntar' | 'apagar' | 'lingua' | null
  >(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => definirTitulo(t.titulos.conta), [t]);
  useEffect(() => {
    if (!temSessao) router.replace('/cartao');
  }, [temSessao]);
  // Com sessão mas sem «eu» (aparelho novo, rede fraca): o cabeçalho fica, e por baixo o esqueleto ou «Sem ligação».
  if (!eu) {
    return (
      <Ecra comBarra={false}>
        <Cabecalho />
        {isError && !isFetching ? <SemLigacao tentar={() => refetch()} /> : <Esqueleto />}
      </Ecra>
    );
  }

  const lojas: Loja[] = dados?.barbearia.lojas ?? [];
  const casa = lojas.find((l) => l.id === eu.lojaId)?.nome ?? t.conta.todas;
  const correr = async (f: () => Promise<unknown>, depois?: () => void) => {
    setErro(null);
    try {
      await f();
      depois?.();
    } catch (e) {
      setErro(mensagemDe(e));
    }
  };
  const abrir = (qual: typeof folha, inicial = '') => {
    setTexto(inicial);
    setErro(null);
    setFolha(qual);
  };
  // As sessões, a deste aparelho em primeiro; as outras pela última vez que se usaram.
  const sessoes = [...eu.sessoes].sort(
    (a, b) => Number(b.actual) - Number(a.actual) || b.vistaEm - a.vistaEm,
  );
  const hoje = diaEmLisboa();
  // Só a demonstração (os revisores das lojas) não tem formas de entrar: a API recusa-lhe o resto.
  const demonstracao = eu.demo ?? eu.formas.length === 0;
  // No Android não há Apple: a folha «Juntar» abria vazia.
  const formasQueFaltam = (['apple', 'google'] as const).filter(
    (t) =>
      !eu.formas.some((f) => f.tipo === t) &&
      (t === 'apple' ? APPLE_CLIENTE && Platform.OS !== 'android' : GOOGLE_CLIENTE),
  );

  return (
    <Ecra comBarra={false}>
      <Cabecalho />

      <Rotulo>{t.conta.eu}</Rotulo>
      <Grupo>
        <Linha
          icone="pessoa"
          nome={t.conta.nome}
          valor={eu.nome || '—'}
          onPress={() => abrir('nome', eu.nome)}
        />
        <Separador recuo={48} />
        <Linha
          icone="bolo"
          nome={t.conta.aniversario}
          valor={paraEcra(eu.aniversario) || '—'}
          onPress={() => abrir('aniversario', eu.aniversario ?? '')}
        />
        <Separador recuo={48} />
        <Linha icone="loja" nome={t.conta.aMinhaCasa} valor={casa} onPress={() => abrir('casa')} />
      </Grupo>

      <Rotulo>{t.conta.formasDeEntrar}</Rotulo>
      <Grupo>
        {eu.formas.map((f, i) => (
          <View key={f.id}>
            {i > 0 && <Separador recuo={48} />}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 54,
                paddingHorizontal: 16,
              }}
            >
              <Icone
                nome={f.tipo === 'email' ? 'email' : 'pessoa'}
                tamanho={20}
                cor={cor.texto2}
                espessura={2}
              />
              <View style={{ flex: 1 }}>
                <T v="forte">{NOME_DA_FORMA[f.tipo]}</T>
                {!!f.email && (
                  <T v="legenda" style={{ color: cor.texto2 }} numberOfLines={1}>
                    {f.email}
                  </T>
                )}
              </View>
              {eu.formas.length > 1 && (
                <Pressable
                  onPress={() => correr(() => conta.tirarForma(f.id))}
                  role="button"
                  aria-label={t.conta.tirarForma(NOME_DA_FORMA[f.tipo])}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <T v="legenda" style={{ color: cor.texto2 }}>
                    {t.conta.tirar}
                  </T>
                </Pressable>
              )}
            </View>
          </View>
        ))}
        {formasQueFaltam.length > 0 && !demonstracao && (
          <>
            <Separador recuo={48} />
            <Linha icone="mais" nome={t.conta.juntarOutraForma} onPress={() => abrir('juntar')} />
          </>
        )}
      </Grupo>

      {/* Os aparelhos com sessão, este em primeiro: cada outro sai sozinho (o Renato, 8 nov). */}
      <Rotulo>{t.conta.sessoes}</Rotulo>
      <Grupo>
        {sessoes.map((x, i) => {
          // A API chama «Aparelho» ao que não conhece («Aparelho · Chrome»): diz-se na língua da app.
          const nome = (x.aparelho || 'Aparelho').replace(/^Aparelho\b/, t.conta.aparelhoSemNome);
          const dia = diaEmLisboa(x.vistaEm * 1000);
          return (
            <View key={x.id}>
              {i > 0 && <Separador recuo={48} />}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 54,
                  paddingHorizontal: 16,
                }}
              >
                <Icone
                  nome={NO_BROWSER.test(x.aparelho) ? 'site' : 'aparelho'}
                  tamanho={20}
                  cor={cor.texto2}
                  espessura={2}
                />
                <View style={{ flex: 1 }}>
                  <T v="forte" numberOfLines={1}>
                    {nome}
                  </T>
                  <T v="legenda" style={{ color: cor.texto2 }} numberOfLines={1}>
                    {x.actual
                      ? t.conta.esteAparelho
                      : t.conta.usado(diasEntre(dia, hoje), dataCurta(dia, hoje, lingua))}
                  </T>
                </View>
                {!x.actual && !demonstracao && (
                  <Pressable
                    onPress={() => correr(() => conta.terminarSessao(x.id))}
                    role="button"
                    aria-label={t.conta.terminarSessao(nome)}
                    hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <T v="legenda" style={{ color: cor.texto2 }}>
                      {t.conta.terminar}
                    </T>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
        {sessoes.length > 2 && !demonstracao && (
          <>
            <Separador recuo={48} />
            <Linha
              icone="fechar"
              nome={t.conta.terminarAsOutras}
              onPress={() => correr(() => conta.sairDasOutras())}
            />
          </>
        )}
        <Separador recuo={48} />
        <Linha
          icone="sair"
          nome={t.conta.sair}
          onPress={() =>
            correr(
              () => conta.sair(),
              () => router.replace('/cartao'),
            )
          }
        />
      </Grupo>

      <Rotulo>{t.conta.mais}</Rotulo>
      <Grupo>
        <Linha
          icone="site"
          nome={t.conta.lingua}
          valor={NOME_DA_LINGUA[lingua]}
          onPress={() => abrir('lingua')}
        />
        <Separador recuo={48} />
        <Linha
          icone="escudo"
          nome={t.conta.privacidade}
          onPress={() => router.push('/privacidade')}
        />
        {!demonstracao && (
          <>
            <Separador recuo={48} />
            <Linha
              icone="lixo"
              nome={t.conta.apagarAConta}
              perigo
              onPress={() => abrir('apagar')}
            />
          </>
        )}
      </Grupo>

      {(erro || aviso) && (
        <T
          v="legenda"
          role="alert"
          style={{
            color: erro ? '#E07A72' : cor.texto2,
            textAlign: 'center',
            marginTop: 18,
            paddingHorizontal: MARGEM,
          }}
        >
          {erro ?? aviso}
        </T>
      )}

      <Folha aberta={folha === 'nome'} fechar={() => setFolha(null)} titulo={t.conta.oTeuNome}>
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 10, gap: 14 }}>
          <Campo
            value={texto}
            onChangeText={setTexto}
            autoFocus
            maxLength={40}
            placeholder={t.conta.nomeProprio}
            autoCapitalize="words"
            erro={erro}
          />
          <Botao
            nome={t.conta.guardar}
            onPress={() => {
              const nome = limparNome(texto);
              if (!nome) return setErro(t.conta.escreveONome);
              correr(
                () => conta.perfil({ nome }),
                () => setFolha(null),
              );
            }}
          />
        </View>
      </Folha>

      <Folha
        aberta={folha === 'aniversario'}
        fechar={() => setFolha(null)}
        titulo={t.conta.aniversario}
      >
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 10, gap: 18 }}>
          {folha === 'aniversario' && <RodaDeData valor={eu.aniversario} aoMudar={setTexto} />}
          {/* Só depois de rodar: o que a roda mostra ao abrir não é uma escolha. */}
          <Botao
            nome={t.conta.guardar}
            inactivo={!texto}
            onPress={() =>
              correr(
                () => conta.perfil({ aniversario: texto || null }),
                () => setFolha(null),
              )
            }
          />
          {!!eu.aniversario && (
            <Pressable
              onPress={() =>
                correr(
                  () => conta.perfil({ aniversario: null }),
                  () => setFolha(null),
                )
              }
              role="button"
              style={{ alignSelf: 'center', padding: 8 }}
            >
              <T v="legenda" style={{ color: cor.texto3 }}>
                {t.conta.tirarOAniversario}
              </T>
            </Pressable>
          )}
          {erro && (
            <T v="legenda" style={{ color: '#E07A72' }}>
              {erro}
            </T>
          )}
        </View>
      </Folha>

      <Folha aberta={folha === 'casa'} fechar={() => setFolha(null)} titulo={t.conta.aMinhaCasa}>
        <CartaoDaFolha role="radiogroup" aria-label={t.conta.aMinhaCasa}>
          <OpcaoDaFolha
            nome={t.conta.todasAsCasas}
            escolhida={eu.lojaId === null}
            onPress={() =>
              correr(
                () => conta.perfil({ lojaId: null }),
                () => setFolha(null),
              )
            }
          />
          {lojas.map((l) => (
            <OpcaoDaFolha
              key={l.id}
              nome={l.nome}
              escolhida={eu.lojaId === l.id}
              separador
              onPress={() =>
                correr(
                  () => conta.perfil({ lojaId: l.id }),
                  () => setFolha(null),
                )
              }
            />
          ))}
        </CartaoDaFolha>
        {erro && (
          <T v="legenda" style={{ color: '#E07A72', paddingHorizontal: MARGEM, marginTop: 10 }}>
            {erro}
          </T>
        )}
      </Folha>

      <Folha
        aberta={folha === 'juntar'}
        fechar={() => setFolha(null)}
        titulo={t.conta.juntarOutraForma}
      >
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 10, gap: 12, alignItems: 'center' }}>
          {formasQueFaltam.includes('apple') && (
            <BotaoDaApple
              clienteId={APPLE_CLIENTE}
              redirectURI={moradaDeRetornoDaApple()}
              aoEntrar={(d) =>
                correr(
                  () => conta.juntarApple(d),
                  () => setFolha(null),
                )
              }
            />
          )}
          {formasQueFaltam.includes('google') && (
            <BotaoDoGoogle
              clienteId={GOOGLE_CLIENTE}
              aoEntrar={(c) =>
                correr(
                  () => conta.juntarGoogle(c),
                  () => setFolha(null),
                )
              }
            />
          )}
          {erro && (
            <T v="legenda" style={{ color: '#E07A72', textAlign: 'center' }}>
              {erro}
            </T>
          )}
        </View>
      </Folha>

      <Folha
        aberta={folha === 'apagar'}
        fechar={() => setFolha(null)}
        titulo={t.conta.apagarAConta}
        subtitulo={t.conta.apagarAviso}
      >
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 10, gap: 14 }}>
          <Botao
            nome={t.conta.apagarAConta}
            perigo
            onPress={() =>
              correr(
                () => conta.apagar(),
                () => router.replace('/cartao'),
              )
            }
          />
          {erro && (
            <T v="legenda" style={{ color: '#E07A72' }}>
              {erro}
            </T>
          )}
        </View>
      </Folha>
      <FolhaDaLingua
        aberta={folha === 'lingua'}
        fechar={() => setFolha(null)}
        aoEscolher={guardarLinguaNaConta}
      />
    </Ecra>
  );
}
