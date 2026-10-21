import { Hono } from 'hono';
import {
  DIAS_DE_NOVO,
  TIPOS_DE_CONTAGEM,
  diaEmLisboa,
  type DadosDaApp,
  type ParceiroPublico,
  type TipoDeContagem,
} from '@nunos-lab/dominio';
import type { Ambiente } from './ambiente.ts';
import {
  categoria,
  loja,
  parceiroBase,
  promocaoPublica,
  type LinhaCategoria,
  type LinhaLoja,
  type LinhaParceiro,
  type LinhaPromocao,
} from './linhas.ts';
import { DIA, agora, hex, paraBytes, sha256 } from './util.ts';

export const rotasPublicas = new Hono<Ambiente>();

/**
 * Tudo o que a app mostra, num pedido só: a app abre, pede isto, e tem o
 * início e todas as páginas dos parceiros. Só vão os parceiros activos com
 * pelo menos uma promoção na app hoje.
 */
rotasPublicas.get('/app', async (c) => {
  const db = c.env.DB;
  const hoje = diaEmLisboa();
  const [cats, pars, proms, lojas, defs] = await db.batch([
    db.prepare('SELECT id, nome, icone, ordem FROM categorias ORDER BY ordem, id'),
    db.prepare('SELECT * FROM parceiros WHERE activo = 1 ORDER BY ordem, nome'),
    db
      .prepare(
        `SELECT p.* FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id
         WHERE pa.activo = 1 AND p.activa = 1
           AND (p.inicio IS NULL OR p.inicio <= ?1) AND (p.fim IS NULL OR p.fim >= ?1)
         ORDER BY p.em_destaque DESC, p.ordem, p.id`,
      )
      .bind(hoje),
    db.prepare('SELECT * FROM lojas ORDER BY ordem, id'),
    db.prepare('SELECT chave, valor FROM definicoes'),
  ]);

  const porParceiro = new Map<number, LinhaPromocao[]>();
  for (const p of proms!.results as LinhaPromocao[]) {
    const lista = porParceiro.get(p.parceiro_id) ?? [];
    lista.push(p);
    porParceiro.set(p.parceiro_id, lista);
  }
  const limiteDeNovo = agora() - DIAS_DE_NOVO * DIA;
  const parceiros: ParceiroPublico[] = [];
  for (const l of pars!.results as LinhaParceiro[]) {
    const lista = porParceiro.get(l.id);
    if (!lista?.length) continue;
    parceiros.push({
      ...parceiroBase(l),
      novo: l.criado_em > limiteDeNovo && l.exemplo === 0,
      promocoes: lista.map(promocaoPublica),
    });
  }
  const usadas = new Set(parceiros.map((p) => p.categoriaId));
  const def = new Map(
    (defs!.results as { chave: string; valor: string }[]).map((d) => [d.chave, d.valor]),
  );
  const avisoAte = def.get('aviso_ate') ?? '';
  const aviso = def.get('aviso')?.trim() || null;

  const dados: DadosDaApp = {
    hoje,
    barbearia: {
      instagram: def.get('instagram') ?? '',
      tiktok: def.get('tiktok') ?? '',
      whatsapp: def.get('whatsapp') ?? '',
      site: def.get('site') ?? '',
      lojas: (lojas!.results as LinhaLoja[]).map(loja),
    },
    aviso: aviso && (!avisoAte || hoje <= avisoAte) ? aviso : null,
    categorias: (cats!.results as LinhaCategoria[]).filter((l) => usadas.has(l.id)).map(categoria),
    parceiros,
  };

  // Uma etiqueta do conteúdo: se a app já o tem, responde-se 304 sem corpo.
  const texto = JSON.stringify(dados);
  const etiqueta = `W/"${hex(await sha256(texto)).slice(0, 20)}"`;
  const cabecalhos = {
    ETag: etiqueta,
    'Cache-Control': 'public, max-age=20, stale-while-revalidate=300',
  };
  if (c.req.header('If-None-Match') === etiqueta) return c.body(null, 304, cabecalhos);
  return c.body(texto, 200, { ...cabecalhos, 'Content-Type': 'application/json; charset=utf-8' });
});

/** As imagens: o id é o resumo do conteúdo, por isso ficam em cache um ano. */
rotasPublicas.get('/imagens/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f]{32}$/.test(id)) return c.body(null, 404);
  const linha = await c.env.DB.prepare('SELECT tipo, bytes FROM imagens WHERE id = ?')
    .bind(id)
    .first<{ tipo: string; bytes: unknown }>();
  if (!linha) return c.body(null, 404, { 'Cache-Control': 'no-store' });
  return new Response(paraBytes(linha.bytes), {
    headers: {
      'Content-Type': linha.tipo,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
});

/** De que tabela tem de existir a referência de cada contagem. */
const TABELA_DA_CONTAGEM: Partial<Record<TipoDeContagem, string>> = {
  parceiro: 'parceiros',
  mapa: 'parceiros',
  ligar: 'parceiros',
  instagram: 'parceiros',
  site: 'parceiros',
  promocao: 'promocoes',
  marcar: 'lojas',
};

/**
 * Uma contagem da app («abriu», «viu o parceiro 3», «carregou em Ligar»). Vem
 * por sendBeacon, em texto simples, sem pré-voo de CORS; responde sempre 204,
 * porque a app não espera por nada. Sem pessoa: só o dia, o tipo e o número.
 */
rotasPublicas.post('/contar', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  const { success } = await c.env.CONTAR.limit({ key: ip });
  if (!success) return c.body(null, 204);
  let dados: { tipo?: unknown; ref?: unknown };
  try {
    dados = JSON.parse((await c.req.text()).slice(0, 200));
  } catch {
    return c.body(null, 204);
  }
  const tipo = dados?.tipo;
  if (typeof tipo !== 'string' || !(TIPOS_DE_CONTAGEM as readonly string[]).includes(tipo))
    return c.body(null, 204);
  const tabela = TABELA_DA_CONTAGEM[tipo as TipoDeContagem];
  const ref = tabela ? Number(dados.ref) : 0;
  if (!Number.isInteger(ref) || ref < 0 || ref > 1e9) return c.body(null, 204);
  const dia = diaEmLisboa();
  // O D1 recusa parâmetros a mais: cada forma leva só os que usa.
  const instrucao = tabela
    ? c.env.DB.prepare(
        `INSERT INTO contagens (dia, tipo, ref, n) SELECT ?1, ?2, ?3, 1 WHERE EXISTS (SELECT 1 FROM ${tabela} WHERE id = ?3)
         ON CONFLICT (dia, tipo, ref) DO UPDATE SET n = n + 1`,
      ).bind(dia, tipo, ref)
    : c.env.DB.prepare(
        `INSERT INTO contagens (dia, tipo, ref, n) VALUES (?1, ?2, 0, 1)
         ON CONFLICT (dia, tipo, ref) DO UPDATE SET n = n + 1`,
      ).bind(dia, tipo);
  c.executionCtx.waitUntil(instrucao.run().catch((e) => console.error('contagem', e)));
  return c.body(null, 204);
});
