#!/usr/bin/env node
/**
 * Publica uma actualização de JavaScript nas apps da loja (canal «producao»), e
 * confere o que os telemóveis vão receber:
 *
 *   node scripts/actualizar-app.mjs cliente|balcao "mensagem"
 *   node scripts/actualizar-app.mjs cliente|balcao --conferir   → só confere a última
 *
 * O `eas update --environment production` liga o EXPO_NO_DOTENV e ignora o
 * .env.production: sem as variáveis no ambiente, a actualização sai sem os ids
 * da Apple e da Google e os botões de entrar desaparecem (aconteceu a 5 nov).
 * Por isso as variáveis vão no ambiente, e no fim confere-se que estão no pacote
 * e que o pacote que o servidor entrega é este.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const [app, mensagem] = process.argv.slice(2);
if (!['cliente', 'balcao'].includes(app) || !mensagem) {
  console.error('Uso: node scripts/actualizar-app.mjs cliente|balcao "mensagem" (ou --conferir)');
  process.exit(1);
}
const pasta = join(raiz, 'apps', app);
const falhar = (texto) => {
  console.error(`\n✖ ${texto}`);
  process.exit(1);
};

// As variáveis do .env.production, para irem no ambiente do empacotador.
const variaveis = Object.fromEntries(
  readFileSync(join(pasta, '.env.production'), 'utf8')
    .split('\n')
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const correr = (args, extra = {}) =>
  execFileSync('npx', args, {
    cwd: pasta,
    encoding: 'utf8',
    env: { ...process.env, ...variaveis, ...extra },
  });

if (mensagem !== '--conferir') {
  execFileSync(
    'npx',
    [
      '-y',
      'eas-cli@latest',
      'update',
      '--channel',
      'producao',
      '--environment',
      'production',
      // Sem a cache do empacotador: a 10 nov, uma actualização do canal «simulador» saiu com o endereço da
      // API da publicação anterior, porque o Metro reaproveitou o ficheiro já transformado com o
      // EXPO_PUBLIC_API dessa vez. Ao contrário, a da produção levaria o servidor local aos telemóveis.
      '--clear-cache',
      '--non-interactive',
      '--message',
      mensagem,
    ],
    { cwd: pasta, stdio: 'inherit', env: { ...process.env, ...variaveis } },
  );
}

// 1. O pacote do iPhone que acabou de sair tem os valores todos do .env.production.
const pastaDoPacote = join(pasta, 'dist/_expo/static/js/ios');
const pacote = readdirSync(pastaDoPacote)
  .filter((f) => f.endsWith('.hbc'))
  .map((f) => join(pastaDoPacote, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!pacote) falhar('Não há pacote do iPhone em dist/.');
const bytes = readFileSync(pacote);
const faltam = Object.entries(variaveis).filter(([, v]) => v && !bytes.includes(Buffer.from(v)));
if (faltam.length)
  falhar(`O pacote saiu sem ${faltam.map(([k]) => k).join(', ')}: publica outra vez.`);
console.log(`✔ O pacote tem as ${Object.keys(variaveis).length} variáveis do .env.production.`);

// 2. O servidor entrega este pacote a quem tem esta impressão nativa.
const impressao = JSON.parse(
  correr(['expo-updates', 'fingerprint:generate', '--platform', 'ios']),
).hash;
const projecto = JSON.parse(readFileSync(join(pasta, 'app.json'), 'utf8')).expo.extra.eas.projectId;
const r = await fetch(`https://u.expo.dev/${projecto}`, {
  headers: {
    'expo-platform': 'ios',
    'expo-runtime-version': impressao,
    'expo-channel-name': 'producao',
    'expo-protocol-version': '1',
    accept: 'multipart/mixed',
  },
});
const texto = await r.text();
const parte = texto
  .split(/-{3,}ExpoManifestBoundary[^\r\n]*/)
  .find((p) => p.includes('"launchAsset"'));
if (!parte) falhar(`O servidor não devolveu nenhuma actualização (${r.status}).`);
const manifesto = JSON.parse(parte.slice(parte.indexOf('{'), parte.lastIndexOf('}') + 1));
const hash = createHash('sha256').update(bytes).digest('base64url');
if (manifesto.launchAsset.hash !== hash)
  falhar(`O servidor entrega outro pacote (${manifesto.createdAt}), não o que saiu daqui.`);
console.log(
  `✔ O servidor entrega este pacote (${manifesto.createdAt}, impressão ${impressao.slice(0, 8)}).`,
);
