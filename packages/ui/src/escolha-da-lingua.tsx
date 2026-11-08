import { LINGUAS, NOME_DA_LINGUA, type Lingua } from '@nunos-lab/dominio';
import { CartaoDaFolha, Folha, OpcaoDaFolha } from './folha';
import { escolherLingua, useLingua } from './lingua';
import { useTextosDaUi } from './textos';

/**
 * A escolha da língua: uma folha com «Português» e «English», cada uma dita na própria língua
 * (como no iPhone). `aoEscolher` deixa a app guardá-la também na conta.
 */
export function FolhaDaLingua({
  aberta,
  fechar,
  aoEscolher,
}: {
  aberta: boolean;
  fechar: () => void;
  aoEscolher?: (lingua: Lingua) => void;
}) {
  const t = useTextosDaUi();
  const lingua = useLingua();
  return (
    <Folha aberta={aberta} fechar={fechar} titulo={t.lingua}>
      <CartaoDaFolha role="radiogroup" aria-label={t.lingua}>
        {LINGUAS.map((l, i) => (
          <OpcaoDaFolha
            key={l}
            nome={NOME_DA_LINGUA[l]}
            escolhida={l === lingua}
            separador={i > 0}
            onPress={() => {
              escolherLingua(l);
              aoEscolher?.(l);
              fechar();
            }}
          />
        ))}
      </CartaoDaFolha>
    </Folha>
  );
}
