import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arte, dispor, faixa, hero, imagensDoCartao } from './grelha.ts';
import { lerPng } from './png-leitor.test.ts';

test('as casas cabem na zona para qualquer objectivo de 1 a 50', () => {
  const zona = { x: 24, y: 16, largura: 327, altura: 112 };
  for (let n = 1; n <= 50; n++) {
    const { lado, centros } = dispor(n, zona);
    assert.equal(centros.length, n);
    assert.ok(lado <= 44 && lado > 10, `objectivo ${n}: lado ${lado}`);
    for (const [x, y] of centros) {
      assert.ok(
        x - lado / 2 >= zona.x - 0.01 && x + lado / 2 <= zona.x + zona.largura + 0.01,
        `${n}: x ${x}`,
      );
      assert.ok(
        y - lado / 2 >= zona.y - 0.01 && y + lado / 2 <= zona.y + zona.altura + 0.01,
        `${n}: y ${y}`,
      );
    }
  }
});

test('dez casas vão em duas linhas de cinco, a 44, centradas', () => {
  const { lado, centros } = dispor(10, { x: 0, y: 0, largura: 375, altura: 144 });
  assert.equal(lado, 44);
  assert.equal(centros[0]![1], centros[4]![1]);
  assert.notEqual(centros[0]![1], centros[5]![1]);
  assert.equal(centros[0]![0] + centros[4]![0], 375);
  assert.equal(centros[0]![1] + centros[5]![1], 144);
});

test('a faixa tem as medidas da Apple e pinta a casa dada a creme e a por dar a preto', async () => {
  const f = lerPng(await faixa({ carimbos: 7, objectivo: 10 }, 2));
  assert.equal(f.largura, 750);
  assert.equal(f.altura, 288);
  const { centros, lado } = dispor(10, { x: 24, y: 16, largura: 327, altura: 112 });
  const [cx, cy] = centros[0]!;
  // Entre o centro (a tesoura) e a borda, o disco é creme.
  assert.deepEqual(f.pixel(Math.round((cx - lado * 0.4) * 2), Math.round(cy * 2)), [244, 241, 236]);
  const [vx, vy] = centros[8]!;
  assert.deepEqual(f.pixel(Math.round(vx * 2), Math.round(vy * 2)), [10, 10, 10]);
  assert.deepEqual(f.pixel(0, 0), [10, 10, 10]);
});

test('a arte do poster e a hero da Google têm as medidas certas', async () => {
  const a = lerPng(await arte({ carimbos: 0, objectivo: 10 }, 3));
  assert.equal(a.largura, 1074);
  assert.equal(a.altura, 1344);
  const h = lerPng(await hero({ carimbos: 10, objectivo: 10 }));
  assert.equal(h.largura, 1032);
  assert.equal(h.altura, 812);
});

test('as imagens do cartão são quatro, e um estado impossível é corrigido', async () => {
  const imagens = await imagensDoCartao({ carimbos: 99, objectivo: 999 });
  assert.deepEqual(Object.keys(imagens).sort(), [
    'artwork@2x.png',
    'artwork@3x.png',
    'strip@2x.png',
    'strip@3x.png',
  ]);
  assert.equal(lerPng(imagens['strip@3x.png']!).largura, 1125);
});
