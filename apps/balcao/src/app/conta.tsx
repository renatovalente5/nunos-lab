import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useConfirmacao } from '../componentes/confirmar';
import {
  despejarFila,
  guardarCasa,
  guardarSessao,
  lerFila,
  pedir,
  useCasa,
  useEu,
} from '../sessao';
import { NOME_DA_LINGUA } from '@nunos-lab/dominio';
import {
  Ecra,
  FolhaDaLingua,
  Grupo,
  Icone,
  MARGEM,
  OpcaoDaFolha,
  Rotulo,
  T,
  cor,
  useLingua,
  useTextosDaUi,
} from '@nunos-lab/ui';
import { useTextos } from '../textos';

/** A barbearia em que este aparelho carimba, a linguagem, quem está a usar, e sair. */
export default function Conta() {
  const t = useTextos();
  const ui = useTextosDaUi();
  const lingua = useLingua();
  const { data: eu } = useEu();
  const casa = useCasa(eu);
  const consultas = useQueryClient();
  const podeMudar =
    !!eu && eu.lojas.length > 1 && !(eu.pessoa.papel === 'barbeiro' && eu.pessoa.lojaId);
  const [confirmar, folhaDeConfirmacao] = useConfirmacao();
  const [aEscolherLingua, setAEscolherLingua] = useState(false);
  const sair = async () => {
    // Sair ao primeiro toque custava: quem entra por ligação precisa de outra, e os carimbos
    // guardados sem rede ficam presos até esta pessoa voltar a entrar aqui.
    const porEnviar = lerFila().filter(
      (p) => p.pessoaId === undefined || p.pessoaId === eu?.pessoa.id,
    ).length;
    const sim = await confirmar({
      titulo: t.conta.sairPergunta,
      detalhe: porEnviar ? t.conta.porEnviar(porEnviar) : undefined,
      accao: t.conta.sair,
    });
    if (!sim) return;
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
          aria-label={t.geral.voltar}
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
          {eu?.pessoa.nome ?? t.geral.conta}
        </T>
      </View>
      {eu && (
        <T
          v="legenda"
          style={{ color: cor.texto2, paddingHorizontal: MARGEM, marginTop: 6, marginLeft: 54 }}
        >
          {t.conta.papel[eu.pessoa.papel]}
          {eu.parceiro ? ` · ${eu.parceiro.nome}` : ''}
        </T>
      )}

      {eu && eu.pessoa.papel !== 'parceiro' && (
        <>
          <Rotulo>{podeMudar ? t.conta.casaOndeCarimbo : t.conta.aMinhaCasa}</Rotulo>
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

      {/* A linguagem numa linha que abre a folha, como na app do cliente, em «Definições» (o Renato, 9 nov). */}
      <Rotulo>{t.conta.definicoes}</Rotulo>
      <Grupo>
        <Pressable
          onPress={() => setAEscolherLingua(true)}
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
          <Icone nome="site" tamanho={20} cor={cor.texto2} espessura={2} />
          <T v="forte" style={{ flex: 1 }}>
            {ui.lingua}
          </T>
          <T v="legenda" style={{ color: cor.texto2 }}>
            {NOME_DA_LINGUA[lingua]}
          </T>
          <Icone nome="seguinte" tamanho={16} cor={cor.texto3} espessura={2.2} />
        </Pressable>
      </Grupo>

      <Rotulo>{t.conta.sessao}</Rotulo>
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
          <T v="forte">{t.conta.sairDesteAparelho}</T>
        </Pressable>
      </Grupo>
      <FolhaDaLingua aberta={aEscolherLingua} fechar={() => setAEscolherLingua(false)} />
      {folhaDeConfirmacao}
    </Ecra>
  );
}
