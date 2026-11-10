import { Hono } from 'hono';
import {
  BYTES_DA_IMAGEM,
  diaEmLisboa,
  ordemDasRedes,
  estadoDaPromocao,
  type CategoriaComContagem,
  type Promocao as PromocaoDoContrato,
} from '@nunos-lab/dominio';
import type { z } from 'zod';
import type { Ambiente, C } from '../ambiente.ts';
import { completarIngles, temLetras, traduzir } from '../traducao.ts';
import { refrescarPasses } from '../wallet/servico.ts';
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
  Traduzir,
  paraBase,
} from './esquemas.ts';

export const rotasDoConteudo = new Hono<Ambiente>();

/** O parceiro e a categoria, para a tradução escolher as palavras («Azeméis Motor — Carros»). */
function ondeDe(p: { nome: string; categoria?: string | null }): string {
  return p.categoria ? `${p.nome} — ${p.categoria}` : p.nome;
}

// ——— traduzir ———

/**
 * O botão «Traduzir» do bloco em inglês: as sugestões, que se editam antes de guardar. Os textos sem
 * letras («−10%», «2×1») voltam como vieram.
 */
rotasDoConteudo.post('/traduzir', async (c) => {
  const { itens, modelo } = await corpo(c, Traduzir);
  const deTeste = (c.env as { MODO?: string }).MODO === 'desenvolvimento' ? modelo : undefined;
  const traduzidos = await traduzir(
    c.env.AI,
    itens.filter((i) => temLetras(i.texto)),
    deTeste,
  );
  if (!traduzidos) recusar(503, 'traducao_indisponivel');
  let k = 0;
  return c.json({
    traducoes: itens.map((i) => (temLetras(i.texto) ? traduzidos[k++]! : i.texto)),
  });
});

// ——— parceiros ———

const SELECT_PARCEIROS = `
  SELECT p.*,
    (SELECT count(*) FROM promocoes WHERE parceiro_id = p.id) AS total,
    (SELECT count(*) FROM promocoes WHERE parceiro_id = p.id AND activa = 1
       AND (inicio IS NULL OR inicio <= ?1) AND (fim IS NULL OR fim >= ?1)) AS na_app
  FROM parceiros p`;

type LinhaComContagens = LinhaParceiro & { na_app: number; total: number };

