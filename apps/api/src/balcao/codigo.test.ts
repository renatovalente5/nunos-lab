import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codigoNovo, iguais, redeDe } from './codigo.ts';
import { NOME_DO_REMETENTE, emailDoCodigo, emailLigado } from './email.ts';

test('o código novo: seis algarismos, sem vício nos primeiros (28 nov 2026)', () => {
  const vistos = new Set<string>();
  const primeiros = new Map<string, number>();
  for (let i = 0; i < 20_000; i++) {
    const c = codigoNovo();
    assert.match(c, /^\d{6}$/);
    vistos.add(c);
    primeiros.set(c[0]!, (primeiros.get(c[0]!) ?? 0) + 1);
  }
  assert.ok(vistos.size > 19_000, 'quase nenhum repetido em 20 000');
  // Cada algarismo da frente perto dos 2 000 (10 %): um vício do módulo saltava à vista.
  for (const d of '0123456789') {
    const n = primeiros.get(d) ?? 0;
    assert.ok(n > 1700 && n < 2300, `o ${d} à frente ${n} vezes`);
  }
});

test('a rede: o IPv4 inteiro e o IPv6 pelo /64', () => {
  assert.equal(redeDe('203.0.113.7'), '203.0.113.7');
  assert.equal(redeDe('2001:db8:85a3:0042:1000:8a2e:370:7334'), '2001:db8:85a3:42::/64');
  assert.equal(redeDe('2001:DB8:85A3:42::1'), '2001:db8:85a3:42::/64', 'a mesma casa');
  assert.equal(redeDe('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(redeDe('::1'), '0:0:0:0::/64');
  assert.equal(redeDe('::ffff:203.0.113.7'), '203.0.113.7', 'o IPv4 escrito à IPv6');
  assert.equal(redeDe('local'), 'local');
});

test('resumos iguais e diferentes', () => {
  assert.equal(iguais(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
  assert.equal(iguais(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
  assert.equal(iguais(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])), false);
});

test('o email do código: no assunto e no corpo, nas duas línguas, sem ligações', () => {
  const pt = emailDoCodigo('012345', 'pt');
  assert.equal(pt.assunto, "012345 é o teu código do Nuno's Lab");
  assert.match(pt.texto, /\n\n012345\n\n/);
  assert.match(pt.texto, /Vale 10 minutos/);
  assert.match(pt.html, /<html lang="pt-PT">/);
  assert.match(pt.html, />012345</);
  assert.doesNotMatch(pt.html, /<a\s|<img\s|https?:/i, 'nem ligações nem imagens');
  assert.ok(pt.html.includes(NOME_DO_REMETENTE));
  const en = emailDoCodigo('987654', 'en');
  assert.equal(en.assunto, "987654 is your Nuno's Lab code");
  assert.match(en.texto, /valid for 10 minutes/);
  assert.match(en.html, /<html lang="en-GB">/);
  assert.throws(() => emailDoCodigo('12345', 'pt'), /6 algarismos/);
  assert.throws(() => emailDoCodigo('<b>1</b>', 'pt'));
});

test('entrar por email só com o binding e o remetente (ou no wrangler dev)', () => {
  const envio = { send: async () => ({ messageId: 'x' }) };
  assert.equal(emailLigado({}), false);
  assert.equal(emailLigado({ EMAIL: envio }), false, 'sem remetente');
  assert.equal(emailLigado({ EMAIL_REMETENTE: 'app@nunoslab.com' }), false, 'sem binding');
  assert.equal(emailLigado({ EMAIL: envio, EMAIL_REMETENTE: 'app@nunoslab.com' }), true);
  assert.equal(emailLigado({ MODO: 'desenvolvimento' }), true);
});
