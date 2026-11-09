import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AJUSTE_DE_ORIGEM,
  caixaDoLogotipo,
  lerAjusteDoLogotipo,
  limitarAjuste,
  DESENHOS_DAS_CATEGORIAS,
  ICONES_DAS_APPS_ANTIGAS,
  ICONES_DAS_CATEGORIAS,
  NOMES_DOS_DESENHOS,
  NOMES_DOS_DESENHOS_EN,
  PARECIDO_PARA_AS_APPS_ANTIGAS,
  categoriaParaAsApps,
  contraste,
  corParaBranco,
  dataCurta,
  degrauDoDesconto,
  diaEmLisboa,
  diasEntre,
  eDiaValido,
  estadoDaPromocao,
  fazAnosHoje,
  limparNome,
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
  textoDeBusca,
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
  assert.equal(semPartir('9h–12h30 e 14h30–19h'), `9h${J}–${J}12h30 e 14h30${J}–${J}19h`);
  for (const t of [
    'Seg a sex · 9:00–19:00 · Sáb · 9:00–13:00',
    '9h–12h30 e 14h30–19h',
    '−300 €',
    'Grátis',
  ])
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
import {
  donaDaCaixa,
  eAniversarioValido,
  estadoDoCartao,
  fraseDesteCorte,
  fraseDoCartao,
  fraseDoCorteOferecido,
  fraseDoProximo,
} from './fidelidade.ts';

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
  assert.equal(fraseDoCartao(7, programa), 'Prémio: corte grátis');
  assert.equal(fraseDoCartao(9, programa), 'O próximo corte é grátis');
  assert.equal(
    fraseDoCartao(9, { objectivo: 10, recompensa: '−50 % na barba' }),
    'O próximo corte tem −50 % na barba',
  );
  assert.equal(fraseDoCartao(10, programa), 'Cartão completo');
  assert.equal(fraseDoCartao(3, { objectivo: 5, recompensa: '' }), 'Faltam 2');
  // Um desconto é nesse corte («tem», «teve»); outra coisa qualquer entrega-se à parte.
  const desconto = { objectivo: 10, recompensa: '50% de desconto' };
  assert.equal(fraseDoCartao(0, desconto), 'Prémio: 50% de desconto');
  assert.equal(fraseDoCartao(9, desconto), 'O próximo corte tem 50% de desconto');
  assert.equal(fraseDesteCorte('50% de desconto'), 'Este corte tem 50% de desconto');
  assert.equal(fraseDoCorteOferecido('50% de desconto'), 'O último corte teve 50% de desconto');
  assert.equal(fraseDesteCorte('Barba grátis'), 'Este corte: barba grátis');
  assert.equal(fraseDoCorteOferecido('Barba grátis'), 'Barba grátis · entregue');
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
      { ...regras, limitePorCliente: null, limiteTotal: null },
      { usadasNoPeriodo: 99, usadasTotal: 99, activo: true },
    ),
    'ok',
  );
  assert.equal(
    motivoDaVantagem(
      { ...regras, limitePorCliente: null, limiteTotal: null },
      { usadasNoPeriodo: 0, usadasTotal: 0, activo: false },
    ),
    'cliente_inactivo',
    'sem limites, continua só para clientes activos',
  );
  assert.equal(limiteEmTexto({ limitePorCliente: 1, periodoDoLimite: 'dia' }), '1 vez por dia');
  assert.equal(
    limiteEmTexto({ limitePorCliente: 3, periodoDoLimite: 'sempre' }),
    '3 vezes no total',
  );
  assert.equal(limiteEmTexto({ limitePorCliente: null, periodoDoLimite: 'dia' }), null);
});

