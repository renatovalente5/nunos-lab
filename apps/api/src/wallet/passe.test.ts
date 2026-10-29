import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passJson, type CartaoDoPasse } from './passe.ts';

const cartao: CartaoDoPasse = {
  serie: 'abcdefgh12345678',
  codigo: 'JMP7ZT8A',
  nome: 'Renato',
  carimbos: 7,
  objectivo: 10,
  recompensa: 'Corte grátis',
  porUsar: 0,
  cortes: 12,
  ultima: { quando: 1761700000, loja: 'Aveiro', pessoa: 'Nuno' },
  lojas: [
    { nome: 'Nogueira do Cravo', telefone: '910 000 000', lat: 40.9, lng: -8.5 },
    { nome: 'Santa Maria da Feira', telefone: '', lat: null, lng: null },
    { nome: 'Aveiro', telefone: '', lat: 40.6, lng: -8.6 },
  ],
  site: 'https://nunoslab.pt',
  instagram: 'nunoslab',
  whatsapp: '+351 910 000 000',
};
const cfg = {
  passTipo: 'pass.pt.nunoslab.cartao',
  equipa: '6M2QCLR98V',
  origemDaApi: 'https://api.local',
  origemDaApp: 'https://app.local/nunos-lab',
  testemunho: 't',
};

test('o storeCard leva a faixa limpa (sem campos principais) e a linha cliente · prémio · cortes', () => {
  const p = passJson(cartao, cfg);
  assert.equal(p.storeCard.headerFields[0]!.value, '7 de 10');
  assert.ok(!('primaryFields' in p.storeCard));
  assert.deepEqual(
    p.storeCard.secondaryFields.map((f) => [f.label, f.value]),
    [
      ['CLIENTE', 'Renato'],
      ['CORTE GRÁTIS', 'Faltam 3'],
    ],
  );
  assert.deepEqual(p.storeCard.auxiliaryFields, [{ key: 'cortes', label: 'CORTES', value: '12' }]);
});

test('o poster do iOS 27 vai ao lado: nome em título, o que falta, e um rodapé curto', () => {
  const p = passJson(cartao, cfg);
  assert.deepEqual(p.posterGeneric.primaryFields, [
    { key: 'nome', value: 'Renato' },
    { key: 'faltam', label: 'FALTAM', value: '3' },
  ]);
  const rodape = p.posterGeneric.footerFields[0]!.value;
  assert.equal(rodape, 'Corte grátis ao 10.º');
  assert.ok(rodape.length <= 40);
  assert.equal(
    passJson({ ...cartao, carimbos: 9 }, cfg).posterGeneric.primaryFields[1]!.label,
    'FALTA',
  );
});

test('com um prémio por usar, o poster e o storeCard dizem-no', () => {
  const p = passJson({ ...cartao, porUsar: 1, carimbos: 2 }, cfg);
  assert.deepEqual(p.posterGeneric.primaryFields[1], {
    key: 'porUsar',
    label: 'POR USAR',
    value: 'Corte grátis',
  });
  assert.equal(p.posterGeneric.footerFields[0]!.value, 'Tens corte grátis por usar');
  assert.equal(p.storeCard.secondaryFields.at(-1)!.label, 'POR USAR');
});

test('as costas levam o contacto de quem emite, as casas e a privacidade', () => {
  const p = passJson(cartao, cfg);
  const costas = Object.fromEntries(p.storeCard.backFields.map((f) => [f.key, f.value]));
  assert.equal(costas.contacto, 'WhatsApp +351 910 000 000\nNogueira do Cravo: 910 000 000');
  assert.equal(costas.como, 'Um carimbo por corte. Ao 10.º, corte grátis.');
  assert.equal(costas.casas, 'Nogueira do Cravo · Santa Maria da Feira · Aveiro');
  assert.equal(costas.privacidade, 'https://app.local/nunos-lab/privacidade/');
  assert.equal(p.posterGeneric.backFields[0]!.key, 'cortes');
  // Sem contacto nenhum, a linha não aparece.
  const semContacto = passJson(
    { ...cartao, whatsapp: '', lojas: cartao.lojas.map((l) => ({ ...l, telefone: '' })) },
    cfg,
  );
  assert.ok(!semContacto.storeCard.backFields.some((f) => f.key === 'contacto'));
});

test('sem nome, não há campo do cliente nem título no poster', () => {
  const p = passJson({ ...cartao, nome: '' }, cfg);
  assert.equal(p.storeCard.secondaryFields[0]!.key, 'faltam');
  assert.equal(p.posterGeneric.primaryFields.length, 1);
});
