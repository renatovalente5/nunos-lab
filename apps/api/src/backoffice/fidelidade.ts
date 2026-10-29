/** O backoffice da fidelidade: o programa e a equipa da Balcão. */
import { Hono } from 'hono';
import { z } from 'zod';
import {
  DIAS_DA_LIGACAO,
  LIMITES,
  LIMITES_DO_PROGRAMA,
  normalizarEmail,
  type PessoaDaEquipaNoBackoffice,
} from '@nunos-lab/dominio';
import type { Ambiente } from '../ambiente.ts';
import { lerPrograma } from '../programa.ts';
import {
  DIA,
  aleatorio,
  blob,
  corpo,
  idDaMorada,
  recusar,
  registar,
  sha256,
  traduzirErroDaBase,
} from '../util.ts';

export const rotasDaFidelidade = new Hono<Ambiente>();

// ——— o programa ———

rotasDaFidelidade.get('/programa', async (c) => c.json(await lerPrograma(c.env.DB)));

const ProgramaPedido = z.object({
  objectivo: z
    .number()
    .int()
    .min(LIMITES_DO_PROGRAMA.objectivo.min)
    .max(LIMITES_DO_PROGRAMA.objectivo.max),
  recompensa: z.string().trim().min(1).max(LIMITES_DO_PROGRAMA.recompensa),
  porDia: z.number().int().min(LIMITES_DO_PROGRAMA.porDia.min).max(LIMITES_DO_PROGRAMA.porDia.max),
  aniversario: z.string().trim().max(LIMITES_DO_PROGRAMA.aniversario),
});

rotasDaFidelidade.put('/programa', async (c) => {
  const p = await corpo(c, ProgramaPedido);
  const db = c.env.DB;
  const por = (chave: string, valor: string) =>
    db
      .prepare(
        'INSERT INTO definicoes (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
      )
      .bind(chave, valor);
  await db.batch([
    por('fid.objectivo', String(p.objectivo)),
    por('fid.recompensa', p.recompensa),
    por('fid.por_dia', String(p.porDia)),
    por('fid.aniversario', p.aniversario),
    registar(c, 'programa.alterado', `${p.objectivo} → ${p.recompensa}`),
  ]);
  return c.json(await lerPrograma(db));
});

// ——— a equipa ———

type LinhaPessoa = {
  id: number;
  nome: string;
  email: string | null;
  papel: 'dono' | 'barbeiro' | 'parceiro';
  loja_id: number | null;
  parceiro_id: number | null;
  activo: number;
  criado_em: number;
  loja: string | null;
  parceiro: string | null;
};

async function lerEquipa(db: D1Database): Promise<PessoaDaEquipaNoBackoffice[]> {
  const [pessoas, sessoes, ligacoes] = await db.batch([
    db.prepare(
      `SELECT e.id, e.nome, e.email, e.papel, e.loja_id, e.parceiro_id, e.activo, e.criado_em,
         l.nome AS loja, p.nome AS parceiro
       FROM equipa e LEFT JOIN lojas l ON l.id = e.loja_id LEFT JOIN parceiros p ON p.id = e.parceiro_id
       WHERE e.removido_em IS NULL ORDER BY e.papel = 'dono' DESC, e.papel, e.nome`,
    ),
    db.prepare(
      'SELECT id, pessoa_id, aparelho, criada_em, vista_em FROM sessoes_da_equipa WHERE revogada_em IS NULL AND expira_em > unixepoch() ORDER BY vista_em DESC',
    ),
    db.prepare(
      'SELECT id, pessoa_id, criado_em, expira_em FROM acessos_da_equipa WHERE usado_em IS NULL AND expira_em > unixepoch() ORDER BY id',
    ),
  ]);
  type S = { id: number; pessoa_id: number; aparelho: string; criada_em: number; vista_em: number };
  type L = { id: number; pessoa_id: number; criado_em: number; expira_em: number };
  return (pessoas!.results as LinhaPessoa[]).map((p) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    papel: p.papel,
    lojaId: p.loja_id,
    parceiroId: p.parceiro_id,
    activo: p.activo === 1,
    criadoEm: p.criado_em,
    loja: p.loja,
    parceiro: p.parceiro,
    sessoes: (sessoes!.results as S[])
      .filter((s) => s.pessoa_id === p.id)
      .map((s) => ({
        id: s.id,
        aparelho: s.aparelho,
        criadaEm: s.criada_em,
        vistaEm: s.vista_em,
        actual: false,
      })),
    ligacoes: (ligacoes!.results as L[])
      .filter((l) => l.pessoa_id === p.id)
      .map((l) => ({ id: l.id, criadoEm: l.criado_em, expiraEm: l.expira_em })),
  }));
}

rotasDaFidelidade.get('/equipa', async (c) => c.json(await lerEquipa(c.env.DB)));

const PessoaPedida = z.object({
  nome: z.string().trim().min(1).max(LIMITES.pessoa),
  email: z.string().trim().max(254).nullable(),
  papel: z.enum(['dono', 'barbeiro', 'parceiro']),
  lojaId: z.number().int().positive().nullable(),
  parceiroId: z.number().int().positive().nullable(),
  activo: z.boolean().optional(),
});

