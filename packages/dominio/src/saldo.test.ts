import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  caminhoDaAppClip,
  centimosDoTexto,
  codigoDoConviteEscrito,
  codigoDoReferrer,
  convitesQueFaltam,
  euros,
  eurosComSinal,
  eurosNoCampo,
  eurosParaUsar,
  gerarCodigo,
  ligacaoDaAppClip,
  ligacaoDaPlayStore,
  nomeCurto,
  safariComAppClip,
  valoresParaUsar,
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

test('com cêntimos, o balcão usa os euros inteiros e, no fim, o saldo todo (27 nov 2026)', () => {
  assert.deepEqual(valoresParaUsar(0), []);
  assert.deepEqual(valoresParaUsar(-150), []);
  assert.deepEqual(valoresParaUsar(50), [50]);
  assert.deepEqual(valoresParaUsar(100), [100]);
  assert.deepEqual(valoresParaUsar(150), [100, 150]);
  assert.deepEqual(valoresParaUsar(300), [100, 200, 300]);
  assert.deepEqual(valoresParaUsar(305), [100, 200, 300, 305]);
});

test('o valor do convite escreve-se com cêntimos, com vírgula ou ponto (27 nov 2026)', () => {
  assert.equal(centimosDoTexto('1'), 100);
  assert.equal(centimosDoTexto('1,5'), 150);
  assert.equal(centimosDoTexto('1.50'), 150);
  assert.equal(centimosDoTexto(' 2,05 € '), 205);
  assert.equal(centimosDoTexto('€0.5'), 50);
  assert.equal(centimosDoTexto('0'), 0);
  assert.equal(centimosDoTexto(''), null);
  assert.equal(centimosDoTexto('1,505'), null);
  assert.equal(centimosDoTexto('-1'), null);
  assert.equal(centimosDoTexto('1,'), null);
  assert.equal(centimosDoTexto('um'), null);
  assert.equal(eurosNoCampo(100), '1');
  assert.equal(eurosNoCampo(150), '1,50');
  assert.equal(eurosNoCampo(150, 'en'), '1.50');
  assert.equal(eurosNoCampo(5), '0,05');
  // O que se mostra no campo volta a ler-se igual.
  for (const c of [0, 5, 50, 100, 150, 1999, 5000])
    for (const lingua of ['pt', 'en'] as const)
      assert.equal(centimosDoTexto(eurosNoCampo(c, lingua)), c);
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

test('o código de convite que vem da Play Store (o Install Referrer, 11 nov 2026)', () => {
  const codigo = gerarCodigo(new Uint8Array([1, 2, 3, 4, 5, 6, 7]));
  // A página do convite manda o «Instalar» com o código no `referrer`, codificado uma vez.
  const ligacao = ligacaoDaPlayStore(codigo);
  assert.equal(
    ligacao,
    `https://play.google.com/store/apps/details?id=pt.nunoslab.app&referrer=convite%3D${codigo}`,
  );
  // O que a app recebe: a Play Store descodifica-o (às vezes não), e pode juntar campos seus.
  const referrer = new URL(ligacao).searchParams.get('referrer')!;
  for (const r of [
    referrer,
    `convite%3D${codigo}`,
    `utm_source=whatsapp&convite=${codigo}`,
    `convite=${codigo.toLowerCase()}&utm_medium=convite`,
    `convite=${codigo.slice(0, 4)} ${codigo.slice(4)}`,
  ])
    assert.equal(codigoDoReferrer(r), codigo, r);
  // Sem convite (instalada pela loja, sem ligação), ou com um código que não é um código: nada.
  for (const r of [
    'utm_source=google-play&utm_medium=organic',
    '',
    null,
    undefined,
    'convite=ABCD',
    `naoconvite=${codigo}`,
    'convite=%E0%A4%A',
  ])
    assert.equal(codigoDoReferrer(r), null, String(r));
});

test('o código de convite pela App Clip do iPhone (25 nov 2026)', () => {
  const codigo = gerarCodigo(new Uint8Array([7, 6, 5, 4, 3, 2, 1]));
  // A ligação da Apple: o «p» é a App Clip, o «convite» vai até ela tal como está.
  const ligacao = ligacaoDaAppClip(codigo);
  assert.equal(ligacao, `https://appclip.apple.com/id?p=pt.nunoslab.app.clip&convite=${codigo}`);
  // Com a app instalada, a mesma ligação abre a app: vai para a página inicial com o código.
  assert.equal(caminhoDaAppClip(ligacao), `/?convite=${codigo}`);
  assert.equal(caminhoDaAppClip(`${ligacao}&l=pt#x`), `/?convite=${codigo}`);
  assert.equal(
    caminhoDaAppClip(`https://appclip.apple.com/id?convite=${codigo.toLowerCase()}&p=x`),
    `/?convite=${codigo}`,
  );
  // O iOS pode mandar a morada com outras letras, com «/» antes do «?», ou com o código partido.
  assert.equal(
    caminhoDaAppClip(ligacao.replace('https://appclip.apple.com', 'HTTPS://AppClip.Apple.com')),
    `/?convite=${codigo}`,
  );
  assert.equal(caminhoDaAppClip(ligacao.replace('/id?', '/id/?')), `/?convite=${codigo}`);
  assert.equal(
    caminhoDaAppClip(
      `https://appclip.apple.com/id?p=pt.nunoslab.app.clip&convite=${codigo.slice(0, 4)}%20${codigo.slice(4)}`,
    ),
    `/?convite=${codigo}`,
  );
  // A ligação da App Clip sem código (ou com um que não é um código): só a página inicial.
  assert.equal(caminhoDaAppClip('https://appclip.apple.com/id?p=pt.nunoslab.app.clip'), '/');
  assert.equal(
    caminhoDaAppClip('https://appclip.apple.com/id?p=pt.nunoslab.app.clip&convite='),
    '/',
  );
  assert.equal(
    caminhoDaAppClip('https://appclip.apple.com/id?p=pt.nunoslab.app.clip&convite=%E0%A4'),
    '/',
  );
  assert.equal(caminhoDaAppClip('https://appclip.apple.com/id?p=x&convite=ABCD'), '/');
  // Outras ligações seguem como vieram.
  for (const outra of [
    'nunoslab://parceiro/3',
    '/carteira',
    `https://renatovalente5.github.io/nunos-lab/?convite=${codigo}`,
    `https://appclip.apple.com.exemplo.pt/id?convite=${codigo}`,
    `http://appclip.apple.com/id?convite=${codigo}`,
    `https://appclip.apple.com/outra?convite=${codigo}`,
    '',
  ])
    assert.equal(caminhoDaAppClip(outra), null, outra);
});

test('a página do convite abre a App Clip só no Safari de um iPhone com iOS 16.4+ (25 nov 2026)', () => {
  const iphone = (versao: string, resto: string) =>
    `Mozilla/5.0 (iPhone; CPU iPhone OS ${versao} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${resto}`;
  const safari = (versao: string) => iphone(versao, 'Version/18.6 Mobile/15E148 Safari/604.1');
  for (const ua of [
    safari('16_4'),
    safari('16_4_1'),
    safari('17_0'),
    safari('18_6'),
    safari('26_1'),
    safari('27_2'),
  ])
    assert.equal(safariComAppClip(ua), true, ua);
  // O Safari do iOS 27 (simulador, 25 nov 2026): a Apple congelou o sistema em 18_x desde o iOS 26.
  assert.equal(
    safariComAppClip(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1',
    ),
    true,
  );
  for (const ua of [
    // Antes da ligação da Apple existir.
    safari('16_3_1'),
    safari('15_8'),
    // Outros browsers do iPhone e os de dentro de outras apps.
    iphone('18_6', 'CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1'),
    iphone('18_6', 'FxiOS/133.0 Mobile/15E148 Safari/605.1.15'),
    iphone('18_6', 'EdgiOS/131.0.2903.70 Version/18.0 Mobile/15E148 Safari/604.1'),
    iphone('18_6', 'Mobile/15E148 Instagram 361.0.0.35.82 (iPhone15,3; iOS 18_6; pt_PT)'),
    iphone('18_6', 'Mobile/15E148 [FBAN/FBIOS;FBAV/493.0.0.43.109]'),
    // O iPad pede a página de computador; o Android e o computador não têm App Clips.
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    '',
  ])
    assert.equal(safariComAppClip(ua), false, ua);
});