rotasDoConteudo.get('/parceiros', async (c) => {
  // Pela ordem da app: cada parceiro no lugar da sua primeira vantagem (uma ordem só, a das vantagens,
  // o Renato, 10 nov); os que ainda não têm nenhuma vão no fim, pelo nome.
  const { results } = await c.env.DB.prepare(
    `${SELECT_PARCEIROS}
     ORDER BY (SELECT min(ordem) FROM promocoes WHERE parceiro_id = p.id) IS NULL,
       (SELECT min(ordem) FROM promocoes WHERE parceiro_id = p.id), p.nome`,
  )
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
    db
      .prepare(
        `SELECT p.*, (SELECT count(*) FROM vales v WHERE v.promocao_id = p.id AND v.anulado_em IS NULL) AS validacoes
         FROM promocoes p WHERE p.parceiro_id = ? ORDER BY p.ordem, p.id`,
      )
      .bind(id),
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
  // O inglês que ficou vazio traduz-se sozinho, com o nome e a categoria a dar o contexto.
  const categoria = p.categoriaId
    ? await db
        .prepare('SELECT nome FROM categorias WHERE id = ?')
        .bind(p.categoriaId)
        .first<{ nome: string }>()
    : null;
  const onde = ondeDe({ nome: p.nome, categoria: categoria?.nome });
  // Com o horário por dias, o texto escreve-se dele nas duas línguas: não há texto livre a guardar.
  if (p.horarioSemana) {
    p.horario = '';
    p.horarioEn = '';
  }
  const [horarioEn, descricaoEn] = await completarIngles(c.env.AI, [
    { campo: 'horario', pt: p.horario, en: p.horarioEn, onde },
    { campo: 'descricao', pt: p.descricao, en: p.descricaoEn, onde },
  ]);
  try {
    const [novo] = await db.batch([
      db
        .prepare(
          `INSERT INTO parceiros (nome, categoria_id, localidade, morada, telefone, instagram, site, horario, horario_semana,
             descricao, horario_en, descricao_en, cor, logotipo_id, logotipo_ajuste, capa_id, activo, ordem)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT coalesce(max(ordem), 0) + 1 FROM parceiros))
           RETURNING id`,
        )
        .bind(
          p.nome,
          p.categoriaId,
          p.localidade,
          p.morada,
          p.telefone,
          p.instagram,
          p.site,
          p.horario ?? '',
          p.horarioSemana ?? null,
          p.descricao,
          horarioEn ?? '',
          descricaoEn ?? '',
          p.cor,
          p.logotipo,
          p.logotipoAjuste ?? null,
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
    .prepare(
      `SELECT pa.nome, pa.horario, pa.horario_semana, pa.descricao, pa.horario_en, pa.descricao_en,
         ca.nome AS categoria
       FROM parceiros pa LEFT JOIN categorias ca ON ca.id = pa.categoria_id WHERE pa.id = ?`,
    )
    .bind(id)
    .first<{
      nome: string;
      horario: string;
      horario_semana: string | null;
      descricao: string;
      horario_en: string;
      descricao_en: string;
      categoria: string | null;
    }>();
  if (!antes) recusar(404, 'nao_existe');
  // O horário por dias põe de parte o texto livre de antes (o texto escreve-se dele, nas duas
  // línguas); e tirá-lo tira o horário todo, sem voltar o texto antigo.
  if (
    dados.horarioSemana !== undefined &&
    (dados.horarioSemana !== null || antes.horario_semana !== null)
  ) {
    dados.horario = '';
    dados.horarioEn = '';
  }
  // O inglês vazio, ou que ficou para trás de um português novo, traduz-se sozinho.
  const onde = ondeDe({ nome: dados.nome ?? antes.nome, categoria: antes.categoria });
  const [horarioEn, descricaoEn] = await completarIngles(c.env.AI, [
    {
      campo: 'horario',
      pt: dados.horario,
      en: dados.horarioEn,
      ptAntes: antes.horario,
      enAntes: antes.horario_en,
      onde,
    },
    {
      campo: 'descricao',
      pt: dados.descricao,
      en: dados.descricaoEn,
      ptAntes: antes.descricao,
      enAntes: antes.descricao_en,
      onde,
    },
  ]);
  if (horarioEn !== undefined) dados.horarioEn = horarioEn;
  if (descricaoEn !== undefined) dados.descricaoEn = descricaoEn;
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
    // As pessoas da equipa ligadas ao parceiro saem como quem é tirado da
    // equipa (as sessões terminam, ficam no histórico), não pela cascata da base.
    db
      .prepare(
        'UPDATE sessoes_da_equipa SET revogada_em = unixepoch() WHERE revogada_em IS NULL AND pessoa_id IN (SELECT id FROM equipa WHERE parceiro_id = ?)',
      )
      .bind(id),
    db
      .prepare(
        'UPDATE equipa SET removido_em = unixepoch(), activo = 0, email = NULL WHERE parceiro_id = ? AND removido_em IS NULL',
      )
      .bind(id),
    db.prepare('UPDATE equipa SET parceiro_id = NULL WHERE parceiro_id = ?').bind(id),
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

function ordenar(c: C, tabela: 'categorias' | 'lojas', ids: number[]) {
  return ids.map((id, i) =>
    c.env.DB.prepare(`UPDATE ${tabela} SET ordem = ? WHERE id = ?`).bind(i + 1, id),
  );
}

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
  l: LinhaPromocao & { validacoes?: number },
  parceiro: string,
  parceiroActivo: boolean,
  hoje: string,
): PromocaoDoContrato {
  return {
    ...promocaoPublica(l),
    destaqueEn: l.destaque_en,
    tituloEn: l.titulo_en,
    detalheEn: l.detalhe_en,
    limiteTotal: l.limite_total,
    validacoes: l.validacoes ?? 0,
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
    `SELECT p.*, pa.nome AS parceiro, pa.activo AS parceiro_activo,
       (SELECT count(*) FROM vales v WHERE v.promocao_id = p.id AND v.anulado_em IS NULL) AS validacoes
     FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id
     ORDER BY p.ordem, p.id`,
  ).all<LinhaPromocao & { parceiro: string; parceiro_activo: number }>();
  const hoje = diaEmLisboa();
  return c.json(
    results.map((l) => promocaoDoBackoffice(l, l.parceiro, l.parceiro_activo === 1, hoje)),
  );
});

rotasDoConteudo.get('/promocoes/:id', async (c) => {
  const id = idDaMorada(c);
  const l = await c.env.DB.prepare(
    `SELECT p.*, pa.nome AS parceiro, pa.activo AS parceiro_activo,
       (SELECT count(*) FROM vales v WHERE v.promocao_id = p.id AND v.anulado_em IS NULL) AS validacoes
     FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id WHERE p.id = ?`,
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
    .prepare(
      'SELECT pa.nome, ca.nome AS categoria FROM parceiros pa LEFT JOIN categorias ca ON ca.id = pa.categoria_id WHERE pa.id = ?',
    )
    .bind(p.parceiroId)
    .first<{ nome: string; categoria: string | null }>();
  if (!parceiro) recusar(400, 'referencia');
  // O inglês que ficou vazio traduz-se sozinho (o Renato, 8 nov).
  const onde = ondeDe(parceiro);
  const [destaqueEn, tituloEn, detalheEn] = await completarIngles(c.env.AI, [
    { campo: 'destaque', pt: p.destaque, en: p.destaqueEn, onde },
    { campo: 'titulo', pt: p.titulo, en: p.tituloEn, onde },
    { campo: 'detalhe', pt: p.detalhe, en: p.detalheEn, onde },
  ]);
  const [nova] = await db.batch([
    db
      .prepare(
        `INSERT INTO promocoes (parceiro_id, destaque, titulo, detalhe, destaque_en, titulo_en, detalhe_en,
           inicio, fim, em_destaque, activa,
           limite_por_cliente, periodo_do_limite, limite_total, ordem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT coalesce(max(ordem), 0) + 1 FROM promocoes))
         RETURNING id`,
      )
      .bind(
        p.parceiroId,
        p.destaque,
        p.titulo,
        p.detalhe,
        destaqueEn ?? '',
        tituloEn ?? '',
        detalheEn ?? '',
        p.inicio,
        p.fim,
        p.emDestaque ? 1 : 0,
        p.activa ? 1 : 0,
        p.limitePorCliente ?? null,
        p.periodoDoLimite ?? 'dia',
        p.limiteTotal ?? null,
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
      `SELECT p.inicio, p.fim, p.destaque, p.titulo, p.detalhe, p.destaque_en, p.titulo_en, p.detalhe_en,
         pa.nome, ca.nome AS categoria
       FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id LEFT JOIN categorias ca ON ca.id = pa.categoria_id
       WHERE p.id = ?`,
    )
    .bind(id)
    .first<{
      inicio: string | null;
      fim: string | null;
      destaque: string;
      titulo: string;
      detalhe: string;
      destaque_en: string;
      titulo_en: string;
      detalhe_en: string;
      nome: string;
      categoria: string | null;
    }>();
  if (!antes) recusar(404, 'nao_existe');
  // O inglês vazio, ou que ficou para trás de um português novo, traduz-se sozinho.
  const onde = ondeDe(antes);
  const [destaqueEn, tituloEn, detalheEn] = await completarIngles(c.env.AI, [
    {
      campo: 'destaque',
      pt: dados.destaque,
      en: dados.destaqueEn,
      ptAntes: antes.destaque,
      enAntes: antes.destaque_en,
      onde,
    },
    {
      campo: 'titulo',
      pt: dados.titulo,
      en: dados.tituloEn,
      ptAntes: antes.titulo,
      enAntes: antes.titulo_en,
      onde,
    },
    {
      campo: 'detalhe',
      pt: dados.detalhe,
      en: dados.detalheEn,
      ptAntes: antes.detalhe,
      enAntes: antes.detalhe_en,
      onde,
    },
  ]);
  if (destaqueEn !== undefined) dados.destaqueEn = destaqueEn;
  if (tituloEn !== undefined) dados.tituloEn = tituloEn;
  if (detalheEn !== undefined) dados.detalheEn = detalheEn;
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
      // Mudar o parceiro leva os vales dela: senão ficavam no antigo.
      ...(dados.parceiroId !== undefined
        ? [
            db
              .prepare('UPDATE vales SET parceiro_id = ? WHERE promocao_id = ?')
              .bind(dados.parceiroId, id),
          ]
        : []),
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

// Uma ordem só para todas as vantagens (o Renato, 10 nov 2026): a app segue-a nos destaques, na lista dos
// parceiros e na página de cada um. A lista do backoffice pode estar filtrada (um estado, um parceiro, uma
// procura): as que chegam trocam entre si os lugares que já ocupavam, e as outras ficam onde estavam.
// Renumera-se tudo a partir de 1, para dois lugares iguais nunca empatarem.
rotasDoConteudo.post('/promocoes/ordem', async (c) => {
  const { ids } = await corpo(c, Ordem);
  const db = c.env.DB;
  const { results: todas } = await db
    .prepare('SELECT id, ordem FROM promocoes ORDER BY ordem, id')
    .all<{ id: number; ordem: number }>();
  const lugarAntes = new Map(todas.map((p) => [p.id, p.ordem]));
  const pedidas = new Set(ids);
  if (pedidas.size !== ids.length || ids.some((id) => !lugarAntes.has(id))) recusar(400, 'ordem');
  const novas = [...ids];
  const mudam = todas.flatMap((p, i) => {
    const id = pedidas.has(p.id) ? novas.shift()! : p.id;
    return lugarAntes.get(id) === i + 1
      ? []
      : [db.prepare('UPDATE promocoes SET ordem = ? WHERE id = ?').bind(i + 1, id)];
  });
  if (mudam.length) await db.batch([...mudam, registar(c, 'promocoes.ordenadas')]);
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
    nomeEn: l.nome_en,
    parceiros: l.parceiros,
  }));
  return c.json(lista);
});

rotasDoConteudo.post('/categorias', async (c) => {
  const k = await corpo(c, Categoria);
  const db = c.env.DB;
  const [nomeEn] = await completarIngles(c.env.AI, [
    { campo: 'categoria', pt: k.nome, en: k.nomeEn },
  ]);
  const [nova] = await db.batch([
    db
      .prepare(
        'INSERT INTO categorias (nome, nome_en, icone, ordem) VALUES (?, ?, ?, (SELECT coalesce(max(ordem), 0) + 1 FROM categorias)) RETURNING id',
      )
      .bind(k.nome, nomeEn ?? '', k.icone),
    registar(c, 'categoria.criada', k.nome),
  ]);
  return c.json({ id: (nova!.results[0] as { id: number }).id }, 201);
});

rotasDoConteudo.patch('/categorias/:id', async (c) => {
  const id = idDaMorada(c);
  const k = await corpo(c, Categoria);
  const db = c.env.DB;
  const antes = await db
    .prepare('SELECT nome, nome_en FROM categorias WHERE id = ?')
    .bind(id)
    .first<{ nome: string; nome_en: string }>();
  if (!antes) recusar(404, 'nao_existe');
  const [nomeEn] = await completarIngles(c.env.AI, [
    { campo: 'categoria', pt: k.nome, en: k.nomeEn, ptAntes: antes.nome, enAntes: antes.nome_en },
  ]);
  const [r] = await db.batch([
    // O nome em inglês só muda quando vem ou se traduz (um backoffice antigo aberto não o apaga).
    db
      .prepare(
        'UPDATE categorias SET nome = ?, icone = ?, nome_en = coalesce(?, nome_en) WHERE id = ?',
      )
      .bind(k.nome, k.icone, nomeEn ?? null, id),
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

const CHAVES = [
  'instagram',
  'tiktok',
  'whatsapp',
  'site',
  'redes_ordem',
  'aviso',
  'aviso_en',
  'aviso_ate',
] as const;

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
    redes: ordemDasRedes(d.get('redes_ordem')),
    aviso: d.get('aviso') ?? '',
    avisoEn: d.get('aviso_en') ?? '',
    avisoAte: d.get('aviso_ate') || null,
  };
}

rotasDoConteudo.get('/barbearia', async (c) => c.json(await lerBarbearia(c.env.DB)));

/** Grava tudo de uma vez: as lojas que não vierem na lista apagam-se — só as sem história (409 casa_com_historia). */
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
    if (!ficam.has(id)) {
      // Uma casa com história não se apaga: a cascata tirava a casa a carimbos, clientes,
      // equipa e prémios, sem aviso e sem volta. Só sai uma casa que nunca serviu.
      const historia = await db
        .prepare(
          `SELECT EXISTS (SELECT 1 FROM carimbos WHERE loja_id = ?1)
            OR EXISTS (SELECT 1 FROM cartoes WHERE usado_loja_id = ?1)
            OR EXISTS (SELECT 1 FROM clientes WHERE loja_id = ?1 AND apagado_em IS NULL)
            OR EXISTS (SELECT 1 FROM equipa WHERE loja_id = ?1 AND removido_em IS NULL)
            OR EXISTS (SELECT 1 FROM prendas WHERE loja_id = ?1) AS h`,
        )
        .bind(id)
        .first<{ h: number }>();
      if (historia?.h) recusar(409, 'casa_com_historia');
      instrucoes.push(
        db.prepare("DELETE FROM contagens WHERE tipo = 'marcar' AND ref = ?").bind(id),
        db.prepare('DELETE FROM lojas WHERE id = ?').bind(id),
      );
    }
  b.lojas.forEach((l, i) => {
    // As coordenadas (o mapa e o passe) só mudam quando o formulário as traz.
    const comCoordenadas = l.lat !== undefined && l.lng !== undefined;
    instrucoes.push(
      l.id
        ? comCoordenadas
          ? db
              .prepare(
                'UPDATE lojas SET nome = ?, morada = ?, telefone = ?, marcar = ?, ordem = ?, lat = ?, lng = ? WHERE id = ?',
              )
              .bind(l.nome, l.morada, l.telefone, l.marcar, i + 1, l.lat, l.lng, l.id)
          : db
              .prepare(
                'UPDATE lojas SET nome = ?, morada = ?, telefone = ?, marcar = ?, ordem = ? WHERE id = ?',
              )
              .bind(l.nome, l.morada, l.telefone, l.marcar, i + 1, l.id)
        : db
            .prepare(
              'INSERT INTO lojas (nome, morada, telefone, marcar, ordem, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(l.nome, l.morada, l.telefone, l.marcar, i + 1, l.lat ?? null, l.lng ?? null),
    );
  });
  // Sem aviso em português não fica o inglês; um backoffice antigo (sem avisoEn) deixa-o como está.
  // O inglês vazio, ou que ficou para trás de um aviso novo, traduz-se sozinho.
  const avisoAntes = await db
    .prepare("SELECT chave, valor FROM definicoes WHERE chave IN ('aviso', 'aviso_en')")
    .all<{ chave: string; valor: string }>();
  const deAntes = (k: string) => avisoAntes.results.find((x) => x.chave === k)?.valor ?? '';
  const [avisoEn] = b.aviso
    ? await completarIngles(c.env.AI, [
        {
          campo: 'aviso',
          pt: b.aviso,
          en: b.avisoEn,
          ptAntes: deAntes('aviso'),
          enAntes: deAntes('aviso_en'),
        },
      ])
    : [''];
  const valores: Record<(typeof CHAVES)[number], string | undefined> = {
    instagram: b.instagram,
    tiktok: b.tiktok,
    whatsapp: b.whatsapp,
    site: b.site,
    redes_ordem: b.redes?.join(','),
    aviso: b.aviso,
    aviso_en: avisoEn,
    aviso_ate: b.aviso ? (b.avisoAte ?? '') : '',
  };
  for (const chave of CHAVES)
    if (valores[chave] !== undefined)
      instrucoes.push(
        db
          .prepare(
            'INSERT INTO definicoes (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
          )
          .bind(chave, valores[chave]),
      );
  instrucoes.push(registar(c, 'barbearia.alterada'));
  await db.batch(instrucoes);
  // O passe leva as casas (os sítios que o acordam no ecrã bloqueado, os nomes e telefones nas
  // costas), o WhatsApp, o site e o Instagram: refaz-se para toda a gente, como ao mudar o
  // programa. Sem isto ficava com os de antes até ao carimbo seguinte de cada cliente.
  c.executionCtx.waitUntil(
    refrescarPasses(c.env)
      .then((feito) => console.log('passes refeitos (barbearia)', JSON.stringify(feito)))
      .catch((e) => console.error('passes', e)),
  );
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
    // A mesma imagem outra vez renova a data: a limpeza não a leva por ter sido escolhida há dias.
    'INSERT INTO imagens (id, tipo, bytes, largura, altura) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET criada_em = unixepoch()',
  )
    .bind(id, tipo, blob(bytes), largura, altura)
    .run();
  return c.json({ id }, 201);
});
