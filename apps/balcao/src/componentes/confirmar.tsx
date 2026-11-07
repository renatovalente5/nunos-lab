import { useCallback, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Botao, Folha, MARGEM } from '@nunos-lab/ui';
import { useTextos } from '../textos';

type Pergunta = {
  titulo: string;
  detalhe?: string;
  /** O nome do botão que faz («Anular», «Sair»). */
  accao: string;
};

/**
 * Uma pergunta antes de um acto com custo («Anular o carimbo…?», «Sair deste
 * aparelho?»): a mesma folha que a app usa para escolher, com o «Deixar» e o
 * botão que faz. O Alert do React Native não existe na web; a folha sobe nas duas.
 */
export function useConfirmacao(): [(p: Pergunta) => Promise<boolean>, ReactNode] {
  const t = useTextos();
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const responder = useRef<(sim: boolean) => void>(() => {});
  const perguntar = useCallback(
    (p: Pergunta) =>
      new Promise<boolean>((r) => {
        responder.current = r;
        setPergunta(p);
      }),
    [],
  );
  const fechar = (sim: boolean) => {
    setPergunta(null);
    responder.current(sim);
  };
  const folha = (
    <Folha
      aberta={!!pergunta}
      fechar={() => fechar(false)}
      titulo={pergunta?.titulo ?? ''}
      subtitulo={pergunta?.detalhe}
    >
      <View style={{ paddingHorizontal: MARGEM, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Botao nome={t.confirmar.deixar} secundario largo onPress={() => fechar(false)} />
          <Botao nome={pergunta?.accao ?? ''} largo onPress={() => fechar(true)} />
        </View>
      </View>
    </Folha>
  );
  return [perguntar, folha];
}
