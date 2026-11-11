/** Os clientes no backoffice: a lista, a ficha, editar, apagar, anular um carimbo, o CSV, e apagar os de exemplo. */
import { Hono } from 'hono';
import { z } from 'zod';
import {
  DIAS_DE_CLIENTE_ACTIVO,
  DIAS_PARA_A_PRENDA,
  LIMITES_DO_PROGRAMA,
  LIMITES_DO_SALDO,
  MESES,
  MESES_EN,
  diaEmLisboa,
  eAniversarioValido,
  eurosComSinal,
  normalizarCodigo,
  normalizarEmail,
  textoDeBusca,
  type ClienteDoBackoffice,
  type FichaDoCliente,
  type TipoDeEntrada,
} from '@nunos-lab/dominio';
import type { Ambiente, C } from '../ambiente.ts';
import { anularCarimbo } from '../carimbos.ts';
import {
  consultaDoSaldo,
  consultaDosMovimentos,
  movimentoPublico,
  saldoDe,
  type LinhaDoMovimento,
} from '../saldo.ts';
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
  email_oculto: number;
};

const LISTA = `SELECT k.id, k.codigo, k.nome, k.email, k.aniversario, k.loja_id, k.criado_em, k.exemplo, k.apagado_em,
    (SELECT count(*) FROM carimbos x WHERE x.cliente_id = k.id AND x.anulado_em IS NULL) AS cortes,
    (SELECT max(criado_em) FROM carimbos x WHERE x.cliente_id = k.id AND x.anulado_em IS NULL) AS ultimo,
    (SELECT min(criado_em) FROM carimbos x WHERE x.cliente_id = k.id AND x.anulado_em IS NULL) AS primeiro,
    (SELECT count(*) FROM carimbos x WHERE x.anulado_em IS NULL
       AND x.cartao_id = (SELECT id FROM cartoes c WHERE c.cliente_id = k.id ORDER BY numero DESC LIMIT 1)) AS carimbos,
    (SELECT objectivo FROM cartoes c WHERE c.cliente_id = k.id ORDER BY numero DESC LIMIT 1) AS objectivo,
    (SELECT count(*) FROM cartoes c WHERE c.cliente_id = k.id AND c.completo_em IS NOT NULL AND c.usado_em IS NULL) AS por_usar,
    (SELECT group_concat(DISTINCT tipo) FROM identidades i WHERE i.cliente_id = k.id) AS formas,
    (SELECT count(*) > 0 FROM identidades i
       WHERE i.cliente_id = k.id AND i.email LIKE '%@privaterelay.appleid.com') AS email_oculto
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
    emailOculto: l.email === null && l.email_oculto === 1,
  };
}

/**
 * A lista, com o filtro de estado calculado aqui (são contas, não milhares). Só cinco (o Renato,
 * 8 nov): todos; novos (o 1.º corte nos últimos 30 dias); activos (um corte no último ano, o mesmo
 * ano das promoções «só clientes activos»); perdidos (sem cortar há mais de um ano); sem app. Sem os
 * clientes de exemplo: em produção só existem para a revisão das lojas (a conta da Apple).
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
    `${LISTA} WHERE k.apagado_em IS NULL AND k.exemplo = 0
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
        return l.primeiro !== null && l.primeiro > t - 30 * DIA;
      case 'activos':
        return parado !== null && parado <= DIAS_DE_CLIENTE_ACTIVO * DIA;
      case 'perdidos':
        return parado !== null && parado > DIAS_DE_CLIENTE_ACTIVO * DIA;
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
  const [cliente, cartoes, carimbos, saldo, movimentos, feitos, recebido, codigoConvite] =
    await db.batch([
      db.prepare(`${LISTA} WHERE k.id = ?`).bind(id),
      db
        .prepare(
          `SELECT c.id, c.numero, c.objectivo, c.recompensa, c.recompensa_en, c.iniciado_em, c.completo_em, c.usado_em,
           l.nome AS usado_loja, e.nome AS usado_por,
           c.meio, c.meio_recompensa, c.meio_recompensa_en, c.meio_ganho_em, c.meio_usado_em,
           ml.nome AS meio_usado_loja, me.nome AS meio_usado_por,
           (SELECT count(*) FROM carimbos x WHERE x.cartao_id = c.id AND x.anulado_em IS NULL) AS carimbos
         FROM cartoes c LEFT JOIN lojas l ON l.id = c.usado_loja_id LEFT JOIN equipa e ON e.id = c.usado_por
         LEFT JOIN lojas ml ON ml.id = c.meio_usado_loja_id LEFT JOIN equipa me ON me.id = c.meio_usado_por
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
      consultaDoSaldo(db, id),
      consultaDosMovimentos(db, id, 200),
      // Quem ele convidou, e quando recebeu o prémio de cada um (o que vale: um anulado não conta).
      db
        .prepare(
          `SELECT v.convidado_id AS cliente_id, k.nome, k.apagado_em, v.criado_em, v.visitou_em, v.premio_padrinho,
           (SELECT min(m.criado_em) FROM movimentos_de_saldo m
             WHERE m.convite_id = v.id AND m.tipo = 'convite' AND m.anulado_em IS NULL) AS premio_em
         FROM convites v JOIN clientes k ON k.id = v.convidado_id
         WHERE v.padrinho_id = ? ORDER BY v.criado_em DESC, v.id DESC`,
        )
        .bind(id),
      db
        .prepare(
          `SELECT v.padrinho_id AS cliente_id, k.nome, k.apagado_em, v.criado_em
         FROM convites v JOIN clientes k ON k.id = v.padrinho_id WHERE v.convidado_id = ?`,
        )
        .bind(id),
      db.prepare('SELECT codigo_convite FROM clientes WHERE id = ?').bind(id),
    ]);
  const l = cliente!.results[0] as Linha | undefined;
  if (!l) recusar(404, 'nao_existe');
  type Cartao = {
    id: number;
    numero: number;
    objectivo: number;
    recompensa: string;
    recompensa_en: string | null;
    iniciado_em: number;
    completo_em: number | null;
    usado_em: number | null;
    usado_loja: string | null;
    usado_por: string | null;
    meio: number | null;
    meio_recompensa: string;
    meio_recompensa_en: string;
    meio_ganho_em: number | null;
    meio_usado_em: number | null;
    meio_usado_loja: string | null;
    meio_usado_por: string | null;
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
  // O saldo e os convites (10 nov 2026): aqui com os nomes inteiros e quem fez cada movimento.
  const por = recebido!.results[0] as
    { cliente_id: number; nome: string; apagado_em: number | null; criado_em: number } | undefined;
  const ficha: FichaDoCliente = {
    ...publico(l),
    saldo: {
      valor: saldoDe(saldo!),
      movimentos: (movimentos!.results as LinhaDoMovimento[]).map((m) => ({
        ...movimentoPublico(m, true),
        por: m.por,
        semLeitura: m.sem_leitura === 1,
        anuladoPor: m.anulado_por_nome,
        anuladoEm: m.anulado_em,
        quemId: m.quem_id,
        quemApagado: m.quem_apagado === 1,
      })),
      convites: (
        feitos!.results as {
          cliente_id: number;
          nome: string;
          apagado_em: number | null;
          criado_em: number;
          visitou_em: number | null;
          premio_padrinho: number;
          premio_em: number | null;
        }[]
      ).map((v) => ({
        clienteId: v.cliente_id,
        nome: v.nome,
        criadoEm: v.criado_em,
        visitouEm: v.visitou_em,
        premio: v.premio_padrinho,
        premioEm: v.premio_em,
        apagado: v.apagado_em !== null,
      })),
      convidadoPor: por
        ? {
            clienteId: por.cliente_id,
            nome: por.nome,
            criadoEm: por.criado_em,
            apagado: por.apagado_em !== null,
          }
        : null,
      codigoDoConvite:
        (codigoConvite!.results[0] as { codigo_convite: string | null } | undefined)
          ?.codigo_convite ?? null,
    },
    cartoes: (cartoes!.results as Cartao[]).map((x) => ({
      id: x.id,
      numero: x.numero,
      objectivo: x.objectivo,
      recompensa: x.recompensa,
      recompensaEn: x.recompensa_en ?? '',
      carimbos: x.carimbos,
      iniciadoEm: x.iniciado_em,
      completoEm: x.completo_em,
      usadoEm: x.usado_em,
      usadoLoja: x.usado_loja,
      usadoPor: x.usado_por,
      meio:
        x.meio === null
          ? null
          : {
              carimbos: x.meio,
              recompensa: x.meio_recompensa,
              recompensaEn: x.meio_recompensa_en,
              ganhoEm: x.meio_ganho_em,
              usadoEm: x.meio_usado_em,
              usadoLoja: x.meio_usado_loja,
              usadoPor: x.meio_usado_por,
            },
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

/**
 * Acertar o saldo (o Renato, 10 nov 2026): o Nuno dá ou tira, com uma nota que o cliente vê na carteira.
 * Tirar mais do que o saldo é recusado (como ao balcão: o saldo nunca fica negativo por um acerto).
 */
rotasDosClientes.post('/clientes/:id/saldo', async (c) => {
  const id = idDaMorada(c);
  const { valor, nota, chave } = await corpo(
    c,
    z.object({
      valor: z
        .number()
        .int()
        .min(-LIMITES_DO_SALDO.movimento.max)
        .max(LIMITES_DO_SALDO.movimento.max)
        .refine((v) => v !== 0),
      nota: z.string().trim().min(1).max(LIMITES_DO_SALDO.nota),
      // Uma por folha aberta: a resposta perdida e o clique outra vez não dão dois acertos.
      chave: z
        .string()
        .regex(/^[A-Za-z0-9_-]{8,64}$/)
        .optional(),
    }),
  );
  const db = c.env.DB;
  const existe = await db
    .prepare('SELECT nome FROM clientes WHERE id = ? AND apagado_em IS NULL')
    .bind(id)
    .first<{ nome: string }>();
  if (!existe) recusar(404, 'nao_existe');
  if (chave) {
    const repetido = await db
      .prepare('SELECT cliente_id FROM movimentos_de_saldo WHERE chave = ?')
      .bind(chave)
      .first<{ cliente_id: number }>();
    if (repetido) {
      if (repetido.cliente_id !== id) recusar(409, 'repetido');
      return c.json(await lerFicha(c, id));
    }
  }
  // O saldo decide-se no próprio INSERT (dois acertos ao mesmo tempo não o põem negativo); o histórico
  // só regista o que entrou.
  let r: D1Result;
  try {
    r = await db
      .prepare(
        `INSERT INTO movimentos_de_saldo (cliente_id, valor, tipo, admin_id, nota, chave)
         SELECT ?1, ?2, 'acerto', ?3, ?4, ?5
         WHERE ?2 > 0 OR (SELECT coalesce(sum(valor), 0) FROM movimentos_de_saldo
                          WHERE cliente_id = ?1 AND anulado_em IS NULL) + ?2 >= 0`,
      )
      .bind(id, valor, c.get('admin')?.id ?? null, nota, chave ?? null)
      .run();
  } catch (e) {
    // A mesma chave ao mesmo tempo por dois caminhos: conta uma.
    if (!String(e).includes('UNIQUE constraint failed')) throw e;
    return c.json(await lerFicha(c, id));
  }
  if (!r.meta.changes) recusar(409, 'saldo_insuficiente');
  await registar(
    c,
    'saldo.acertado',
    `${existe.nome || id} · ${eurosComSinal(valor)} · ${nota}`,
  ).run();
  return c.json(await lerFicha(c, id));
});

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
    // Em inglês com o ordinal («5th Mar»): o Excel não o lê como data, como o «5 de mar».
    const ordinal =
      dia % 100 >= 11 && dia % 100 <= 13
        ? 'th'
        : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[dia % 10] ?? 'th');
    return en ? `${dia}${ordinal} ${MESES_EN[mes] ?? ''}` : `${dia} de ${MESES[mes] ?? ''}`;
  };
  const linhas = [
    en
      ? [
          'Name',
          'Email',
          'Code',
          'Haircuts',
          'First visit',
          'Last visit',
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

/** Apagar um cliente (um pedido de quem só tem cartão de balcão): a mesma limpeza da app. */
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
