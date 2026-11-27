import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FOLGAS_DO_MAPA,
  FOLGAS_DO_MAPA_VIVO,
  enquadrar,
  AO_CENTRO_F2,
  AO_CENTRO_F3,
  folgasAoCentro,
  projectar,
  regiaoDoEnquadramento,
  versaoDasCasas,
} from './mapa.ts';

const casas = [
  { lat: 40.8840641, lng: -8.4517073 },
  { lat: 41.0484371, lng: -8.4890838 },
  { lat: 40.6457766, lng: -8.6408181 },
];

test('enquadrar: as casas ficam todas dentro das folgas, e a caixa toca uma delas', () => {
  const tamanhos: [number, number, typeof FOLGAS_DO_MAPA][] = [
    [358, 280, FOLGAS_DO_MAPA],
    [520, 400, FOLGAS_DO_MAPA],
    [320, 320, FOLGAS_DO_MAPA],
    [335, 419, FOLGAS_DO_MAPA_VIVO],
    [362, 453, FOLGAS_DO_MAPA_VIVO],
  ];
  for (const [w, h, FOLGAS] of tamanhos) {
    const e = enquadrar(casas, w, h, FOLGAS)!;
    const ps = casas.map((c) => projectar(c, e, w, h));
    for (const p of ps) {
      assert.ok(p.x >= FOLGAS.lados - 0.5 && p.x <= w - FOLGAS.lados + 0.5, `x ${p.x} em ${w}`);
      assert.ok(p.y >= FOLGAS.cima - 0.5 && p.y <= h - FOLGAS.baixo + 0.5, `y ${p.y} em ${h}`);
    }
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    const largura = Math.max(...xs) - Math.min(...xs);
    const altura = Math.max(...ys) - Math.min(...ys);
    const encosta =
      Math.abs(largura - (w - 2 * FOLGAS.lados)) < 1.5 ||
      Math.abs(altura - (h - FOLGAS.cima - FOLGAS.baixo)) < 1.5;
    assert.ok(encosta, `a caixa não encosta às folgas em ${w}×${h}`);
    assert.equal(e.z, Math.round(e.z * 100) / 100);
  }
});

test('enquadrar: as duas barbearias de agora ficam ao meio, com o nome inteiro', () => {
  // Nogueira do Cravo e Santa Maria da Feira, nos sítios do Google Maps (26 nov 2026).
  const agora = [
    { lat: 40.8849677, lng: -8.4551624 },
    { lat: 40.9272211, lng: -8.545357 },
  ];
  // A pastilha do nome vai até 150 px, ao meio do pino, e fica a 8 da borda.
  const meioNome = 150 / 2 + 8;
  for (const base of [FOLGAS_DO_MAPA_VIVO, FOLGAS_DO_MAPA]) {
    for (const [w, h] of [
      [343, 412],
      [358, 430],
      [398, 478],
      [520, 624],
    ] as const) {
      const folgas = folgasAoCentro(base, w, h);
      const e = enquadrar(agora, w, h, folgas)!;
      // Um pouco à direita do meio (o Renato arrastou-o 19 pontos num mapa de 350), sem mudar o zoom.
      const desvio = folgas.aDireita ?? 0;
      assert.ok(desvio >= 0.05 * w && desvio <= 0.06 * w, `desvio ${desvio} em ${w}`);
      for (const c of agora) {
        const p = projectar(c, e, w, h);
        // No terço do meio (como o Renato o pôs no iPhone) mais o desvio, e com o nome inteiro no mapa vivo.
        assert.ok(
          p.x >= w / 3 + desvio - 1 && p.x <= (w * 2) / 3 + desvio + 1,
          `fora do meio: x ${p.x.toFixed(1)} em ${w}`,
        );
        if (base === FOLGAS_DO_MAPA_VIVO)
          assert.ok(p.x >= meioNome && p.x <= w - meioNome, `nome cortado: x ${p.x.toFixed(1)}`);
        assert.ok(p.y >= h / 4 && p.y <= (h * 3) / 4, `fora do meio: y ${p.y.toFixed(1)} em ${h}`);
      }
      // Vê-se o mar: a borda de oeste passa a costa de Espinho (-8,646), como na captura dele (27 nov).
      const r = regiaoDoEnquadramento(e, w, h);
      const oeste = r.lng - r.lngDelta / 2;
      assert.ok(oeste <= -8.648, `sem mar: a borda de oeste é ${oeste.toFixed(4)} em ${w}`);
    }
  }
});

test('folgasAoCentro: uma parte do mapa, nunca menos do que as de base', () => {
  // Como o Renato o pôs no iPhone: um terço de cada lado, um quarto em cima e em baixo, e 5,5 % à direita.
  assert.deepEqual(folgasAoCentro(FOLGAS_DO_MAPA_VIVO, 520, 624), {
    cima: 156,
    baixo: 156,
    lados: 173,
    aDireita: 29,
  });
  // O «f=3» de 26 nov não muda (as apps que o pedem desenham os pinos com ele).
  assert.deepEqual(folgasAoCentro(FOLGAS_DO_MAPA_VIVO, 520, 624, AO_CENTRO_F3), {
    cima: 156,
    baixo: 156,
    lados: 173,
  });
  // O desvio nunca come a folga de base do lado direito (o nome da casa mais a leste).
  const estreito = folgasAoCentro(FOLGAS_DO_MAPA_VIVO, 280, 336);
  assert.equal(estreito.lados - (estreito.aDireita ?? 0), FOLGAS_DO_MAPA_VIVO.lados);
  // O «f=2» de antes não muda (as apps que o pedem desenham os pinos com ele).
  assert.deepEqual(folgasAoCentro(FOLGAS_DO_MAPA_VIVO, 520, 624, AO_CENTRO_F2), {
    cima: 150,
    baixo: 125,
    lados: 140,
  });
  // Num mapa pequeno ficam as de base (o balão, o «Legal», o nome).
  assert.deepEqual(folgasAoCentro(FOLGAS_DO_MAPA_VIVO, 200, 240), FOLGAS_DO_MAPA_VIVO);
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

test('a região do enquadramento é a imagem em graus: as casas dentro, as bordas onde a imagem acaba', () => {
  const [w, h] = [358, 376];
  const e = enquadrar(casas, w, h)!;
  const r = regiaoDoEnquadramento(e, w, h);
  for (const c of casas) {
    assert.ok(Math.abs(c.lat - r.lat) < r.latDelta / 2, `lat ${c.lat}`);
    assert.ok(Math.abs(c.lng - r.lng) < r.lngDelta / 2, `lng ${c.lng}`);
  }
  // O canto de cima à esquerda da região cai no canto da imagem.
  const canto = projectar({ lat: r.lat + r.latDelta / 2, lng: r.lng - r.lngDelta / 2 }, e, w, h);
  assert.ok(Math.abs(canto.x) < 0.5 && Math.abs(canto.y) < 1, `canto em ${canto.x}, ${canto.y}`);
});
