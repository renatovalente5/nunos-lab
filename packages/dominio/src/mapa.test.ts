import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FOLGAS_DO_MAPA, enquadrar, projectar, versaoDasCasas } from './mapa.ts';

const casas = [
  { lat: 40.8840641, lng: -8.4517073 },
  { lat: 41.0484371, lng: -8.4890838 },
  { lat: 40.6457766, lng: -8.6408181 },
];

test('enquadrar: as casas ficam todas dentro das folgas, e a caixa toca uma delas', () => {
  const tamanhos: [number, number][] = [
    [358, 280],
    [520, 400],
    [320, 320],
  ];
  for (const [w, h] of tamanhos) {
    const e = enquadrar(casas, w, h)!;
    const ps = casas.map((c) => projectar(c, e, w, h));
    for (const p of ps) {
      assert.ok(
        p.x >= FOLGAS_DO_MAPA.lados - 0.5 && p.x <= w - FOLGAS_DO_MAPA.lados + 0.5,
        `x ${p.x} em ${w}`,
      );
      assert.ok(
        p.y >= FOLGAS_DO_MAPA.cima - 0.5 && p.y <= h - FOLGAS_DO_MAPA.baixo + 0.5,
        `y ${p.y} em ${h}`,
      );
    }
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    const largura = Math.max(...xs) - Math.min(...xs);
    const altura = Math.max(...ys) - Math.min(...ys);
    const encosta =
      Math.abs(largura - (w - 2 * FOLGAS_DO_MAPA.lados)) < 1.5 ||
      Math.abs(altura - (h - FOLGAS_DO_MAPA.cima - FOLGAS_DO_MAPA.baixo)) < 1.5;
    assert.ok(encosta, `a caixa não encosta às folgas em ${w}×${h}`);
    assert.equal(e.z, Math.round(e.z * 100) / 100);
  }
});

test('enquadrar: uma casa só fica ao centro, à escala da vila; sem casas não há mapa', () => {
  const e = enquadrar([casas[0]!], 358, 280)!;
  assert.equal(e.z, 13);
  const p = projectar(casas[0]!, e, 358, 280);
  assert.ok(Math.abs(p.x - 179) < 0.5);
  assert.ok(Math.abs(p.y - (280 / 2 + (FOLGAS_DO_MAPA.cima - FOLGAS_DO_MAPA.baixo) / 2)) < 0.5);
  assert.equal(enquadrar([], 358, 280), null);
});

test('a impressão das casas muda quando uma casa muda de sítio, e só aí', () => {
  const casas = [
    { lat: 40.8551, lng: -8.4512 },
    { lat: 40.926, lng: -8.5413 },
    { lat: null, lng: null },
  ];
  const v = versaoDasCasas(casas);
  assert.equal(
    versaoDasCasas(casas.map((c) => ({ ...c }))),
    v,
    'as mesmas casas, a mesma impressão',
  );
  assert.equal(versaoDasCasas(casas.slice(0, 2)), v, 'uma casa sem sítio não conta');
  assert.notEqual(versaoDasCasas([{ lat: 40.8552, lng: -8.4512 }, casas[1]!]), v);
  assert.notEqual(versaoDasCasas([...casas, { lat: 40.64, lng: -8.65 }]), v, 'uma casa nova');
});
