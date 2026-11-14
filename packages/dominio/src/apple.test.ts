import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ORIGEM_DA_APPLE,
  corpoDoDesfechoDaApple,
  lerDesfechoDaApple,
  type DesfechoDaApple,
} from './apple.ts';
import { TIPOS_DE_CONTAGEM } from './tipos.ts';

const fechou: DesfechoDaApple = {
  desfecho: 'fechou',
  codigo: 'ERR_REQUEST_CANCELED',
  segundos: 23.4,
  tentativa: 2,
};

test('o desfecho da janela da Apple vai e volta, e cabe no que a API lê (200 caracteres)', () => {
  const corpo = corpoDoDesfechoDaApple(ORIGEM_DA_APPLE.cliente, fechou, 1);
  assert.ok(corpo.length <= 200, corpo);
  assert.deepEqual(lerDesfechoDaApple(JSON.parse(corpo)), {
    tipo: 'apple_fechou',
    ref: 1,
    desfecho: 'fechou',
    origem: 'cliente',
    codigo: 'ERR_REQUEST_CANCELED',
    segundos: 23,
    tentativa: 2,
    reenvios: 1,
  });
  // O pior caso continua a caber: o código mais comprido, os números no máximo.
  const pior = corpoDoDesfechoDaApple(
    ORIGEM_DA_APPLE.balcaoWeb,
    { desfecho: 'entrou', codigo: 'x'.repeat(500), segundos: 1e9, tentativa: 1e9 },
    1e9,
  );
  assert.ok(pior.length <= 200, pior);
  assert.deepEqual(lerDesfechoDaApple(JSON.parse(pior)), {
    tipo: 'apple_entrou',
    ref: 4,
    desfecho: 'entrou',
    origem: 'balcaoWeb',
    codigo: 'x'.repeat(40),
    segundos: 3600,
    tentativa: 99,
    reenvios: 9,
  });
});

test('os três desfechos são tipos de contagem, e mais nenhum «apple_» passa', () => {
  for (const desfecho of ['entrou', 'fechou', 'falhou'] as const) {
    const lido = lerDesfechoDaApple(
      JSON.parse(corpoDoDesfechoDaApple(ORIGEM_DA_APPLE.clienteWeb, { ...fechou, desfecho })),
    );
    assert.equal(lido?.desfecho, desfecho);
    assert.ok((TIPOS_DE_CONTAGEM as readonly string[]).includes(lido!.tipo), lido!.tipo);
  }
  assert.deepEqual(
    TIPOS_DE_CONTAGEM.filter((t) => t.startsWith('apple_')),
    ['apple_entrou', 'apple_fechou', 'apple_falhou'],
  );
  assert.equal(lerDesfechoDaApple({ tipo: 'apple_abriu', ref: 1 }), null);
  assert.equal(lerDesfechoDaApple({ tipo: 'apple_', ref: 1 }), null);
  assert.equal(lerDesfechoDaApple({ tipo: 'abrir', ref: 1 }), null);
});

test('sem origem conhecida não conta; o que vem torto fica limpo', () => {
  for (const ref of [0, 5, -1, 1.5, '1', null, undefined])
    assert.equal(lerDesfechoDaApple({ tipo: 'apple_fechou', ref }), null, String(ref));
  for (const dados of [null, undefined, 'apple_fechou', 7, []])
    assert.equal(lerDesfechoDaApple(dados), null);
  // Só a origem é obrigatória: o resto, em falta ou torto, fica no mínimo.
  assert.deepEqual(lerDesfechoDaApple({ tipo: 'apple_falhou', ref: 3 }), {
    tipo: 'apple_falhou',
    ref: 3,
    desfecho: 'falhou',
    origem: 'balcao',
    codigo: '',
    segundos: 0,
    tentativa: 1,
    reenvios: 0,
  });
  const torto = lerDesfechoDaApple({
    tipo: 'apple_falhou',
    ref: 2,
    c: 'popup_blocked<script>"\n · by_browser',
    s: -4,
    n: 'duas',
    r: Number.NaN,
  });
  assert.equal(torto?.codigo, 'popup_blockedscriptby_browser');
  assert.equal(torto?.segundos, 0);
  assert.equal(torto?.tentativa, 1);
  assert.equal(torto?.reenvios, 0);
});
