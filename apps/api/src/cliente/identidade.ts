/**
 * De uma identidade provada (a Apple ou a Google disseram quem é) à conta do
 * cliente. As regras, por ordem:
 *  1. a identidade já existe → essa conta;
 *  2. o email é verificado e de uma caixa que nunca muda de dono (Gmail,
 *     iCloud; nunca o relay da Apple), e já há uma conta com esse email provado
 *     da mesma forma → junta-se a essa conta (a mesma pessoa, por outra porta);
 *  3. ou o email foi escrito ao balcão («novo cliente»), sem ninguém provar →
 *     quem o prova agora fica com esse cartão (era dele; os carimbos vão com ele);
 *  4. senão, nasce uma conta nova com o primeiro cartão.
 * Duas contas com o mesmo email mas sem prova nunca se juntam às escondidas.
 */
import { donaDaCaixa, eEmailDeRelay, textoDeBusca, type Programa } from '@nunos-lab/dominio';
import { codigoNovo, novoCartao } from '../programa.ts';
import { recusar } from '../util.ts';

export type IdentidadeProvada = {
  tipo: 'apple' | 'google';
  sujeito: string;
  email: string | null;
  emailVerificado: boolean;
  nome: string;
};

type Encontrada = { id: number; cliente_id: number };

export function emailProvado(id: IdentidadeProvada): string | null {
  return id.email && id.emailVerificado && !eEmailDeRelay(id.email) ? id.email : null;
}

function dona(id: IdentidadeProvada): boolean {
  const email = emailProvado(id);
  return !!email && donaDaCaixa(email);
}

export async function entrarComIdentidade(
  db: D1Database,
  id: IdentidadeProvada,
  programa: Programa,
): Promise<{ clienteId: number; identidadeId: number; nova: boolean }> {
  const existente = await db
    .prepare(
      `SELECT i.id, i.cliente_id FROM identidades i JOIN clientes k ON k.id = i.cliente_id
       WHERE i.tipo = ? AND i.sujeito = ? AND k.apagado_em IS NULL`,
    )
    .bind(id.tipo, id.sujeito)
    .first<Encontrada>();
  if (existente)
    return { clienteId: existente.cliente_id, identidadeId: existente.id, nova: false };

  const email = emailProvado(id);
  if (email) {
    // 2 e 3: a mesma caixa, provada por outra porta, ou escrita ao balcão.
    const irma = await db
      .prepare(
        `SELECT i.id, i.cliente_id, i.dona, i.tipo FROM identidades i JOIN clientes k ON k.id = i.cliente_id
         WHERE i.email = ? AND k.apagado_em IS NULL AND (i.dona = 1 OR i.tipo = 'email')
         ORDER BY i.dona DESC, i.id LIMIT 1`,
      )
      .bind(email)
      .first<Encontrada & { dona: number; tipo: string }>();
    if (irma && (irma.dona === 1 ? dona(id) : true)) {
      let identidade;
      try {
        [identidade] = await db.batch([
          db
            .prepare(
              'INSERT INTO identidades (cliente_id, tipo, sujeito, email, dona) VALUES (?, ?, ?, ?, ?) RETURNING id',
            )
            .bind(irma.cliente_id, id.tipo, id.sujeito, id.email, dona(id) ? 1 : 0),
          // O email escrito ao balcão fica provado por quem o abriu.
          db
            .prepare("UPDATE identidades SET dona = 1 WHERE id = ? AND tipo = 'email'")
            .bind(irma.id),
          db
            .prepare(
              "UPDATE clientes SET email = coalesce(email, ?), nome = CASE WHEN nome = '' THEN ? ELSE nome END, busca = CASE WHEN nome = '' THEN ? ELSE busca END WHERE id = ?",
            )
            .bind(email, id.nome.slice(0, 40), textoDeBusca(id.nome.slice(0, 40)), irma.cliente_id),
        ]);
      } catch (e) {
        const ganhou = await quemGanhou(db, id, e);
        if (!ganhou) throw e;
        return { clienteId: ganhou.cliente_id, identidadeId: ganhou.id, nova: false };
      }
      return {
        clienteId: irma.cliente_id,
        identidadeId: (identidade!.results[0] as { id: number }).id,
        nova: false,
      };
    }
  }

  // 4: uma conta nova, com o primeiro cartão.
  const codigo = await codigoNovo(db);
  const cliente = await db
    .prepare('INSERT INTO clientes (codigo, nome, email, busca) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(codigo, id.nome.slice(0, 40), email, textoDeBusca(id.nome.slice(0, 40)))
    .first<{ id: number }>();
  if (!cliente) throw new Error('A conta não nasceu');
  let identidade;
  try {
    [identidade] = await db.batch([
      db
        .prepare(
          'INSERT INTO identidades (cliente_id, tipo, sujeito, email, dona) VALUES (?, ?, ?, ?, ?) RETURNING id',
        )
        .bind(cliente.id, id.tipo, id.sujeito, id.email, dona(id) ? 1 : 0),
      novoCartao(db, cliente.id, 1, programa),
    ]);
  } catch (e) {
    // Dois toques ao mesmo tempo na primeira entrada: o outro pedido ficou com a
    // identidade. A conta que acabou de nascer apaga-se (ficava órfã, a contar
    // como cliente) e devolve-se a que ganhou.
    const ganhou = await quemGanhou(db, id, e);
    if (!ganhou) throw e;
    await db.prepare('DELETE FROM clientes WHERE id = ?').bind(cliente.id).run();
    return { clienteId: ganhou.cliente_id, identidadeId: ganhou.id, nova: false };
  }
  return {
    clienteId: cliente.id,
    identidadeId: (identidade!.results[0] as { id: number }).id,
    nova: true,
  };
}

/**
 * Quando um INSERT da identidade falha por já existir (dois pedidos ao mesmo
 * tempo com a mesma Apple/Google), quem a tem agora. Outro erro qualquer: null.
 */
async function quemGanhou(
  db: D1Database,
  id: IdentidadeProvada,
  e: unknown,
): Promise<Encontrada | null> {
  if (!String(e).includes('UNIQUE constraint failed: identidades')) return null;
  return db
    .prepare(
      `SELECT i.id, i.cliente_id FROM identidades i JOIN clientes k ON k.id = i.cliente_id
       WHERE i.tipo = ? AND i.sujeito = ? AND k.apagado_em IS NULL`,
    )
    .bind(id.tipo, id.sujeito)
    .first<Encontrada>();
}

/** Junta uma forma de entrar à conta que já está aberta. Uma forma de outra conta não se rouba. */
export async function juntarIdentidade(
  db: D1Database,
  clienteId: number,
  id: IdentidadeProvada,
): Promise<number> {
  const existente = await db
    .prepare('SELECT id, cliente_id FROM identidades WHERE tipo = ? AND sujeito = ?')
    .bind(id.tipo, id.sujeito)
    .first<Encontrada>();
  if (existente) {
    if (existente.cliente_id === clienteId) return existente.id;
    recusar(409, 'noutra_conta');
  }
  const email = emailProvado(id);
  const [identidade] = await db.batch([
    db
      .prepare(
        'INSERT INTO identidades (cliente_id, tipo, sujeito, email, dona) VALUES (?, ?, ?, ?, ?) RETURNING id',
      )
      .bind(clienteId, id.tipo, id.sujeito, id.email, dona(id) ? 1 : 0),
    db
      .prepare('UPDATE clientes SET email = coalesce(email, ?) WHERE id = ?')
      .bind(email, clienteId),
  ]);
  return (identidade!.results[0] as { id: number }).id;
}
