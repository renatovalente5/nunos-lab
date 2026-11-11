/**
 * O histórico de cada pessoa da equipa no backoffice (o Renato, 11 nov 2026): o que carimbou, o saldo que
 * usou, os prémios que entregou e o que anulou de outros, do mais recente para trás, às páginas. A primeira
 * página traz os números dos últimos 30 dias: os carimbos, o saldo usado, o que lhe anularam e o que fez
 * sem ler o cartão (os sinais de batota que o Nuno procura).
 */
import { Hono } from 'hono';
import type { AcontecimentoDaPessoa, HistoricoDaPessoa } from '@nunos-lab/dominio';
import type { Ambiente } from '../ambiente.ts';
import { DIA, agora, idDaMorada, pessoaDaRevisao, recusar } from '../util.ts';

export const rotasDoHistoricoDaEquipa = new Hono<Ambiente>();

const POR_PAGINA = 100;

/**
 * Tudo o que a pessoa ?1 fez, numa lista só (as mesmas colunas em todas as partes). O que anulou de outros
 * entra à hora em que anulou, com quem o tinha feito e quando; o que anulou de si mesma já se vê no que
 * fez («Anulado por …»). Quatro partes: o D1 não aceita mais de cinco num UNION (os carimbos feitos e os
 * anulados de outros vêm na mesma; os usos também).
 */
const TUDO = `
  SELECT CASE WHEN x.pessoa_id = ?1 THEN 'carimbo' ELSE 'anulou-carimbo' END AS tipo, x.id,
         CASE WHEN x.pessoa_id = ?1 THEN x.criado_em ELSE x.anulado_em END AS quando,
         x.cliente_id, x.loja_id, NULL AS valor, NULL AS recompensa, NULL AS recompensa_en,
         CASE WHEN x.pessoa_id = ?1 THEN x.sem_leitura ELSE 0 END AS sem_leitura,
         CASE WHEN x.pessoa_id = ?1 THEN x.repetido ELSE 0 END AS repetido,
         CASE WHEN x.pessoa_id = ?1 THEN x.anulado_em END AS anulado_em,
         CASE WHEN x.pessoa_id = ?1 THEN x.anulado_por END AS anulado_por,
         CASE WHEN x.pessoa_id = ?1 THEN NULL ELSE x.pessoa_id END AS de_pessoa,
         CASE WHEN x.pessoa_id = ?1 THEN NULL ELSE x.criado_em END AS de_quando
    FROM carimbos x WHERE x.pessoa_id = ?1 OR x.anulado_por = ?1
  UNION ALL
  SELECT CASE WHEN m.pessoa_id = ?1 THEN 'uso' ELSE 'anulou-uso' END, m.id,
         CASE WHEN m.pessoa_id = ?1 THEN m.criado_em ELSE m.anulado_em END,
         m.cliente_id, m.loja_id, m.valor, NULL, NULL,
         CASE WHEN m.pessoa_id = ?1 THEN m.sem_leitura ELSE 0 END, 0,
         CASE WHEN m.pessoa_id = ?1 THEN m.anulado_em END,
         CASE WHEN m.pessoa_id = ?1 THEN m.anulado_por END,
         CASE WHEN m.pessoa_id = ?1 THEN NULL ELSE m.pessoa_id END,
         CASE WHEN m.pessoa_id = ?1 THEN NULL ELSE m.criado_em END
    FROM movimentos_de_saldo m WHERE m.tipo = 'uso' AND (m.pessoa_id = ?1 OR m.anulado_por = ?1)
  UNION ALL
  SELECT 'premio', c.id, c.usado_em, c.cliente_id, c.usado_loja_id, NULL, c.recompensa, c.recompensa_en,
         0, 0, NULL, NULL, NULL, NULL
    FROM cartoes c WHERE c.usado_por = ?1 AND c.usado_em IS NOT NULL
  UNION ALL
  SELECT 'meio', c.id, c.meio_usado_em, c.cliente_id, c.meio_usado_loja_id, NULL, c.meio_recompensa,
         c.meio_recompensa_en, 0, 0, NULL, NULL, NULL, NULL
    FROM cartoes c WHERE c.meio_usado_por = ?1 AND c.meio_usado_em IS NOT NULL`;

type Linha = {
  tipo: AcontecimentoDaPessoa['tipo'];
  id: number;
  quando: number;
  cliente_id: number | null;
  valor: number | null;
  recompensa: string | null;
  recompensa_en: string | null;
  sem_leitura: number;
  repetido: number;
  anulado_em: number | null;
  de_quando: number | null;
  cliente_nome: string | null;
  cliente_apagado_em: number | null;
  loja: string | null;
  anulado_por_nome: string | null;
  de_nome: string | null;
};

