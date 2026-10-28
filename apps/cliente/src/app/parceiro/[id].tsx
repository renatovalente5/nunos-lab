import {
  diaEmLisboa,
  ligacaoDoInstagram,
  ligacaoDoMapa,
  ligacaoDoTelefone,
  semPartir,
} from '@nunos-lab/dominio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Capa } from '../../componentes/capa';
import { CartaoDaPromocao, categoriaELocal, iconeDe } from '../../componentes/cartoes';
import { Logotipo } from '../../componentes/logotipo';
import { useEu, useTemSessao } from '../../conta';
import { abrir, contar, definirTitulo, ligacaoParaPartilhar, useDados } from '../../dados';
import {
  Botao,
  BotaoRedondo,
  Ecra,
  Esqueleto,
  EtiquetaExemplo,
  Grupo,
  Icone,
  MARGEM,
  Rotulo,
  SemLigacao,
  Separador,
  T,
  cor,
  raio,
} from '@nunos-lab/ui';

function voltar() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function BotaoSobreACapa({
  icone,
  rotulo,
  onPress,
}: {
  icone: 'voltar' | 'partilhar';
  rotulo: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label={rotulo}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? 'rgba(10,10,10,0.7)' : cor.veu,
      })}
    >
      <Icone nome={icone} tamanho={21} cor="#FFFFFF" espessura={2.2} />
    </Pressable>
  );
}

