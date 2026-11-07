import { dataCurta, diaEmLisboa, nomeDoMes } from '@nunos-lab/dominio';
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

/** O alvo de uma linha do registo, com o que a API guarda em português na entrada («Aparelho · ligação»). */
export function alvoDoRegisto(accao: string, alvo: string): string {
  if (accao !== 'entrou') return alvo;
  const t = textos().geral;
  return nomeDoAparelho(alvo, t.aparelho).replace(/ · ligação$/, ` · ${t.ligacao}`);
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
