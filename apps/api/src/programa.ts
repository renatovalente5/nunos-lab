/** O programa de carimbos e as leituras do cartão que a app, a Balcão e o backoffice partilham. */
import {
  carimboDoPremioAMeio,
  naLingua,
  type Lingua,
  LIMITES_DO_PROGRAMA,
  PROGRAMA_PREDEFINIDO,
  gerarCodigo,
  type CartaoDoCliente,
  type Programa,
} from '@nunos-lab/dominio';

export async function lerPrograma(db: D1Database): Promise<Programa> {
  const defs = await db
    .prepare("SELECT chave, valor FROM definicoes WHERE chave LIKE 'fid.%'")
    .all<{ chave: string; valor: string }>();
  return programaDasDefinicoes(new Map(defs.results.map((x) => [x.chave, x.valor])));
}

/** O programa a partir das definições já lidas (as chaves «fid.*»), com os valores de origem no que faltar. */
export function programaDasDefinicoes(d: Map<string, string>): Programa {
  const inteiro = (chave: string, { min, max }: { min: number; max: number }, senao: number) => {
    const n = Number(d.get(chave));
    return Number.isInteger(n) && n >= min && n <= max ? n : senao;
  };
  return {
    objectivo: inteiro(
      'fid.objectivo',
      LIMITES_DO_PROGRAMA.objectivo,
      PROGRAMA_PREDEFINIDO.objectivo,
    ),
    recompensa: d.get('fid.recompensa') ?? PROGRAMA_PREDEFINIDO.recompensa,
    porDia: inteiro('fid.por_dia', LIMITES_DO_PROGRAMA.porDia, PROGRAMA_PREDEFINIDO.porDia),
    aniversario: d.get('fid.aniversario') ?? '',
    recompensaEn: d.get('fid.recompensa_en') ?? '',
    aniversarioEn: d.get('fid.aniversario_en') ?? '',
    meioRecompensa: d.get('fid.meio_recompensa') ?? '',
    meio: inteiro('fid.meio', LIMITES_DO_PROGRAMA.meio, PROGRAMA_PREDEFINIDO.meio),
    meioRecompensaEn: d.get('fid.meio_recompensa_en') ?? '',
  };
}

export type LinhaCartao = {
  id: number;
  cliente_id: number;
  numero: number;
  objectivo: number;
  recompensa: string;
  recompensa_en: string;
  iniciado_em: number;
  completo_em: number | null;
  usado_em: number | null;
  meio: number | null;
  meio_recompensa: string;
  meio_recompensa_en: string;
  meio_ganho_em: number | null;
  meio_usado_em: number | null;
  carimbos: number;
};

export const COLUNAS_DO_CARTAO = `c.id, c.cliente_id, c.numero, c.objectivo, c.recompensa, c.recompensa_en, c.iniciado_em,
  c.completo_em, c.usado_em, c.meio, c.meio_recompensa, c.meio_recompensa_en, c.meio_ganho_em, c.meio_usado_em,
  (SELECT count(*) FROM carimbos x WHERE x.cartao_id = c.id AND x.anulado_em IS NULL) AS carimbos`;

/** O cartão em curso: o último de cada cliente (um novo nasce ao completar o anterior). */
export function consultaDoCartaoActual(db: D1Database, clienteId: number): D1PreparedStatement {
  return db
    .prepare(
      `SELECT ${COLUNAS_DO_CARTAO} FROM cartoes c WHERE c.cliente_id = ? ORDER BY c.numero DESC LIMIT 1`,
    )
    .bind(clienteId);
}

export async function cartaoActual(db: D1Database, clienteId: number): Promise<LinhaCartao | null> {
  return consultaDoCartaoActual(db, clienteId).first<LinhaCartao>();
}

export function cartaoPublico(l: LinhaCartao, lingua: Lingua = 'pt'): CartaoDoCliente {
  return {
    id: l.id,
    numero: l.numero,
    objectivo: l.objectivo,
    recompensa: naLingua(lingua, l.recompensa, l.recompensa_en),
    carimbos: l.carimbos,
    meio:
      l.meio === null
        ? null
        : {
            carimbos: l.meio,
            recompensa: naLingua(lingua, l.meio_recompensa, l.meio_recompensa_en),
            ganho: l.meio_ganho_em !== null,
            usado: l.meio_usado_em !== null,
          },
  };
}

