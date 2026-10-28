#!/usr/bin/env node
/**
 * Publica a app e o backoffice no GitHub Pages (ramo gh-pages), a partir
 * deste Mac:
 *
 *   node scripts/publicar.mjs            → constrói e envia
 *   node scripts/publicar.mjs --so-construir → só constrói em _site/
 *
 * A API publica-se à parte: «npm run publicar -w @nunos-lab/api».
 *
 *   _site/              a app do cliente (Expo, exportada para a web)
 *   _site/backoffice/   o backoffice (Vite)
 *   _site/404.html      a mesma app: o GitHub Pages serve-a a qualquer morada
 *                       que não exista (/nunos-lab/parceiro/3), e o Expo Router
 *                       desenha a página certa
 *   _site/barbearia/    a mesma app outra vez (e _site/privacidade/), para
 *                       estas moradas responderem 200 e não 404
 *   _site/.nojekyll     sem isto o GitHub esconde a pasta «_expo» (o Jekyll
 *                       ignora tudo o que começa por «_»)
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/nunos-lab';
const ORIGEM = 'https://renatovalente5.github.io';
const site = join(raiz, '_site');
const correr = (cmd, args, cwd, env = {}) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });

// 1. As duas construções.
correr(
  'npx',
  ['expo', 'export', '-p', 'web', '--output-dir', 'dist', '--clear'],
  join(raiz, 'apps/cliente'),
  {
    NODE_ENV: 'production',
  },
);
correr('npx', ['vite', 'build'], join(raiz, 'apps/backoffice'));

// 2. Juntar.
rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });
cpSync(join(raiz, 'apps/cliente/dist'), site, { recursive: true });
cpSync(join(raiz, 'apps/backoffice/dist'), join(site, 'backoffice'), { recursive: true });

// 3. O index da app: as moradas do <head> que escrevi à raiz passam a levar a
//    base (o Expo só a põe nos scripts que ele próprio gera), e a imagem de
//    partilha precisa da morada inteira (o WhatsApp não resolve caminhos).
let html = readFileSync(join(site, 'index.html'), 'utf8');
for (const f of ['manifest.webmanifest', 'apple-touch-icon.png', 'icone-192.png'])
  html = html.replaceAll(`href="/${f}"`, `href="${BASE}/${f}"`);
html = html.replace('content="/partilha.jpg"', `content="${ORIGEM}${BASE}/partilha.jpg"`);
for (const f of ['manifest.webmanifest', 'apple-touch-icon.png', 'icone-192.png', 'partilha.jpg'])
  if (!html.includes(`${BASE}/${f}`) || !existsSync(join(site, f)))
    throw new Error(`Falta ${f} no index ou no site`);
if (!html.includes(`src="${BASE}/_expo/static/js/web/`))
  throw new Error('Os scripts do Expo não levam a base');
writeFileSync(join(site, 'index.html'), html);
writeFileSync(join(site, '404.html'), html);
// As moradas fixas respondem 200 (o 404.html abre a app, mas com «404», e as
// pré-visualizações do WhatsApp e do Facebook desistem). Um parceiro partilha-se
// como /?parceiro=N, que é o index.
for (const rota of ['barbearia', 'cartao', 'conta', 'privacidade']) {
  mkdirSync(join(site, rota), { recursive: true });
  writeFileSync(join(site, rota, 'index.html'), html);
}
writeFileSync(join(site, '.nojekyll'), '');

// O backoffice: os ficheiros têm de pedir /nunos-lab/backoffice/…
const bo = readFileSync(join(site, 'backoffice/index.html'), 'utf8');
if (!bo.includes(`${BASE}/backoffice/ficheiros/`)) throw new Error('O backoffice não leva a base');
if (!bo.includes('Content-Security-Policy'))
  throw new Error('O backoffice saiu sem a política de segurança');
console.log('\n_site pronto.');

if (process.argv.includes('--so-construir')) process.exit(0);

// 4. Enviar para o ramo gh-pages (um commit só, sem histórico: é o resultado
//    de uma construção, e o código vive no main).
const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
  cwd: raiz,
  encoding: 'utf8',
}).trim();
const remoto = execFileSync('git', ['remote', 'get-url', 'origin'], {
  cwd: raiz,
  encoding: 'utf8',
}).trim();
rmSync(join(site, '.git'), { recursive: true, force: true });
correr('git', ['init', '-q', '-b', 'gh-pages'], site);
correr('git', ['add', '-A'], site);
correr(
  'git',
  [
    '-c',
    'user.name=Renato Valente',
    '-c',
    'user.email=renato.lima.valente@gmail.com',
    'commit',
    '-q',
    '-m',
    `Publicar ${sha}`,
  ],
  site,
);
correr('git', ['push', '-f', remoto, 'gh-pages'], site);
rmSync(join(site, '.git'), { recursive: true, force: true });
console.log(`\nPublicado: ${ORIGEM}${BASE}/ e ${ORIGEM}${BASE}/backoffice/`);
