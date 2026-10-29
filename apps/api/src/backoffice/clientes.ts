/** Os clientes no backoffice: a lista, a ficha, o CSV, e apagar os de exemplo. */
import { Hono } from 'hono';
import {
  diaEmLisboa,
  textoDeBusca,
  type ClienteDoBackoffice,
  type FichaDoCliente,
  type TipoDeEntrada,
} from '@nunos-lab/dominio';
import type { Ambiente } from '../ambiente.ts';
import { emRisco } from '../balcao/rotas.ts';
import { agora, idDaMorada, recusar, registar } from '../util.ts';

export const rotasDosClientes = new Hono<Ambiente>();

type Linha = {
  id: number;
  codigo: string;
  nome: string;
  email: string | null;
  aniversario: string | null;
  loja_id: number | null;
  criado_em: number;
  exemplo: number;
  apagado_em: number | null;
  cortes: number;
  ultimo: number | null;
  primeiro: number | null;
  carimbos: number;
  objectivo: number | null;
  por_usar: number;
  formas: string | null;
};

const LISTA = `SELECT k.id, k.codigo, k.nome, k.email, k.aniversario, k.loja_id, k.criado_em, k.exemplo, k.apagado_em,
    (SELECT count(*) FROM carimbos x WHERE x.cliente_id = k.id AND x.anulado_em IS NULL) AS cortes,
    (SELECT max(criado_em) FROM carimbos x WHERE x.cliente_id = k.id AND x.anulado_em IS NULL) AS ultimo,
    (SELECT min(criado_em) FROM carimbos x WHERE x.cliente_id = k.id AND x.anulado_em IS NULL) AS primeiro,
    (SELECT count(*) FROM carimbos x WHERE x.anulado_em IS NULL
       AND x.cartao_id = (SELECT id FROM cartoes c WHERE c.cliente_id = k.id ORDER BY numero DESC LIMIT 1)) AS carimbos,
    (SELECT objectivo FROM cartoes c WHERE c.cliente_id = k.id ORDER BY numero DESC LIMIT 1) AS objectivo,
    (SELECT count(*) FROM cartoes c WHERE c.cliente_id = k.id AND c.completo_em IS NOT NULL AND c.usado_em IS NULL) AS por_usar,
    (SELECT group_concat(DISTINCT tipo) FROM identidades i WHERE i.cliente_id = k.id) AS formas
  FROM clientes k`;

function publico(l: Linha): ClienteDoBackoffice {
  return {
    id: l.id,
    codigo: l.codigo,
    nome: l.nome,
    email: l.email,
    aniversario: l.aniversario,
    lojaId: l.loja_id,
    criadoEm: l.criado_em,
    cortes: l.cortes,
    ultimo: l.ultimo,
    carimbos: l.carimbos,
    objectivo: l.objectivo ?? 0,
    recompensasPorUsar: l.por_usar,
    exemplo: l.exemplo === 1,
    apagado: l.apagado_em !== null,
    formas: (l.formas ? l.formas.split(',') : []) as TipoDeEntrada[],
  };
}

/**
 * A lista, com o filtro de estado calculado aqui (são contas, não milhares):
 * novos (1.º corte há 30 dias), activos (corte há 90), em risco, perdidos (> 180).
 */
rotasDosClientes.get('/clientes', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const estado = c.req.query('estado') ?? 'todos';
  const lojaId = Number(c.req.query('lojaId')) || null;
  const padrao = `%${q.replace(/[%_]/g, '')}%`;
  const busca = `%${textoDeBusca(q.replace(/[%_]/g, ''))}%`;
  const r = await c.env.DB.prepare(
    `${LISTA} WHERE k.apagado_em IS NULL
     ${q ? 'AND (k.nome LIKE ? OR k.busca LIKE ? OR k.email LIKE ? OR k.codigo LIKE ?)' : ''}
     ${lojaId ? 'AND (k.loja_id = ? OR EXISTS (SELECT 1 FROM carimbos x WHERE x.cliente_id = k.id AND x.loja_id = ?))' : ''}
     ORDER BY ultimo DESC NULLS LAST, k.criado_em DESC LIMIT 500`,
  )
    .bind(
      ...(q ? [padrao, busca, padrao, `${q.toUpperCase()}%`] : []),
      ...(lojaId ? [lojaId, lojaId] : []),
    )
    .all<Linha>();
  const t = agora();
  const lista = r.results.filter((l) => {
    const parado = l.ultimo ? t - l.ultimo : null;
    switch (estado) {
      case 'novos':
        return l.primeiro !== null && l.primeiro > t - 30 * 86400;
      case 'activos':
        return parado !== null && parado <= 90 * 86400;
      case 'em-risco':
        return (
          l.cortes >= 2 &&
          l.primeiro !== null &&
          l.ultimo !== null &&
          emRisco([{ n: l.cortes, primeiro: l.primeiro, ultimo: l.ultimo }], t) === 1
        );
      case 'perdidos':
        return parado !== null && parado > 180 * 86400;
      case 'sem-app':
        return !l.formas || l.formas === 'email';
      default:
        return true;
    }
  });
  return c.json(lista.map(publico));
});

