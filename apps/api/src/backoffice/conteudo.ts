import { Hono } from 'hono';
import {
  BYTES_DA_IMAGEM,
  diaEmLisboa,
  estadoDaPromocao,
  type CategoriaComContagem,
  type Promocao as PromocaoDoContrato,
} from '@nunos-lab/dominio';
import type { z } from 'zod';
import type { Ambiente, C } from '../ambiente.ts';
import {
  categoria,
  loja,
  parceiroDoBackoffice,
  promocaoPublica,
  type LinhaCategoria,
  type LinhaLoja,
  type LinhaParceiro,
  type LinhaPromocao,
} from '../linhas.ts';
import {
  blob,
  corpo,
  hex,
  idDaMorada,
  recusar,
  registar,
  sha256,
  traduzirErroDaBase,
} from '../util.ts';
import {
  Barbearia,
  COLUNAS_DA_PROMOCAO,
  COLUNAS_DO_PARCEIRO,
  Categoria,
  Ordem,
  Parceiro,
  Promocao,
  paraBase,
} from './esquemas.ts';

export const rotasDoConteudo = new Hono<Ambiente>();

// ——— parceiros ———

const SELECT_PARCEIROS = `
  SELECT p.*,
    (SELECT count(*) FROM promocoes WHERE parceiro_id = p.id) AS total,
    (SELECT count(*) FROM promocoes WHERE parceiro_id = p.id AND activa = 1
       AND (inicio IS NULL OR inicio <= ?1) AND (fim IS NULL OR fim >= ?1)) AS na_app
  FROM parceiros p`;

type LinhaComContagens = LinhaParceiro & { na_app: number; total: number };

rotasDoConteudo.get('/parceiros', async (c) => {
  const { results } = await c.env.DB.prepare(`${SELECT_PARCEIROS} ORDER BY p.ordem, p.nome`)
    .bind(diaEmLisboa())
    .all<LinhaComContagens>();
  return c.json(results.map(parceiroDoBackoffice));
});

rotasDoConteudo.get('/parceiros/:id', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  const hoje = diaEmLisboa();
  const [par, proms] = await db.batch([
    db.prepare(`${SELECT_PARCEIROS} WHERE p.id = ?2`).bind(hoje, id),
    db.prepare('SELECT * FROM promocoes WHERE parceiro_id = ? ORDER BY ordem, id').bind(id),
  ]);
  const linha = par!.results[0] as LinhaComContagens | undefined;
  if (!linha) recusar(404, 'nao_existe');
  return c.json({
    parceiro: parceiroDoBackoffice(linha),
    promocoes: (proms!.results as LinhaPromocao[]).map((l) =>
      promocaoDoBackoffice(l, linha.nome, linha.activo === 1, hoje),
    ),
  });
});

rotasDoConteudo.post('/parceiros', async (c) => {
  const p = await corpo(c, Parceiro);
  const db = c.env.DB;
  try {
    const [novo] = await db.batch([
      db
        .prepare(
          `INSERT INTO parceiros (nome, categoria_id, loja_id, localidade, morada, telefone, instagram, site, horario, descricao,
             cor, logotipo_id, capa_id, activo, ordem)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT coalesce(max(ordem), 0) + 1 FROM parceiros))
           RETURNING id`,
        )
        .bind(
          p.nome,
          p.categoriaId,
          p.lojaId,
          p.localidade,
          p.morada,
          p.telefone,
          p.instagram,
          p.site,
          p.horario,
          p.descricao,
          p.cor,
          p.logotipo,
          p.capa,
          p.activo ? 1 : 0,
        ),
      registar(c, 'parceiro.criado', p.nome),
    ]);
    return c.json({ id: (novo!.results[0] as { id: number }).id }, 201);
  } catch (e) {
    traduzirErroDaBase(e);
  }
});

/** Um UPDATE só com os campos que vieram. */
function actualizar(
  c: C,
  tabela: 'parceiros' | 'promocoes',
  colunaDaData: 'alterado_em' | 'alterada_em',
  colunas: Record<string, string>,
  dados: Record<string, unknown>,
  id: number,
): D1PreparedStatement {
  const campos = Object.keys(dados).filter((k) => k in colunas && dados[k] !== undefined);
  if (!campos.length) recusar(400, 'nada_a_mudar');
  const sets = campos.map((k) => `${colunas[k]} = ?`).join(', ');
  return c.env.DB.prepare(
    `UPDATE ${tabela} SET ${sets}, ${colunaDaData} = unixepoch() WHERE id = ?`,
  ).bind(...campos.map((k) => paraBase(dados[k])), id);
}