async function validar(c: Parameters<typeof corpo>[0], p: Partial<z.output<typeof PessoaPedida>>) {
  const email = p.email ? normalizarEmail(p.email) : null;
  if (p.email && !email) recusar(400, 'invalido');
  const db = c.env.DB;
  if (p.lojaId && !(await db.prepare('SELECT 1 FROM lojas WHERE id = ?').bind(p.lojaId).first()))
    recusar(400, 'referencia');
  if (
    p.parceiroId &&
    !(await db.prepare('SELECT 1 FROM parceiros WHERE id = ?').bind(p.parceiroId).first())
  )
    recusar(400, 'referencia');
  if (p.papel === 'parceiro' && !p.parceiroId) recusar(400, 'invalido');
  return email;
}

rotasDaFidelidade.post('/equipa', async (c) => {
  const p = await corpo(c, PessoaPedida);
  const email = await validar(c, p);
  const db = c.env.DB;
  try {
    await db.batch([
      db
        .prepare(
          'INSERT INTO equipa (nome, email, papel, loja_id, parceiro_id, activo) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          p.nome,
          email,
          p.papel,
          p.papel === 'parceiro' ? null : p.lojaId,
          p.papel === 'parceiro' ? p.parceiroId : null,
          p.activo === false ? 0 : 1,
        ),
      registar(c, 'equipa.criada', `${p.nome} · ${p.papel}`),
    ]);
  } catch (e) {
    traduzirErroDaBase(e);
  }
  return c.json(await lerEquipa(db), 201);
});

rotasDaFidelidade.patch('/equipa/:id', async (c) => {
  const id = idDaMorada(c);
  const p = await corpo(c, PessoaPedida.partial());
  const email = await validar(c, p);
  const db = c.env.DB;
  const partes: string[] = [];
  const valores: (string | number | null)[] = [];
  if (p.nome !== undefined) (partes.push('nome = ?'), valores.push(p.nome));
  if (p.email !== undefined) (partes.push('email = ?'), valores.push(email));
  if (p.papel !== undefined) (partes.push('papel = ?'), valores.push(p.papel));
  if (p.lojaId !== undefined) (partes.push('loja_id = ?'), valores.push(p.lojaId));
  if (p.parceiroId !== undefined) (partes.push('parceiro_id = ?'), valores.push(p.parceiroId));
  if (p.activo !== undefined) (partes.push('activo = ?'), valores.push(p.activo ? 1 : 0));
  if (partes.length === 0) recusar(400, 'nada_a_mudar');
  try {
    const r = await db
      .prepare(`UPDATE equipa SET ${partes.join(', ')} WHERE id = ? AND removido_em IS NULL`)
      .bind(...valores, id)
      .run();
    if (!r.meta.changes) recusar(404, 'nao_existe');
  } catch (e) {
    traduzirErroDaBase(e);
  }
  return c.json(await lerEquipa(db));
});

/** Tirar alguém da equipa: fica no registo dos carimbos; as sessões dele terminam. */
rotasDaFidelidade.delete('/equipa/:id', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  const pessoa = await db
    .prepare('SELECT nome FROM equipa WHERE id = ? AND removido_em IS NULL')
    .bind(id)
    .first<{ nome: string }>();
  if (!pessoa) recusar(404, 'nao_existe');
  await db.batch([
    db
      .prepare('UPDATE equipa SET removido_em = unixepoch(), email = NULL, activo = 0 WHERE id = ?')
      .bind(id),
    db
      .prepare(
        'UPDATE sessoes_da_equipa SET revogada_em = unixepoch() WHERE pessoa_id = ? AND revogada_em IS NULL',
      )
      .bind(id),
    db.prepare('DELETE FROM acessos_da_equipa WHERE pessoa_id = ? AND usado_em IS NULL').bind(id),
    registar(c, 'equipa.removida', pessoa.nome),
  ]);
  return c.json(await lerEquipa(db));
});

/** Uma ligação de acesso à Balcão para esta pessoa: devolve o código UMA vez. */
rotasDaFidelidade.post('/equipa/:id/acesso', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  const pessoa = await db
    .prepare('SELECT nome FROM equipa WHERE id = ? AND removido_em IS NULL AND activo = 1')
    .bind(id)
    .first<{ nome: string }>();
  if (!pessoa) recusar(404, 'nao_existe');
  const codigo = aleatorio(32);
  const expiraEm = Math.floor(Date.now() / 1000) + DIAS_DA_LIGACAO * DIA;
  await db.batch([
    db
      .prepare(
        'INSERT INTO acessos_da_equipa (pessoa_id, resumo, criado_por, expira_em) VALUES (?, ?, ?, ?)',
      )
      .bind(id, blob(await sha256(codigo)), c.get('admin').id, expiraEm),
    registar(c, 'equipa.ligacao', pessoa.nome),
  ]);
  return c.json({ codigo, expiraEm }, 201);
});

rotasDaFidelidade.delete('/equipa/sessoes/:id', async (c) => {
  const id = idDaMorada(c);
  const r = await c.env.DB.prepare(
    'UPDATE sessoes_da_equipa SET revogada_em = unixepoch() WHERE id = ? AND revogada_em IS NULL',
  )
    .bind(id)
    .run();
  if (!r.meta.changes) recusar(404, 'nao_existe');
  return c.body(null, 204);
});
