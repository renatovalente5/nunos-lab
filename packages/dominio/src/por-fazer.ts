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
  | { tipo: 'a_acabar'; promocaoId: number; parceiro: string; promocao: string; fim: string; dias: number }
  | { tipo: 'parceiro_incompleto'; parceiroId: number; parceiro: string; falta: FaltaNoParceiro[] };

/** As barbearias não entram: o telefone ou a marcação em falta não precisam de aviso (o Renato, 9 nov). */
export type FaltaNoParceiro = 'morada' | 'logotipo';

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
  for (const p of parceiros)
    if (!validam(p.id).length)
      lista.push({ tipo: 'sem_quem_valide', parceiroId: p.id, parceiro: p.nome });
  // Sem sessão aberta em aparelho nenhum, não valida: nunca entrou, ou saiu.
  for (const p of parceiros)
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
    if (!p.morada.trim()) falta.push('morada');
    if (!p.logotipo) falta.push('logotipo');
    if (falta.length)
      lista.push({ tipo: 'parceiro_incompleto', parceiroId: p.id, parceiro: p.nome, falta });
  }
  return lista;
}
