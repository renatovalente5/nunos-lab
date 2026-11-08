/** O backoffice da fidelidade: o programa e a equipa da Balcão. */
import { Hono } from 'hono';
import { z } from 'zod';
import {
  LIMITES,
  LIMITES_DO_PROGRAMA,
  normalizarEmail,
  type PessoaDaEquipaNoBackoffice,
} from '@nunos-lab/dominio';
import type { Ambiente } from '../ambiente.ts';
import { lerPrograma } from '../programa.ts';
import { refrescarPasses } from '../wallet/servico.ts';
import { nomeLimpo } from '../nomes.ts';
import {
  corpo,
  idDaMorada,
  pessoaDaRevisao,
  recusar,
  registar,
  traduzirErroDaBase,
} from '../util.ts';
import { completarIngles } from '../traducao.ts';

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
  /** Em inglês (vazio: a app em inglês traduz os prémios comuns ou mostra o português); sem eles, ficam como estão. */
  recompensaEn: z.string().trim().max(LIMITES_DO_PROGRAMA.recompensa).optional(),
  aniversarioEn: z.string().trim().max(LIMITES_DO_PROGRAMA.aniversario).optional(),
});

rotasDaFidelidade.put('/programa', async (c) => {
  const p = await corpo(c, ProgramaPedido);
  const db = c.env.DB;
  const antes = await lerPrograma(db);
  const por = (chave: string, valor: string) =>
    db
      .prepare(
        'INSERT INTO definicoes (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
      )
      .bind(chave, valor);
  // A recompensa nova vale também para os cartões em curso (os completos ficam com a que
  // ganharam): o Nuno muda a regra para toda a gente, e o passe da Wallet passa a dizer o
  // mesmo que a app. O objectivo não: um cartão a 9 de 10 completa-se a 10.
  // O inglês vazio, ou que ficou para trás de um português novo, traduz-se sozinho; o prémio,
  // primeiro pelas regras («50% de desconto» → «50% off»), porque as frases do cartão dependem delas.
  const [recompensaEnNova, aniversarioEn] = await completarIngles(c.env.AI, [
    {
      campo: 'recompensa',
      pt: p.recompensa,
      en: p.recompensaEn,
      ptAntes: antes.recompensa,
      enAntes: antes.recompensaEn ?? '',
    },
    {
      campo: 'aniversario',
      pt: p.aniversario,
      en: p.aniversarioEn,
      ptAntes: antes.aniversario,
      enAntes: antes.aniversarioEn ?? '',
    },
  ]);
  const recompensaEn = recompensaEnNova ?? antes.recompensaEn ?? '';
  const mudouRecompensa =
    p.recompensa !== antes.recompensa || recompensaEn !== (antes.recompensaEn ?? '');
  const emCurso = mudouRecompensa
    ? ((
        await db
          .prepare(
            'SELECT count(*) AS n FROM cartoes WHERE completo_em IS NULL AND (recompensa != ? OR recompensa_en != ?)',
          )
          .bind(p.recompensa, recompensaEn)
          .first<{ n: number }>()
      )?.n ?? 0)
    : 0;
  await db.batch([
    por('fid.objectivo', String(p.objectivo)),
    por('fid.recompensa', p.recompensa),
    por('fid.por_dia', String(p.porDia)),
    por('fid.aniversario', p.aniversario),
    por('fid.recompensa_en', recompensaEn),
    ...(aniversarioEn !== undefined ? [por('fid.aniversario_en', aniversarioEn)] : []),
    ...(mudouRecompensa
      ? [
          db
            .prepare(
              'UPDATE cartoes SET recompensa = ?, recompensa_en = ? WHERE completo_em IS NULL AND (recompensa != ? OR recompensa_en != ?)',
            )
            .bind(p.recompensa, recompensaEn, p.recompensa, recompensaEn),
        ]
      : []),
    registar(
      c,
      'programa.alterado',
      `${p.objectivo} → ${p.recompensa}${mudouRecompensa ? ` · ${emCurso} ${emCurso === 1 ? 'cartão' : 'cartões'} em curso` : ''}`,
    ),
  ]);
  // Os passes dizem a recompensa: refazem-se todos (em fundo; são poucos aparelhos).
  if (mudouRecompensa)
    c.executionCtx.waitUntil(
      refrescarPasses(c.env)
        .then((feito) => console.log('passes refeitos (recompensa)', JSON.stringify(feito)))
        .catch((e) => console.error('passes', e)),
    );
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

/** A equipa, sem a conta da revisão das lojas: é da Apple, não se edita nem se tira daqui (8 nov). */
async function lerEquipa(db: D1Database, revisao: number): Promise<PessoaDaEquipaNoBackoffice[]> {
  const [pessoas, sessoes] = await db.batch([
    db
      .prepare(
        `SELECT e.id, e.nome, e.email, e.papel, e.loja_id, e.parceiro_id, e.activo, e.criado_em,
           l.nome AS loja, p.nome AS parceiro
         FROM equipa e LEFT JOIN lojas l ON l.id = e.loja_id LEFT JOIN parceiros p ON p.id = e.parceiro_id
         WHERE e.removido_em IS NULL AND e.id != ? ORDER BY e.papel = 'dono' DESC, e.papel, e.nome`,
      )
      .bind(revisao),
    db.prepare(
      'SELECT id, pessoa_id, aparelho, criada_em, vista_em FROM sessoes_da_equipa WHERE revogada_em IS NULL AND expira_em > unixepoch() ORDER BY vista_em DESC',
    ),
  ]);
  type S = { id: number; pessoa_id: number; aparelho: string; criada_em: number; vista_em: number };
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
  }));
}

rotasDaFidelidade.get('/equipa', async (c) =>
  c.json(await lerEquipa(c.env.DB, pessoaDaRevisao(c.env))),
);

const PessoaPedida = z.object({
  nome: nomeLimpo(LIMITES.pessoa),
  // Sem email não se entra (as ligações de acesso saíram a 8 nov): é obrigatório.
  email: z.string().trim().min(1).max(254),
  papel: z.enum(['dono', 'barbeiro', 'parceiro']),
  lojaId: z.number().int().positive().nullable(),
  parceiroId: z.number().int().positive().nullable(),
  activo: z.boolean().optional(),
});

async function validar(c: Parameters<typeof corpo>[0], p: Partial<z.output<typeof PessoaPedida>>) {
  const email = p.email !== undefined ? normalizarEmail(p.email) : null;
  if (p.email !== undefined && !email) recusar(400, 'invalido');
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
  return c.json(await lerEquipa(db, pessoaDaRevisao(c.env)), 201);
});

rotasDaFidelidade.patch('/equipa/:id', async (c) => {
  const id = idDaMorada(c);
  if (id === pessoaDaRevisao(c.env)) recusar(404, 'nao_existe');
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
  // Como no POST: um parceiro não tem casa, e quem não é parceiro não tem parceiro.
  if (p.papel === 'parceiro') partes.push('loja_id = NULL');
  else if (p.papel !== undefined) partes.push('parceiro_id = NULL');
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
  return c.json(await lerEquipa(db, pessoaDaRevisao(c.env)));
});

/** Tirar alguém da equipa: fica no registo dos carimbos; as sessões dele terminam. */
rotasDaFidelidade.delete('/equipa/:id', async (c) => {
  const id = idDaMorada(c);
  if (id === pessoaDaRevisao(c.env)) recusar(404, 'nao_existe');
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
    registar(c, 'equipa.removida', pessoa.nome),
  ]);
  return c.json(await lerEquipa(db, pessoaDaRevisao(c.env)));
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
