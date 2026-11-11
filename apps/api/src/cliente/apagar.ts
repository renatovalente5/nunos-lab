/**
 * Apagar a conta de um cliente: sai tudo o que é pessoal; os carimbos ficam sem
 * dono, para as contagens. A app (o próprio) e o backoffice (um pedido de quem só
 * tem cartão feito ao balcão, sem app para o fazer) fazem exactamente o mesmo.
 */
import type { C } from '../ambiente.ts';
import { codigoNovo } from '../programa.ts';
import { consultaDeJaFoiCliente, guardarMarcas, marcasDoCliente } from '../saldo.ts';
import { desactivarPasseDaGoogle } from '../wallet/servico.ts';

export async function apagarConta(c: C, id: number): Promise<void> {
  const db = c.env.DB;
  const codigo = await codigoNovo(db);
  const passe = await db
    .prepare('SELECT serie, google_em FROM passes WHERE cliente_id = ?')
    .bind(id)
    .first<{ serie: string; google_em: number | null }>();
  // Quem já cortou ou foi convidado deixa uma marca irreversível das formas de entrar e dos emails: ao
  // voltar com a mesma Apple ou Google, já não aceita um convite como se fosse novo (11 nov 2026).
  const foi = (await consultaDeJaFoiCliente(db, id).first<{ foi: number }>())?.foi === 1;
  const marcas = foi ? await marcasDoCliente(db, c.env.WALLET_SEGREDO, id) : [];
  await db.batch([
    ...guardarMarcas(db, marcas),
    db.prepare('DELETE FROM identidades WHERE cliente_id = ?').bind(id),
    // O passe sai também (e os registos da Apple com ele): a Wallet deixa de o actualizar.
    db.prepare('DELETE FROM passes WHERE cliente_id = ?').bind(id),
    db
      .prepare(
        'UPDATE sessoes_de_cliente SET revogada_em = unixepoch() WHERE cliente_id = ? AND revogada_em IS NULL',
      )
      .bind(id),
    db
      .prepare(
        `UPDATE clientes SET nome = '', busca = '', email = NULL, aniversario = NULL, aniversario_desde = NULL, loja_id = NULL,
         codigo = ?, codigo_versao = codigo_versao + 1, codigo_convite = NULL, apagado_em = unixepoch() WHERE id = ?`,
      )
      .bind(codigo, id),
  ]);
  if (passe?.google_em) desactivarPasseDaGoogle(c, passe.serie);
}
