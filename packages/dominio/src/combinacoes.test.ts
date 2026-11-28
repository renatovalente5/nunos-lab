/**
 * Combinações ao acaso (com semente) das contas novas de 27 nov 2026: cêntimos, saldo ao balcão, dias das
 * vantagens, horas e leitura do QR do balcão, distância, e o ajuste do logótipo.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALFABETO_DO_CODIGO,
  FOLGA_DO_MEIO,
  LIMITES_DO_AJUSTE,
  RAIO_DO_BALCAO,
  FOLGA_DA_PRECISAO,
  ajusteAoMeio,
  ajusteAproximado,
  ajusteCheio,
  ajusteInteiro,
  centimosDoTexto,
  codigoDoBalcaoLido,
  dentroDasHorasDoQr,
  distanciaEmMetros,
  eurosNoCampo,
  ligacaoDoBalcao,
  pertoDoBalcao,
  temAsVantagens,
  valoresParaUsar,
} from './index.ts';

/** Um gerador ao acaso com semente (mulberry32): a mesma corrida dá os mesmos casos. */
function acaso(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = acaso(20261127);
const inteiro = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));

test('cêntimos: escrever e ler dão o mesmo, em pt e en, com € e espaços', () => {
  for (let i = 0; i < 20_000; i++) {
    const c = i < 1000 ? i : inteiro(0, 99_999_999);
    for (const lingua of ['pt', 'en'] as const) {
      const t = eurosNoCampo(c, lingua);
      assert.equal(centimosDoTexto(t), c, `${c} → «${t}»`);
      assert.equal(centimosDoTexto(` ${t} €`), c);
      assert.equal(centimosDoTexto(`€ ${t}`), c);
      assert.equal(centimosDoTexto(`€${t}`), c);
    }
  }
  for (const [texto, c] of [
    ['1,5', 150],
    ['1.5', 150],
    ['1,05', 105],
    ['0,5', 50],
    ['0', 0],
    ['0,00', 0],
    ['01', 100],
    ['2 €', 200],
    ['999999,99', 99_999_999],
    ['1,50 €', 150],
    [' 1,5 ', 150],
  ] as const)
    assert.equal(centimosDoTexto(texto), c, `«${texto}»`);
  for (const mau of [
    '',
    ' ',
    '-1',
    '−1',
    '1,555',
    '1.234,50',
    '1 234',
    '1e3',
    'abc',
    '1,',
    ',5',
    '.5',
    '1..5',
    '€',
    '€€1',
    '１',
    '1000000',
    '1,5,0',
    '+1',
    'NaN',
    'Infinity',
    '0x10',
    '1 ,5',
  ])
    assert.equal(centimosDoTexto(mau), null, `«${mau}» devia ser recusado`);
});

test('o saldo ao balcão: os valores nunca passam do saldo nem dos 500 €, sobem, e o último é o máximo', () => {
  const MAX = 50_000;
  for (let saldo = -500; saldo <= 70_000; saldo += saldo < 1000 ? 1 : 37) {
    const v = valoresParaUsar(saldo);
    if (saldo <= 0) {
      assert.deepEqual(v, [], `saldo ${saldo}`);
      continue;
    }
    const ate = Math.min(saldo, MAX);
    assert.ok(v.length > 0);
    assert.equal(v.at(-1), ate, `saldo ${saldo}: o último é o saldo todo (até 500 €)`);
    for (let i = 1; i < v.length; i++) assert.ok(v[i]! > v[i - 1]!, `saldo ${saldo}: sobe`);
    assert.ok(v.every((x) => x > 0 && x <= ate && Number.isInteger(x)));
    assert.equal(v.length, Math.floor(ate / 100) + (ate % 100 ? 1 : 0));
    assert.ok(v.slice(0, Math.floor(ate / 100)).every((x, i) => x === (i + 1) * 100));
  }
  assert.deepEqual(valoresParaUsar(Number.NaN), []);
});

