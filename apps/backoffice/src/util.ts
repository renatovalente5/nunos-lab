import {
  dataCurta,
  diaEmLisboa,
  euros as eurosDoSaldo,
  eurosComSinal,
  nomeDoMes,
  recompensaEmIngles,
} from '@nunos-lab/dominio';
import { useEffect, useState } from 'react';
import { etiquetaDaLingua, linguaActual } from './lingua';
import { textos } from './textos';

/** «agora», «há 5 min», «há 3 h», «ontem», «há 4 dias», «12 out» (na língua de agora). */
export function haQuanto(segundos: number, agora = Date.now() / 1000): string {
  const t = textos().geral.quando;
  const d = Math.max(0, agora - segundos);
  if (d < 60) return t.agora;
  if (d < 3600) return t.haMinutos(Math.floor(d / 60));
  if (d < 86_400) return t.haHoras(Math.floor(d / 3600));
  if (d < 2 * 86_400) return t.ontem;
  if (d < 7 * 86_400) return t.haDias(Math.floor(d / 86_400));
  // O Chrome escreve «12/10» com o mês curto em pt-PT: a data vem do domínio, como na app.
  return dataCurta(diaEmLisboa(segundos * 1000), diaEmLisboa(agora * 1000), linguaActual());
}

/** Um número como se escreve na língua de agora («1234» em português, «1,234» em inglês). */
export function numero(n: number): string {
  return n.toLocaleString(etiquetaDaLingua());
}

export function plural(n: number, um: string, varios: string): string {
  return `${numero(n)} ${n === 1 ? um : varios}`;
}

/** O que uma linha do registo quer dizer («criou o parceiro»), na língua de agora. */
export function accao(chave: string): string | undefined {
  const accoes = textos().geral.accoes;
  return Object.prototype.hasOwnProperty.call(accoes, chave) ? accoes[chave] : undefined;
}

/**
 * O aparelho de uma sessão como a API o guarda («iPhone · Safari»; «Aparelho · Chrome» quando não
 * conhece o sistema), com a palavra «Aparelho» na língua de agora.
 */
export function nomeDoAparelho(aparelho: string, palavra: string): string {
  return aparelho ? aparelho.replace(/^Aparelho(?= ·|$)/, palavra) : palavra;
}

/**
 * Os euros que a API escreve no registo, em português («1 €», «+2,50 €», «−3 €»), na língua de agora
 * («€1», «+€2.50»). Com o `euros` do domínio, o do saldo: o `euros` deste ficheiro escreve «1,00 €».
 */
function eurosNaLingua(texto: string): string {
  const m = /^([+−]?)(\d+)(?:,(\d{2}))? €$/.exec(texto);
  if (!m) return texto;
  const centimos = (m[1] === '−' ? -1 : 1) * (Number(m[2]) * 100 + Number(m[3] ?? 0));
  return m[1] === '+'
    ? eurosComSinal(centimos, linguaActual())
    : eurosDoSaldo(centimos, linguaActual());
}

/**
 * O alvo de uma linha do registo. A API guarda-o em português («Aparelho · ligação», «3 cartões em curso»,
 * «nome, aniversário»); as partes que são da app (não do Nuno) dizem-se aqui na língua de agora.
 */