export default function PaginaDoParceiro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isError, isFetching, dataUpdatedAt, refetch } = useDados();
  const temSessao = useTemSessao();
  const { data: eu } = useEu(true);
  const margens = useSafeAreaInsets();
  const parceiro = data?.parceiros.find((p) => String(p.id) === id);
  // A lista guardada no aparelho pode ser de antes deste parceiro (uma ligação
  // partilhada de um parceiro novo): só se diz que não está depois de a rede responder.
  const aEsperar = !data || (!parceiro && !dataUpdatedAt);

  useEffect(() => {
    if (parceiro) definirTitulo(`${parceiro.nome} · Nuno's Lab`);
  }, [parceiro]);
  useEffect(() => {
    if (id && /^\d+$/.test(id)) contar('parceiro', Number(id));
  }, [id]);

  if (aEsperar) {
    return (
      <Ecra comBarra={false}>
        <View style={{ paddingHorizontal: MARGEM }}>
          <BotaoSobreACapa icone="voltar" rotulo="Voltar" onPress={voltar} />
        </View>
        {isError && !isFetching ? <SemLigacao tentar={() => refetch()} /> : <Esqueleto />}
      </Ecra>
    );
  }

  if (!parceiro) {
    return (
      <Ecra comBarra={false}>
        <View style={{ paddingHorizontal: MARGEM, paddingTop: 80, alignItems: 'center', gap: 16 }}>
          <Icone nome="etiqueta" tamanho={34} cor={cor.texto3} />
          <T v="subtitulo" style={{ textAlign: 'center' }}>
            Esta vantagem já não está na app
          </T>
          <Botao nome="Ver as vantagens" onPress={() => router.replace('/')} />
        </View>
      </Ecra>
    );
  }

  const p = parceiro;
  const icone = iconeDe(p, data.categorias);
  const partilhavel =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function';
  const accoes = [
    p.morada && {
      icone: 'mapa' as const,
      nome: 'Ir',
      rotulo: `Ir a ${p.nome}`,
      tipo: 'mapa' as const,
      url: ligacaoDoMapa(p.morada, p.exemplo ? '' : p.nome),
    },
    p.telefone && {
      icone: 'ligar' as const,
      nome: 'Ligar',
      rotulo: `Ligar para ${p.nome}`,
      tipo: 'ligar' as const,
      url: ligacaoDoTelefone(p.telefone),
    },
    p.instagram && {
      icone: 'instagram' as const,
      nome: 'Instagram',
      rotulo: `Instagram de ${p.nome}`,
      tipo: 'instagram' as const,
      url: ligacaoDoInstagram(p.instagram),
    },
    p.site && {
      icone: 'site' as const,
      nome: 'Site',
      rotulo: `Site de ${p.nome}`,
      tipo: 'site' as const,
      url: p.site,
    },
  ].filter((a) => !!a);

  return (
    <Ecra comBarra={false} semTopo>
      <Capa parceiro={p} icone={icone} altura={300 + margens.top} raioBaixo={raio.cartao}>
        <View
          style={{
            position: 'absolute',
            top: margens.top + 12,
            left: MARGEM,
            right: MARGEM,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <BotaoSobreACapa icone="voltar" rotulo="Voltar" onPress={voltar} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {p.exemplo && <EtiquetaExemplo sobreFoto />}
            {partilhavel && (
              <BotaoSobreACapa
                icone="partilhar"
                rotulo="Partilhar"
                onPress={() =>
                  navigator
                    .share({ title: p.nome, url: ligacaoParaPartilhar(p.id) })
                    .catch(() => {})
                }
              />
            )}
          </View>
        </View>
      </Capa>

      <View style={{ paddingHorizontal: MARGEM, marginTop: -42 }}>
        <Logotipo parceiro={p} tamanho={84} anel />
        <T v="titulo" style={{ marginTop: 14 }} role="heading" aria-level={1}>
          {p.nome}
        </T>
        <T v="legenda" style={{ color: cor.texto2, marginTop: 4, fontSize: 14 }}>
          {categoriaELocal(p, data.categorias)}
        </T>
        {!!p.descricao && (
          <T v="corpo" style={{ color: cor.texto2, marginTop: 10, fontSize: 16, lineHeight: 23 }}>
            {p.descricao}
          </T>
        )}
      </View>

      {accoes.length > 0 && (
        <View style={{ flexDirection: 'row', paddingHorizontal: MARGEM - 10, marginTop: 22 }}>
          {accoes.map((a) => (
            <BotaoRedondo
              key={a.tipo}
              icone={a.icone}
              nome={a.nome}
              rotulo={a.rotulo}
              onPress={() => {
                contar(a.tipo, p.id);
                abrir(a.url);
              }}
            />
          ))}
        </View>
      )}

      <Rotulo>{p.promocoes.length === 1 ? 'A tua vantagem' : 'As tuas vantagens'}</Rotulo>
      {p.promocoes.map((pr) => (
        <CartaoDaPromocao
          key={pr.id}
          promocao={pr}
          hoje={data.hoje}
          aoAbrir={() => contar('promocao', pr.id)}
          temCartao={temSessao}
          usadaHoje={
            eu?.vales.find(
              (v) => v.promocaoId === pr.id && diaEmLisboa(v.quando * 1000) === data.hoje,
            )?.quando ?? null
          }
        />
      ))}

      {(!!p.horario || !!p.morada) && (
        <Grupo style={{ marginTop: 20 }}>
          {!!p.horario && (
            <View style={{ flexDirection: 'row', gap: 14, padding: 16, alignItems: 'flex-start' }}>
              <Icone nome="relogio" tamanho={20} cor={cor.texto2} />
              <T v="corpo" style={{ flex: 1 }}>
                {semPartir(p.horario)}
              </T>
            </View>
          )}
          {!!p.horario && !!p.morada && <Separador recuo={50} />}
          {!!p.morada && (
            <Pressable
              onPress={() => {
                contar('mapa', p.id);
                abrir(ligacaoDoMapa(p.morada, p.exemplo ? '' : p.nome));
              }}
              role="link"
              aria-label={`Morada: ${p.morada}. Abrir no mapa.`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: 14,
                padding: 16,
                alignItems: 'center',
                backgroundColor: pressed ? cor.superficieAlta : 'transparent',
              })}
            >
              <Icone nome="mapa" tamanho={20} cor={cor.texto2} />
              <T v="corpo" style={{ flex: 1 }}>
                {semPartir(p.morada)}
              </T>
              <Icone nome="seguinte" tamanho={18} cor={cor.texto3} />
            </Pressable>
          )}
        </Grupo>
      )}
    </Ecra>
  );
}
