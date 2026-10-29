import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lerPng } from './png-leitor.test.ts';
import { png } from './png.ts';
import { mascara, Tela } from './tela.ts';

test('um PNG RGB sai com as medidas, a cor de fundo e o que se pintou', async () => {
  const tela = new Tela(3, 2, [10, 20, 30]);
  tela.pintar(1, 1, [255, 255, 255], 1);
  tela.pintar(2, 0, [210, 20, 30], 0.5);
  const lido = lerPng(await png(tela));
  assert.equal(lido.largura, 3);
  assert.equal(lido.altura, 2);
  assert.equal(lido.canais, 3);
  assert.deepEqual(lido.pixel(0, 0), [10, 20, 30]);
  assert.deepEqual(lido.pixel(1, 1), [255, 255, 255]);
  assert.deepEqual(lido.pixel(2, 0), [110, 20, 30]);
});

test('uma tela transparente é RGBA e o «sobre» dá o alfa certo', async () => {
  const tela = new Tela(2, 1, null);
  tela.pintar(0, 0, [200, 100, 0], 0.5);
  const lido = lerPng(await png(tela));
  assert.equal(lido.canais, 4);
  assert.deepEqual(lido.pixel(0, 0), [200, 100, 0, 128]);
  assert.deepEqual(lido.pixel(1, 0), [0, 0, 0, 0]);
});

test('um disco cobre o centro, deixa os cantos e suaviza a borda', () => {
  const tela = new Tela(20, 20, [0, 0, 0]);
  tela.disco(10, 10, 8, [255, 255, 255]);
  const px = (x: number, y: number) => tela.dados[y * tela.passo + 1 + x * 3]!;
  assert.equal(px(10, 10), 255);
  assert.equal(px(0, 0), 0);
  assert.equal(px(19, 10), 0);
  // Um pixel a ~7,8 do centro, na borda, fica a meio.
  const borda = px(15, 15);
  assert.ok(borda > 60 && borda < 200, `borda ${borda}`);
});

test('um anel pinta no raio e deixa o meio', () => {
  const tela = new Tela(30, 30, [0, 0, 0]);
  tela.anel(15, 15, 10, 2, [255, 255, 255]);
  const px = (x: number, y: number) => tela.dados[y * tela.passo + 1 + x * 3]!;
  assert.equal(px(15, 15), 0);
  assert.ok(px(25, 15) > 240);
  assert.ok(px(5, 15) > 240);
});

test('um glifo reduzido conserva a proporção de tinta', () => {
  // Uma máscara 8×8 com a metade de cima a cheio.
  const alfa = new Uint8Array(64).map((_, i) => (i < 32 ? 255 : 0));
  const tela = new Tela(4, 4, [0, 0, 0]);
  tela.glifo(mascara(alfa, 8), 0, 0, 4, [255, 255, 255]);
  const px = (x: number, y: number) => tela.dados[y * tela.passo + 1 + x * 3]!;
  assert.equal(px(0, 0), 255);
  assert.equal(px(3, 1), 255);
  assert.equal(px(0, 2), 0);
  assert.equal(px(3, 3), 0);
});
