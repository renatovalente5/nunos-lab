import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conferirCredencialGoogle } from './google.ts';

/** Um «Google» de faz de conta: um par de chaves nosso, e tokens assinados com ele. */
const par = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
);
const outro = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
);
const chaves = async () => new Map([['k1', par.publicKey]]);
const CLIENTE = '123-abc.apps.googleusercontent.com';
const AGORA = 1_800_000_000;
const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const texto = (o: unknown) => b64(new TextEncoder().encode(JSON.stringify(o)));

async function token(
  corpo: Record<string, unknown>,
  { kid = 'k1', chave = par.privateKey, alg = 'RS256' } = {},
) {
  const inicio = `${texto({ alg, kid, typ: 'JWT' })}.${texto(corpo)}`;
  const assinatura = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(inicio)),
  );
  return `${inicio}.${b64(assinatura)}`;
}

const BOM = {
  iss: 'https://accounts.google.com',
  aud: CLIENTE,
  sub: '1098',
  email: 'NunoDib16@gmail.com',
  email_verified: true,
  name: 'Nuno',
  iat: AGORA - 10,
  exp: AGORA + 3600,
};

test('um token certo dá o email em minúsculas', async () => {
  const id = await conferirCredencialGoogle(await token(BOM), CLIENTE, { agora: AGORA, chaves });
  assert.deepEqual(id, { email: 'nunodib16@gmail.com', sub: '1098', nome: 'Nuno' });
});

test('recusa: outro cliente, outro emissor, caducado, email por verificar', async () => {
  const casos: Record<string, unknown>[] = [
    { ...BOM, aud: 'outro.apps.googleusercontent.com' },
    { ...BOM, iss: 'https://exemplo.pt' },
    { ...BOM, exp: AGORA - 120 },
    { ...BOM, email_verified: false },
    { ...BOM, email: undefined },
  ];
  for (const c of casos)
    assert.equal(
      await conferirCredencialGoogle(await token(c), CLIENTE, { agora: AGORA, chaves }),
      null,
    );
});

test('recusa: assinado por outra chave, chave desconhecida, corpo mexido, lixo', async () => {
  assert.equal(
    await conferirCredencialGoogle(await token(BOM, { chave: outro.privateKey }), CLIENTE, {
      agora: AGORA,
      chaves,
    }),
    null,
  );
  assert.equal(
    await conferirCredencialGoogle(await token(BOM, { kid: 'k9' }), CLIENTE, {
      agora: AGORA,
      chaves,
    }),
    null,
  );
  const [c, , a] = (await token(BOM)).split('.');
  const mexido = `${c}.${texto({ ...BOM, email: 'intruso@gmail.com' })}.${a}`;
  assert.equal(await conferirCredencialGoogle(mexido, CLIENTE, { agora: AGORA, chaves }), null);
  assert.equal(
    await conferirCredencialGoogle('nao.e.um.token', CLIENTE, { agora: AGORA, chaves }),
    null,
  );
  assert.equal(await conferirCredencialGoogle('', CLIENTE, { agora: AGORA, chaves }), null);
});

test('um algoritmo que não seja RS256 é recusado antes de olhar para a chave', async () => {
  assert.equal(
    await conferirCredencialGoogle(await token(BOM, { alg: 'none' }), CLIENTE, {
      agora: AGORA,
      chaves,
    }),
    null,
  );
});
