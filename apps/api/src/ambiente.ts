import type { Context } from 'hono';

/** Quem está no backoffice neste pedido (posto pela guarda da sessão). */
export type AdminDaSessao = { id: number; nome: string; sessao: number };

export type Ambiente = { Bindings: Env; Variables: { admin: AdminDaSessao } };
export type C = Context<Ambiente>;
