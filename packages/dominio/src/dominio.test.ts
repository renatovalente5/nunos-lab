import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  contraste,
  corParaBranco,
  dataCurta,
  degrauDoDesconto,
  diaEmLisboa,
  diasEntre,
  eDiaValido,
  estadoDaPromocao,
  ligacaoDoTelefone,
  normalizarDestaque,
  normalizarEmail,
  normalizarInstagram,
  normalizarLigacao,
  normalizarSite,
  normalizarTelefone,
  periodoEmTexto,
  semPartir,
  somarDias,
  tintaSobre,
  validadeEmTexto,
} from './index.ts';

test('o dia de Lisboa muda à meia-noite de Lisboa, e não à de Londres no verão', () => {
  // 23:30 UTC de 14 de julho é 00:30 de 15 em Lisboa (hora de verão, UTC+1).
  assert.equal(diaEmLisboa(Date.UTC(2026, 6, 14, 23, 30)), '2026-07-15');
  // No inverno Lisboa está em UTC: 23:30 UTC ainda é dia 14.
  assert.equal(diaEmLisboa(Date.UTC(2026, 0, 14, 23, 30)), '2026-01-14');
});

test('só passam dias que existem', () => {
  assert.ok(eDiaValido('2028-02-29'));
  assert.ok(!eDiaValido('2026-02-29'));
  assert.ok(!eDiaValido('2026-13-01'));
  assert.ok(!eDiaValido('26-01-01'));
  assert.ok(!eDiaValido(null));
});