rotasDoConteudo.patch('/parceiros/:id', async (c) => {
  const id = idDaMorada(c);
  const dados = await corpo(c, Parceiro.partial());
  const db = c.env.DB;
  const antes = await db
    .prepare('SELECT nome FROM parceiros WHERE id = ?')
    .bind(id)
    .first<{ nome: string }>();
  if (!antes) recusar(404, 'nao_existe');
  const accao =
    dados.activo === true && Object.keys(dados).length === 1
      ? 'parceiro.activado'
      : dados.activo === false && Object.keys(dados).length === 1
        ? 'parceiro.pausado'
        : 'parceiro.alterado';
  try {
    await db.batch([
      actualizar(c, 'parceiros', 'alterado_em', COLUNAS_DO_PARCEIRO, dados, id),
      registar(c, accao, dados.nome ?? antes.nome),
    ]);
  } catch (e) {
    traduzirErroDaBase(e);
  }
  // Devolve o que ficou gravado (com os contactos arrumados): o formulário fica com isto.
  const linha = await db
    .prepare(`${SELECT_PARCEIROS} WHERE p.id = ?2`)
    .bind(diaEmLisboa(), id)
    .first<LinhaComContagens>();
  return c.json(parceiroDoBackoffice(linha!));
});

/** Os toques da app que apontam para um parceiro (a referência é o id dele). */
const TIPOS_DO_PARCEIRO = "'parceiro', 'mapa', 'ligar', 'instagram', 'site'";

rotasDoConteudo.delete('/parceiros/:id', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  const antes = await db
    .prepare('SELECT nome FROM parceiros WHERE id = ?')
    .bind(id)
    .first<{ nome: string }>();
  if (!antes) recusar(404, 'nao_existe');
  await db.batch([
    // As contagens vão com ele: os ids reaproveitam-se, e um parceiro novo com
    // o mesmo número não pode herdar as vistas do apagado.
    db
      .prepare(
        `DELETE FROM contagens WHERE (tipo IN (${TIPOS_DO_PARCEIRO}) AND ref = ?1)
           OR (tipo = 'promocao' AND ref IN (SELECT id FROM promocoes WHERE parceiro_id = ?1))`,
      )
      .bind(id),
    db.prepare('DELETE FROM parceiros WHERE id = ?').bind(id),
    registar(c, 'parceiro.apagado', antes.nome),
  ]);
  return c.body(null, 204);
});

function ordenar(c: C, tabela: 'parceiros' | 'promocoes' | 'categorias' | 'lojas', ids: number[]) {
  return ids.map((id, i) =>
    c.env.DB.prepare(`UPDATE ${tabela} SET ordem = ? WHERE id = ?`).bind(i + 1, id),
  );
}

rotasDoConteudo.post('/parceiros/ordem', async (c) => {
  const { ids } = await corpo(c, Ordem);
  if (ids.length)
    await c.env.DB.batch([...ordenar(c, 'parceiros', ids), registar(c, 'parceiros.ordenados')]);
  return c.body(null, 204);
});

/** Apagar de uma vez os parceiros inventados para a demonstração. */
rotasDoConteudo.post('/exemplos/apagar', async (c) => {
  const db = c.env.DB;
  const [, r] = await db.batch([
    db.prepare(
      `DELETE FROM contagens WHERE (tipo IN (${TIPOS_DO_PARCEIRO}) AND ref IN (SELECT id FROM parceiros WHERE exemplo = 1))
         OR (tipo = 'promocao' AND ref IN (SELECT p.id FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id WHERE pa.exemplo = 1))`,
    ),
    db.prepare('DELETE FROM parceiros WHERE exemplo = 1'),
    registar(c, 'exemplos.apagados'),
  ]);
  return c.json({ apagados: r!.meta.changes });
});

// ——— promoções ———

/**
 * Uma promoção ligada de um parceiro desligado também não está na app: conta
 * como pausada, e `parceiroPausado` diz porquê.
 */
