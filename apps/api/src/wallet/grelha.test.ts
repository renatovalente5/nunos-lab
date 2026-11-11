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

test('a faixa tem as medidas da Apple e pinta a casa dada a creme e a por dar a preto, com a tesoura clara', async () => {
  const f = lerPng(await faixa({ carimbos: 7, objectivo: 10 }, 2));
  assert.equal(f.largura, 750);
  assert.equal(f.altura, 288);
  const { centros, lado } = dispor(10, { x: 24, y: 16, largura: 327, altura: 112 });
  const [cx, cy] = centros[0]!;
  // Entre o centro (a tesoura) e a borda, o disco é creme.
  assert.deepEqual(f.pixel(Math.round((cx - lado * 0.4) * 2), Math.round(cy * 2)), [244, 241, 236]);
  const [vx, vy] = centros[8]!;
  // Fora da tesoura clara (que ocupa 44% da casa ao centro) e dentro do aro, a casa por dar é preta.
  assert.deepEqual(f.pixel(Math.round((vx + lado * 0.32) * 2), Math.round(vy * 2)), [10, 10, 10]);
  // E a tesoura clara está lá: na casa por dar há píxeis mais claros do que o fundo, perto do centro.
  let claros = 0;
  for (let dx = -8; dx <= 8; dx++)
    for (let dy = -8; dy <= 8; dy++) {
      const [r] = f.pixel(Math.round(vx * 2) + dx, Math.round(vy * 2) + dy);
      if (r > 20) claros++;
    }
  assert.ok(claros > 5, `píxeis da tesoura clara: ${claros}`);
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

test('o «n» da marca vai no fundo do poster, quase apagado, por baixo das casas; a faixa e a hero não o levam', async () => {
  const a = lerPng(await arte({ carimbos: 3, objectivo: 10 }, 3));
  // A perna do «n» (do x 164 ao 208, ao alto), acima das casas: branco a 7 % sobre o fundo (10 + 0,07 × 245 ≈ 27).
  const [r, g, b] = a.pixel(186 * 3, 20 * 3);
  assert.ok(r === g && g === b && r >= 22 && r <= 32, `perna do «n»: ${r}`);
  assert.deepEqual(a.pixel(100 * 3, 20 * 3), [10, 10, 10], 'fora do «n», o fundo');
  assert.deepEqual(a.pixel(20 * 3, 420 * 3), [10, 10, 10], 'em baixo, à esquerda, o fundo');
  // A 3.ª casa (dada, a creme) fica por cima da perna do «n», sem mistura.
  const { centros, lado } = dispor(10, { x: 30, y: 47, largura: 298, altura: 139 });
  const [cx, cy] = centros[2]!;
  assert.ok(cx > 164 && cx < 208, 'a 3.ª casa está por cima da perna');
  assert.deepEqual(a.pixel(Math.round((cx - lado * 0.4) * 3), Math.round(cy * 3)), [244, 241, 236]);
  // Na faixa (iOS antigos) e na hero da Google, a mesma zona é só fundo.
  const f = lerPng(await faixa({ carimbos: 3, objectivo: 10 }, 3));
  assert.deepEqual(f.pixel(186 * 3, 8 * 3), [10, 10, 10]);
  const h = lerPng(await hero({ carimbos: 3, objectivo: 10 }));
  assert.deepEqual(h.pixel(1000, 30), [10, 10, 10]);
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