/** A instrução que abre o cartão `numero` de um cliente, com o programa de agora. */
export function novoCartao(
  db: D1Database,
  clienteId: number,
  numero: number,
  programa: Programa,
): D1PreparedStatement {
  // O prémio a meio, se o programa o tiver, fica no cartão como o objectivo e a recompensa.
  const meio = carimboDoPremioAMeio(programa);
  return db
    .prepare(
      `INSERT INTO cartoes (cliente_id, numero, objectivo, recompensa, recompensa_en, meio, meio_recompensa, meio_recompensa_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      clienteId,
      numero,
      programa.objectivo,
      programa.recompensa,
      programa.recompensaEn ?? '',
      meio,
      meio ? programa.meioRecompensa.trim() : '',
      meio ? (programa.meioRecompensaEn ?? '').trim() : '',
    );
}

/** Os prémios a meio ganhos e por entregar, de qualquer cartão: ficam até o cliente os usar. */
export function consultaDosPremiosAMeio(db: D1Database, clienteId: number): D1PreparedStatement {
  return db
    .prepare(
      `SELECT id AS cartaoId, meio AS carimbos, meio_recompensa AS recompensa, meio_recompensa_en,
         meio_ganho_em AS ganhoEm
       FROM cartoes WHERE cliente_id = ? AND meio_ganho_em IS NOT NULL AND meio_usado_em IS NULL
       ORDER BY meio_ganho_em`,
    )
    .bind(clienteId);
}

/** As linhas de `consultaDosPremiosAMeio`, com o prémio na língua pedida. */
export function premiosAMeioDe(
  linhas: unknown[],
  lingua: Lingua,
): { cartaoId: number; carimbos: number; recompensa: string; ganhoEm: number }[] {
  return (
    linhas as {
      cartaoId: number;
      carimbos: number;
      recompensa: string;
      meio_recompensa_en: string;
      ganhoEm: number;
    }[]
  ).map(({ meio_recompensa_en, ...p }) => ({
    ...p,
    recompensa: naLingua(lingua, p.recompensa, meio_recompensa_en),
  }));
}

/** As recompensas por usar: cartões completos que ninguém entregou. */
export function consultaDasRecompensas(db: D1Database, clienteId: number): D1PreparedStatement {
  return db
    .prepare(
      `SELECT id AS cartaoId, recompensa, recompensa_en, completo_em AS ganhaEm FROM cartoes
       WHERE cliente_id = ? AND completo_em IS NOT NULL AND usado_em IS NULL ORDER BY completo_em`,
    )
    .bind(clienteId);
}

/** Um código de cartão que ainda não existe (a colisão é rara; tenta-se cinco vezes). */
export async function codigoNovo(db: D1Database): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const codigo = gerarCodigo(crypto.getRandomValues(new Uint8Array(7)));
    const existe = await db.prepare('SELECT 1 FROM clientes WHERE codigo = ?').bind(codigo).first();
    if (!existe) return codigo;
  }
  throw new Error('Não houve código livre');
}

const HORA_EM_LISBOA = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Lisbon',
  hour: '2-digit',
  hour12: false,
});

/** A hora (0–23) de um instante, em Lisboa. */
export function horaEmLisboa(unix: number): number {
  return Number(HORA_EM_LISBOA.format(new Date(unix * 1000))) % 24;
}

/** O instante (unix) em que começa um dia de Lisboa («AAAA-MM-DD»). */
export function inicioDoDia(dia: string): number {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  // Em Lisboa o desvio é 0 ou +1 h. À meia-noite UTC desse dia, a hora local diz
  // quantas horas o dia já leva — nos dias da mudança de hora, o desvio ao
  // meio-dia (que se usava) não é o da meia-noite.
  const meiaNoiteUtc = Date.UTC(a, m - 1, d) / 1000;
  return meiaNoiteUtc - horaEmLisboa(meiaNoiteUtc) * 3600;
}
