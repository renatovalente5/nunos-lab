import type { MiddlewareHandler } from 'hono';
import { DIAS_DA_SESSAO_DO_CLIENTE, MINUTOS_DE_PROVA_RECENTE } from '@nunos-lab/dominio';
import type { Ambiente, C } from '../ambiente.ts';
import { DIA, agora, aleatorio, aparelhoDe, blob, recusar, sha256 } from '../util.ts';

/** A guarda das rotas /api/eu: o testemunho da app, no cabeçalho, de uma conta que existe. */
export const exigirCliente: MiddlewareHandler<Ambiente> = async (c, next) => {
  const cabecalho = c.req.header('Authorization') ?? '';
  const testemunho = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(testemunho)) recusar(401, 'sessao');
  const linha = await c.env.DB.prepare(
    `SELECT s.id, s.cliente_id, s.vista_em, s.criada_em, s.identidade_id
     FROM sessoes_de_cliente s JOIN clientes k ON k.id = s.cliente_id
     WHERE s.resumo = ? AND s.revogada_em IS NULL AND s.expira_em > unixepoch() AND k.apagado_em IS NULL`,
  )
    .bind(blob(await sha256(testemunho)))
    .first<{
      id: number;
      cliente_id: number;
      vista_em: number;
      criada_em: number;
      identidade_id: number | null;
    }>();
  if (!linha) recusar(401, 'sessao');
  if (linha.vista_em < agora() - 3600) {
    const db = c.env.DB;
    c.executionCtx.waitUntil(
      db.batch([
        db
          .prepare(
            'UPDATE sessoes_de_cliente SET vista_em = unixepoch(), expira_em = unixepoch() + ? WHERE id = ?',
          )
          .bind(DIAS_DA_SESSAO_DO_CLIENTE * DIA, linha.id),
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
  });
  await next();
};

/** Abre uma sessão deste aparelho e devolve o testemunho UMA vez. */
export async function abrirSessaoDoCliente(
  c: C,
  clienteId: number,
  identidadeId: number | null,
): Promise<string> {
  const testemunho = aleatorio(32);
  await c.env.DB.prepare(
    `INSERT INTO sessoes_de_cliente (resumo, cliente_id, identidade_id, aparelho, expira_em)
     VALUES (?, ?, ?, ?, unixepoch() + ?)`,
  )
    .bind(
      blob(await sha256(testemunho)),
      clienteId,
      identidadeId,
      aparelhoDe(c.req.header('User-Agent') ?? ''),
      DIAS_DA_SESSAO_DO_CLIENTE * DIA,
    )
    .run();
  return testemunho;
}

/** Entrou há pouco: pode juntar e tirar formas de entrar, e apagar a conta. */
export function provaRecente(c: C): boolean {
  return c.get('cliente').criadaEm > agora() - MINUTOS_DE_PROVA_RECENTE * 60;
}