function promocaoDoBackoffice(
  l: LinhaPromocao,
  parceiro: string,
  parceiroActivo: boolean,
  hoje: string,
): PromocaoDoContrato {
  return {
    ...promocaoPublica(l),
    parceiroId: l.parceiro_id,
    parceiro,
    parceiroPausado: !parceiroActivo,
    activa: l.activa === 1,
    ordem: l.ordem,
    criadaEm: l.criada_em,
    alteradaEm: l.alterada_em,
    estado: estadoDaPromocao(
      { activa: l.activa === 1 && parceiroActivo, inicio: l.inicio, fim: l.fim },
      hoje,
    ),
  };
}

rotasDoConteudo.get('/promocoes', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, pa.nome AS parceiro, pa.activo AS parceiro_activo FROM promocoes p
     JOIN parceiros pa ON pa.id = p.parceiro_id
     ORDER BY pa.ordem, pa.nome, p.ordem, p.id`,
  ).all<LinhaPromocao & { parceiro: string; parceiro_activo: number }>();
  const hoje = diaEmLisboa();
  return c.json(
    results.map((l) => promocaoDoBackoffice(l, l.parceiro, l.parceiro_activo === 1, hoje)),
  );
});

rotasDoConteudo.get('/promocoes/:id', async (c) => {
  const id = idDaMorada(c);
  const l = await c.env.DB.prepare(
    'SELECT p.*, pa.nome AS parceiro, pa.activo AS parceiro_activo FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id WHERE p.id = ?',
  )
    .bind(id)
    .first<LinhaPromocao & { parceiro: string; parceiro_activo: number }>();
  if (!l) recusar(404, 'nao_existe');
  return c.json(promocaoDoBackoffice(l, l.parceiro, l.parceiro_activo === 1, diaEmLisboa()));
});

function conferirDatas(p: { inicio?: string | null; fim?: string | null }) {
  if (p.inicio && p.fim && p.inicio > p.fim) recusar(400, 'datas');
}

rotasDoConteudo.post('/promocoes', async (c) => {
  const p = await corpo(c, Promocao);
  conferirDatas(p);
  const db = c.env.DB;
  const parceiro = await db
    .prepare('SELECT nome FROM parceiros WHERE id = ?')
    .bind(p.parceiroId)
    .first<{ nome: string }>();
  if (!parceiro) recusar(400, 'referencia');
  const [nova] = await db.batch([
    db
      .prepare(
        `INSERT INTO promocoes (parceiro_id, destaque, titulo, detalhe, inicio, fim, em_destaque, activa, ordem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT coalesce(max(ordem), 0) + 1 FROM promocoes WHERE parceiro_id = ?))
         RETURNING id`,
      )
      .bind(
        p.parceiroId,
        p.destaque,
        p.titulo,
        p.detalhe,
        p.inicio,
        p.fim,
        p.emDestaque ? 1 : 0,
        p.activa ? 1 : 0,
        p.parceiroId,
      ),
    registar(c, 'promocao.criada', `${parceiro.nome}: ${p.destaque} ${p.titulo}`),
  ]);
  return c.json({ id: (nova!.results[0] as { id: number }).id }, 201);
});

rotasDoConteudo.patch('/promocoes/:id', async (c) => {
  const id = idDaMorada(c);
  const dados = await corpo(c, Promocao.partial());
  const db = c.env.DB;
  const antes = await db
    .prepare(
      'SELECT p.inicio, p.fim, p.destaque, p.titulo, pa.nome FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id WHERE p.id = ?',
    )
    .bind(id)
    .first<{
      inicio: string | null;
      fim: string | null;
      destaque: string;
      titulo: string;
      nome: string;
    }>();
  if (!antes) recusar(404, 'nao_existe');
  conferirDatas({
    inicio: dados.inicio === undefined ? antes.inicio : dados.inicio,
    fim: dados.fim === undefined ? antes.fim : dados.fim,
  });
  const so = (k: string) => Object.keys(dados).length === 1 && k in dados;
  const accao = so('activa')
    ? dados.activa
      ? 'promocao.activada'
      : 'promocao.pausada'
    : so('emDestaque')
      ? 'promocao.destaque'
      : 'promocao.alterada';
  try {
    await db.batch([
      actualizar(c, 'promocoes', 'alterada_em', COLUNAS_DA_PROMOCAO, dados, id),
      registar(
        c,
        accao,
        `${antes.nome}: ${dados.destaque ?? antes.destaque} ${dados.titulo ?? antes.titulo}`,
      ),
    ]);
  } catch (e) {
    traduzirErroDaBase(e);
  }
  return c.body(null, 204);
});

rotasDoConteudo.delete('/promocoes/:id', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  const antes = await db
    .prepare(
      'SELECT p.destaque, p.titulo, pa.nome FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id WHERE p.id = ?',
    )
    .bind(id)
    .first<{ destaque: string; titulo: string; nome: string }>();
  if (!antes) recusar(404, 'nao_existe');
  await db.batch([
    db.prepare("DELETE FROM contagens WHERE tipo = 'promocao' AND ref = ?").bind(id),
    db.prepare('DELETE FROM promocoes WHERE id = ?').bind(id),
    registar(c, 'promocao.apagada', `${antes.nome}: ${antes.destaque} ${antes.titulo}`),
  ]);
  return c.body(null, 204);
});

rotasDoConteudo.post('/promocoes/ordem', async (c) => {
  const { ids } = await corpo(c, Ordem);
  if (ids.length) await c.env.DB.batch(ordenar(c, 'promocoes', ids));
  return c.body(null, 204);
});

// ——— categorias ———

rotasDoConteudo.get('/categorias', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.*, (SELECT count(*) FROM parceiros WHERE categoria_id = c.id) AS parceiros
     FROM categorias c ORDER BY c.ordem, c.id`,
  ).all<LinhaCategoria & { parceiros: number }>();
  const lista: CategoriaComContagem[] = results.map((l) => ({
    ...categoria(l),
    parceiros: l.parceiros,
  }));
  return c.json(lista);
});

