import assert from 'node:assert/strict';
import { test } from 'node:test';
import { objeto } from './google.ts';
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
/** Um minuto depois do último carimbo: é quando o aparelho vem buscar o passe novo. */
const LOGO_A_SEGUIR = 1761700000 + 60;
const cfg = {
  passTipo: 'pass.pt.nunoslab.cartao',
  equipa: '6M2QCLR98V',
  origemDaApi: 'https://api.local',
  origemDaApp: 'https://app.local/nunos-lab',
  testemunho: 't',
};

test('o storeCard leva a faixa limpa (sem campos principais) e a linha cliente · prémio, sem os cortes', () => {
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
  assert.ok(!('auxiliaryFields' in p.storeCard), 'os cortes saíram da frente (7 nov)');
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

test('o aviso do passe muda com o estado: novo carimbo, cartão completo, nada a zeros', () => {
  const aviso = (carimbos: number) =>
    passJson({ ...cartao, carimbos }, cfg, LOGO_A_SEGUIR).storeCard.headerFields[0]!.changeMessage;
  assert.equal(aviso(7), 'Carimbo novo: %@');
  assert.equal(aviso(9), 'Carimbo novo: %@ · o próximo corte é grátis');
  assert.equal(aviso(10), 'Cartão completo (%@): este corte é grátis');
  assert.equal(aviso(0), undefined);
  assert.equal(
    passJson({ ...cartao, carimbos: 9 }, cfg).posterGeneric.footerFields[0]!.value,
    'O próximo corte é grátis',
  );
  assert.deepEqual(passJson({ ...cartao, carimbos: 10 }, cfg).posterGeneric.primaryFields[1], {
    key: 'cartao',
    label: 'CARTÃO',
    value: 'Completo',
  });
});

test('sem nome, não há campo do cliente nem título no poster', () => {
  const p = passJson({ ...cartao, nome: '' }, cfg);
  assert.equal(p.storeCard.secondaryFields[0]!.key, 'faltam');
  assert.equal(p.posterGeneric.primaryFields.length, 1);
});

test('em inglês (a língua da conta), o passe diz o mesmo em inglês', () => {
  const en = { ...cartao, recompensa: 'Free haircut', lingua: 'en' as const };
  const p = passJson(en, cfg);
  assert.equal(p.description, "Nuno's Lab card");
  assert.equal(p.storeCard.headerFields[0]!.label, 'STAMPS');
  assert.equal(p.storeCard.headerFields[0]!.value, '7 of 10');
  assert.deepEqual(
    p.storeCard.secondaryFields.map((f) => [f.label, f.value]),
    [
      ['NAME', 'Renato'],
      ['FREE HAIRCUT', '3 to go'],
    ],
  );
  assert.deepEqual(p.posterGeneric.primaryFields[1], { key: 'faltam', label: 'TO GO', value: '3' });
  assert.equal(p.posterGeneric.footerFields[0]!.value, 'Free haircut at 10 stamps');
  const costas = Object.fromEntries(p.storeCard.backFields.map((f) => [f.key, f.value]));
  assert.equal(costas.como, 'One stamp per haircut. 10 stamps: free haircut.');
  assert.equal(costas.privacidade, 'https://app.local/nunos-lab/privacidade/?lingua=en');
  assert.equal(p.locations[0]!.relevantText, "Nuno's Lab Nogueira do Cravo: show your card.");
  const aviso = (carimbos: number) =>
    passJson({ ...en, carimbos }, cfg, LOGO_A_SEGUIR).storeCard.headerFields[0]!.changeMessage;
  assert.equal(aviso(7), 'New stamp: %@');
  assert.equal(aviso(9), 'New stamp: %@ – your next haircut is free');
  assert.equal(aviso(10), 'Card complete (%@) – this haircut is free');
  // Um «%» do prémio escreve-se «%%» no aviso da Apple.
  assert.equal(
    passJson({ ...en, recompensa: '50% off', carimbos: 9 }, cfg, LOGO_A_SEGUIR).storeCard
      .headerFields[0]!.changeMessage,
    'New stamp: %@ – your next haircut is 50%% off',
  );
});

test('sem um carimbo há pouco, o passe muda sem aviso (anular, mudar a língua)', () => {
  // Anulado o 7.º, o último carimbo passa a ser o de há semanas: «6 de 10» sem «Carimbo novo».
  const semanasDepois = 1761700000 + 21 * 86_400;
  const aviso = (c: CartaoDoPasse) =>
    passJson(c, cfg, semanasDepois).storeCard.headerFields[0]!.changeMessage;
  assert.equal(aviso({ ...cartao, carimbos: 6 }), undefined);
  assert.equal(aviso({ ...cartao, lingua: 'en' }), undefined);
  assert.equal(aviso({ ...cartao, ultima: null }), undefined);
  // Meia hora é o limite: o telemóvel que estava sem rede recebe-o depois, sem aviso.
  assert.equal(
    passJson(cartao, cfg, 1761700000 + 29 * 60).storeCard.headerFields[0]!.changeMessage,
    'Carimbo novo: %@',
  );
  assert.equal(
    passJson(cartao, cfg, 1761700000 + 31 * 60).storeCard.headerFields[0]!.changeMessage,
    undefined,
  );
});

test('na Google Wallet, o cartão também sai na língua da conta', () => {
  const base = {
    id: 'e.nl-1',
    codigo: 'JMP7 ZT8A',
    qr: 'x',
    nome: '',
    carimbos: 7,
    objectivo: 10,
    porUsar: 2,
    cortes: 12,
    hero: 'https://api.local/hero.png',
  };
  const pt = objeto('e', { ...base, recompensa: 'Corte grátis' });
  assert.equal(pt.accountName, 'Cliente');
  assert.deepEqual(pt.loyaltyPoints, { label: 'Carimbos', balance: { string: '7 de 10' } });
  const en = objeto('e', { ...base, recompensa: 'Free haircut', lingua: 'en' });
  assert.equal(en.accountName, 'Client');
  assert.deepEqual(en.loyaltyPoints, { label: 'Stamps', balance: { string: '7 of 10' } });
  assert.deepEqual(en.secondaryLoyaltyPoints, {
    label: 'Ready to use',
    balance: { string: '2 × Free haircut' },
  });
  // Um só prémio diz-se sem «1 ×», como no passe da Apple.
  assert.deepEqual(
    objeto('e', { ...base, porUsar: 1, recompensa: 'Free haircut', lingua: 'en' })
      .secondaryLoyaltyPoints,
    {
      label: 'Ready to use',
      balance: { string: 'Free haircut' },
    },
  );
  assert.equal(en.heroImage.contentDescription.defaultValue.language, 'en-GB');
  assert.equal(en.textModulesData[1]!.body, 'One stamp per haircut. 10 stamps: free haircut.');
});