type Numeros = { carimbos: number; saldo_usado: number; anulados: number; sem_leitura: number };

rotasDoHistoricoDaEquipa.get('/equipa/:id/historico', async (c) => {
  const id = idDaMorada(c);
  const db = c.env.DB;
  // A conta da revisão das lojas não está na Equipa: também não tem histórico aqui.
  if (id === pessoaDaRevisao(c.env)) recusar(404, 'nao_existe');
  const existe = await db
    .prepare('SELECT 1 FROM equipa WHERE id = ? AND removido_em IS NULL')
    .bind(id)
    .first();
  if (!existe) recusar(404, 'nao_existe');
  // A página seguinte começa depois da última linha da anterior: «quando.tipo.id».
  const antes = c.req.query('antes');
  const cursor = antes ? /^(\d{1,12})\.([a-z-]{1,20})\.(\d{1,12})$/.exec(antes) : null;
  if (antes && !cursor) recusar(400, 'invalido');
  const lista = db
    .prepare(
      `SELECT a.*, k.nome AS cliente_nome, k.apagado_em AS cliente_apagado_em, l.nome AS loja,
         ea.nome AS anulado_por_nome, ed.nome AS de_nome
       FROM (${TUDO}) a
         LEFT JOIN clientes k ON k.id = a.cliente_id
         LEFT JOIN lojas l ON l.id = a.loja_id
         LEFT JOIN equipa ea ON ea.id = a.anulado_por
         LEFT JOIN equipa ed ON ed.id = a.de_pessoa
       ${cursor ? 'WHERE (a.quando, a.tipo, a.id) < (?2, ?3, ?4)' : ''}
       ORDER BY a.quando DESC, a.tipo DESC, a.id DESC
       LIMIT ${POR_PAGINA + 1}`,
    )
    .bind(id, ...(cursor ? [Number(cursor[1]), cursor[2]!, Number(cursor[3])] : []));
  const numeros = db
    .prepare(
      `SELECT
         (SELECT count(*) FROM carimbos
            WHERE pessoa_id = ?1 AND criado_em >= ?2 AND anulado_em IS NULL) AS carimbos,
         (SELECT coalesce(-sum(valor), 0) FROM movimentos_de_saldo
            WHERE tipo = 'uso' AND pessoa_id = ?1 AND criado_em >= ?2 AND anulado_em IS NULL) AS saldo_usado,
         (SELECT count(*) FROM carimbos
            WHERE pessoa_id = ?1 AND criado_em >= ?2 AND anulado_em IS NOT NULL)
         + (SELECT count(*) FROM movimentos_de_saldo
            WHERE tipo = 'uso' AND pessoa_id = ?1 AND criado_em >= ?2 AND anulado_em IS NOT NULL) AS anulados,
         (SELECT count(*) FROM carimbos
            WHERE pessoa_id = ?1 AND criado_em >= ?2 AND anulado_em IS NULL AND sem_leitura = 1)
         + (SELECT count(*) FROM movimentos_de_saldo
            WHERE tipo = 'uso' AND pessoa_id = ?1 AND criado_em >= ?2 AND anulado_em IS NULL
              AND sem_leitura = 1) AS sem_leitura`,
    )
    .bind(id, agora() - 30 * DIA);
  const [linhas, n] = await db.batch(cursor ? [lista] : [lista, numeros]);
  const todas = linhas!.results as Linha[];
  const pagina = todas.slice(0, POR_PAGINA);
  const ultima = pagina.at(-1);
  const contas = n?.results[0] as Numeros | undefined;
  const resposta: HistoricoDaPessoa = {
    numeros: contas
      ? {
          carimbos: contas.carimbos,
          saldoUsado: contas.saldo_usado,
          anulados: contas.anulados,
          semLeitura: contas.sem_leitura,
        }
      : null,
    acontecimentos: pagina.map((l) => ({
      tipo: l.tipo,
      id: l.id,
      quando: l.quando,
      cliente:
        l.cliente_id !== null && l.cliente_nome !== null
          ? { id: l.cliente_id, nome: l.cliente_nome, apagado: l.cliente_apagado_em !== null }
          : null,
      loja: l.loja,
      valor: l.valor,
      recompensa: l.recompensa,
      recompensaEn: l.recompensa_en || null,
      semLeitura: l.sem_leitura === 1,
      repetido: l.repetido === 1,
      anulado: l.anulado_em !== null ? { em: l.anulado_em, por: l.anulado_por_nome } : null,
      de: l.de_quando !== null ? { pessoa: l.de_nome, quando: l.de_quando } : null,
    })),
    seguinte:
      todas.length > POR_PAGINA && ultima ? `${ultima.quando}.${ultima.tipo}.${ultima.id}` : null,
  };
  return c.json(resposta);
});
