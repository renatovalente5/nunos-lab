import { LINGUAS, NOME_DA_LINGUA, type Lingua } from '@nunos-lab/dominio';
import { Pressable } from 'react-native';
import { CartaoDaFolha, Folha, OpcaoDaFolha } from './folha';
import { Icone } from './icone';
import { escolherLingua, useLingua } from './lingua';
import { cor } from './tema';
import { T } from './texto';
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

/** O botão da língua num cabeçalho: o globo e a língua de agora («PT», «EN»). Abre a folha. */
export function BotaoDaLingua({ onPress }: { onPress: () => void }) {
  const t = useTextosDaUi();
  const lingua = useLingua();
  return (
    <Pressable
      onPress={onPress}
      role="button"
      aria-label={`${t.lingua}: ${NOME_DA_LINGUA[lingua]}`}
      hitSlop={6}
      style={({ pressed }) => ({
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        borderRadius: 18,
        backgroundColor: pressed ? cor.linha : cor.superficieAlta,
      })}
    >
      <Icone nome="site" tamanho={16} cor={cor.texto2} espessura={2} />
      <T v="forte" maxFontSizeMultiplier={1.2} style={{ fontSize: 13, letterSpacing: 0.4 }}>
        {lingua.toUpperCase()}
      </T>
    </Pressable>
  );
}
