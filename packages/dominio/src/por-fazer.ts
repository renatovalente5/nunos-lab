import { diasEntre } from './datas.ts';
import { DIAS_A_ACABAR } from './limites.ts';
import type { Parceiro, PessoaDaEquipaNoBackoffice, Promocao } from './tipos.ts';

/**
 * O que falta fazer no backoffice para a app estar inteira (o Renato, 9 nov 2026: «um parceiro foi
 * criado mas não tem pessoas a validarem…»). Os parceiros desligados (de propósito) e os de exemplo
 * não contam. Vem pela ordem em que importa: primeiro o que impede um cliente de usar uma vantagem.
 */
export type CoisaPorFazer =
  | { tipo: 'sem_quem_valide'; parceiroId: number; parceiro: string }
  | { tipo: 'nao_entrou'; parceiroId: number; parceiro: string; pessoa: string }
  | { tipo: 'fora_da_app'; parceiroId: number; parceiro: string }
  | {
      tipo: 'a_acabar';
      promocaoId: number;
      parceiro: string;
      promocao: string;
      fim: string;
      dias: number;
    }
  | { tipo: 'parceiro_incompleto'; parceiroId: number; parceiro: string; falta: FaltaNoParceiro[] };

/** As barbearias não entram: o telefone ou a marcação em falta não precisam de aviso (o Renato, 9 nov). */
export type FaltaNoParceiro = 'morada' | 'logotipo';

/**
 * Um parceiro em que todas as vantagens têm código (o Renato, 11 nov 2026: a Seek Cosmetics, uma loja
 * online): o código usa-se ao pagar, ninguém lê o cartão, e não é preciso quem valide nem morada.
 * Contam as vantagens na app e as agendadas; sem nenhuma, ainda não se sabe como vai ser.
 */
export function soComCodigo(promocoes: Pick<Promocao, 'estado' | 'cupao'>[]): boolean {
  const vivas = promocoes.filter((p) => p.estado === 'activa' || p.estado === 'agendada');
  return vivas.length > 0 && vivas.every((p) => p.cupao.trim() !== '');
}

export function oQueFaltaFazer(d: {
  parceiros: Parceiro[];
  equipa: PessoaDaEquipaNoBackoffice[];
  promocoes: Promocao[];
  hoje: string;
}): CoisaPorFazer[] {
  const parceiros = d.parceiros.filter((p) => p.activo && !p.exemplo);
  const lista: CoisaPorFazer[] = [];
  const validam = (id: number) =>
    d.equipa.filter((e) => e.papel === 'parceiro' && e.parceiroId === id && e.activo);
  // Só com código, ninguém precisa de ler o cartão: nem quem valide, nem quem entre na app for partners.
  const codigo = new Set(
    parceiros
      .filter((p) => soComCodigo(d.promocoes.filter((pr) => pr.parceiroId === p.id)))
      .map((p) => p.id),
  );
  const leemOCartao = parceiros.filter((p) => !codigo.has(p.id));
  for (const p of leemOCartao)
    if (!validam(p.id).length)
      lista.push({ tipo: 'sem_quem_valide', parceiroId: p.id, parceiro: p.nome });
  // Sem sessão aberta em aparelho nenhum, não valida: nunca entrou, ou saiu.
  for (const p of leemOCartao)
    for (const e of validam(p.id))
      if (!e.sessoes.length)
        lista.push({ tipo: 'nao_entrou', parceiroId: p.id, parceiro: p.nome, pessoa: e.nome });
  for (const p of parceiros)
    if (p.promocoesNaApp === 0)
      lista.push({ tipo: 'fora_da_app', parceiroId: p.id, parceiro: p.nome });
  const deles = new Set(parceiros.map((p) => p.id));
  lista.push(
    ...d.promocoes
      .filter((pr) => deles.has(pr.parceiroId) && pr.estado === 'activa' && pr.fim)
      .map((pr) => ({ pr, dias: diasEntre(d.hoje, pr.fim!) }))
      .filter(({ dias }) => dias >= 0 && dias <= DIAS_A_ACABAR)
      .sort((a, b) => a.dias - b.dias)
      .map(({ pr, dias }) => ({
        tipo: 'a_acabar' as const,
        promocaoId: pr.id,
        parceiro: pr.parceiro,
        promocao: `${pr.destaque} ${pr.titulo}`.trim(),
        fim: pr.fim!,
        dias,
      })),
  );
  for (const p of parceiros) {
    const falta: FaltaNoParceiro[] = [];
    // Uma loja só online não tem morada para pôr.
    if (!p.morada.trim() && !codigo.has(p.id)) falta.push('morada');
    if (!p.logotipo) falta.push('logotipo');
    if (falta.length)
      lista.push({ tipo: 'parceiro_incompleto', parceiroId: p.id, parceiro: p.nome, falta });
  }
  return lista;
}