test('os dias das vantagens: a fronteira é estrita, e nenhum corte não dá vantagens', () => {
  for (let i = 0; i < 50_000; i++) {
    const dias = inteiro(7, 730);
    const agora = inteiro(1_700_000_000, 1_900_000_000);
    const ultimo = agora - inteiro(-86_400, 800 * 86_400);
    assert.equal(temAsVantagens(ultimo, dias, agora), ultimo > agora - dias * 86_400);
  }
  assert.equal(temAsVantagens(null, 45, 1_800_000_000), false);
  const agora = 1_800_000_000;
  assert.equal(temAsVantagens(agora - 45 * 86_400 + 1, 45, agora), true);
  assert.equal(temAsVantagens(agora - 45 * 86_400, 45, agora), false);
});

/** A hora de Lisboa, à mão: UTC+1 do último domingo de março (01:00 UTC) ao último de outubro (01:00 UTC). */
function horaDeLisboaAMao(ms: number): number {
  const d = new Date(ms);
  const ano = d.getUTCFullYear();
  const ultimoDomingo = (mes: number) => {
    const fim = new Date(Date.UTC(ano, mes + 1, 0));
    return Date.UTC(ano, mes, fim.getUTCDate() - fim.getUTCDay(), 1);
  };
  const verao = ms >= ultimoDomingo(2) && ms < ultimoDomingo(9);
  return (d.getUTCHours() + (verao ? 1 : 0)) % 24;
}

test('as horas do QR: das 8h às 22h de Lisboa, minuto a minuto, nos dias da mudança da hora e noutros', () => {
  const dias = [
    '2026-03-28',
    '2026-03-29',
    '2026-03-30',
    '2026-10-24',
    '2026-10-25',
    '2026-10-26',
    '2026-11-27',
    '2027-03-28',
    '2026-06-21',
    '2026-12-31',
  ];
  for (const dia of dias) {
    const inicio = Date.parse(`${dia}T00:00:00Z`) - 2 * 3600_000;
    for (let m = 0; m < 28 * 60; m++) {
      const t = inicio + m * 60_000;
      const h = horaDeLisboaAMao(t);
      assert.equal(
        dentroDasHorasDoQr(t),
        h >= 8 && h < 22,
        `${new Date(t).toISOString()} (Lisboa ${h}h)`,
      );
    }
  }
});

test('ler o QR do balcão: a ligação de qualquer morada, com outros parâmetros, maiúsculas ou minúsculas', () => {
  const codigoAoAcaso = () =>
    Array.from({ length: 16 }, () => ALFABETO_DO_CODIGO[inteiro(0, 31)]).join('');
  const sitios = [
    'https://renatovalente5.github.io/nunos-lab',
    'https://renatovalente5.github.io/nunos-lab/',
    'https://app.nunoslab.pt',
    'http://localhost:8872',
    'nunoslab://',
  ];
  for (let i = 0; i < 3000; i++) {
    const codigo = codigoAoAcaso();
    const sitio = sitios[i % sitios.length]!;
    const ligacao = ligacaoDoBalcao(codigo, sitio);
    assert.equal(codigoDoBalcaoLido(ligacao), codigo, ligacao);
    assert.equal(codigoDoBalcaoLido(ligacao.toLowerCase()), codigo, 'em minúsculas');
    assert.equal(codigoDoBalcaoLido(` ${ligacao}\n`), codigo, 'com espaços');
    assert.equal(
      codigoDoBalcaoLido(`${ligacao}&utm_source=qr`),
      codigo,
      'com mais parâmetros depois',
    );
    assert.equal(
      codigoDoBalcaoLido(`${sitio}/?x=1&balcao=${codigo}`),
      codigo,
      'com parâmetros antes',
    );
    assert.equal(codigoDoBalcaoLido(`${ligacao}#topo`), codigo, 'com âncora');
    assert.equal(codigoDoBalcaoLido(codigo), codigo, 'o código sozinho');
    assert.equal(codigoDoBalcaoLido(codigo.toLowerCase()), codigo);
    assert.equal(codigoDoBalcaoLido(`${ligacao}X`), null, '17 letras na ligação');
    assert.equal(codigoDoBalcaoLido(codigo.slice(1)), null, '15 letras');
  }
  for (const nao of [
    '',
    'https://renatovalente5.github.io/nunos-lab/',
    'https://renatovalente5.github.io/nunos-lab/?convite=ABCDEFGH',
    'ABCDEFGH',
    'nunoslab://cartao/ABCDEFGH',
    'IIIIIIIIIIIIIIII',
    'OOOOOOOOOOOOOOOO',
    'https://exemplo.pt/?xbalcao=0123456789ABCDEF',
  ])
    assert.equal(codigoDoBalcaoLido(nao), null, `«${nao}» não é um QR do balcão`);
});