rotasDoConteudo.post('/categorias', async (c) => {
  const k = await corpo(c, Categoria);
  const db = c.env.DB;
  const [nova] = await db.batch([
    db
      .prepare(
        'INSERT INTO categorias (nome, icone, ordem) VALUES (?, ?, (SELECT coalesce(max(ordem), 0) + 1 FROM categorias)) RETURNING id',
      )
      .bind(k.nome, k.icone),
    registar(c, 'categoria.criada', k.nome),
  ]);
  return c.json({ id: (nova!.results[0] as { id: number }).id }, 201);
});

rotasDoConteudo.patch('/categorias/:id', async (c) => {
  const id = idDaMorada(c);
  const k = await corpo(c, Categoria);
  const db = c.env.DB;
  const [r] = await db.batch([
    db.prepare('UPDATE categorias SET nome = ?, icone = ? WHERE id = ?').bind(k.nome, k.icone, id),
    registar(c, 'categoria.alterada', k.nome),
  ]);
  if (!r!.meta.changes) recusar(404, 'nao_existe');
  return c.body(null, 204);
});

rotasDoConteudo.delete('/categorias/:id', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  const antes = await db
    .prepare('SELECT nome FROM categorias WHERE id = ?')
    .bind(id)
    .first<{ nome: string }>();
  if (!antes) recusar(404, 'nao_existe');
  await db.batch([
    db.prepare('DELETE FROM categorias WHERE id = ?').bind(id),
    registar(c, 'categoria.apagada', antes.nome),
  ]);
  return c.body(null, 204);
});

rotasDoConteudo.post('/categorias/ordem', async (c) => {
  const { ids } = await corpo(c, Ordem);
  if (ids.length) await c.env.DB.batch(ordenar(c, 'categorias', ids));
  return c.body(null, 204);
});

// ——— a barbearia: lojas, redes e o aviso ———

const CHAVES = ['instagram', 'tiktok', 'whatsapp', 'site', 'aviso', 'aviso_ate'] as const;

async function lerBarbearia(db: D1Database) {
  const [lojas, defs] = await db.batch([
    db.prepare('SELECT * FROM lojas ORDER BY ordem, id'),
    db.prepare('SELECT chave, valor FROM definicoes'),
  ]);
  const d = new Map(
    (defs!.results as { chave: string; valor: string }[]).map((x) => [x.chave, x.valor]),
  );
  return {
    lojas: (lojas!.results as LinhaLoja[]).map(loja),
    instagram: d.get('instagram') ?? '',
    tiktok: d.get('tiktok') ?? '',
    whatsapp: d.get('whatsapp') ?? '',
    site: d.get('site') ?? '',
    aviso: d.get('aviso') ?? '',
    avisoAte: d.get('aviso_ate') || null,
  };
}

rotasDoConteudo.get('/barbearia', async (c) => c.json(await lerBarbearia(c.env.DB)));

