import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codigoDepoisDe, codigoEscrito } from './index.ts';

test('o código escrito ou colado fica só com os seis algarismos (28 nov 2026)', () => {
  assert.equal(codigoEscrito(''), '');
  assert.equal(codigoEscrito('1'), '1');
  assert.equal(codigoEscrito('12a3'), '123');
  assert.equal(codigoEscrito('123456'), '123456');
  assert.equal(codigoEscrito('012345'), '012345', 'o zero à frente conta');
  assert.equal(codigoEscrito('123 456'), '123456');
  assert.equal(codigoEscrito('Código: 654321'), '654321');
  assert.equal(codigoEscrito('654321 é o teu código do Nuno’s Lab'), '654321');
  assert.equal(codigoEscrito('28/11/2026 · 654321'), '654321', 'a data não é o código');
  assert.equal(codigoEscrito('1234567'), '123456', 'algarismos a mais: os primeiros seis');
  assert.equal(codigoEscrito('１２３'), '', 'só os algarismos de 0 a 9');
});

test('o preenchimento automático acrescenta ao que já lá estava, e ganha', () => {
  assert.equal(codigoDepoisDe('', '1'), '1');
  assert.equal(codigoDepoisDe('12', '123'), '123');
  assert.equal(codigoDepoisDe('12', '12654321'), '654321', 'o iPhone pôs o código depois do «12»');
  assert.equal(codigoDepoisDe('12', '1'), '1', 'apagar');
  assert.equal(codigoDepoisDe('123456', '1234567'), '123456', 'um a mais não estraga');
  assert.equal(codigoDepoisDe('', 'Código: 654321'), '654321');
  assert.equal(codigoDepoisDe('12', '654321'), '654321', 'colado por cima de tudo');
});
