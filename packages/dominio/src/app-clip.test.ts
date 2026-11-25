/**
 * A App Clip do convite (apps/cliente/targets/convite, em Swift) e a app têm de estar de acordo (o Renato,
 * 25 nov 2026): a mesma versão (a App Store recusa uma App Clip com outra), o mesmo grupo e o mesmo
 * ficheiro para o código, a ligação da Apple com o nome certo, e a mesma API. Fica aqui e não na app: um
 * script de testes no package.json da app mudava a impressão nativa (e as actualizações OTA deixavam de
 * chegar às versões da loja).
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { APP_CLIP_IOS, FICHEIRO_DO_CONVITE_IOS, GRUPO_PARTILHADO_IOS } from './index.ts';

const cliente = new URL('../../../apps/cliente/', import.meta.url);
const ler = (caminho: string) => readFileSync(new URL(caminho, cliente), 'utf8');
const app = JSON.parse(ler('app.json')).expo;
const plist = ler('targets/convite/Info.plist');
const partilha = ler('targets/convite/Partilha.swift');
const doPlist = (chave: string) =>
  new RegExp(`<key>${chave}</key>\\s*<string>([^<]*)</string>`).exec(plist)?.[1];
const textoSwift = (nome: string) =>
  new RegExp(`static let ${nome} = "([^"]*)"`).exec(partilha)?.[1];

test('a App Clip diz o mesmo que a app sobre a cifra', () => {
  assert.equal(app.ios.config.usesNonExemptEncryption, false);
  assert.match(plist, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
});

test('a App Clip tem a versão da app', () => {
  // O @bacons/apple-targets põe a versão do app.json e o número da build do EAS em todos os alvos.
  assert.equal(doPlist('CFBundleShortVersionString'), '$(MARKETING_VERSION)');
  assert.equal(doPlist('CFBundleVersion'), '$(CURRENT_PROJECT_VERSION)');
});

test('a App Clip deixa o código onde a app o procura', () => {
  assert.deepEqual(app.ios.entitlements['com.apple.security.application-groups'], [
    GRUPO_PARTILHADO_IOS,
  ]);
  // A app diz qual é a App Clip dela: sem isto, a App Store Connect recusa a build (ITMS-90876).
  assert.deepEqual(app.ios.entitlements['com.apple.developer.associated-appclip-app-identifiers'], [
    `$(AppIdentifierPrefix)${APP_CLIP_IOS}`,
  ]);
  assert.equal(textoSwift('grupo'), GRUPO_PARTILHADO_IOS);
  assert.equal(textoSwift('ficheiro'), FICHEIRO_DO_CONVITE_IOS);
});

test('a ligação da Apple abre esta App Clip', () => {
  const sufixo = /bundleIdentifier: '([^']+)'/.exec(ler('targets/convite/expo-target.config.js'));
  assert.equal(`${app.ios.bundleIdentifier}${sufixo?.[1]}`, APP_CLIP_IOS);
});

test('a App Clip fala com a API da app e traz as letras que pede', () => {
  const daApp = /EXPO_PUBLIC_API \?\? '([^']+)'/.exec(ler('src/dados.ts'))?.[1];
  assert.ok(daApp);
  assert.ok(ler('targets/convite/Api.swift').includes(`URL(string: "${daApp}")!`));
  const letras = [...plist.matchAll(/<string>(Manrope_[^<]+\.ttf)<\/string>/g)].map((m) => m[1]!);
  assert.equal(letras.length, 4);
  for (const l of letras) assert.ok(existsSync(new URL(`targets/convite/assets/${l}`, cliente)), l);
});

/** Há o compilador do Swift (um Mac com as ferramentas do Xcode)? */
function temSwift(): boolean {
  try {
    execFileSync('swiftc', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

test(
  'a App Clip lê o código da ligação, escreve os textos e mostra as casas (Swift, pt e en)',
  { skip: !temSwift() && 'sem o swiftc' },
  () => {
    const pasta = mkdtempSync(join(tmpdir(), 'app-clip-'));
    try {
      const fontes = ['Api', 'Textos', 'Partilha'].map((f) =>
        fileURLToPath(new URL(`targets/convite/${f}.swift`, cliente)),
      );
      const testes = join(pasta, 'testes');
      execFileSync(
        'swiftc',
        [
          '-swift-version',
          '5',
          ...fontes,
          fileURLToPath(new URL('app-clip/main.swift', import.meta.url)),
          '-o',
          testes,
        ],
        { stdio: 'pipe' },
      );
      for (const lingua of ['pt-PT', 'en-GB']) {
        try {
          execFileSync(testes, ['-AppleLanguages', `(${lingua})`], { stdio: 'pipe' });
        } catch (e) {
          assert.fail(`${lingua}: ${String((e as { stderr?: Buffer }).stderr ?? e)}`);
        }
      }
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  },
);