test('a distância: zero no mesmo sítio, simétrica, desigualdade triangular, e bate com a conta plana a poucos metros', () => {
  const lugar = () => ({ lat: 37 + r() * 5, lng: -9.5 + r() * 3 });
  for (let i = 0; i < 20_000; i++) {
    const a = lugar();
    const b = { lat: a.lat + (r() - 0.5) * 0.01, lng: a.lng + (r() - 0.5) * 0.01 };
    const c = lugar();
    assert.equal(distanciaEmMetros(a, a), 0);
    assert.ok(Math.abs(distanciaEmMetros(a, b) - distanciaEmMetros(b, a)) < 1e-6);
    assert.ok(distanciaEmMetros(a, c) <= distanciaEmMetros(a, b) + distanciaEmMetros(b, c) + 1e-6);
    const plana =
      6_371_008.8 *
      Math.hypot(
        ((b.lat - a.lat) * Math.PI) / 180,
        (((b.lng - a.lng) * Math.PI) / 180) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180),
      );
    assert.ok(
      Math.abs(distanciaEmMetros(a, b) - plana) < 0.5 + plana * 0.002,
      `${distanciaEmMetros(a, b)} vs ${plana}`,
    );
  }
});

test('perto do balcão: mais longe nunca entra quando mais perto não entra; a folga só até 100 m', () => {
  const loja = { lat: 40.84, lng: -8.52 };
  for (let i = 0; i < 20_000; i++) {
    const metros = r() * 600;
    const precisao = r() < 0.1 ? r() * 10_000 : r() * 200;
    const p = { lat: loja.lat + metros / 111_195.08, lng: loja.lng, precisao };
    const d = distanciaEmMetros(p, loja);
    assert.equal(
      pertoDoBalcao(p, loja),
      d <= RAIO_DO_BALCAO + Math.min(precisao, FOLGA_DA_PRECISAO),
    );
  }
  for (const mau of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])
    for (const campo of ['lat', 'lng', 'precisao'] as const)
      assert.equal(
        pertoDoBalcao({ lat: loja.lat, lng: loja.lng, precisao: 5, [campo]: mau }, loja),
        false,
      );
  assert.equal(
    pertoDoBalcao({ ...loja, precisao: -50 }, loja),
    true,
    'precisão negativa conta como 0',
  );
});