rotasDosClientes.get('/clientes/:id', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  const [cliente, cartoes, carimbos] = await db.batch([
    db.prepare(`${LISTA} WHERE k.id = ?`).bind(id),
    db
      .prepare(
        `SELECT c.id, c.numero, c.objectivo, c.recompensa, c.iniciado_em, c.completo_em, c.usado_em,
           l.nome AS usado_loja, e.nome AS usado_por,
           (SELECT count(*) FROM carimbos x WHERE x.cartao_id = c.id AND x.anulado_em IS NULL) AS carimbos
         FROM cartoes c LEFT JOIN lojas l ON l.id = c.usado_loja_id LEFT JOIN equipa e ON e.id = c.usado_por
         WHERE c.cliente_id = ? ORDER BY c.numero DESC`,
      )
      .bind(id),
    db
      .prepare(
        `SELECT x.id, x.criado_em AS quando, l.nome AS loja, e.nome AS pessoa, s.nome AS servico, c.numero,
           x.anulado_em, a.nome AS anulado_por, x.repetido, x.sem_leitura
         FROM carimbos x JOIN cartoes c ON c.id = x.cartao_id
         LEFT JOIN lojas l ON l.id = x.loja_id LEFT JOIN equipa e ON e.id = x.pessoa_id
         LEFT JOIN servicos s ON s.id = x.servico_id LEFT JOIN equipa a ON a.id = x.anulado_por
         WHERE x.cliente_id = ? ORDER BY x.criado_em DESC LIMIT 200`,
      )
      .bind(id),
  ]);
  const l = cliente!.results[0] as Linha | undefined;
  if (!l) recusar(404, 'nao_existe');
  type Cartao = {
    id: number;
    numero: number;
    objectivo: number;
    recompensa: string;
    iniciado_em: number;
    completo_em: number | null;
    usado_em: number | null;
    usado_loja: string | null;
    usado_por: string | null;
    carimbos: number;
  };
  type Carimbo = {
    id: number;
    quando: number;
    loja: string | null;
    pessoa: string | null;
    servico: string | null;
    numero: number;
    anulado_em: number | null;
    anulado_por: string | null;
    repetido: number;
    sem_leitura: number;
  };
  const ficha: FichaDoCliente = {
    ...publico(l),
    cartoes: (cartoes!.results as Cartao[]).map((x) => ({
      id: x.id,
      numero: x.numero,
      objectivo: x.objectivo,
      recompensa: x.recompensa,
      carimbos: x.carimbos,
      iniciadoEm: x.iniciado_em,
      completoEm: x.completo_em,
      usadoEm: x.usado_em,
      usadoLoja: x.usado_loja,
      usadoPor: x.usado_por,
    })),
    historico: (carimbos!.results as Carimbo[]).map((x) => ({
      id: x.id,
      quando: x.quando,
      loja: x.loja,
      pessoa: x.pessoa,
      servico: x.servico,
      cartaoNumero: x.numero,
      anuladoEm: x.anulado_em,
      anuladoPor: x.anulado_por,
      repetido: x.repetido === 1,
      semLeitura: x.sem_leitura === 1,
    })),
  };
  return c.json(ficha);
});

/** A lista em CSV (Excel/Numbers): o que o Nuno quer levar para fora. */
rotasDosClientes.get('/clientes.csv', async (c) => {
  const r = await c.env.DB.prepare(
    `${LISTA} WHERE k.apagado_em IS NULL ORDER BY k.nome`,
  ).all<Linha>();
  // Uma célula que começa por = + - @ (ou tab/CR) seria uma fórmula no Excel: um apóstrofo à frente desarma-a.
  const celula = (v: unknown) => {
    const s = String(v ?? '');
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const data = (s: number | null) => (s ? diaEmLisboa(s * 1000) : '');
  const linhas = [
    [
      'Nome',
      'Email',
      'Código',
      'Cortes',
      'Primeiro',
      'Último',
      'Carimbos',
      'Objectivo',
      'Recompensas por usar',
      'Aniversário',
      'Desde',
    ],
    ...r.results.map((l) => [
      l.nome,
      l.email,
      l.codigo,
      l.cortes,
      data(l.primeiro),
      data(l.ultimo),
      l.carimbos,
      l.objectivo ?? '',
      l.por_usar,
      l.aniversario ?? '',
      data(l.criado_em),
    ]),
  ];
  return c.body('﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n'), 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="clientes.csv"',
  });
});

/**
 * Apaga os clientes de exemplo, com os cartões e os carimbos deles, e a equipa
 * de exemplo. Ficam o cliente e a pessoa da porta da revisão das lojas
 * (REVISAO_CLIENTE, REVISAO_PESSOA): a Apple e a Google entram por eles.
 */
rotasDosClientes.delete('/clientes/exemplos', async (c) => {
  const db = c.env.DB;
  const guardarCliente = c.env.REVISAO_CLIENTE ?? '';
  const guardarPessoa = Number(c.env.REVISAO_PESSOA ?? 0);
  // O «changes» do D1 conta as linhas em cascata (cartões, carimbos): conta-se antes.
  const n = await db
    .prepare('SELECT count(*) AS n FROM clientes WHERE exemplo = 1 AND codigo IS NOT ?')
    .bind(guardarCliente)
    .first<{ n: number }>();
  await db.batch([
    db.prepare('DELETE FROM clientes WHERE exemplo = 1 AND codigo IS NOT ?').bind(guardarCliente),
    db
      .prepare("DELETE FROM equipa WHERE email IS NULL AND nome LIKE '% (exemplo)' AND id IS NOT ?")
      .bind(guardarPessoa),
    registar(c, 'clientes.exemplos_apagados'),
  ]);
  return c.json({ apagados: n?.n ?? 0 });
});
