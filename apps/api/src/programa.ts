/** O programa de carimbos e as leituras do cartão que a app, a Balcão e o backoffice partilham. */
import {
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
  const d = new Map(defs.results.map((x) => [x.chave, x.valor]));
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
    servicos: (d.get('fid.servicos') ?? '1') === '1',
    aniversario: d.get('fid.aniversario') ?? '',
  };
}

export type LinhaCartao = {
  id: number;
  cliente_id: number;
  numero: number;
  objectivo: number;
  recompensa: string;
  iniciado_em: number;
  completo_em: number | null;
  usado_em: number | null;
  carimbos: number;
};

const COLUNAS_DO_CARTAO = `c.id, c.cliente_id, c.numero, c.objectivo, c.recompensa, c.iniciado_em,
  c.completo_em, c.usado_em,
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

export function cartaoPublico(l: LinhaCartao): CartaoDoCliente {
  return {
    id: l.id,
    numero: l.numero,
    objectivo: l.objectivo,
    recompensa: l.recompensa,
    carimbos: l.carimbos,
  };
}

/** A instrução que abre o cartão `numero` de um cliente, com o programa de agora. */
export function novoCartao(
  db: D1Database,
  clienteId: number,
  numero: number,
  programa: Programa,
): D1PreparedStatement {
  return db
    .prepare('INSERT INTO cartoes (cliente_id, numero, objectivo, recompensa) VALUES (?, ?, ?, ?)')
    .bind(clienteId, numero, programa.objectivo, programa.recompensa);
}

/** As recompensas por usar: cartões completos que ninguém entregou. */
export function consultaDasRecompensas(db: D1Database, clienteId: number): D1PreparedStatement {
  return db
    .prepare(
      `SELECT id AS cartaoId, recompensa, completo_em AS ganhaEm FROM cartoes
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
