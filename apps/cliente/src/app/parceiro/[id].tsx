import {
  diaEmLisboa,
  inicioDoPeriodo,
  ligacaoDoInstagram,
  ligacaoDoTelefone,
} from '@nunos-lab/dominio';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Capa } from '../../componentes/capa';
import {
  CartaoDaPromocao,
  categoriaELocal,
  iconeDe,
  type BloqueioDaVantagem,
} from '../../componentes/cartoes';
import { HorarioDoParceiro } from '../../componentes/horario';
import { Logotipo } from '../../componentes/logotipo';
import { EscolherMapa } from '../../componentes/mapas';
import { useEu, useTemSessao } from '../../conta';
import { abrir, contar, definirTitulo, ligacaoParaPartilhar, useDados } from '../../dados';
import {
  Botao,
  BotaoRedondo,
  cor,
  Ecra,
  Esqueleto,
  EtiquetaExemplo,
  Grupo,
  Icone,
  MARGEM,
  raio,
  Rotulo,
  SemLigacao,
  T,
} from '@nunos-lab/ui';
import { useTextos } from '../../textos';

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
  const t = useTextos();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isError, isFetching, dataUpdatedAt, refetch } = useDados();
  const temSessao = useTemSessao();
  // Os pedidos de 15 em 15 s só com esta página à frente (por baixo, o Cartão pára de pedir).
  const aFrente = useIsFocused();
  const { data: euGuardado } = useEu(aFrente);
  // Depois de um 401 a sessão vai-se, mas a consulta ainda tem o «eu» da conta que saiu.
  const eu = temSessao ? euGuardado : undefined;
  // Sem corte no último ano as vantagens não valem: apagadas, com o cadeado (o Renato, 9 nov).
  const bloqueio: BloqueioDaVantagem =
    eu && !eu.activo ? (eu.cortes > 0 ? 'expirou' : 'nunca') : null;
  const margens = useSafeAreaInsets();
  const [aEscolherMapa, setAEscolherMapa] = useState(false);
  const parceiro = data?.parceiros.find((p) => String(p.id) === id);
  // A lista guardada no aparelho pode ser de antes deste parceiro (uma ligação
  // partilhada de um parceiro novo): só se diz que não está depois de a rede responder.
  const aEsperar = !data || (!parceiro && !dataUpdatedAt);

  useEffect(() => {
    if (parceiro) definirTitulo(t.titulos.parceiro(parceiro.nome));
  }, [parceiro, t]);
  useEffect(() => {
    if (id && /^\d+$/.test(id)) contar('parceiro', Number(id));
  }, [id]);

  if (aEsperar) {
    return (
      <Ecra comBarra={false}>
        <View style={{ paddingHorizontal: MARGEM }}>
          <BotaoSobreACapa icone="voltar" rotulo={t.parceiro.voltar} onPress={voltar} />
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
            {t.parceiro.jaNaoEsta}
          </T>
          <Botao nome={t.naoEncontrado.verAsVantagens} onPress={() => router.replace('/')} />
        </View>
      </Ecra>
    );
  }

  const p = parceiro;
  const icone = iconeDe(p, data.categorias);
  const partilhavel =
    Platform.OS !== 'web' ||
    (typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  const partilhar = () => {
    const url = ligacaoParaPartilhar(p.id);
    const r =
      Platform.OS === 'web'
        ? navigator.share({ title: p.nome, url })
        : Share.share(
            Platform.OS === 'ios' ? { title: p.nome, url } : { title: p.nome, message: url },
          );
    r.catch(() => {});
  };
  const accoes = [
    p.morada && {
      icone: 'mapa' as const,
      nome: t.mapa.ir,
      // A morada só aparece na folha que o «Ir» abre: o leitor de ecrã ouve-a já aqui.
      rotulo: `${t.mapa.irA(p.nome)}, ${p.morada}`,
      tipo: 'mapa' as const,
      // O «Ir» abre a folha para escolher o mapa: a contagem fica para quando se escolhe.
      url: '',
    },
    p.telefone && {
      icone: 'ligar' as const,
      nome: t.parceiro.ligar,
      rotulo: t.parceiro.ligarPara(p.nome),
      tipo: 'ligar' as const,
      url: ligacaoDoTelefone(p.telefone),
    },
    p.instagram && {
      icone: 'instagram' as const,
      nome: 'Instagram',
      rotulo: t.parceiro.instagramDe(p.nome),
      tipo: 'instagram' as const,
      url: ligacaoDoInstagram(p.instagram),
    },
    p.site && {
      icone: 'site' as const,
      nome: t.parceiro.site,
      rotulo: t.parceiro.siteDe(p.nome),
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
          <BotaoSobreACapa icone="voltar" rotulo={t.parceiro.voltar} onPress={voltar} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {p.exemplo && <EtiquetaExemplo sobreFoto />}
            {partilhavel && (
              <BotaoSobreACapa
                icone="partilhar"
                rotulo={t.parceiro.partilhar}
                onPress={partilhar}
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
                if (a.tipo === 'mapa') return setAEscolherMapa(true);
                contar(a.tipo, p.id);
                abrir(a.url);
              }}
            />
          ))}
        </View>
      )}

      {/* Bloqueadas não são «tuas»: o título diz só «Vantagem». */}
      <Rotulo>
        {p.promocoes.length === 1
          ? bloqueio
            ? t.parceiro.vantagem
            : t.parceiro.aTuaVantagem
          : bloqueio
            ? t.parceiro.vantagens
            : t.parceiro.asTuasVantagens}
      </Rotulo>
      {p.promocoes.map((pr) => {
        const vales = eu?.vales.filter((v) => v.promocaoId === pr.id) ?? [];
        const inicio = inicioDoPeriodo(pr.periodoDoLimite, data.hoje);
        return (
          <CartaoDaPromocao
            key={pr.id}
            promocao={pr}
            hoje={data.hoje}
            aoAbrir={() => contar('promocao', pr.id)}
            temCartao={temSessao}
            bloqueio={bloqueio}
            usadas={vales.filter((v) => diaEmLisboa(v.quando * 1000) >= inicio).length}
            usadaHoje={
              vales.find((v) => diaEmLisboa(v.quando * 1000) === data.hoje)?.quando ?? null
            }
          />
        );
      })}

      {/* A morada saiu daqui: o «Ir» lá em cima abre a folha com ela (o Renato, 9 nov). */}
      {!!p.horario && <HorarioDoParceiro texto={p.horario} semana={p.horarioSemana ?? null} />}

      <EscolherMapa
        destino={
          aEscolherMapa && p.morada
            ? { nome: p.nome, morada: p.morada, procurar: p.exemplo ? '' : p.nome }
            : null
        }
        fechar={() => setAEscolherMapa(false)}
        aoEscolher={() => contar('mapa', p.id)}
      />
    </Ecra>
  );
}
