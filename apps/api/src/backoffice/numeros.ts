import { Hono } from 'hono';
import {
  DIAS_A_ACABAR,
  diaEmLisboa,
  diasEntre,
  estadoDaPromocao,
  somarDias,
  type EntradaDoRegisto,
  type Resumo,
} from '@nunos-lab/dominio';
import type { Ambiente } from '../ambiente.ts';

export const rotasDosNumeros = new Hono<Ambiente>();

const CONTACTOS = new Set(['mapa', 'ligar', 'instagram', 'site']);

/**
 * O resumo do backoffice: o que está na app, o que precisa de atenção, e as
 * contagens dos últimos N dias (7, 30 ou 90), até hoje inclusive.
 */
rotasDosNumeros.get('/resumo', async (c) => {
  const dias = [7, 30, 90].includes(Number(c.req.query('dias'))) ? Number(c.req.query('dias')) : 30;
  const hoje = diaEmLisboa();
  const desde = somarDias(hoje, -(dias - 1));
  const db = c.env.DB;
  const [pars, proms, abrir, porRef, lojas] = await db.batch([
    db.prepare('SELECT id, nome, activo, exemplo FROM parceiros'),
    db.prepare('SELECT id, parceiro_id, destaque, titulo, inicio, fim, activa FROM promocoes'),
    db.prepare("SELECT dia, n FROM contagens WHERE tipo = 'abrir' AND dia >= ?").bind(desde),
    db
      .prepare(
        `SELECT tipo, ref, sum(n) AS n FROM contagens
         WHERE dia >= ? AND tipo IN ('parceiro', 'mapa', 'ligar', 'instagram', 'site', 'marcar')
         GROUP BY tipo, ref`,
      )
      .bind(desde),
    db.prepare('SELECT id, nome FROM lojas ORDER BY ordem, id'),
  ]);
  type P = { id: number; nome: string; activo: number; exemplo: number };
  type Pr = {
    id: number;
    parceiro_id: number;
    destaque: string;
    titulo: string;
    inicio: string | null;
    fim: string | null;
    activa: number;
  };
  const parceiros = pars!.results as P[];
  const nomes = new Map(parceiros.map((p) => [p.id, p.nome]));
  const activos = new Map(parceiros.map((p) => [p.id, p.activo === 1]));
  const contas = { naApp: 0, agendadas: 0, terminadas: 0, pausadas: 0 };
  const comPromocaoNaApp = new Set<number>();
  const aAcabar: Resumo['aAcabar'] = [];
  for (const p of proms!.results as Pr[]) {
    const estado = estadoDaPromocao({ activa: p.activa === 1, inicio: p.inicio, fim: p.fim }, hoje);
    if (estado === 'activa' && activos.get(p.parceiro_id)) {
      contas.naApp++;
      comPromocaoNaApp.add(p.parceiro_id);
      if (p.fim && diasEntre(hoje, p.fim) <= DIAS_A_ACABAR)
        aAcabar.push({
          id: p.id,
          destaque: p.destaque,
          titulo: p.titulo,
          parceiro: nomes.get(p.parceiro_id) ?? '',
          fim: p.fim,
        });
    } else if (estado === 'agendada') contas.agendadas++;
    else if (estado === 'terminada') contas.terminadas++;
    else if (estado === 'pausada') contas.pausadas++;
  }
  aAcabar.sort((a, b) => a.fim.localeCompare(b.fim));
  const semPromocoes = parceiros
    .filter((p) => p.activo === 1 && !comPromocaoNaApp.has(p.id))
    .map((p) => ({ id: p.id, nome: p.nome }));

  const porDia = new Map((abrir!.results as { dia: string; n: number }[]).map((l) => [l.dia, l.n]));
  const aberturas = Array.from({ length: dias }, (_, i) => {
    const dia = somarDias(desde, i);
    return { dia, n: porDia.get(dia) ?? 0 };
  });

  const vistas = new Map<number, { vistas: number; contactos: number }>();
  const marcacoesPorLoja = new Map<number, number>();
  const totais = {
    aberturas: aberturas.reduce((s, d) => s + d.n, 0),
    parceiros: 0,
    contactos: 0,
    marcacoes: 0,
  };
  for (const l of porRef!.results as { tipo: string; ref: number; n: number }[]) {
    if (l.tipo === 'marcar') {
      marcacoesPorLoja.set(l.ref, (marcacoesPorLoja.get(l.ref) ?? 0) + l.n);
      totais.marcacoes += l.n;
      continue;
    }
    if (!nomes.has(l.ref)) continue;
    const v = vistas.get(l.ref) ?? { vistas: 0, contactos: 0 };
    if (l.tipo === 'parceiro') {
      v.vistas += l.n;
      totais.parceiros += l.n;
    } else if (CONTACTOS.has(l.tipo)) {
      v.contactos += l.n;
      totais.contactos += l.n;
    }
    vistas.set(l.ref, v);
  }
  const maisVistos = [...vistas.entries()]
    .map(([id, v]) => ({ id, nome: nomes.get(id) ?? '', ...v }))
    .sort((a, b) => b.vistas - a.vistas || b.contactos - a.contactos)
    .slice(0, 8);

  const resumo: Resumo = {
    hoje,
    dias,
    parceiros: {
      naApp: comPromocaoNaApp.size,
      pausados: parceiros.filter((p) => p.activo === 0).length,
      semPromocoes: semPromocoes.length,
      exemplos: parceiros.filter((p) => p.exemplo === 1).length,
    },
    promocoes: contas,
    aAcabar,
    semPromocoes,
    aberturas,
    totais,
    maisVistos,
    marcacoes: (lojas!.results as { id: number; nome: string }[]).map((l) => ({
      id: l.id,
      nome: l.nome,
      n: marcacoesPorLoja.get(l.id) ?? 0,
    })),
  };
  return c.json(resumo);
});

/** O registo, do mais recente para trás, 50 de cada vez (?antes=<id>). */
rotasDosNumeros.get('/registo', async (c) => {
  const antes = Number(c.req.query('antes') ?? 0);
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.quando, a.nome AS quem, r.accao, r.alvo FROM registo r LEFT JOIN admins a ON a.id = r.admin_id
     WHERE (?1 = 0 OR r.id < ?1) ORDER BY r.id DESC LIMIT 50`,
  )
    .bind(Number.isInteger(antes) && antes > 0 ? antes : 0)
    .all<EntradaDoRegisto>();
  return c.json(results);
});
