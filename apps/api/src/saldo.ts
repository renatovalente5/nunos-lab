/**
 * O saldo e os convites (o Renato, 10 nov 2026): as leituras e as instruções que a carteira do cliente,
 * a for partners e o backoffice partilham. Dinheiro sempre em cêntimos; o saldo é a soma dos movimentos
 * que não foram anulados.
 */
import { inicioDoDia } from './programa.ts';
import {
  CONVITES_PREDEFINIDOS,
  LIMITES_DO_SALDO,
  diaEmLisboa,
  gerarCodigo,
  nomeCurto,
  type DefinicoesDosConvites,
  type MovimentoDoSaldo,
  type TipoDeMovimento,
} from '@nunos-lab/dominio';

/** As definições dos convites a partir das «conv.*» já lidas, com as predefinições no que faltar. */
export function convitesDasDefinicoes(d: Map<string, string>): DefinicoesDosConvites {
  const inteiro = (chave: string, { min, max }: { min: number; max: number }, senao: number) => {
    const v = d.get(chave);
    const n = Number(v);
    return v !== undefined && v !== '' && Number.isInteger(n) && n >= min && n <= max ? n : senao;
  };
  const limite = d.get('conv.limite');
  const n = Number(limite);
  return {
    ligado: (d.get('conv.ligado') ?? (CONVITES_PREDEFINIDOS.ligado ? '1' : '0')) === '1',
    valorPadrinho: inteiro(
      'conv.valor_padrinho',
      LIMITES_DO_SALDO.premio,
      CONVITES_PREDEFINIDOS.valorPadrinho,
    ),
    valorConvidado: inteiro(
      'conv.valor_convidado',
      LIMITES_DO_SALDO.premio,
      CONVITES_PREDEFINIDOS.valorConvidado,
    ),
    // Escrito vazio é «sem limite»; nunca escrito, a predefinição.
    limite:
      limite === undefined
        ? CONVITES_PREDEFINIDOS.limite
        : limite === ''
          ? null
          : Number.isInteger(n) &&
              n >= LIMITES_DO_SALDO.convites.min &&
              n <= LIMITES_DO_SALDO.convites.max
            ? n
            : CONVITES_PREDEFINIDOS.limite,
  };
}

export async function lerConvites(db: D1Database): Promise<DefinicoesDosConvites> {
  const defs = await db
    .prepare("SELECT chave, valor FROM definicoes WHERE chave LIKE 'conv.%'")
    .all<{ chave: string; valor: string }>();
  return convitesDasDefinicoes(new Map(defs.results.map((x) => [x.chave, x.valor])));
}

/** O saldo de um cliente (em cêntimos): a soma do que não foi anulado. */
export function consultaDoSaldo(db: D1Database, clienteId: number): D1PreparedStatement {
  return db
    .prepare(
      'SELECT coalesce(sum(valor), 0) AS saldo FROM movimentos_de_saldo WHERE cliente_id = ? AND anulado_em IS NULL',
    )
    .bind(clienteId);
}

export const saldoDe = (r: D1Result): number =>
  (r.results[0] as { saldo: number } | undefined)?.saldo ?? 0;

/**
 * Os movimentos de um cliente, do mais recente para o mais antigo, com o outro lado do convite (o
 * nome inteiro: a carteira mostra-o curto, o backoffice inteiro, com o id para ligar à ficha dele), a
 * casa e quem fez.
 */
export function consultaDosMovimentos(
  db: D1Database,
  clienteId: number,
  limite = 100,
): D1PreparedStatement {
  return db
    .prepare(
      `SELECT m.id, m.valor, m.tipo, m.nota, m.criado_em, m.anulado_em, m.sem_leitura, l.nome AS loja,
         coalesce(e.nome, a.nome) AS por, ea.nome AS anulado_por_nome,
         q.nome AS quem, q.id AS quem_id, q.apagado_em IS NOT NULL AS quem_apagado
       FROM movimentos_de_saldo m
         LEFT JOIN lojas l ON l.id = m.loja_id
         LEFT JOIN equipa e ON e.id = m.pessoa_id
         LEFT JOIN admins a ON a.id = m.admin_id
         LEFT JOIN equipa ea ON ea.id = m.anulado_por
         LEFT JOIN convites v ON v.id = m.convite_id
         LEFT JOIN clientes q ON q.id = CASE m.tipo
           WHEN 'convite' THEN v.convidado_id WHEN 'convidado' THEN v.padrinho_id END
       WHERE m.cliente_id = ?
       ORDER BY m.criado_em DESC, m.id DESC LIMIT ?`,
    )
    .bind(clienteId, limite);
}

export type LinhaDoMovimento = {
  id: number;
  valor: number;
  tipo: TipoDeMovimento;
  nota: string;
  criado_em: number;
  anulado_em: number | null;
  sem_leitura: number;
  /** Quem da equipa anulou (null: o backoffice, ou um prémio tirado por um carimbo anulado lá). */
  anulado_por_nome: string | null;
  loja: string | null;
  por: string | null;
  quem: string | null;
  /** O outro lado do convite (no «convite» e no «convidado»), e se já apagou a conta. */
  quem_id: number | null;
  quem_apagado: number;
};