test('faz anos hoje: o 29 de Fevereiro cai no 28 nos anos sem 29', () => {
  assert.equal(fazAnosHoje('03-05', '2026-03-05'), true);
  assert.equal(fazAnosHoje('03-05', '2026-05-03'), false);
  assert.equal(fazAnosHoje(null, '2026-03-05'), false);
  assert.equal(fazAnosHoje('02-29', '2028-02-29'), true, 'bissexto: no próprio dia');
  assert.equal(fazAnosHoje('02-29', '2028-02-28'), false, 'bissexto: não é no 28');
  assert.equal(fazAnosHoje('02-29', '2027-02-28'), true, 'sem 29: é no 28');
  assert.equal(fazAnosHoje('02-29', '2027-03-01'), false);
  assert.equal(fazAnosHoje('02-29', '2100-02-28'), true, '2100 não é bissexto');
  assert.equal(fazAnosHoje('02-29', '2000-02-28'), false, '2000 é bissexto');
});

test('procurar sem acentos apanha as letras que o NFD não parte, e é idempotente', () => {
  assert.equal(textoDeBusca('Jørgen Ølsen'), 'jorgen olsen');
  assert.equal(textoDeBusca('Łukasz Straße'), 'lukasz strasse');
  assert.equal(textoDeBusca('  João   Ñandú '), 'joao nandu');
  for (const n of ['Jørgen Ølsen', 'Łukasz Straße', 'João Ñandú', 'Æsir Œuvre Đorđe'])
    assert.equal(textoDeBusca(textoDeBusca(n)), textoDeBusca(n));
});

test('um telefone com hífens, pontos ou parênteses é arrumado, não recusado', () => {
  assert.equal(normalizarTelefone('912-345-678'), '912 345 678');
  assert.equal(normalizarTelefone('(+351) 912.345.678'), '+351 912 345 678');
  assert.equal(normalizarTelefone('912 345 67a'), null);
});

test('um nome perde o que não se vê, e só invisíveis não é nome', () => {
  assert.equal(limparNome('\u200B\u200B\u200B'), '');
  assert.equal(limparNome('\u200D'), '');
  assert.equal(limparNome('  Ana \u200B  Maria\u00A0 '), 'Ana Maria');
  assert.equal(limparNome('\u202Eetnelav'), 'etnelav');
  assert.equal(limparNome('Zé \u{1F468}\u200D\u{1F466}'), 'Zé \u{1F468}\u200D\u{1F466}');
  assert.equal(limparNome('😀 Zé Ñandú'), '😀 Zé Ñandú');
  assert.equal(limparNome(limparNome(' a\u200Eb ')), 'ab');
});

