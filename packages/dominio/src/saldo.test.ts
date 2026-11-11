import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  codigoDoConviteEscrito,
  convitesQueFaltam,
  euros,
  eurosComSinal,
  eurosParaUsar,
  gerarCodigo,
  nomeCurto,
} from './index.ts';

test('o saldo em euros: inteiros sem casas, cêntimos com duas (10 nov 2026)', () => {
  assert.equal(euros(100), '1 €');
  assert.equal(euros(250), '2,50 €');
  assert.equal(euros(5), '0,05 €');
  assert.equal(euros(-300), '−3 €');
  assert.equal(euros(0), '0 €');
  assert.equal(euros(100, 'en'), '€1');
  assert.equal(euros(250, 'en'), '€2.50');
  assert.equal(euros(-300, 'en'), '−€3');
  assert.equal(eurosComSinal(100), '+1 €');
  assert.equal(eurosComSinal(-200), '−2 €');
  assert.equal(eurosComSinal(100, 'en'), '+€1');
});

test('ao balcão usam-se euros inteiros, até ao saldo', () => {
  assert.equal(eurosParaUsar(0), 0);
  assert.equal(eurosParaUsar(99), 0);
  assert.equal(eurosParaUsar(100), 1);
  assert.equal(eurosParaUsar(350), 3);
  assert.equal(eurosParaUsar(-100), 0);
});

test('nos convites cada um vê do outro só o primeiro nome e a inicial', () => {
  assert.equal(nomeCurto('Pedro Miguel Santos'), 'Pedro S.');
  assert.equal(nomeCurto('  Ana  '), 'Ana');
  assert.equal(nomeCurto('joão álvares'), 'joão Á.');
  assert.equal(nomeCurto(''), '');
  assert.equal(convitesQueFaltam(10, 3), 7);
  assert.equal(convitesQueFaltam(10, 12), 0);
  assert.equal(convitesQueFaltam(null, 3), null);
});

test('o código de convite colado: a ligação com mais coisas, a frase, à mão (11 nov 2026)', () => {
  const codigo = gerarCodigo(new Uint8Array([1, 2, 3, 4, 5, 6, 7]));
  const curto = `${codigo.slice(0, 4)} ${codigo.slice(4)}`;
  for (const escrito of [
    codigo,
    codigo.toLowerCase(),
    curto,
    ` ${curto.toLowerCase()} `,
    `https://renatovalente5.github.io/nunos-lab/?convite=${codigo}`,
    `https://renatovalente5.github.io/nunos-lab/?convite=${codigo}&utm_source=whatsapp&fbclid=abc`,
    `https://exemplo.pt/?a=1&convite=${codigo.toLowerCase()}`,
    `Ganha 1 € no teu primeiro corte no Nuno’s Lab com o meu convite. Código: ${codigo}`,
    `Código: ${curto}`,
  ])
    assert.equal(codigoDoConviteEscrito(escrito), codigo, escrito);
  // O que não é um código fica como está (quem chama recusa-o).
  assert.notEqual(codigoDoConviteEscrito('ABCD'), codigo);
  assert.notEqual(codigoDoConviteEscrito('https://exemplo.pt/?outro=1'), codigo);
});
