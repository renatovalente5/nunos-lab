/**
 * As métricas da fidelidade (backoffice › Métricas): um período (por omissão os
 * últimos 30 dias), uma casa ou todas, e a comparação com o período anterior.
 * As contas por cliente fazem-se aqui em JavaScript: são centenas de linhas.
 */
import { Hono } from 'hono';
import {
  diaDaSemana,
  diaEmLisboa,
  diasEntre,
  eDiaValido,
  somarDias,
  type Metricas,
} from '@nunos-lab/dominio';
import type { Ambiente } from '../ambiente.ts';
import { emRisco } from '../balcao/rotas.ts';
import { horaEmLisboa, inicioDoDia } from '../programa.ts';
import { agora } from '../util.ts';

export const rotasDasMetricas = new Hono<Ambiente>();

rotasDasMetricas.get('/metricas', async (c) => {
  const hoje = diaEmLisboa();
  const ateQ = c.req.query('ate');
  const deQ = c.req.query('de');
  const ate = eDiaValido(ateQ) && ateQ <= hoje ? ateQ : hoje;
  const de = eDiaValido(deQ) && deQ <= ate && diasEntre(deQ, ate) < 400 ? deQ : somarDias(ate, -29);
  const dias = diasEntre(de, ate) + 1;
  const antesDe = somarDias(de, -dias);
  const antesAte = somarDias(de, -1);
  const lojaId = Number(c.req.query('lojaId')) || null;
  const casa = lojaId ? 'AND x.loja_id = ?' : '';
  const l = lojaId ? [lojaId] : [];
  const db = c.env.DB;
  const t = agora();

  const NOVOS = `SELECT count(DISTINCT p.cliente_id) AS n FROM (SELECT x.cliente_id, min(x.dia) AS primeiro FROM carimbos x WHERE x.anulado_em IS NULL GROUP BY x.cliente_id) p
    JOIN carimbos x ON x.cliente_id = p.cliente_id AND x.dia = p.primeiro AND x.anulado_em IS NULL
    WHERE p.primeiro BETWEEN ? AND ? ${casa}`;
  const ULTIMA_CASA = `(SELECT loja_id FROM carimbos y WHERE y.cartao_id = c.id AND y.anulado_em IS NULL ORDER BY y.id DESC LIMIT 1)`;

  const r = await db.batch([
    // 0 carimbos no período · 1 no anterior
    db
      .prepare(
        `SELECT count(*) AS n FROM carimbos x WHERE x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL ${casa}`,
      )
      .bind(de, ate, ...l),
    db
      .prepare(
        `SELECT count(*) AS n FROM carimbos x WHERE x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL ${casa}`,
      )
      .bind(antesDe, antesAte, ...l),
    // 2 novos · 3 novos antes · 4 activos no período
    db.prepare(NOVOS).bind(de, ate, ...l),
    db.prepare(NOVOS).bind(antesDe, antesAte, ...l),
    db
      .prepare(
        `SELECT count(DISTINCT x.cliente_id) AS n FROM carimbos x WHERE x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL ${casa}`,
      )
      .bind(de, ate, ...l),
    // 5 recompensas ganhas · 6 usadas · 7 por usar
    db
      .prepare(
        `SELECT count(*) AS n FROM cartoes c WHERE c.completo_em >= ? AND c.completo_em < ? ${lojaId ? `AND ${ULTIMA_CASA} = ?` : ''}`,
      )
      .bind(inicioDoDia(de), inicioDoDia(somarDias(ate, 1)), ...l),
    db
      .prepare(
        `SELECT count(*) AS n FROM cartoes c WHERE c.usado_em >= ? AND c.usado_em < ? ${lojaId ? 'AND c.usado_loja_id = ?' : ''}`,
      )
      .bind(inicioDoDia(de), inicioDoDia(somarDias(ate, 1)), ...l),
    db.prepare(
      'SELECT count(*) AS n FROM cartoes c WHERE c.completo_em IS NOT NULL AND c.usado_em IS NULL',
    ),
    // 8 anulados, repetidos, sem leitura, receita
    db
      .prepare(
        `SELECT sum(x.anulado_em IS NOT NULL) AS anulados, sum(x.repetido = 1 AND x.anulado_em IS NULL) AS repetidos,
           sum(x.sem_leitura = 1 AND x.anulado_em IS NULL) AS sem_leitura,
           sum(CASE WHEN x.anulado_em IS NULL THEN s.preco END) AS receita,
           sum(x.anulado_em IS NULL AND (s.preco IS NULL)) AS sem_preco
         FROM carimbos x LEFT JOIN servicos s ON s.id = x.servico_id WHERE x.dia BETWEEN ? AND ? ${casa}`,
      )
      .bind(de, ate, ...l),
    // 9 por dia
    db
      .prepare(
        `SELECT x.dia, count(*) AS n FROM carimbos x WHERE x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL ${casa} GROUP BY x.dia`,
      )
      .bind(de, ate, ...l),
    // 10 por casa (período, clientes, anterior)
    db
      .prepare(
        `SELECT lj.id, lj.nome,
           (SELECT count(*) FROM carimbos x WHERE x.loja_id = lj.id AND x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL) AS n,
           (SELECT count(DISTINCT x.cliente_id) FROM carimbos x WHERE x.loja_id = lj.id AND x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL) AS clientes,
           (SELECT count(*) FROM carimbos x WHERE x.loja_id = lj.id AND x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL) AS anterior
         FROM lojas lj ORDER BY lj.ordem, lj.id`,
      )
      .bind(de, ate, de, ate, antesDe, antesAte),
    // 11 por pessoa
    db
      .prepare(
        `SELECT e.id, e.nome, lj.nome AS loja,
           sum(x.id IS NOT NULL AND x.anulado_em IS NULL) AS n,
           sum(x.anulado_em IS NOT NULL) AS anulados,
           sum(x.repetido = 1 AND x.anulado_em IS NULL) AS repetidos,
           sum(x.sem_leitura = 1 AND x.anulado_em IS NULL) AS sem_leitura,
           (SELECT count(*) FROM cartoes c WHERE c.usado_por = e.id AND c.usado_em >= ? AND c.usado_em < ?) AS recompensas
         FROM equipa e LEFT JOIN lojas lj ON lj.id = e.loja_id
         LEFT JOIN carimbos x ON x.pessoa_id = e.id AND x.dia BETWEEN ? AND ? ${casa}
         WHERE e.removido_em IS NULL AND e.papel != 'parceiro' GROUP BY e.id ORDER BY n DESC, e.nome`,
      )
      .bind(inicioDoDia(de), inicioDoDia(somarDias(ate, 1)), de, ate, ...l),
    // 12 os instantes, para o mapa de calor
    db
      .prepare(
        `SELECT x.dia, x.criado_em FROM carimbos x WHERE x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL ${casa} LIMIT 50000`,
      )
      .bind(de, ate, ...l),
    // 13 serviços
    db
      .prepare(
        `SELECT s.id, coalesce(s.nome, 'Sem serviço') AS nome, count(*) AS n, sum(s.preco) AS receita
         FROM carimbos x LEFT JOIN servicos s ON s.id = x.servico_id
         WHERE x.dia BETWEEN ? AND ? AND x.anulado_em IS NULL ${casa} GROUP BY s.id ORDER BY n DESC`,
      )
      .bind(de, ate, ...l),
    // 14 por cliente (toda a história), para activos, frequência, risco, distribuição, várias casas
    db.prepare(
      `SELECT x.cliente_id, k.nome, count(*) AS n, min(x.criado_em) AS primeiro, max(x.criado_em) AS ultimo,
           count(DISTINCT x.loja_id) AS lojas
         FROM carimbos x JOIN clientes k ON k.id = x.cliente_id
         WHERE x.anulado_em IS NULL AND k.apagado_em IS NULL GROUP BY x.cliente_id`,
    ),
    // 15 a segunda visita de cada cliente (o retorno)
    db.prepare(
      `SELECT cliente_id, min(CASE WHEN rn = 1 THEN criado_em END) AS primeiro, min(CASE WHEN rn = 2 THEN criado_em END) AS segundo
       FROM (SELECT cliente_id, criado_em, row_number() OVER (PARTITION BY cliente_id ORDER BY criado_em) AS rn
             FROM carimbos WHERE anulado_em IS NULL) WHERE rn <= 2 GROUP BY cliente_id`,
    ),
    // 16 os meses em que cada cliente veio (as coortes)
    db.prepare(
      `SELECT cliente_id, substr(dia, 1, 7) AS mes FROM carimbos WHERE anulado_em IS NULL GROUP BY cliente_id, mes`,
    ),
    // 17 validações no período · 18 no anterior · 19 clientes únicos · 20 clientes com parcerias (sempre)
    db
      .prepare(
        `SELECT count(*) AS n FROM vales v JOIN clientes k ON k.id = v.cliente_id WHERE v.dia BETWEEN ? AND ? AND v.anulado_em IS NULL ${lojaId ? 'AND k.loja_id = ?' : ''}`,
      )
      .bind(de, ate, ...l),
    db
      .prepare(
        `SELECT count(*) AS n FROM vales v JOIN clientes k ON k.id = v.cliente_id WHERE v.dia BETWEEN ? AND ? AND v.anulado_em IS NULL ${lojaId ? 'AND k.loja_id = ?' : ''}`,
      )
      .bind(antesDe, antesAte, ...l),
    db
      .prepare(
        `SELECT count(DISTINCT v.cliente_id) AS n FROM vales v JOIN clientes k ON k.id = v.cliente_id WHERE v.dia BETWEEN ? AND ? AND v.anulado_em IS NULL ${lojaId ? 'AND k.loja_id = ?' : ''}`,
      )
      .bind(de, ate, ...l),
    db.prepare(
      'SELECT count(DISTINCT v.cliente_id) AS n FROM vales v JOIN clientes k ON k.id = v.cliente_id WHERE v.anulado_em IS NULL AND k.apagado_em IS NULL',
    ),
    // 21 por parceiro · 22 por promoção · 23 pela casa do cliente
    db
      .prepare(
        `SELECT pa.id, pa.nome,
           (SELECT count(*) FROM vales v JOIN clientes k ON k.id = v.cliente_id WHERE v.parceiro_id = pa.id AND v.dia BETWEEN ?1 AND ?2 AND v.anulado_em IS NULL ${lojaId ? 'AND k.loja_id = ?5' : ''}) AS n,
           (SELECT count(DISTINCT v.cliente_id) FROM vales v JOIN clientes k ON k.id = v.cliente_id WHERE v.parceiro_id = pa.id AND v.dia BETWEEN ?1 AND ?2 AND v.anulado_em IS NULL ${lojaId ? 'AND k.loja_id = ?5' : ''}) AS clientes,
           (SELECT count(*) FROM vales v JOIN clientes k ON k.id = v.cliente_id WHERE v.parceiro_id = pa.id AND v.dia BETWEEN ?3 AND ?4 AND v.anulado_em IS NULL ${lojaId ? 'AND k.loja_id = ?5' : ''}) AS anterior
         FROM parceiros pa WHERE pa.activo = 1 ORDER BY n DESC, pa.ordem, pa.nome`,
      )
      .bind(de, ate, antesDe, antesAte, ...l),
    db
      .prepare(
        `SELECT p.id, pa.nome AS parceiro, p.destaque, p.titulo, p.limite_total AS limiteTotal,
           (SELECT count(*) FROM vales v JOIN clientes k ON k.id = v.cliente_id WHERE v.promocao_id = p.id AND v.dia BETWEEN ?1 AND ?2 AND v.anulado_em IS NULL ${lojaId ? 'AND k.loja_id = ?3' : ''}) AS n,
           (SELECT count(*) FROM vales v WHERE v.promocao_id = p.id AND v.anulado_em IS NULL) AS total
         FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id WHERE p.validar = 1
         ORDER BY n DESC, total DESC, pa.nome LIMIT 40`,
      )
      .bind(de, ate, ...l),
    db
      .prepare(
        `SELECT lj.id, lj.nome,
           (SELECT count(*) FROM vales v JOIN clientes k ON k.id = v.cliente_id WHERE k.loja_id = lj.id AND v.dia BETWEEN ? AND ? AND v.anulado_em IS NULL) AS n
         FROM lojas lj ORDER BY lj.ordem, lj.id`,
      )
      .bind(de, ate),
    // 24 contas
    db.prepare(
      `SELECT count(*) AS total,
         sum(EXISTS (SELECT 1 FROM identidades i WHERE i.cliente_id = k.id AND i.tipo = 'apple')) AS apple,
         sum(EXISTS (SELECT 1 FROM identidades i WHERE i.cliente_id = k.id AND i.tipo = 'google')) AS google,
         sum(EXISTS (SELECT 1 FROM identidades i WHERE i.cliente_id = k.id AND i.tipo = 'email' AND i.dona = 1)) AS email,
         sum(NOT EXISTS (SELECT 1 FROM identidades i WHERE i.cliente_id = k.id AND (i.tipo != 'email' OR i.dona = 1))) AS so_balcao
       FROM clientes k WHERE k.apagado_em IS NULL`,
    ),
  ]);
  const n = (i: number) => Number((r[i]!.results[0] as { n: number | null }).n ?? 0);

  // Por dia, com os dias a zero.
  const porDiaMapa = new Map(
    (r[9]!.results as { dia: string; n: number }[]).map((x) => [x.dia, x.n]),
  );
  const porDia: Metricas['porDia'] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1))
    porDia.push({ dia: d, n: porDiaMapa.get(d) ?? 0 });

  // O mapa de calor: dia da semana × hora, em Lisboa.
  const mapaDeCalor = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const x of r[12]!.results as { dia: string; criado_em: number }[])
    mapaDeCalor[diaDaSemana(x.dia)]![horaEmLisboa(x.criado_em)]!++;

  // Os clientes.
  type PorCliente = {
    cliente_id: number;
    nome: string;
    n: number;
    primeiro: number;
    ultimo: number;
    lojas: number;
  };
  const porCliente = r[14]!.results as PorCliente[];
  const activos = (dias: number) => porCliente.filter((k) => k.ultimo > t - dias * 86400).length;
  const comVarias = porCliente.filter((k) => k.n >= 2);
  const frequencia =
    comVarias.length > 0
      ? Math.round(
          comVarias.reduce((s, k) => s + (k.ultimo - k.primeiro) / (k.n - 1), 0) /
            comVarias.length /
            86400,
        )
      : null;
  type Retorno = { cliente_id: number; primeiro: number; segundo: number | null };
  const elegiveis = (r[15]!.results as Retorno[]).filter(
    (k) => k.primeiro < t - 60 * 86400 && k.primeiro > t - 120 * 86400,
  );
  const retorno =
    elegiveis.length >= 5
      ? elegiveis.filter((k) => k.segundo !== null && k.segundo - k.primeiro <= 60 * 86400).length /
        elegiveis.length
      : null;
  const faixas: [string, (n: number) => boolean][] = [
    ['1', (x) => x === 1],
    ['2–5', (x) => x >= 2 && x <= 5],
    ['6–10', (x) => x >= 6 && x <= 10],
    ['11+', (x) => x >= 11],
  ];
  const top = [...porCliente]
    .sort((a, b) => b.n - a.n || b.ultimo - a.ultimo)
    .slice(0, 10)
    .map((k) => ({ id: k.cliente_id, nome: k.nome, cortes: k.n, ultimo: k.ultimo }));

  // As coortes dos últimos 12 meses: quem entrou em cada mês, e em quantos dos meses seguintes voltou.
  type Mes = { cliente_id: number; mes: string };
  const mesesPorCliente = new Map<number, string[]>();
  for (const m of r[16]!.results as Mes[]) {
    const lista = mesesPorCliente.get(m.cliente_id) ?? [];
    lista.push(m.mes);
    mesesPorCliente.set(m.cliente_id, lista);
  }
  // Um mês é «AAAA-MM»; somar meses faz-se no calendário, não em dias.
  const mesMais = (mes: string, n: number) => {
    const [a, m] = mes.split('-').map(Number) as [number, number];
    return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
  };
  const esteMes = hoje.slice(0, 7);
  const coortes: Metricas['coortes'] = [];
  for (let i = 11; i >= 0; i--) {
    const mes = mesMais(esteMes, -i);
    const entraram = [...mesesPorCliente.values()].filter((ms) => [...ms].sort()[0] === mes);
    const voltaram: number[] = [];
    for (let k = 1; k <= 6; k++) {
      const seguinte = mesMais(mes, k);
      if (seguinte > esteMes) break;
      voltaram.push(entraram.filter((ms) => ms.includes(seguinte)).length);
    }
    coortes.push({ mes, clientes: entraram.length, voltaram });
  }

  const extras = r[8]!.results[0] as {
    anulados: number | null;
    repetidos: number | null;
    sem_leitura: number | null;
    receita: number | null;
    sem_preco: number | null;
  };
  const contas = r[24]!.results[0] as {
    total: number;
    apple: number | null;
    google: number | null;
    email: number | null;
    so_balcao: number | null;
  };
  const m: Metricas = {
    de,
    ate,
    dias,
    lojaId,
    totais: {
      carimbos: n(0),
      carimbosAnterior: n(1),
      clientesNovos: n(2),
      clientesNovosAnterior: n(3),
      clientesActivos: n(4),
      recompensasGanhas: n(5),
      recompensasUsadas: n(6),
      recompensasPorUsar: n(7),
      anulados: extras.anulados ?? 0,
      repetidos: extras.repetidos ?? 0,
      semLeitura: extras.sem_leitura ?? 0,
      receita: extras.receita !== null && (extras.sem_preco ?? 0) === 0 ? extras.receita : null,
    },
    porDia,
    porLoja: r[10]!.results as Metricas['porLoja'],
    porPessoa: (
      r[11]!.results as (Omit<Metricas['porPessoa'][number], 'semLeitura'> & {
        sem_leitura: number;
      })[]
    ).map((p) => ({
      id: p.id,
      nome: p.nome,
      loja: p.loja,
      n: p.n ?? 0,
      anulados: p.anulados ?? 0,
      repetidos: p.repetidos ?? 0,
      semLeitura: p.sem_leitura ?? 0,
      recompensas: p.recompensas ?? 0,
    })),
    mapaDeCalor,
    servicos: r[13]!.results as Metricas['servicos'],
    clientes: {
      total: contas.total,
      activos30: activos(30),
      activos90: activos(90),
      activos365: activos(365),
      frequencia,
      retorno,
      emRisco: emRisco(porCliente, t),
      perdidos: porCliente.filter((k) => k.ultimo <= t - 180 * 86400).length,
      variasCasas: porCliente.filter((k) => k.lojas >= 2).length,
      distribuicao: faixas.map(([faixa, cabe]) => ({
        faixa,
        n: porCliente.filter((k) => cabe(k.n)).length,
      })),
      top,
    },
    coortes,
    contas: {
      total: contas.total,
      apple: contas.apple ?? 0,
      google: contas.google ?? 0,
      email: contas.email ?? 0,
      soBalcao: contas.so_balcao ?? 0,
    },
    parcerias: {
      validacoes: n(17),
      validacoesAnterior: n(18),
      clientesUnicos: n(19),
      clientesComParcerias: n(20),
      porParceiro: r[21]!.results as Metricas['parcerias']['porParceiro'],
      porPromocao: r[22]!.results as Metricas['parcerias']['porPromocao'],
      semValidacoes: (r[21]!.results as Metricas['parcerias']['porParceiro'])
        .filter((x) => x.n === 0)
        .map((x) => ({ id: x.id, nome: x.nome })),
      porCasa: r[23]!.results as Metricas['parcerias']['porCasa'],
    },
  };
  return c.json(m);
});