test('o logótipo: aproximar à volta de um ponto deixa-o no sítio, e afastar volta atrás', () => {
  for (let i = 0; i < 20_000; i++) {
    const a = {
      fundo: '#FFFFFF',
      zoom: 0.3 + r() * 2.7,
      x: (r() - 0.5) * 1.2,
      y: (r() - 0.5) * 1.2,
    };
    const ponto = { x: r() - 0.5, y: r() - 0.5 };
    const factor = Math.exp((r() - 0.5) * 2);
    const b = ajusteAproximado(a, factor, ponto);
    assert.ok(
      b.zoom >= LIMITES_DO_AJUSTE.zoom.min && b.zoom <= LIMITES_DO_AJUSTE.zoom.max,
      `zoom ${b.zoom}`,
    );
    assert.ok(
      Math.abs(b.x) <= LIMITES_DO_AJUSTE.desvio && Math.abs(b.y) <= LIMITES_DO_AJUSTE.desvio,
    );
    assert.ok([b.zoom, b.x, b.y].every(Number.isFinite));
    const semLimites =
      a.zoom * factor >= LIMITES_DO_AJUSTE.zoom.min &&
      a.zoom * factor <= LIMITES_DO_AJUSTE.zoom.max &&
      Math.abs(ponto.x - (ponto.x - a.x) * factor) <= 1 &&
      Math.abs(ponto.y - (ponto.y - a.y) * factor) <= 1;
    if (semLimites) {
      // O ponto da imagem debaixo do «ponto» é o mesmo antes e depois (em coordenadas da imagem).
      const antes = { x: (ponto.x - a.x) / a.zoom, y: (ponto.y - a.y) / a.zoom };
      const depois = { x: (ponto.x - b.x) / b.zoom, y: (ponto.y - b.y) / b.zoom };
      assert.ok(
        Math.abs(antes.x - depois.x) < 0.01 && Math.abs(antes.y - depois.y) < 0.01,
        json({ a, b, ponto, factor }),
      );
      const c = ajusteAproximado(b, 1 / factor, ponto);
      assert.ok(
        Math.abs(c.zoom - a.zoom) < 0.01 &&
          Math.abs(c.x - a.x) < 0.01 &&
          Math.abs(c.y - a.y) < 0.01,
        json({ a, c }),
      );
    }
  }
  const a = { fundo: '#FFFFFF', zoom: 1, x: 0.2, y: -0.1 };
  for (const mau of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1])
    assert.ok([ajusteAproximado(a, mau).zoom].every(Number.isFinite), `factor ${mau}`);
});

test('o logótipo: «Inteiro» põe os quatro cantos dentro do círculo; «Encher» cobre o círculo (até ao limite)', () => {
  const a = { fundo: '#000000', zoom: 1, x: 0.3, y: 0.3 };
  for (let i = 0; i < 20_000; i++) {
    const proporcao = Math.exp((r() - 0.5) * 6); // de ~0,05 a ~20
    const inteiro = ajusteInteiro(a, proporcao);
    // zoom = o lado maior da imagem, em fracções do diâmetro; o outro lado = zoom / max(p, 1/p).
    const maior = inteiro.zoom;
    const menor = maior / Math.max(proporcao, 1 / proporcao);
    assert.ok(Math.hypot(maior, menor) <= 1 + 1e-3, `cantos fora: ${proporcao}`);
    assert.ok(Math.hypot(maior, menor) >= 0.9, `pequeno de mais: ${proporcao}`);
    assert.deepEqual([inteiro.x, inteiro.y], [0, 0]);
    const cheio = ajusteCheio(a, proporcao);
    const menorCheio = cheio.zoom / Math.max(proporcao, 1 / proporcao);
    if (Math.max(proporcao, 1 / proporcao) <= LIMITES_DO_AJUSTE.zoom.max)
      assert.ok(menorCheio >= 1 - 1e-3, `não cobre: ${proporcao} → ${cheio.zoom}`);
    else assert.equal(cheio.zoom, LIMITES_DO_AJUSTE.zoom.max);
  }
  for (const mau of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    assert.ok(
      Number.isFinite(ajusteInteiro(a, mau).zoom) && Number.isFinite(ajusteCheio(a, mau).zoom),
    );
});

test('o logótipo: puxar ao meio é idempotente e só dentro da folga', () => {
  for (let i = 0; i < 20_000; i++) {
    const a = { fundo: '#FFFFFF', zoom: 1, x: (r() - 0.5) * 0.06, y: (r() - 0.5) * 0.06 };
    const { ajuste, x, y } = ajusteAoMeio(a);
    assert.equal(x, Math.abs(a.x) < FOLGA_DO_MEIO);
    assert.equal(y, Math.abs(a.y) < FOLGA_DO_MEIO);
    assert.equal(ajuste.x, x ? 0 : a.x);
    assert.equal(ajuste.y, y ? 0 : a.y);
    assert.deepEqual(ajusteAoMeio(ajuste).ajuste, ajuste);
  }
});

const json = (o: unknown) => JSON.stringify(o);
