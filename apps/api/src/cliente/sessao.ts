import type { MiddlewareHandler } from 'hono';
import { DIAS_DA_SESSAO_DO_CLIENTE, DIAS_MAXIMOS_DA_SESSAO } from '@nunos-lab/dominio';
import type { Ambiente, C } from '../ambiente.ts';
import { DIA, agora, aleatorio, aparelhoDoPedido, blob, recusar, sha256 } from '../util.ts';

/** A guarda das rotas /api/eu: o testemunho da app, no cabeçalho, de uma conta que existe. */
export const exigirCliente: MiddlewareHandler<Ambiente> = async (c, next) => {
  const cabecalho = c.req.header('Authorization') ?? '';
  const testemunho = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(testemunho)) recusar(401, 'sessao');
  const linha = await c.env.DB.prepare(
    `SELECT s.id, s.cliente_id, s.vista_em, s.criada_em, s.identidade_id, s.aparelho, k.codigo
     FROM sessoes_de_cliente s JOIN clientes k ON k.id = s.cliente_id
     WHERE s.resumo = ? AND s.revogada_em IS NULL AND s.expira_em > unixepoch()
       AND s.criada_em > unixepoch() - ? AND k.apagado_em IS NULL`,
  )
    // O tecto: um ano desde que abriu, por mais que se use.
    .bind(blob(await sha256(testemunho)), DIAS_MAXIMOS_DA_SESSAO * DIA)
    .first<{
      id: number;
      cliente_id: number;
      vista_em: number;
      criada_em: number;
      identidade_id: number | null;
      aparelho: string;
      codigo: string;
    }>();
  if (!linha) recusar(401, 'sessao');
  // A app nativa diz o nome do aparelho: as sessões antigas, que ficaram «Aparelho», ganham-no já.
  const aparelho = c.req.header('X-Aparelho') ? aparelhoDoPedido(c) : linha.aparelho;
  if (linha.vista_em < agora() - 3600 || aparelho !== linha.aparelho) {
    const db = c.env.DB;
    c.executionCtx.waitUntil(
      db.batch([
        db
          .prepare(
            'UPDATE sessoes_de_cliente SET vista_em = unixepoch(), expira_em = unixepoch() + ?, aparelho = ? WHERE id = ?',
          )
          .bind(DIAS_DA_SESSAO_DO_CLIENTE * DIA, aparelho, linha.id),
        db
          .prepare('UPDATE clientes SET visto_em = unixepoch() WHERE id = ?')
          .bind(linha.cliente_id),
      ]),
    );
  }
  c.set('cliente', {
    id: linha.cliente_id,
    sessao: linha.id,
    criadaEm: linha.criada_em,
    identidadeId: linha.identidade_id,
    // A demonstração é a sessão sem identidade na conta de revisão (a única que nasce assim).
    demo:
      linha.identidade_id === null &&
      linha.codigo === (c.env as { REVISAO_CLIENTE?: string }).REVISAO_CLIENTE,
  });
  await next();
};

/** Abre uma sessão deste aparelho e devolve o testemunho UMA vez. */
export async function abrirSessaoDoCliente(
  c: C,
  clienteId: number,
  identidadeId: number | null,
  dias = DIAS_DA_SESSAO_DO_CLIENTE,
): Promise<string> {
  const testemunho = aleatorio(32);
  await c.env.DB.prepare(
    `INSERT INTO sessoes_de_cliente (resumo, cliente_id, identidade_id, aparelho, expira_em)
     VALUES (?, ?, ?, ?, unixepoch() + ?)`,
  )
    .bind(blob(await sha256(testemunho)), clienteId, identidadeId, aparelhoDoPedido(c), dias * DIA)
    .run();
  return testemunho;
}
