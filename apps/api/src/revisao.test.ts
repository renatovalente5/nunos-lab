import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Ambiente } from './ambiente.ts';
import { rotasDaRevisao } from './revisao.ts';

type Env = Ambiente['Bindings'];

/** Um ambiente de faz de conta: o travão deixa passar e a base tem o cliente de exemplo. */
function ambiente(codigo?: string, deixaPassar = true): Env {
  return {
    REVISAO_CODIGO: codigo,
    REVISAO_CLIENTE: 'JMP7ZT8A',
    TRAVAO: { limit: async () => ({ success: deixaPassar }) },
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ id: 1, codigo: 'JMP7ZT8A', nome: 'Rafael <Costa>' }),
        }),
      }),
    },
  } as unknown as Env;
}

/** O formulário enviado, como um browser o envia. */
const enviar = (codigo: string) =>
  new Request('http://local/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ codigo }),
  });

test('sem o segredo posto, a porta não existe', async () => {
  assert.equal((await rotasDaRevisao.request('/', {}, ambiente())).status, 404);
  assert.equal((await rotasDaRevisao.request(enviar('x'), undefined, ambiente())).status, 404);
});

test('a página pede o código num formulário; só o código certo mostra o QR', async () => {
  const env = ambiente('SEGREDO');
  const porta = await rotasDaRevisao.request('/', {}, env);
  assert.equal(porta.status, 200);
  const html = await porta.text();
  assert.ok(html.includes('method="post"') && html.includes('name="codigo"'));
  assert.ok(!html.includes('<svg'), 'sem código não há QR');

  const errado = await rotasDaRevisao.request(enviar('OUTRO'), undefined, env);
  assert.equal(errado.status, 404);
  const outraVez = await errado.text();
  assert.ok(outraVez.includes('method="post"') && !outraVez.includes('<svg'));

  // O código aceita espaços à volta (colado das notas), e o nome do cliente vai escapado.
  const certo = await rotasDaRevisao.request(enviar(' SEGREDO '), undefined, env);
  assert.equal(certo.status, 200);
  assert.equal(certo.headers.get('cache-control'), 'no-store');
  const qr = await certo.text();
  assert.ok(qr.includes('<svg') && qr.includes('JMP7') && qr.includes('ZT8A'));
  assert.ok(qr.includes('Rafael &lt;Costa&gt;') && !qr.includes('Rafael <Costa>'));
});

test('o código vai no corpo: na morada não conta', async () => {
  const env = ambiente('SEGREDO');
  const html = await (await rotasDaRevisao.request('/?codigo=SEGREDO', {}, env)).text();
  assert.ok(!html.includes('<svg'));
  const json = await rotasDaRevisao.request(
    new Request('http://local/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: 'SEGREDO' }),
    }),
    undefined,
    env,
  );
  assert.equal(json.status, 404);
});

test('o travão corta a força bruta', async () => {
  const r = await rotasDaRevisao.request(enviar('SEGREDO'), undefined, ambiente('SEGREDO', false));
  assert.equal(r.status, 429);
});
