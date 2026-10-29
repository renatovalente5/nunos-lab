/**
 * As imagens fixas do passe da Apple e os glifos dos carimbos, a partir da
 * marca oficial (apps/cliente/assets/marca: o «n» e a palavra) e dos ícones
 * da interface (packages/ui/src/icone.tsx: a tesoura e a prenda). Escreve
 * apps/api/src/wallet/imagens.ts e apps/api/src/wallet/glifos.ts.
 *
 * Corre-se à mão quando a marca ou os ícones mudam:
 *   node scripts/imagens-do-passe.mjs
 * Usa o sharp que o Expo já traz para o node_modules.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import sharp from 'sharp';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARCA = join(RAIZ, 'apps/cliente/assets/marca');
const SAIDA = join(RAIZ, 'apps/api/src/wallet');
const PRETO = { r: 10, g: 10, b: 10, alpha: 1 };

/** O ícone: o «n» a branco sobre preto, a 65 % da altura, num quadrado de 38 pt. */
async function icone(lado) {
  const n = await sharp(join(MARCA, 'simbolo.png'))
    .resize({ height: Math.round(lado * 0.655) })
    .toBuffer({ resolveWithObject: true });
  return sharp({ create: { width: lado, height: lado, channels: 4, background: PRETO } })
    .composite([
      {
        input: n.data,
        left: Math.round((lado - n.info.width) / 2),
        top: Math.round((lado - n.info.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** A palavra (com o lema), centrada numa tela transparente de `largura` × `altura`, à `fraccao` da largura. */
async function palavra(largura, altura, fraccao) {
  const p = await sharp(join(MARCA, 'palavra.png'))
    .resize({ width: Math.round(largura * fraccao) })
    .toBuffer({ resolveWithObject: true });
  return sharp({
    create: {
      width: largura,
      height: altura,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: p.data,
        left: Math.round((largura - p.info.width) / 2),
        top: Math.round((altura - p.info.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Os traços de um ícone da interface, lidos do icone.tsx (uma fonte só). */
function tracos(nome) {
  const fonte = readFileSync(join(RAIZ, 'packages/ui/src/icone.tsx'), 'utf8');
  const bloco = fonte.match(new RegExp(`\\n  ${nome}: \\[([\\s\\S]*?)\\],\\n`));
  if (!bloco) throw new Error(`Não encontrei o ícone «${nome}» no icone.tsx.`);
  return [...bloco[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Um ícone da interface como máscara (só o alfa) de `lado` × `lado`, com o traço do app. */
async function glifo(nome, espessura, lado) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 24 24" fill="none">${tracos(
    nome,
  )
    .map(
      (d) =>
        `<path d="${d}" stroke="#fff" stroke-width="${espessura}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('')}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alfa = Buffer.alloc(lado * lado);
  for (let i = 0; i < lado * lado; i++) alfa[i] = data[i * info.channels + 3];
  return alfa;
}

const LADO_DO_GLIFO = 256;

const imagens = {
  'icon.png': await icone(38),
  'icon@2x.png': await icone(76),
  'icon@3x.png': await icone(114),
  'logo.png': await palavra(160, 50, 0.925),
  'logo@2x.png': await palavra(320, 100, 0.925),
  'logo@3x.png': await palavra(480, 150, 0.925),
  'primaryLogo.png': await palavra(126, 30, 1),
  'primaryLogo@2x.png': await palavra(252, 60, 1),
  'primaryLogo@3x.png': await palavra(378, 90, 1),
};
writeFileSync(
  join(SAIDA, 'imagens.ts'),
  `/**
 * As imagens fixas do passe da Apple, feitas por scripts/imagens-do-passe.mjs a
 * partir da marca oficial: o «n» no ícone (38 pt), a palavra no logótipo
 * (160 × 50 pt) e no logótipo principal do poster do iOS 27 (126 × 30 pt).
 */
export const IMAGENS_DO_PASSE: Record<string, string> = {
${Object.entries(imagens)
  .map(([nome, bytes]) => `  '${nome}':\n    '${bytes.toString('base64')}',`)
  .join('\n')}
};
`,
);

const glifos = {
  tesoura: await glifo('tesoura', 2.2, LADO_DO_GLIFO),
  presente: await glifo('presente', 2, LADO_DO_GLIFO),
};
writeFileSync(
  join(SAIDA, 'glifos.ts'),
  `/**
 * Os glifos das casas do cartão (a tesoura do carimbo dado, a prenda da última
 * casa), os mesmos da interface, como máscaras de ${LADO_DO_GLIFO} × ${LADO_DO_GLIFO} (só o alfa)
 * comprimidas em zlib. Feito por scripts/imagens-do-passe.mjs.
 */
export const LADO_DO_GLIFO = ${LADO_DO_GLIFO};
export const GLIFOS: Record<'tesoura' | 'presente', string> = {
${Object.entries(glifos)
  .map(([nome, alfa]) => `  ${nome}:\n    '${deflateSync(alfa, { level: 9 }).toString('base64')}',`)
  .join('\n')}
};
`,
);
for (const [nome, bytes] of Object.entries(imagens)) console.log(nome, bytes.length, 'bytes');
for (const [nome, alfa] of Object.entries(glifos))
  console.log(nome, deflateSync(alfa).length, 'bytes comprimidos');
