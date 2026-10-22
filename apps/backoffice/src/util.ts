import { useEffect, useState } from 'react';

/** «agora», «há 5 min», «há 3 h», «ontem», «há 4 dias», «12 out». */
export function haQuanto(segundos: number, agora = Date.now() / 1000): string {
  const d = Math.max(0, agora - segundos);
  if (d < 60) return 'agora';
  if (d < 3600) return `há ${Math.floor(d / 60)} min`;
  if (d < 86_400) return `há ${Math.floor(d / 3600)} h`;
  if (d < 2 * 86_400) return 'ontem';
  if (d < 7 * 86_400) return `há ${Math.floor(d / 86_400)} dias`;
  return new Date(segundos * 1000)
    .toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
    .replace('.', '');
}

export function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString('pt-PT')} ${n === 1 ? um : varios}`;
}

/** O que cada linha do registo quer dizer, em português corrido. */
export const ACCOES: Record<string, string> = {
  entrou: 'entrou no backoffice',
  'acesso.criado': 'criou uma ligação de acesso para',
  'sessao.terminada': 'terminou a sessão de',
  'pessoa.removida': 'tirou o acesso a',
  'pessoa.criada': 'deu acesso a',
  'pessoa.email': 'mudou o email de',
  'parceiro.criado': 'criou o parceiro',
  'parceiro.alterado': 'alterou o parceiro',
  'parceiro.activado': 'pôs na app o parceiro',
  'parceiro.pausado': 'pausou o parceiro',
  'parceiro.apagado': 'apagou o parceiro',
  'parceiros.ordenados': 'mudou a ordem dos parceiros',
  'promocao.criada': 'criou a promoção',
  'promocao.alterada': 'alterou a promoção',
  'promocao.activada': 'ligou a promoção',
  'promocao.pausada': 'pausou a promoção',
  'promocao.destaque': 'mudou o destaque de',
  'promocao.apagada': 'apagou a promoção',
  'categoria.criada': 'criou a categoria',
  'categoria.alterada': 'alterou a categoria',
  'categoria.apagada': 'apagou a categoria',
  'barbearia.alterada': 'alterou a barbearia',
  'exemplos.apagados': 'apagou os parceiros de exemplo',
};

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

/** Avisa antes de fechar a página com alterações por gravar. */
export function useAvisoAoSair(sujo: boolean) {
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [sujo]);
}
