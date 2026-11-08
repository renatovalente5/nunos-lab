#!/usr/bin/env node
/**
 * Dar acesso ao backoffice a alguém, com o email da conta Google com que vai entrar (as pessoas
 * seguintes dão-se lá dentro, na Equipa › Acesso ao backoffice). Fala com a base pela sessão do
 * wrangler de quem publica: é essa a autenticação. As ligações de acesso saíram a 8 nov 2026.
 *
 *   node scripts/acesso.mjs --nome "Renato" --email renato@gmail.com            → base local
 *   node scripts/acesso.mjs --nome "Renato" --email renato@gmail.com --remoto   → produção
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const valor = (nome) => (args.indexOf(nome) === -1 ? undefined : args[args.indexOf(nome) + 1]);
const nome = valor('--nome');
const email = valor('--email')?.trim().toLowerCase();
const remoto = args.includes('--remoto');
if (!nome || nome.length > 40 || !email || !/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(email)) {
  console.error('Uso: node scripts/acesso.mjs --nome "Nome" --email nome@gmail.com [--remoto]');
  process.exit(1);
}

const nomeSql = nome.replace(/'/g, "''");
const sql = [
  `INSERT INTO admins (nome, email) SELECT '${nomeSql}', '${email}' WHERE NOT EXISTS (SELECT 1 FROM admins WHERE email = '${email}' AND removido_em IS NULL);`,
  `INSERT INTO registo (admin_id, accao, alvo) VALUES (NULL, 'pessoa.criada', '${nomeSql} · ${email}');`,
].join(' ');

const api = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api');
execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'nunos-lab', remoto ? '--remote' : '--local', '--command', sql],
  { cwd: api, stdio: ['ignore', 'ignore', 'inherit'] },
);
console.log(`${nome} já pode entrar no backoffice com o Google (${email}).`);
