import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completarIngles, traduzir } from './traducao.ts';

/** Um motor de mentira: devolve o que se lhe pedir e conta as chamadas. */
function motor(resposta: (textos: string[]) => string | Error) {
  const chamadas: string[][] = [];
  const ai = {
    run: async (_modelo: string, opcoes: { messages: { content: string }[] }) => {
      const textos = (JSON.parse(opcoes.messages[1]!.content) as { texto: string }[]).map(
        (i) => i.texto,
      );
      chamadas.push(textos);
      const r = resposta(textos);
      if (r instanceof Error) throw r;
      return { response: r };
    },
  } as unknown as Ai;
  return { ai, chamadas };
}
const emIngles = (textos: string[]) => JSON.stringify({ traducoes: textos.map((t) => `EN:${t}`) });

test('ao criar, o inglês vazio traduz-se; o escrito fica; o «−10%» fica como está', async () => {
  const { ai, chamadas } = motor(emIngles);
  const r = await completarIngles(ai, [
    { campo: 'titulo', pt: 'Na refeição', en: '' },
    { campo: 'detalhe', pt: 'Ao almoço', en: 'At lunch' },
    { campo: 'destaque', pt: '−10%', en: undefined },
  ]);
  assert.deepEqual(r, ['EN:Na refeição', 'At lunch', undefined]);
  assert.deepEqual(chamadas, [['Na refeição']]);
});

test('o português mudou e o inglês ficou: traduz outra vez; o inglês mudado na mesma vez fica', async () => {
  const { ai } = motor(emIngles);
  const r = await completarIngles(ai, [
    {
      campo: 'titulo',
      pt: 'Sobremesa',
      en: 'House dessert',
      ptAntes: 'Café',
      enAntes: 'House dessert',
    },
    {
      campo: 'detalhe',
      pt: 'Só ao jantar',
      en: 'Dinner only',
      ptAntes: 'Ao almoço',
      enAntes: 'At lunch',
    },
  ]);
  assert.deepEqual(r, ['EN:Sobremesa', 'Dinner only']);
});

test('o que não veio não se mexe (pausar, mudar a ordem)', async () => {
  const { ai, chamadas } = motor(emIngles);
  const r = await completarIngles(ai, [
    { campo: 'titulo', pt: undefined, en: undefined, ptAntes: 'Na refeição', enAntes: '' },
  ]);
  assert.deepEqual(r, [undefined]);
  assert.equal(chamadas.length, 0);
});

test('o prémio comum traduz-se pelas regras, sem o motor', async () => {
  const { ai, chamadas } = motor(emIngles);
  const r = await completarIngles(ai, [
    { campo: 'recompensa', pt: '50% de desconto', en: '', ptAntes: 'Corte grátis', enAntes: '' },
    { campo: 'recompensa', pt: 'Barba grátis', en: '' },
  ]);
  assert.deepEqual(r, ['50% off', 'EN:Barba grátis']);
  assert.deepEqual(chamadas, [['Barba grátis']]);
});

test('o motor falha: o inglês velho de um português novo sai; o vazio fica vazio', async () => {
  const { ai } = motor(() => new Error('rede'));
  const r = await completarIngles(ai, [
    { campo: 'titulo', pt: 'Sobremesa', en: 'Coffee', ptAntes: 'Café', enAntes: 'Coffee' },
    { campo: 'detalhe', pt: 'Ao almoço', en: '' },
  ]);
  assert.deepEqual(r, ['', '']);
});

test('traduzir: lista curta, cercas de código, sinais e divagações', async () => {
  assert.equal(
    await traduzir(motor(() => '{"traducoes": ["a"]}').ai, [{ texto: 'x' }, { texto: 'y' }]),
    null,
  );
  assert.deepEqual(
    await traduzir(motor(() => '```json\n{"traducoes": ["Mon‑Fri"]}\n```').ai, [
      { texto: 'Seg a sex' },
    ]),
    ['Mon-Fri'],
  );
  assert.deepEqual(
    await traduzir(motor(() => '{"traducoes": ["up to -€300"]}').ai, [{ texto: 'até −300 €' }]),
    ['up to −€300'],
  );
  assert.equal(
    await traduzir(motor(() => JSON.stringify({ traducoes: ['x'.repeat(200)] })).ai, [
      { texto: 'Olá' },
    ]),
    null,
  );
  assert.equal(await traduzir(undefined, [{ texto: 'Olá' }]), null);
});
