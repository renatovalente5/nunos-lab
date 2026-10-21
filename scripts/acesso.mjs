#!/usr/bin/env node
/**
 * A PRIMEIRA ligação de acesso ao backoffice (as seguintes criam-se lá dentro,
 * em «Acessos»). Fala com a base pela sessão do wrangler de quem publica: é
 * essa a autenticação, e não há outra porta.
 *
 *   node scripts/acesso.mjs --nome "Renato"            → base local, imprime a ligação
 *   node scripts/acesso.mjs --nome "Renato" --remoto   → produção, grava a ligação num
 *                                                        ficheiro em ~/Chaves/nunos-lab/
 *
 * A ligação vale uma vez e por 7 dias. Só o resumo SHA-256 do código vai para a base.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const nome = args[args.indexOf('--nome') + 1];
const remoto = args.includes('--remoto');
if (!nome || args.indexOf('--nome') === -1 || nome.length > 40) {
  console.error('Uso: node scripts/acesso.mjs --nome "Nome" [--remoto]');
  process.exit(1);
}

const codigo = randomBytes(32).toString('base64url');
const resumo = createHash('sha256').update(codigo).digest('hex');
const nomeSql = nome.replace(/'/g, "''");
const sql = [
  `INSERT INTO admins (nome) SELECT '${nomeSql}' WHERE NOT EXISTS (SELECT 1 FROM admins WHERE nome = '${nomeSql}' AND removido_em IS NULL);`,
  `INSERT INTO acessos (admin_id, resumo, expira_em) VALUES ((SELECT id FROM admins WHERE nome = '${nomeSql}' AND removido_em IS NULL ORDER BY id LIMIT 1), X'${resumo}', unixepoch() + 7 * 86400);`,
  `INSERT INTO registo (admin_id, accao, alvo) VALUES (NULL, 'acesso.criado', '${nomeSql}');`,
].join(' ');

const api = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api');
execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'nunos-lab', remoto ? '--remote' : '--local', '--command', sql],
  {
    cwd: api,
    stdio: ['ignore', 'ignore', 'inherit'],
  },
);

const base = remoto
  ? 'https://renatovalente5.github.io/nunos-lab/backoffice/'
  : 'http://localhost:8871/';
const ligacao = `${base}#acesso=${codigo}`;
if (remoto) {
  const pasta = join(homedir(), 'Chaves', 'nunos-lab');
  mkdirSync(pasta, { recursive: true, mode: 0o700 });
  const ficheiro = join(
    pasta,
    `acesso-${nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9]+/g, '-')}.txt`,
  );
  writeFileSync(ficheiro, `${ligacao}\n`, { mode: 0o600 });
  console.log(`Ligação de acesso para ${nome} (vale uma vez, 7 dias) gravada em ${ficheiro}`);
} else {
  console.log(ligacao);
}