/** Grava tudo de uma vez: as lojas que não vierem na lista apagam-se. */
rotasDoConteudo.put('/barbearia', async (c) => {
  const b: z.output<typeof Barbearia> = await corpo(c, Barbearia);
  const db = c.env.DB;
  const existentes = (await db.prepare('SELECT id FROM lojas').all<{ id: number }>()).results.map(
    (l) => l.id,
  );
  const ficam = new Set(b.lojas.map((l) => l.id).filter((id): id is number => id !== undefined));
  if ([...ficam].some((id) => !existentes.includes(id))) recusar(400, 'referencia');
  const instrucoes: D1PreparedStatement[] = [];
  for (const id of existentes)
    if (!ficam.has(id))
      instrucoes.push(
        db.prepare("DELETE FROM contagens WHERE tipo = 'marcar' AND ref = ?").bind(id),
        db.prepare('DELETE FROM lojas WHERE id = ?').bind(id),
      );
  b.lojas.forEach((l, i) => {
    instrucoes.push(
      l.id
        ? db
            .prepare(
              'UPDATE lojas SET nome = ?, morada = ?, telefone = ?, marcar = ?, ordem = ? WHERE id = ?',
            )
            .bind(l.nome, l.morada, l.telefone, l.marcar, i + 1, l.id)
        : db
            .prepare(
              'INSERT INTO lojas (nome, morada, telefone, marcar, ordem) VALUES (?, ?, ?, ?, ?)',
            )
            .bind(l.nome, l.morada, l.telefone, l.marcar, i + 1),
    );
  });
  const valores: Record<(typeof CHAVES)[number], string> = {
    instagram: b.instagram,
    tiktok: b.tiktok,
    whatsapp: b.whatsapp,
    site: b.site,
    aviso: b.aviso,
    aviso_ate: b.aviso ? (b.avisoAte ?? '') : '',
  };
  for (const chave of CHAVES)
    instrucoes.push(
      db
        .prepare(
          'INSERT INTO definicoes (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
        )
        .bind(chave, valores[chave]),
    );
  instrucoes.push(registar(c, 'barbearia.alterada'));
  await db.batch(instrucoes);
  // Devolve o que ficou gravado (as lojas novas já com o id): o formulário fica com isto.
  return c.json(await lerBarbearia(db));
});

// ——— imagens ———

const TIPOS_DE_IMAGEM = ['image/webp', 'image/jpeg', 'image/png'] as const;

/** Os primeiros bytes têm de dizer o mesmo que o Content-Type. */
function assinaturaCerta(b: Uint8Array, tipo: string): boolean {
  const comeca = (...v: number[]) => v.every((x, i) => b[i] === x);
  if (tipo === 'image/png') return comeca(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (tipo === 'image/jpeg') return comeca(0xff, 0xd8, 0xff);
  if (tipo === 'image/webp')
    return (
      comeca(0x52, 0x49, 0x46, 0x46) &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50
    );
  return false;
}

/**
 * Uma imagem já reduzida pelo browser (o logótipo a 512 px, a capa a 1600).
 * A largura e a altura vêm na morada (?l=&a=). Devolve o id, que é o resumo:
 * o parceiro grava-o depois, no seu PATCH.
 */
rotasDoConteudo.post('/imagens', async (c) => {
  const tipo = (c.req.header('Content-Type') ?? '').split(';')[0]!.trim();
  if (!(TIPOS_DE_IMAGEM as readonly string[]).includes(tipo)) recusar(415, 'tipo_de_imagem');
  if (Number(c.req.header('Content-Length') ?? 0) > BYTES_DA_IMAGEM) recusar(413, 'imagem_grande');
  const largura = Number(c.req.query('l'));
  const altura = Number(c.req.query('a'));
  if (![largura, altura].every((n) => Number.isInteger(n) && n >= 1 && n <= 4000))
    recusar(400, 'medidas');
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (!bytes.byteLength) recusar(400, 'imagem_vazia');
  if (bytes.byteLength > BYTES_DA_IMAGEM) recusar(413, 'imagem_grande');
  if (!assinaturaCerta(bytes, tipo)) recusar(415, 'imagem_invalida');
  const id = hex(await sha256(bytes)).slice(0, 32);
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO imagens (id, tipo, bytes, largura, altura) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, tipo, blob(bytes), largura, altura)
    .run();
  return c.json({ id }, 201);
});
