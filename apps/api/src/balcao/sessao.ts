/**
 * Entrar na Balcão: com o Google ou a Apple do email que o Nuno registou na
 * equipa, ou por uma ligação de acesso (uma vez, 7 dias) para quem não tiver
 * nenhum dos dois. A sessão dura um ano sem uso: um barbeiro não volta a entrar.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { DIAS_DA_SESSAO_DA_EQUIPA, type PapelDaEquipa } from '@nunos-lab/dominio';
import type { Ambiente, C } from '../ambiente.ts';
import { conferirCredencialGoogle } from '../backoffice/google.ts';
import { conferirTokenDaApple } from '../entrada/apple.ts';
import { codigoDeRevisaoValido, pessoaDeRevisao } from '../revisao.ts';
import { DIA, agora, aleatorio, aparelhoDe, blob, corpo, recusar, sha256 } from '../util.ts';

type LinhaPessoa = {
  id: number;
  nome: string;
  papel: PapelDaEquipa;
  loja_id: number | null;
  parceiro_id: number | null;
};

export const exigirPessoa: MiddlewareHandler<Ambiente> = async (c, next) => {
  const cabecalho = c.req.header('Authorization') ?? '';
  const testemunho = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(testemunho)) recusar(401, 'sessao');
  const linha = await c.env.DB.prepare(
    `SELECT s.id AS sessao, s.vista_em, e.id, e.nome, e.papel, e.loja_id, e.parceiro_id
     FROM sessoes_da_equipa s JOIN equipa e ON e.id = s.pessoa_id
     WHERE s.resumo = ? AND s.revogada_em IS NULL AND s.expira_em > unixepoch()
       AND e.removido_em IS NULL AND e.activo = 1`,
  )
    .bind(blob(await sha256(testemunho)))
    .first<LinhaPessoa & { sessao: number; vista_em: number }>();
  if (!linha) recusar(401, 'sessao');
  if (linha.vista_em < agora() - 3600)
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        'UPDATE sessoes_da_equipa SET vista_em = unixepoch(), expira_em = unixepoch() + ? WHERE id = ?',
      )
        .bind(DIAS_DA_SESSAO_DA_EQUIPA * DIA, linha.sessao)
        .run(),
    );
  c.set('pessoa', {
    id: linha.id,
    nome: linha.nome,
    papel: linha.papel,
    lojaId: linha.loja_id,
    parceiroId: linha.parceiro_id,
    sessao: linha.sessao,
  });
  await next();
};

export const rotasDeEntradaDaBalcao = new Hono<Ambiente>();

async function travar(c: C) {
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  if (!(await c.env.TRAVAO.limit({ key: `entrar:${ip}` }))?.success)
    recusar(429, 'muitas_tentativas');
}

async function abrirSessao(c: C, pessoaId: number) {
  const testemunho = aleatorio(32);
  await c.env.DB.prepare(
    'INSERT INTO sessoes_da_equipa (resumo, pessoa_id, aparelho, expira_em) VALUES (?, ?, ?, unixepoch() + ?)',
  )
    .bind(
      blob(await sha256(testemunho)),
      pessoaId,
      aparelhoDe(c.req.header('User-Agent') ?? ''),
      DIAS_DA_SESSAO_DA_EQUIPA * DIA,
    )
    .run();
  return c.json({ sessao: testemunho });
}

async function pessoaDoEmail(c: C, email: string | null): Promise<number> {
  if (!email) recusar(403, 'sem_acesso');
  const p = await c.env.DB.prepare(
    'SELECT id FROM equipa WHERE email = ? AND removido_em IS NULL AND activo = 1',
  )
    .bind(email)
    .first<{ id: number }>();
  if (!p) recusar(403, 'sem_acesso');
  return p.id;
}

rotasDeEntradaDaBalcao.post('/entrar', async (c) => {
  await travar(c);
  const { acesso } = await corpo(c, z.object({ acesso: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }));
  const gasta = await c.env.DB.prepare(
    `UPDATE acessos_da_equipa SET usado_em = unixepoch()
     WHERE resumo = ? AND usado_em IS NULL AND expira_em > unixepoch()
       AND pessoa_id IN (SELECT id FROM equipa WHERE removido_em IS NULL AND activo = 1)
     RETURNING pessoa_id`,
  )
    .bind(blob(await sha256(acesso)))
    .first<{ pessoa_id: number }>();
  if (!gasta) recusar(401, 'ligacao_invalida');
  return abrirSessao(c, gasta.pessoa_id);
});

rotasDeEntradaDaBalcao.post('/entrar/demonstracao', async (c) => {
  await travar(c);
  const { codigo } = await corpo(c, z.object({ codigo: z.string().min(4).max(64) }));
  if (!(await codigoDeRevisaoValido(c, codigo))) recusar(401, 'codigo_invalido');
  return abrirSessao(c, await pessoaDeRevisao(c));
});

rotasDeEntradaDaBalcao.post('/entrar/google', async (c) => {
  await travar(c);
  const { credencial } = await corpo(c, z.object({ credencial: z.string().min(20).max(4096) }));
  const id = await conferirCredencialGoogle(credencial, c.env.GOOGLE_CLIENTE);
  if (!id) recusar(401, 'google_invalido');
  return abrirSessao(c, await pessoaDoEmail(c, id.email));
});

rotasDeEntradaDaBalcao.post('/entrar/apple', async (c) => {
  await travar(c);
  const { token, nonce } = await corpo(
    c,
    z.object({ token: z.string().min(20).max(8192), nonce: z.string().min(8).max(128).nullish() }),
  );
  const clientes = c.env.APPLE_CLIENTES.split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (clientes.length === 0) recusar(400, 'apple_desligado');
  const id = await conferirTokenDaApple(token, clientes, nonce ?? null);
  if (!id) recusar(401, 'apple_invalido');
  // Um email de retransmissão da Apple nunca está na equipa: pede-se que partilhe o email.
  return abrirSessao(c, await pessoaDoEmail(c, id.emailVerificado ? id.email : null));
});