test('as frases em inglês: o prémio, as datas e os limites', async () => {
  const { linguaDaEtiqueta, naLingua } = await import('./lingua.ts');
  const { recompensaNaLingua } = await import('./fidelidade.ts');
  const { validadeEmTexto } = await import('./promocoes.ts');
  const { limiteEmTexto } = await import('./vales.ts');
  const { dataCurta } = await import('./datas.ts');
  // A língua do aparelho: o português de qualquer país, o resto em inglês, e sem etiqueta o português.
  assert.equal(linguaDaEtiqueta('pt-PT'), 'pt');
  assert.equal(linguaDaEtiqueta('pt_BR'), 'pt');
  assert.equal(linguaDaEtiqueta('en-US'), 'en');
  assert.equal(linguaDaEtiqueta('fr'), 'en');
  assert.equal(linguaDaEtiqueta(''), 'pt');
  // O conteúdo do backoffice: a versão inglesa, ou o português se não a houver.
  assert.equal(naLingua('en', 'Comer', 'Food'), 'Food');
  assert.equal(naLingua('en', 'Comer', '  '), 'Comer');
  assert.equal(naLingua('pt', 'Comer', 'Food'), 'Comer');
  // O prémio de sempre traduz-se mesmo sem versão inglesa.
  const desconto = { objectivo: 10, recompensa: '50% de desconto' };
  assert.equal(fraseDoCartao(0, desconto, 'en'), 'Reward: 50% off');
  assert.equal(fraseDoCartao(9, desconto, 'en'), 'Your next haircut is 50% off');
  assert.equal(fraseDoCartao(10, desconto, 'en'), 'Card complete');
  assert.equal(fraseDoCartao(3, { objectivo: 5, recompensa: '' }, 'en'), '2 to go');
  assert.equal(
    fraseDoCartao(9, { objectivo: 10, recompensa: 'Corte grátis' }, 'en'),
    'Your next haircut is free',
  );
  assert.equal(recompensaNaLingua('Corte grátis', 'en'), 'Free haircut');
  assert.equal(fraseDoCorteOferecido('50% de desconto', 'en'), 'Your last haircut was 50% off');
  assert.equal(fraseDoCorteOferecido('Barba grátis', 'en'), 'Barba grátis · redeemed');
  // «10% discount» e «metade do preço» dizem-se como os outros descontos; um prémio à parte leva «Next:».
  assert.equal(recompensaNaLingua('10% discount', 'en'), '10% off');
  assert.equal(recompensaNaLingua('50% desconto', 'en'), '50% off');
  assert.equal(fraseDoProximo('Metade do preço', 'en'), 'Your next haircut is half price');
  assert.equal(fraseDoProximo('Free beard trim', 'en'), 'Next: free beard trim');
  assert.equal(fraseDesteCorte('Corte grátis', 'en'), 'This haircut is free');
  // As datas e as validades.
  assert.equal(dataCurta('2026-12-31', '2026-11-07', 'en'), '31\u00A0Dec');
  assert.equal(
    validadeEmTexto({ inicio: null, fim: '2026-11-07' }, '2026-11-07', 'en'),
    'Today only',
  );
  assert.equal(
    validadeEmTexto({ inicio: null, fim: '2026-11-13' }, '2026-11-07', 'en'),
    'Ends Friday',
  );
  assert.equal(
    limiteEmTexto({ limitePorCliente: 2, periodoDoLimite: 'semana' }, 'en'),
    'Twice a week',
  );
  assert.equal(
    limiteEmTexto({ limitePorCliente: 1, periodoDoLimite: 'sempre' }, 'en'),
    'Once only',
  );
  assert.equal(
    limiteEmTexto({ limitePorCliente: 3, periodoDoLimite: 'mes' }, 'en'),
    '3 times a month',
  );
  assert.equal(dataCurta('2026-09-12', '2026-11-07', 'en'), '12\u00A0Sept');
});

test('o que falta fazer: só o que deixa a app a meio, pela ordem em que importa', async () => {
  const { oQueFaltaFazer } = await import('./por-fazer.ts');
  const parceiro = (id: number, extra: Record<string, unknown> = {}) =>
    ({
      id,
      nome: `P${id}`,
      activo: true,
      exemplo: false,
      promocoesNaApp: 1,
      morada: 'Rua 1',
      logotipo: 'a'.repeat(32),
      ...extra,
    }) as never;
  const pessoa = (parceiroId: number, sessoes: unknown[], extra: Record<string, unknown> = {}) =>
    ({
      nome: `Quem ${parceiroId}`,
      papel: 'parceiro',
      parceiroId,
      activo: true,
      sessoes,
      ...extra,
    }) as never;
  const promocao = (fim: string | null, extra: Record<string, unknown> = {}) =>
    ({
      id: 5,
      parceiroId: 1,
      parceiro: 'P1',
      destaque: '−10%',
      titulo: 'Na refeição',
      estado: 'activa',
      fim,
      ...extra,
    }) as never;
  const hoje = '2026-11-09';

  const tudoBem = oQueFaltaFazer({
    parceiros: [parceiro(1)],
    equipa: [pessoa(1, [{}])],
    promocoes: [promocao(null)],
    hoje,
  });
  assert.deepEqual(tudoBem, [], 'tudo em dia');

  const lista = oQueFaltaFazer({
    parceiros: [
      parceiro(1),
      parceiro(2, { morada: ' ', logotipo: null, promocoesNaApp: 0 }),
      parceiro(3, { activo: false }),
      parceiro(4, { exemplo: true }),
    ],
    equipa: [pessoa(1, []), pessoa(2, [{}], { activo: false })],
    promocoes: [
      promocao('2026-11-10'),
      promocao('2026-11-30', { id: 6 }),
      promocao('2026-11-08', { id: 7 }),
    ],
    hoje,
  });
  assert.deepEqual(
    lista.map((c) => c.tipo),
    ['sem_quem_valide', 'nao_entrou', 'fora_da_app', 'a_acabar', 'parceiro_incompleto'],
  );
  assert.equal(
    lista.find((c) => c.tipo === 'sem_quem_valide')?.parceiro,
    'P2',
    'quem está desligado não valida',
  );
  const aAcabar = lista.find((c) => c.tipo === 'a_acabar');
  assert.ok(aAcabar?.tipo === 'a_acabar' && aAcabar.dias === 1 && aAcabar.promocaoId === 5);
  const incompleto = lista.find((c) => c.tipo === 'parceiro_incompleto');
  assert.deepEqual(incompleto?.tipo === 'parceiro_incompleto' && incompleto.falta, [
    'morada',
    'logotipo',
  ]);
  assert.ok(
    !lista.some((c) => 'parceiroId' in c && (c.parceiroId === 3 || c.parceiroId === 4)),
    'desligados e exemplos não contam',
  );
});