test('contas de dias atravessam meses e anos', () => {
  assert.equal(somarDias('2026-12-30', 3), '2027-01-02');
  assert.equal(somarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(diasEntre('2026-10-22', '2026-10-22'), 0);
  assert.equal(diasEntre('2026-10-22', '2026-11-01'), 10);
  assert.equal(diasEntre('2026-10-22', '2026-10-20'), -2);
  assert.equal(dataCurta('2026-12-31', '2026-10-22'), '31\u00A0dez');
  assert.equal(dataCurta('2027-01-05', '2026-10-22'), '5\u00A0jan\u00A02027');
});

test('o estado de uma promoção conta o início e o fim inteiros', () => {
  const base = { activa: true, inicio: '2026-11-01', fim: '2026-11-30' };
  assert.equal(estadoDaPromocao(base, '2026-10-31'), 'agendada');
  assert.equal(estadoDaPromocao(base, '2026-11-01'), 'activa');
  assert.equal(estadoDaPromocao(base, '2026-11-30'), 'activa');
  assert.equal(estadoDaPromocao(base, '2026-12-01'), 'terminada');
  assert.equal(estadoDaPromocao({ ...base, activa: false }, '2026-11-10'), 'pausada');
  assert.equal(estadoDaPromocao({ activa: true, inicio: null, fim: null }, '2030-01-01'), 'activa');
});

test('a validade diz-se como ao balcão', () => {
  const hoje = '2026-10-22'; // quinta-feira
  assert.equal(validadeEmTexto({ inicio: null, fim: null }, hoje), null);
  assert.equal(validadeEmTexto({ inicio: null, fim: '2026-10-22' }, hoje), 'Só hoje');
  assert.equal(validadeEmTexto({ inicio: null, fim: '2026-10-23' }, hoje), 'Até amanhã');
  assert.equal(validadeEmTexto({ inicio: null, fim: '2026-10-25' }, hoje), 'Até domingo');
  assert.equal(validadeEmTexto({ inicio: null, fim: '2026-10-29' }, hoje), 'Até 29\u00A0out');
  assert.equal(
    periodoEmTexto({ inicio: '2026-11-01', fim: '2026-11-30' }, hoje),
    '1\u00A0nov – 30\u00A0nov',
  );
  assert.equal(periodoEmTexto({ inicio: null, fim: null }, hoje), 'Sempre');
});

test('o destaque arruma-se, e arrumar duas vezes dá o mesmo', () => {
  const casos: [string, string][] = [
    ['-10%', '−10%'],
    ['  - 15 %  ', '−15%'],
    ['2x1', '2×1'],
    ['2 X 1', '2×1'],
    ['Grátis', 'Grátis'],
    ['−5 €', '−5 €'],
  ];
  for (const [entrada, saida] of casos) {
    assert.equal(normalizarDestaque(entrada), saida);
    assert.equal(normalizarDestaque(normalizarDestaque(entrada)), saida);
  }
});

test('os contactos aceitam-se como as pessoas os escrevem', () => {
  assert.equal(normalizarInstagram('@tasca.do_cravo'), 'tasca.do_cravo');
  assert.equal(normalizarInstagram('https://www.instagram.com/nunoslab/?hl=pt'), 'nunoslab');
  assert.equal(normalizarInstagram('m.instagram.com/tasca'), 'tasca');
  assert.equal(normalizarInstagram('https://instagram.com/stories/tasca/3141592/'), 'tasca');
  assert.equal(normalizarInstagram('https://www.instagram.com/p/C1abc/'), null);
  assert.equal(normalizarInstagram('https://www.instagram.com/reel/C1abc/?igsh=x'), null);
  assert.equal(normalizarInstagram('não serve'), null);
  assert.equal(normalizarInstagram(''), '');
  assert.equal(normalizarSite('tasca.pt'), 'https://tasca.pt/');
  assert.equal(normalizarSite('javascript:alert(1)'), null);
  assert.equal(normalizarSite('localhost'), null);
  assert.equal(normalizarLigacao('http://exemplo.pt'), null);
  assert.equal(normalizarLigacao('https://wa.link/abc'), 'https://wa.link/abc');
  assert.equal(normalizarTelefone(' 256  123 456 '), '256 123 456');
  assert.equal(normalizarTelefone('+351 912 345 678'), '+351 912 345 678');
  assert.equal(normalizarTelefone('12'), null);
  assert.equal(ligacaoDoTelefone('+351 912 345 678'), 'tel:+351912345678');
});

test('a tinta sobre uma cor é a que se lê', () => {
  assert.equal(tintaSobre('#111111'), '#FFFFFF');
  assert.equal(tintaSobre('#F4F1EC'), '#111111');
  assert.ok(contraste('#FFFFFF', '#000000') > 20);
});

test('o que se lê de uma vez não parte, e aplicar duas vezes dá o mesmo', () => {
  const J = '\u2060';
  const N = '\u00A0';
  assert.equal(semPartir('Sáb · 9:00–13:00'), `Sáb${N}· 9:00${J}–${J}13:00`);
  assert.equal(semPartir('−300 €'), `−300${N}€`);
  assert.equal(semPartir('9:00 - 19:00'), `9:00${J}-${J}19:00`);
  for (const t of ['Seg a sex · 9:00–19:00 · Sáb · 9:00–13:00', '−300 €', 'Grátis'])
    assert.equal(semPartir(semPartir(t)), semPartir(t));
});

test('um email compara-se sem espaços e em minúsculas', () => {
  assert.equal(normalizarEmail('  NunoDib16@Gmail.com '), 'nunodib16@gmail.com');
  assert.equal(normalizarEmail('sem-arroba'), null);
  assert.equal(normalizarEmail('a@b'), null);
});

test('a capa de um parceiro leva sempre texto branco que se lê', () => {
  assert.equal(corParaBranco('#26303D'), '#26303D', 'uma cor escura fica igual');
  for (const clara of ['#F2C94C', '#FFFFFF', '#9BE7FF', '#B4532A'])
    assert.ok(contraste(corParaBranco(clara), '#FFFFFF') >= 4.5, clara);
  assert.equal(corParaBranco('lixo'), '#26303D');
});

test('o desconto encolhe por degraus até às 12 letras do campo', () => {
  assert.equal(degrauDoDesconto('−10%'), 0);
  assert.equal(degrauDoDesconto('2×1'), 0);
  assert.equal(degrauDoDesconto('−300 €'), 1);
  assert.equal(degrauDoDesconto('Grátis'), 1);
  assert.equal(degrauDoDesconto('−1500 €'), 2);
  assert.equal(degrauDoDesconto('Uma semana'), 3);
  assert.equal(degrauDoDesconto('−50% 2.º par'), 3);
});

// ——— o cartão de carimbos ———

import {
  codigoCurto,
  codigoDoQr,
  codigoLido,
  codigoValido,
  gerarCodigo,
  normalizarCodigo,
  textoDoQr,
} from './cartao.ts';
import { donaDaCaixa, eAniversarioValido, estadoDoCartao, fraseDoCartao } from './fidelidade.ts';

test('o código do cartão: 8 letras, a última de controlo, e os erros de leitura corrigem-se', () => {
  const codigo = gerarCodigo(Uint8Array.from([7, 200, 3, 255, 31, 32, 64]));
  assert.equal(codigo.length, 8);
  assert.ok(codigoValido(codigo));
  // Uma letra trocada já não bate.
  const trocada = (codigo[0] === 'A' ? 'B' : 'A') + codigo.slice(1);
  assert.equal(codigoValido(trocada), false);
  // O que se escreve à mão: minúsculas, espaços, O por 0, I e L por 1.
  const escrito = codigoCurto(codigo).toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l');
  assert.equal(normalizarCodigo(escrito), codigo);
  assert.equal(codigoLido(escrito), codigo);
  // O QR leva o prefixo; outro QR qualquer não serve.
  assert.equal(codigoDoQr(textoDoQr(codigo)), codigo);
  assert.equal(codigoDoQr('https://exemplo.pt/x'), null);
  assert.equal(codigoLido('NL1.' + codigo), codigo);
  assert.equal(codigoLido('NL1.ABCDEFGH'), null);
  assert.equal(codigoCurto(codigo), `${codigo.slice(0, 4)} ${codigo.slice(4)}`);
  // Bytes diferentes dão códigos diferentes, e 256 é múltiplo de 32.
  assert.notEqual(codigo, gerarCodigo(Uint8Array.from([8, 200, 3, 255, 31, 32, 64])));
});

test('o estado do cartão e a frase', () => {
  assert.deepEqual(estadoDoCartao(7, 10), { faltam: 3, completo: false });
  assert.deepEqual(estadoDoCartao(10, 10), { faltam: 0, completo: true });
  assert.deepEqual(estadoDoCartao(12, 10), { faltam: 0, completo: true });
  const programa = { objectivo: 10, recompensa: 'Corte grátis' };
  assert.equal(fraseDoCartao(7, programa), 'Faltam 3 para corte grátis');
  assert.equal(fraseDoCartao(9, programa), 'O próximo corte é grátis');
  assert.equal(
    fraseDoCartao(9, { objectivo: 10, recompensa: '−50 % na barba' }),
    'O próximo é −50 % na barba',
  );
  assert.equal(fraseDoCartao(10, programa), 'Cartão completo');
  assert.equal(fraseDoCartao(3, { objectivo: 5, recompensa: '' }), 'Faltam 2');
});

test('aniversário e caixas de correio', () => {
  assert.ok(eAniversarioValido('02-29'));
  assert.ok(eAniversarioValido('12-31'));
  assert.equal(eAniversarioValido('02-30'), false);
  assert.equal(eAniversarioValido('13-01'), false);
  assert.equal(eAniversarioValido('2000-01-01'), false);
  assert.ok(donaDaCaixa('alguem@gmail.com'));
  assert.ok(donaDaCaixa('Alguem@iCloud.com'));
  assert.equal(donaDaCaixa('alguem@empresa.pt'), false);
});

// ——— os vales ———

import { inicioDoPeriodo, limiteEmTexto, motivoDaVantagem } from './vales.ts';

test('o início do período de um limite', () => {
  assert.equal(inicioDoPeriodo('dia', '2026-10-28'), '2026-10-28');
  assert.equal(inicioDoPeriodo('semana', '2026-10-28'), '2026-10-26', 'quarta → segunda');
  assert.equal(inicioDoPeriodo('semana', '2026-10-26'), '2026-10-26', 'segunda fica');
  assert.equal(inicioDoPeriodo('semana', '2026-11-01'), '2026-10-26', 'domingo → a segunda antes');
  assert.equal(inicioDoPeriodo('mes', '2026-10-28'), '2026-10-01');
  assert.equal(inicioDoPeriodo('sempre', '2026-10-28'), '0000-00-00');
});

test('o motivo de uma vantagem, por ordem', () => {
  const regras = {
    limitePorCliente: 1,
    periodoDoLimite: 'dia' as const,
    limiteTotal: 10,
    soClientesActivos: true,
  };
  assert.equal(
    motivoDaVantagem(regras, { usadasNoPeriodo: 0, usadasTotal: 0, activo: true }),
    'ok',
  );
  assert.equal(
    motivoDaVantagem(regras, { usadasNoPeriodo: 0, usadasTotal: 0, activo: false }),
    'cliente_inactivo',
  );
  assert.equal(
    motivoDaVantagem(regras, { usadasNoPeriodo: 0, usadasTotal: 10, activo: true }),
    'limite_total',
  );
  assert.equal(
    motivoDaVantagem(regras, { usadasNoPeriodo: 1, usadasTotal: 3, activo: true }),
    'ja_usou',
  );
  assert.equal(
    motivoDaVantagem(
      { ...regras, limitePorCliente: 2, periodoDoLimite: 'semana' },
      { usadasNoPeriodo: 2, usadasTotal: 3, activo: true },
    ),
    'limite_do_cliente',
  );
  assert.equal(
    motivoDaVantagem(
      { ...regras, limitePorCliente: null, limiteTotal: null, soClientesActivos: false },
      { usadasNoPeriodo: 99, usadasTotal: 99, activo: false },
    ),
    'ok',
  );
  assert.equal(limiteEmTexto({ limitePorCliente: 1, periodoDoLimite: 'dia' }), '1 por dia');
  assert.equal(limiteEmTexto({ limitePorCliente: 3, periodoDoLimite: 'sempre' }), '3 no total');
  assert.equal(limiteEmTexto({ limitePorCliente: null, periodoDoLimite: 'dia' }), null);
});
