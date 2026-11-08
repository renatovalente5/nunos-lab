/** Os clientes no backoffice: a lista, a ficha, editar, apagar, anular um carimbo, o CSV, e apagar os de exemplo. */
import { Hono } from 'hono';
import { z } from 'zod';
import {
  DIAS_PARA_A_PRENDA,
  LIMITES_DO_PROGRAMA,
  MESES,
  MESES_EN,
  diaEmLisboa,
  eAniversarioValido,
  normalizarCodigo,
  normalizarEmail,
  textoDeBusca,
  type ClienteDoBackoffice,
  type FichaDoCliente,
  type TipoDeEntrada,
} from '@nunos-lab/dominio';
import type { Ambiente, C } from '../ambiente.ts';
import { emRisco } from '../balcao/rotas.ts';
import { anularCarimbo } from '../carimbos.ts';
import { apagarConta } from '../cliente/apagar.ts';
import { DIA, agora, corpo, idDaMorada, recusar, registar, traduzirErroDaBase } from '../util.ts';
import { nomeLimpo } from '../nomes.ts';
import { tocarPasse } from '../wallet/servico.ts';

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
  // O D1 recusa padrões LIKE com mais de 50 caracteres: um nome tem no máximo 40.
  const q = (c.req.query('q') ?? '').trim().slice(0, 40);
  const estado = c.req.query('estado') ?? 'todos';
  const codigo = normalizarCodigo(q);
  const lojaId = Number(c.req.query('lojaId')) || null;
  const padrao = `%${q.replace(/[%_]/g, '')}%`;
  const busca = `%${textoDeBusca(q.replace(/[%_]/g, ''))}%`;
  const r = await c.env.DB.prepare(
    `${LISTA} WHERE k.apagado_em IS NULL
     ${q ? 'AND (k.nome LIKE ? OR k.busca LIKE ? OR k.email LIKE ? OR k.codigo LIKE ?)' : ''}
     ${lojaId ? 'AND (k.loja_id = ? OR EXISTS (SELECT 1 FROM carimbos x WHERE x.cliente_id = k.id AND x.loja_id = ?))' : ''}
     ORDER BY ultimo DESC NULLS LAST, k.criado_em DESC LIMIT 5000`,
  )
    .bind(
      ...(q ? [padrao, busca, padrao, codigo ? `${codigo}%` : ''] : []),
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

async function lerFicha(c: C, id: number): Promise<FichaDoCliente> {
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
        `SELECT x.id, x.criado_em AS quando, l.nome AS loja, e.nome AS pessoa, c.numero,
           x.anulado_em, a.nome AS anulado_por, x.repetido, x.sem_leitura
         FROM carimbos x JOIN cartoes c ON c.id = x.cartao_id
         LEFT JOIN lojas l ON l.id = x.loja_id LEFT JOIN equipa e ON e.id = x.pessoa_id
         LEFT JOIN equipa a ON a.id = x.anulado_por
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
      cartaoNumero: x.numero,
      anuladoEm: x.anulado_em,
      anuladoPor: x.anulado_por,
      repetido: x.repetido === 1,
      semLeitura: x.sem_leitura === 1,
    })),
  };
  return ficha;
}

rotasDosClientes.get('/clientes/:id', async (c) => c.json(await lerFicha(c, idDaMorada(c))));

const ClientePedido = z.object({
  nome: nomeLimpo(LIMITES_DO_PROGRAMA.nomeDoCliente).optional(),
  /** O email dado ao balcão (null: tirar): quem o provar na app fica com este cartão. */
  email: z.string().trim().max(254).nullable().optional(),
  aniversario: z
    .string()
    .nullable()
    .refine((v) => v === null || eAniversarioValido(v))
    .optional(),
  lojaId: z.number().int().positive().nullable().optional(),
});

/** Corrigir um cliente: um nome mal escrito ao balcão, o email de quem veio sem app, a data, a casa. */
rotasDosClientes.patch('/clientes/:id', async (c) => {
  const id = idDaMorada(c);
  const p = await corpo(c, ClientePedido);
  const db = c.env.DB;
  const cliente = await db
    .prepare('SELECT nome, aniversario FROM clientes WHERE id = ? AND apagado_em IS NULL')
    .bind(id)
    .first<{ nome: string; aniversario: string | null }>();
  if (!cliente) recusar(404, 'nao_existe');
  if (p.lojaId && !(await db.prepare('SELECT 1 FROM lojas WHERE id = ?').bind(p.lojaId).first()))
    recusar(400, 'referencia');
  const email = p.email ? normalizarEmail(p.email) : p.email ? null : p.email;
  if (p.email && !email) recusar(400, 'invalido');
  const partes: string[] = [];
  const valores: (string | number | null)[] = [];
  const instrucoes: D1PreparedStatement[] = [];
  const mudou: string[] = [];
  if (p.nome !== undefined) {
    partes.push('nome = ?', 'busca = ?');
    valores.push(p.nome, textoDeBusca(p.nome));
    mudou.push('nome');
  }
  if (email !== undefined) {
    if (email) {
      // Outro cliente já entra com este email: não se juntam contas por aqui.
      const outro = await db
        .prepare(
          `SELECT 1 FROM identidades i JOIN clientes k ON k.id = i.cliente_id
           WHERE i.email = ? AND i.cliente_id != ? AND k.apagado_em IS NULL LIMIT 1`,
        )
        .bind(email, id)
        .first();
      if (outro) recusar(409, 'email_ja_tem_cartao');
      instrucoes.push(
        db.prepare("DELETE FROM identidades WHERE cliente_id = ? AND tipo = 'email'").bind(id),
        db
          .prepare(
            "INSERT INTO identidades (cliente_id, tipo, sujeito, email, dona) VALUES (?, 'email', ?, ?, 0)",
          )
          .bind(id, email, email),
      );
      partes.push('email = ?');
      valores.push(email);
    } else {
      instrucoes.push(
        db.prepare("DELETE FROM identidades WHERE cliente_id = ? AND tipo = 'email'").bind(id),
      );
      partes.push('email = NULL');
    }
    mudou.push('email');
  }
  if (p.aniversario !== undefined && p.aniversario !== cliente.aniversario) {
    // Dada pelo Nuno, a data conta logo: a espera dos 30 dias é para quem a muda na app.
    partes.push('aniversario = ?', 'aniversario_desde = ?');
    valores.push(p.aniversario, p.aniversario === null ? null : agora() - DIAS_PARA_A_PRENDA * DIA);
    mudou.push('aniversário');
  }
  if (p.lojaId !== undefined) {
    partes.push('loja_id = ?');
    valores.push(p.lojaId);
    mudou.push('casa');
  }
  if (!mudou.length) recusar(400, 'nada_a_mudar');
  if (partes.length)
    instrucoes.push(
      db.prepare(`UPDATE clientes SET ${partes.join(', ')} WHERE id = ?`).bind(...valores, id),
    );
  instrucoes.push(
    registar(c, 'cliente.alterado', `${p.nome ?? cliente.nome} · ${mudou.join(', ')}`),
  );
  try {
    await db.batch(instrucoes);
  } catch (e) {
    traduzirErroDaBase(e);
  }
  if (p.nome !== undefined) tocarPasse(c, id);
  return c.json(await lerFicha(c, id));
});

/** Anular um carimbo de qualquer dia (um engano de ontem): a mesma regra da Balcão, pelo dono. */
rotasDosClientes.post('/carimbos/:id/anular', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  const { clienteId, criadoEm, instrucoes } = await anularCarimbo(db, id, {
    pessoaId: null,
    dono: true,
  });
  const cliente = await db
    .prepare('SELECT nome FROM clientes WHERE id = ?')
    .bind(clienteId)
    .first<{ nome: string }>();
  await db.batch([
    ...instrucoes,
    registar(c, 'carimbo.anulado', `${cliente?.nome ?? ''} · ${diaEmLisboa(criadoEm * 1000)}`),
  ]);
  tocarPasse(c, clienteId);
  return c.json(await lerFicha(c, clienteId));
});

/** A lista em CSV (Excel/Numbers): o que o Nuno quer levar para fora. */
rotasDosClientes.get('/clientes.csv', async (c) => {
  const r = await c.env.DB.prepare(
    `${LISTA} WHERE k.apagado_em IS NULL AND k.exemplo = 0 ORDER BY k.nome`,
  ).all<Linha>();
  // Uma célula que começa por = + - @ (ou tab/CR) seria uma fórmula no Excel: um apóstrofo à frente desarma-a.
  const celula = (v: unknown) => {
    const s = String(v ?? '');
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const en = c.req.query('lingua') === 'en';
  const data = (s: number | null) => (s ? diaEmLisboa(s * 1000) : '');
  // «5 de mar»: o Excel lia «03-05» como uma data (e trocava o dia e o mês).
  const aniversario = (a: string | null) => {
    if (!a) return '';
    const dia = Number(a.slice(3));
    const mes = Number(a.slice(0, 2)) - 1;
    return en ? `${dia} ${MESES_EN[mes] ?? ''}` : `${dia} de ${MESES[mes] ?? ''}`;
  };
  const linhas = [
    en
      ? [
          'Name',
          'Email',
          'Code',
          'Haircuts',
          'First',
          'Last',
          'Stamps',
          'Goal',
          'Rewards ready',
          'Birthday',
          'Since',
        ]
      : [
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
      aniversario(l.aniversario),
      data(l.criado_em),
    ]),
  ];
  return c.body('﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n'), 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${en ? 'clients' : 'clientes'}.csv"`,
  });
});

