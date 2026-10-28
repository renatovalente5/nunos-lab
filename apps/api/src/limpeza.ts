/** A limpeza da madrugada (o cron do wrangler.jsonc). Nada daqui é preciso no dia a dia. */
export async function limpar(env: Env): Promise<void> {
  const db = env.DB;
  const r = await db.batch([
    // Ligações usadas ou caducadas há mais de 30 dias.
    db.prepare(
      'DELETE FROM acessos WHERE expira_em < unixepoch() - 30 * 86400 OR (usado_em IS NOT NULL AND usado_em < unixepoch() - 30 * 86400)',
    ),
    // Sessões terminadas ou caducadas há mais de 30 dias.
    db.prepare(
      'DELETE FROM sessoes WHERE expira_em < unixepoch() - 30 * 86400 OR (revogada_em IS NOT NULL AND revogada_em < unixepoch() - 30 * 86400)',
    ),
    // O mesmo para a equipa e os clientes; os códigos de email caducados com mais de um dia.
    db.prepare(
      'DELETE FROM acessos_da_equipa WHERE expira_em < unixepoch() - 30 * 86400 OR (usado_em IS NOT NULL AND usado_em < unixepoch() - 30 * 86400)',
    ),
    db.prepare(
      'DELETE FROM sessoes_da_equipa WHERE expira_em < unixepoch() - 30 * 86400 OR (revogada_em IS NOT NULL AND revogada_em < unixepoch() - 30 * 86400)',
    ),
    db.prepare(
      'DELETE FROM sessoes_de_cliente WHERE expira_em < unixepoch() - 30 * 86400 OR (revogada_em IS NOT NULL AND revogada_em < unixepoch() - 30 * 86400)',
    ),
    db.prepare('DELETE FROM codigos_de_entrada WHERE expira_em < unixepoch() - 86400'),
    // Imagens que ninguém usa (carregadas e depois trocadas), com mais de um dia.
    db.prepare(
      `DELETE FROM imagens WHERE criada_em < unixepoch() - 86400
         AND id NOT IN (SELECT logotipo_id FROM parceiros WHERE logotipo_id IS NOT NULL)
         AND id NOT IN (SELECT capa_id FROM parceiros WHERE capa_id IS NOT NULL)`,
    ),
    // Contagens com mais de dois anos, e o registo com mais de três.
    db.prepare("DELETE FROM contagens WHERE dia < date('now', '-730 days')"),
    db.prepare('DELETE FROM registo WHERE quando < unixepoch() - 3 * 365 * 86400'),
  ]);
  console.log(
    'limpeza',
    r.map((x) => x.meta.changes),
  );
}