export function alvoDoRegisto(accao: string, alvo: string): string {
  const t = textos();
  const g = t.geral;
  if (accao === 'entrou')
    return nomeDoAparelho(alvo, g.aparelho).replace(/ · ligação$/, ` · ${g.ligacao}`);
  if (accao === 'convites.alterados') {
    // «ligados · 1 € / 1 € · 10» (10 nov 2026): o «10» sozinho não se percebe, diz-se «10 por cliente».
    const m = /^(ligados|desligados) · (.+?) \/ (.+?) · (\d+|sem limite)$/.exec(alvo);
    if (!m) return alvo;
    const [, estado, padrinho, convidado, limite] = m;
    const c = g.convitesNoRegisto;
    return [
      estado === 'ligados' ? c.ligados : c.desligados,
      `${eurosNaLingua(padrinho!)} / ${eurosNaLingua(convidado!)}`,
      limite === 'sem limite' ? c.semLimite : c.porCliente(Number(limite)),
    ].join(' · ');
  }
  if (accao === 'carimbo.anulado')
    return alvo.replace(/(\d{4}-\d{2}-\d{2})$/, (dia) =>
      dataCurta(dia, diaEmLisboa(), linguaActual()),
    );
  if (accao === 'cliente.alterado') {
    // Os campos dizem-se também em português: o registo guardava «casa», que passou a «barbearia».
    const i = alvo.lastIndexOf(' · ');
    if (i < 0) return alvo;
    const campos = g.camposDoCliente as Record<string, string>;
    const mudou = alvo.slice(i + 3).split(', ');
    return `${alvo.slice(0, i)} · ${mudou.map((c) => campos[c] ?? c).join(', ')}`;
  }
  if (linguaActual() === 'pt') return alvo;
  switch (accao) {
    case 'sessao.terminada':
      return alvo.replace(/ · Aparelho(?= ·|$)/, ` · ${g.aparelho}`);
    case 'pessoa.email':
      return alvo.replace(/ · sem email$/, ` · ${g.semEmail}`);
    case 'equipa.criada':
      return alvo.replace(
        / · (dono|barbeiro|parceiro)$/,
        (_, papel: keyof typeof t.equipa.papeis) => ` · ${t.equipa.papeis[papel]}`,
      );
    case 'saldo.acertado':
      // «Pedro Santos · +2 € · nota» (10 nov 2026): só o valor é da app; o nome e a nota ficam.
      return alvo.replace(
        / · ([+−]\d+(?:,\d{2})? €)(?= · |$)/,
        (_, valor: string) => ` · ${eurosNaLingua(valor)}`,
      );
    case 'programa.alterado': {
      // «10 → 50% de desconto · 5 → 20% num produto · 3 cartões em curso» (o prémio a meio desde 10 nov).
      const m = /^(\d+) → (.*?)(?: · (\d+) → (.*?))?(?: · (\d+) cart(?:ão|ões) em curso)?$/.exec(
        alvo,
      );
      if (!m) return alvo;
      const [, objectivo, recompensa, meio, meioRecompensa, emCurso] = m;
      return `${objectivo} → ${recompensaEmIngles(recompensa ?? '')}${
        meio === undefined ? '' : ` · ${meio} → ${recompensaEmIngles(meioRecompensa ?? '')}`
      }${emCurso === undefined ? '' : ` · ${g.cartoesEmCurso(Number(emCurso))}`}`;
    }
  }
  return alvo;
}

/** Cêntimos em euros, como se lê: «15,00 €». */
export function euros(centimos: number): string {
  return (centimos / 100).toLocaleString(etiquetaDaLingua(), {
    style: 'currency',
    currency: 'EUR',
  });
}

/** Uma fracção em percentagem inteira: 0,623 → «62 %» (em inglês, «62%»). */
export function percentagem(fraccao: number): string {
  return `${Math.round(fraccao * 100)}${linguaActual() === 'en' ? '' : ' '}%`;
}

/** «AAAA-MM» → «out 2026», «Oct 2026». */
export function mesPorExtenso(mes: string): string {
  const [ano, m] = mes.split('-');
  return `${nomeDoMes(Number(m) - 1, linguaActual()) ?? m} ${ano}`;
}

/** O endereço da página: «#/parceiros/3» → ['parceiros', '3']. */
export function useRota(): string[] {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const mudou = () => setHash(location.hash);
    window.addEventListener('hashchange', mudou);
    return () => window.removeEventListener('hashchange', mudou);
  }, []);
  return hash.replace(/^#\/?/, '').split('?')[0]!.split('/').filter(Boolean);
}

export function parametro(nome: string): string | null {
  return new URLSearchParams(location.hash.split('?')[1] ?? '').get(nome);
}

export function ir(caminho: string) {
  location.hash = `#/${caminho}`;
}

/**
 * Avisa antes de sair com alterações por gravar: ao fechar a página, e ao ir
 * para outra página do backoffice (o menu, «‹ Parceiros»).
 */
export function useAvisoAoSair(sujo: boolean) {
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const ligacao = (e.target as Element | null)?.closest?.('a[href^="#/"]');
      if (ligacao && !window.confirm(textos().geral.sairSemGuardar)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', aviso);
    document.addEventListener('click', clique, true);
    return () => {
      window.removeEventListener('beforeunload', aviso);
      document.removeEventListener('click', clique, true);
    };
  }, [sujo]);
}
