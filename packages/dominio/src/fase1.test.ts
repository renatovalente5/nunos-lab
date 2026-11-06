import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIAS_PARA_A_PRENDA, emailCurto, temPrendaHoje } from './index.ts';

test('o email curto distingue homónimos sem dar o email', () => {
  assert.equal(emailCurto('renato.lima@gmail.com'), 're…@gmail.com');
  assert.equal(emailCurto('a@x.pt'), 'a…@x.pt');
  assert.equal(emailCurto('semarroba'), 'se…');
  assert.equal(emailCurto(null), null);
  assert.equal(emailCurto(''), null);
});

test('a prenda de anos só com a data dada há 30 dias ou mais, e só no dia', () => {
  const hoje = '2026-11-06';
  const agora = Date.UTC(2026, 10, 6, 12) / 1000;
  const dia = 86400;
  assert.equal(temPrendaHoje('11-06', agora - DIAS_PARA_A_PRENDA * dia, hoje, agora), true);
  assert.equal(
    temPrendaHoje('11-06', agora - 29 * dia, hoje, agora),
    false,
    'dada há 29 dias não vale',
  );
  assert.equal(temPrendaHoje('11-06', agora, hoje, agora), false, 'dada hoje não vale');
  assert.equal(temPrendaHoje('11-06', null, hoje, agora), false, 'sem «desde» não vale');
  assert.equal(temPrendaHoje('11-07', agora - 100 * dia, hoje, agora), false, 'não é hoje');
  assert.equal(temPrendaHoje(null, agora - 100 * dia, hoje, agora), false);
  // O 29 de Fevereiro cai no 28 nos anos sem 29, como em fazAnosHoje.
  assert.equal(temPrendaHoje('02-29', 0, '2027-02-28', Date.UTC(2027, 1, 28) / 1000), true);
});
