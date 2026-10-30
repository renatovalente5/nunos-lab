import type { Context } from 'hono';
import type { PapelDaEquipa } from '@nunos-lab/dominio';

/** Quem está no backoffice neste pedido (posto pela guarda da sessão). */
export type AdminDaSessao = { id: number; nome: string; sessao: number };

/** O cliente da app neste pedido (/api/eu). */
export type ClienteDaSessao = {
  id: number;
  sessao: number;
  /** Quando a sessão abriu: é a «prova recente» para mexer na conta. */
  criadaEm: number;
  identidadeId: number | null;
  /** A sessão de demonstração (a porta da revisão das lojas): não mexe na conta. */
  demo: boolean;
};

/** A pessoa da equipa neste pedido (/api/balcao). */
export type PessoaDaSessao = {
  id: number;
  nome: string;
  papel: PapelDaEquipa;
  lojaId: number | null;
  parceiroId: number | null;
  sessao: number;
  /** A pessoa de demonstração (a porta da revisão das lojas): só vê clientes de exemplo. */
  demo: boolean;
};

export type Ambiente = {
  Bindings: Env;
  Variables: { admin: AdminDaSessao; cliente: ClienteDaSessao; pessoa: PessoaDaSessao };
};
export type C = Context<Ambiente>;