/** Apaga os clientes de exemplo, com os cartões e os carimbos deles, e a equipa de exemplo. */
rotasDosClientes.delete('/clientes/exemplos', async (c) => {
  const db = c.env.DB;
  // O «changes» do D1 conta as linhas em cascata (cartões, carimbos): conta-se antes.
  const n = await db
    .prepare('SELECT count(*) AS n FROM clientes WHERE exemplo = 1')
    .first<{ n: number }>();
  await db.batch([
    db.prepare('DELETE FROM clientes WHERE exemplo = 1'),
    db.prepare("DELETE FROM equipa WHERE email IS NULL AND nome LIKE '% (exemplo)'"),
    registar(c, 'clientes.exemplos_apagados'),
  ]);
  return c.json({ apagados: n?.n ?? 0 });
});

/** Apagar um cliente (um pedido de quem só tem cartão de balcão): a mesma limpeza da app. Depois de «/clientes/exemplos», para o «exemplos» não cair aqui. */
rotasDosClientes.delete('/clientes/:id', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  const cliente = await db
    .prepare('SELECT codigo FROM clientes WHERE id = ? AND apagado_em IS NULL')
    .bind(id)
    .first<{ codigo: string }>();
  if (!cliente) recusar(404, 'nao_existe');
  await apagarConta(c, id);
  // O histórico guarda-se 3 anos: de uma conta apagada fica o código, e não o nome.
  await db.batch([registar(c, 'cliente.apagado', cliente.codigo)]);
  return c.body(null, 204);
});