test('desenhos novos: as apps antigas recebem um que conhecem (9 nov)', () => {
  // Cada desenho tem traço e nome; o que as apps antigas não conhecem tem um parecido que conhecem.
  for (const icone of ICONES_DAS_CATEGORIAS) {
    assert.ok(DESENHOS_DAS_CATEGORIAS[icone]?.length, `${icone} sem desenho`);
    assert.ok(NOMES_DOS_DESENHOS[icone] && NOMES_DOS_DESENHOS_EN[icone], `${icone} sem nome`);
    if (ICONES_DAS_APPS_ANTIGAS.includes(icone)) continue;
    const parecido = PARECIDO_PARA_AS_APPS_ANTIGAS[icone];
    assert.ok(
      parecido && ICONES_DAS_APPS_ANTIGAS.includes(parecido),
      `${icone} sem parecido antigo`,
    );
  }
  const base = { id: 7, nome: 'Joias', ordem: 3 };
  assert.deepEqual(categoriaParaAsApps({ ...base, icone: 'joias' }), {
    ...base,
    icone: 'beleza',
    desenho: 'joias',
  });
  assert.deepEqual(categoriaParaAsApps({ ...base, icone: 'cafe' }), {
    ...base,
    icone: 'cafe',
    desenho: 'cafe',
  });
});

test('ajuste do logótipo: limites, leitura da base e a caixa no círculo (9 nov)', () => {
  // Sem ajuste: o de sempre, branco e a 70 % ao meio (arredondado: (1 − 0,7) / 2 não dá 0,15 exacto).
  const redondo = (c: ReturnType<typeof caixaDoLogotipo>) =>
    Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v]),
    );
  assert.deepEqual(redondo(caixaDoLogotipo(null)), {
    fundo: '#FFFFFF',
    lado: 0.7,
    esquerda: 0.15,
    topo: 0.15,
  });
  assert.deepEqual(redondo(caixaDoLogotipo({ fundo: '#0B3D2E', zoom: 1, x: 0.1, y: -0.2 })), {
    fundo: '#0B3D2E',
    lado: 1,
    esquerda: 0.1,
    topo: -0.2,
  });
  // Fora dos limites encosta; a cor fica em maiúsculas; o que não serve é null.
  assert.deepEqual(limitarAjuste({ fundo: '#0b3d2e', zoom: 9, x: -5, y: 0.5 }), {
    fundo: '#0B3D2E',
    zoom: 3,
    x: -1,
    y: 0.5,
  });
  assert.equal(limitarAjuste({ fundo: 'verde', zoom: 1, x: 0, y: 0 }), null);
  assert.equal(limitarAjuste({ fundo: '#FFFFFF', zoom: Number.NaN, x: 0, y: 0 }), null);
  assert.deepEqual(lerAjusteDoLogotipo(JSON.stringify(AJUSTE_DE_ORIGEM)), AJUSTE_DE_ORIGEM);
  assert.equal(lerAjusteDoLogotipo('{estragado'), null);
  assert.equal(lerAjusteDoLogotipo(null), null);
});
