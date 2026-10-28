import { eAniversarioValido, type FormaDeEntrar, type Loja } from '@nunos-lab/dominio';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  APPLE_CLIENTE,
  GOOGLE_CLIENTE,
  mensagemDe,
  moradaDeRetornoDaApple,
  useConta,
  useEu,
  useTemSessao,
} from '../conta';
import { definirTitulo, useDados } from '../dados';
import {
  Botao,
  BotaoDaApple,
  BotaoDoGoogle,
  Campo,
  Ecra,
  Folha,
  Grupo,
  Icone,
  MARGEM,
  OpcaoDaFolha,
  Rotulo,
  Separador,
  T,
  cor,
  type NomeDoIcone,
} from '@nunos-lab/ui';

const NOME_DA_FORMA: Record<FormaDeEntrar['tipo'], string> = {
  apple: 'Apple',
  google: 'Google',
  email: 'Email',
};

/** «DD/MM» ↔ «MM-DD». */
const paraEcra = (a: string | null) => (a ? `${a.slice(3)}/${a.slice(0, 2)}` : '');
const paraApi = (texto: string): string | null | false => {
  const t = texto.trim();
  if (!t) return null;
  const m = /^(\d{1,2})[/\-.](\d{1,2})$/.exec(t);
  if (!m) return false;
  const v = `${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return eAniversarioValido(v) ? v : false;
};

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

export default function Conta() {
  const temSessao = useTemSessao();
  const { data: eu } = useEu();
  const { data: dados } = useDados();
  const conta = useConta();
  const [aviso, setAviso] = useState<string | null>(null);
  const [folha, setFolha] = useState<
    'nome' | 'aniversario' | 'casa' | 'juntar' | 'perdi' | 'apagar' | null
  >(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => definirTitulo("Nuno's Lab · Conta"), []);
  useEffect(() => {
    if (!temSessao) router.replace('/cartao');
  }, [temSessao]);
  if (!eu) return <Ecra comBarra={false}>{null}</Ecra>;

  const lojas: Loja[] = dados?.barbearia.lojas ?? [];
  const casa = lojas.find((l) => l.id === eu.lojaId)?.nome ?? 'Todas';
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
  const semProva = !eu.provaRecente;
  const formasQueFaltam = (['apple', 'google'] as const).filter(
    (t) => !eu.formas.some((f) => f.tipo === t) && (t === 'apple' ? APPLE_CLIENTE : GOOGLE_CLIENTE),
  );

  return (
    <Ecra comBarra={false}>
      <View
        style={{ paddingHorizontal: MARGEM, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/cartao'))}
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
          Conta
        </T>
      </View>

      <Rotulo>Eu</Rotulo>
      <Grupo>
        <Linha
          icone="pessoa"
          nome="Nome"
          valor={eu.nome || '—'}
          onPress={() => abrir('nome', eu.nome)}
        />
        <Separador recuo={48} />
        <Linha
          icone="bolo"
          nome="Aniversário"
          valor={paraEcra(eu.aniversario) || '—'}
          onPress={() => abrir('aniversario', paraEcra(eu.aniversario))}
        />
        <Separador recuo={48} />
        <Linha icone="loja" nome="A minha casa" valor={casa} onPress={() => abrir('casa')} />
      </Grupo>

      <Rotulo>Formas de entrar</Rotulo>
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
                  aria-label={`Tirar ${NOME_DA_FORMA[f.tipo]}`}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <T v="legenda" style={{ color: cor.texto2 }}>
                    Tirar
                  </T>
                </Pressable>
              )}
            </View>
          </View>
        ))}
        {formasQueFaltam.length > 0 && (
          <>
            <Separador recuo={48} />
            <Linha icone="mais" nome="Juntar outra forma" onPress={() => abrir('juntar')} />
          </>
        )}
      </Grupo>

      <Rotulo>Sessões</Rotulo>
      <Grupo>
        <Linha
          icone="aparelho"
          nome={eu.sessoes.length === 1 ? 'Só este aparelho' : `${eu.sessoes.length} aparelhos`}
          valor={eu.sessoes.length > 1 ? 'Terminar as outras' : undefined}
          onPress={eu.sessoes.length > 1 ? () => correr(() => conta.sairDasOutras()) : undefined}
        />
        <Separador recuo={48} />
        <Linha icone="escudo" nome="Perdi o telemóvel" onPress={() => abrir('perdi')} />
        <Separador recuo={48} />
        <Linha
          icone="sair"
          nome="Sair"
          onPress={() =>
            correr(
              () => conta.sair(),
              () => router.replace('/cartao'),
            )
          }
        />
      </Grupo>

      <Rotulo>Mais</Rotulo>
      <Grupo>
        <Link href="/privacidade" asChild>
          <Pressable
            role="link"
            style={({ pressed }) => ({
              backgroundColor: pressed ? cor.superficieAlta : 'transparent',
            })}
          >
            <Linha icone="escudo" nome="Privacidade" />
          </Pressable>
        </Link>
        <Separador recuo={48} />
        <Linha icone="lixo" nome="Apagar a conta" perigo onPress={() => abrir('apagar')} />
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

      <Folha aberta={folha === 'nome'} fechar={() => setFolha(null)} titulo="O teu nome">
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 6, gap: 14 }}>
          <Campo
            value={texto}
            onChangeText={setTexto}
            autoFocus
            maxLength={40}
            placeholder="Nome próprio"
            autoCapitalize="words"
          />
          <Botao
            nome="Guardar"
            onPress={() =>
              correr(
                () => conta.perfil({ nome: texto.trim() }),
                () => setFolha(null),
              )
            }
          />
        </View>
      </Folha>

      <Folha aberta={folha === 'aniversario'} fechar={() => setFolha(null)} titulo="Aniversário">
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 6, gap: 14 }}>
          <Campo
            value={texto}
            onChangeText={setTexto}
            autoFocus
            placeholder="DD/MM"
            keyboardType="numbers-and-punctuation"
            erro={erro}
          />
          <Botao
            nome="Guardar"
            onPress={() => {
              const v = paraApi(texto);
              if (v === false) return setErro('Escreve o dia e o mês: 24/03.');
              correr(
                () => conta.perfil({ aniversario: v }),
                () => setFolha(null),
              );
            }}
          />
        </View>
      </Folha>

      <Folha aberta={folha === 'casa'} fechar={() => setFolha(null)} titulo="A minha casa">
        <OpcaoDaFolha
          nome="Todas as casas"
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
      </Folha>

      <Folha aberta={folha === 'juntar'} fechar={() => setFolha(null)} titulo="Juntar outra forma">
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 6, gap: 12, alignItems: 'center' }}>
          {semProva ? (
            <>
              <T v="corpo" style={{ color: cor.texto2, textAlign: 'center' }}>
                Entraste há mais de 15 minutos. Sai e entra outra vez para mudar as formas de
                entrar.
              </T>
              <Botao
                nome="Sair"
                secundario
                onPress={() =>
                  correr(
                    () => conta.sair(),
                    () => router.replace('/cartao'),
                  )
                }
              />
            </>
          ) : (
            <>
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
            </>
          )}
          {erro && (
            <T v="legenda" style={{ color: '#E07A72', textAlign: 'center' }}>
              {erro}
            </T>
          )}
        </View>
      </Folha>

      <Folha aberta={folha === 'perdi'} fechar={() => setFolha(null)} titulo="Perdi o telemóvel">
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 6, gap: 14 }}>
          <T v="corpo" style={{ color: cor.texto2 }}>
            As outras sessões terminam e o código do cartão muda. Os carimbos ficam.
          </T>
          <Botao
            nome="Terminar e mudar o código"
            onPress={() =>
              correr(
                () => conta.perdiOTelemovel(),
                () => {
                  setFolha(null);
                  setAviso('Feito: código novo.');
                },
              )
            }
          />
        </View>
      </Folha>

      <Folha aberta={folha === 'apagar'} fechar={() => setFolha(null)} titulo="Apagar a conta">
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 6, gap: 14 }}>
          <T v="corpo" style={{ color: cor.texto2 }}>
            {semProva
              ? 'Entraste há mais de 15 minutos. Sai e entra outra vez para apagar a conta.'
              : 'O cartão, os carimbos e as recompensas perdem-se. Não se desfaz.'}
          </T>
          {semProva ? (
            <Botao
              nome="Sair"
              secundario
              onPress={() =>
                correr(
                  () => conta.sair(),
                  () => router.replace('/cartao'),
                )
              }
            />
          ) : (
            <Botao
              nome="Apagar a conta"
              onPress={() =>
                correr(
                  () => conta.apagar(),
                  () => router.replace('/cartao'),
                )
              }
            />
          )}
          {erro && (
            <T v="legenda" style={{ color: '#E07A72' }}>
              {erro}
            </T>
          )}
        </View>
      </Folha>
    </Ecra>
  );
}