/**
 * O movimento como a carteira o vê: do outro lado do convite, só o nome curto; e o prémio de um convite
 * (a visita de um amigo) só com o dia, não a hora — quem convida sabe se foi, não quando (11 nov 2026).
 * O backoffice (`nomeInteiro`) vê tudo.
 */
export function movimentoPublico(l: LinhaDoMovimento, nomeInteiro = false): MovimentoDoSaldo {
  return {
    id: l.id,
    valor: l.valor,
    tipo: l.tipo,
    quem: l.quem ? (nomeInteiro ? l.quem : nomeCurto(l.quem) || null) : null,
    loja: l.loja,
    nota: l.nota,
    criadoEm:
      !nomeInteiro && l.tipo === 'convite'
        ? inicioDoDia(diaEmLisboa(l.criado_em * 1000))
        : l.criado_em,
    anulado: l.anulado_em !== null,
  };
}

/** O código do convite do cliente: o que tem, ou um novo (8 letras, como os cartões, que ninguém tem). */
export async function codigoDoConvite(db: D1Database, clienteId: number): Promise<string> {
  const tem = await db
    .prepare('SELECT codigo_convite FROM clientes WHERE id = ?')
    .bind(clienteId)
    .first<{ codigo_convite: string | null }>();
  if (tem?.codigo_convite) return tem.codigo_convite;
  for (let i = 0; i < 5; i++) {
    const codigo = gerarCodigo(crypto.getRandomValues(new Uint8Array(7)));
    try {
      // Só se ainda não tiver (dois pedidos ao mesmo tempo ficam com o mesmo).
      await db
        .prepare('UPDATE clientes SET codigo_convite = ? WHERE id = ? AND codigo_convite IS NULL')
        .bind(codigo, clienteId)
        .run();
      const agora = await db
        .prepare('SELECT codigo_convite FROM clientes WHERE id = ?')
        .bind(clienteId)
        .first<{ codigo_convite: string | null }>();
      if (agora?.codigo_convite) return agora.codigo_convite;
    } catch (e) {
      // Um código igual ao de outro cliente (o índice único): tenta-se outro.
      if (!String(e).includes('UNIQUE constraint failed')) throw e;
    }
  }
  throw new Error('Não houve código de convite livre');
}

// ——— as marcas das contas apagadas (revisão de 11 nov 2026: nenhum batoteiro) ———

/**
 * A marca irreversível de uma forma de entrar («google:<sub>») ou de um email («email:<email>»): um HMAC
 * com o segredo da API, que só serve para reconhecer a mesma pessoa a voltar.
 */
export async function marcaDe(segredo: string, texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`nunoslab:marca:${segredo}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const b = new Uint8Array(
    await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(texto.toLowerCase())),
  );
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Os textos que se marcam de uma forma de entrar: a forma e o email dela. */
export function textosDaIdentidade(i: {
  tipo: string;
  sujeito: string;
  email: string | null;
}): string[] {
  return [`${i.tipo}:${i.sujeito}`, ...(i.email ? [`email:${i.email}`] : [])];
}

/** As marcas de um cliente: as formas de entrar, os emails delas e o email dado ao balcão. */
export async function marcasDoCliente(
  db: D1Database,
  segredo: string,
  clienteId: number,
): Promise<string[]> {
  const [ids, k] = await db.batch([
    db.prepare('SELECT tipo, sujeito, email FROM identidades WHERE cliente_id = ?').bind(clienteId),
    db.prepare('SELECT email FROM clientes WHERE id = ?').bind(clienteId),
  ]);
  const textos = new Set<string>();
  for (const i of ids!.results as { tipo: string; sujeito: string; email: string | null }[])
    for (const t of textosDaIdentidade(i)) textos.add(t);
  const email = (k!.results[0] as { email: string | null } | undefined)?.email;
  if (email) textos.add(`email:${email}`);
  return Promise.all([...textos].map((t) => marcaDe(segredo, t)));
}

/**
 * Já foi cliente (cortou, ou aceitou um convite)? Só destes se guardam as marcas ao apagar: quem nunca
 * fez nada não tem nada a repetir.
 */
export function consultaDeJaFoiCliente(db: D1Database, clienteId: number): D1PreparedStatement {
  return db
    .prepare(
      `SELECT (EXISTS (SELECT 1 FROM carimbos WHERE cliente_id = ?1)
            OR EXISTS (SELECT 1 FROM convites WHERE convidado_id = ?1)) AS foi`,
    )
    .bind(clienteId);
}

/** As instruções que guardam estas marcas (as repetidas ficam como estavam). */
export function guardarMarcas(db: D1Database, marcas: string[]): D1PreparedStatement[] {
  return marcas.map((m) =>
    db.prepare('INSERT OR IGNORE INTO marcas_de_contas_apagadas (marca) VALUES (?)').bind(m),
  );
}

/** Alguma destas marcas é de uma conta apagada (ou de uma forma de entrar tirada)? */
export async function temMarcaApagada(db: D1Database, marcas: string[]): Promise<boolean> {
  if (!marcas.length) return false;
  const r = await db
    .prepare(
      `SELECT 1 FROM marcas_de_contas_apagadas WHERE marca IN (${marcas.map(() => '?').join(',')}) LIMIT 1`,
    )
    .bind(...marcas)
    .first();
  return !!r;
}
