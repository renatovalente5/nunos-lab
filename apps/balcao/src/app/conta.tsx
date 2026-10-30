import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  despejarFila,
  guardarCasa,
  guardarSessao,
  lerFila,
  pedir,
  useCasa,
  useEu,
} from '../sessao';
import { Ecra, Grupo, Icone, MARGEM, OpcaoDaFolha, Rotulo, T, cor } from '@nunos-lab/ui';

const PAPEL = { dono: 'Dono', barbeiro: 'Barbeiro', parceiro: 'Parceiro' } as const;

/** A casa em que este aparelho carimba, quem está a usar, e sair. */
export default function Conta() {
  const { data: eu } = useEu();
  const casa = useCasa(eu);
  const consultas = useQueryClient();
  const podeMudar =
    !!eu && eu.lojas.length > 1 && !(eu.pessoa.papel === 'barbeiro' && eu.pessoa.lojaId);
  const sair = async () => {
    try {
      // Os carimbos guardados sem rede vão antes; os que ficarem esperam que esta pessoa volte a entrar.
      if (lerFila().length) await despejarFila(eu?.pessoa.id);
      await pedir('/sair', { metodo: 'POST' });
    } catch {
      // Sem rede: a sessão sai daqui na mesma.
    } finally {
      // guardarSessao(null) volta ao início.
      guardarSessao(null);
      consultas.clear();
    }
  };
  return (
    <Ecra comBarra={false}>
      <View
        style={{ paddingHorizontal: MARGEM, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
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
          {eu?.pessoa.nome ?? 'Conta'}
        </T>
      </View>
      {eu && (
        <T
          v="legenda"
          style={{ color: cor.texto2, paddingHorizontal: MARGEM, marginTop: 6, marginLeft: 54 }}
        >
          {PAPEL[eu.pessoa.papel]}
          {eu.parceiro ? ` · ${eu.parceiro.nome}` : ''}
        </T>
      )}

      {eu && eu.pessoa.papel !== 'parceiro' && (
        <>
          <Rotulo>{podeMudar ? 'Casa onde estou a carimbar' : 'A minha casa'}</Rotulo>
          <Grupo>
            {eu.lojas
              .filter((l) => podeMudar || l.id === casa)
              .map((l, i) => (
                <OpcaoDaFolha
                  key={l.id}
                  nome={l.nome}
                  escolhida={l.id === casa}
                  separador={i > 0}
                  onPress={() => podeMudar && guardarCasa(l.id)}
                />
              ))}
          </Grupo>
        </>
      )}

      <Rotulo>Sessão</Rotulo>
      <Grupo>
        <Pressable
          onPress={sair}
          role="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 54,
            paddingHorizontal: 16,
            backgroundColor: pressed ? cor.superficieAlta : 'transparent',
          })}
        >
          <Icone nome="sair" tamanho={20} cor={cor.texto2} espessura={2} />
          <T v="forte">Sair deste aparelho</T>
        </Pressable>
      </Grupo>
    </Ecra>
  );
}
