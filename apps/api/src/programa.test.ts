import assert from 'node:assert/strict';
import { test } from 'node:test';
import { horaEmLisboa, inicioDoDia } from './programa.ts';

test('o dia em Lisboa começa à hora certa de verão, de inverno e nos dias da mudança', () => {
  const inicio = (dia: string) => new Date(inicioDoDia(dia) * 1000).toISOString();
  assert.equal(inicio('2026-07-01'), '2026-06-30T23:00:00.000Z');
  assert.equal(inicio('2026-11-10'), '2026-11-10T00:00:00.000Z');
  // 25 out 2026: a hora muda à 01:00 UTC; à meia-noite em Lisboa ainda é verão.
  assert.equal(inicio('2026-10-25'), '2026-10-24T23:00:00.000Z');
  assert.equal(inicio('2026-10-26'), '2026-10-26T00:00:00.000Z');
  // 29 mar 2026: a hora muda à 01:00 UTC; à meia-noite em Lisboa ainda é inverno.
  assert.equal(inicio('2026-03-29'), '2026-03-29T00:00:00.000Z');
  assert.equal(inicio('2026-03-30'), '2026-03-29T23:00:00.000Z');
});

test('a hora em Lisboa', () => {
  assert.equal(horaEmLisboa(Date.UTC(2026, 6, 1, 12) / 1000), 13);
  assert.equal(horaEmLisboa(Date.UTC(2026, 0, 1, 12) / 1000), 12);
});
