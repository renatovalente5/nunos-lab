import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aparelhoDoPedido } from './util.ts';

const pedido = (cabecalhos: Record<string, string>) => ({
  req: { header: (nome: string) => cabecalhos[nome] },
});

test('o nome do aparelho vem codificado das apps (o Android só manda ASCII) e lê-se com o «·» (13 nov)', () => {
  const nome = 'Android · Samsung SM-A346B';
  const codificado = encodeURIComponent(nome);
  // O OkHttp recusa num cabeçalho tudo o que estiver fora de  ..~.
  assert.ok(/^[ -~]*$/.test(codificado), codificado);
  assert.equal(aparelhoDoPedido(pedido({ 'X-Aparelho': codificado })), nome);
  // As versões de antes mandam-no tal e qual: continua igual.
  assert.equal(aparelhoDoPedido(pedido({ 'X-Aparelho': 'iPhone' })), 'iPhone');
  assert.equal(aparelhoDoPedido(pedido({ 'X-Aparelho': nome })), nome);
  // Um «%» solto não rebenta: fica como veio, sem o que não é letra nem número.
  assert.equal(aparelhoDoPedido(pedido({ 'X-Aparelho': 'Android 100%' })), 'Android 100');
  // Sem cabeçalho, pelo navegador.
  assert.equal(
    aparelhoDoPedido(
      pedido({
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
      }),
    ),
    'Android · Chrome',
  );
});
