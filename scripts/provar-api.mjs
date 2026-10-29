#!/usr/bin/env node
/**
 * A prova da API contra o «wrangler dev» local (porta 8870), com a base local
 * acabada de migrar e com os exemplos. Percorre o que a app e o backoffice
 * fazem, e as recusas que importam. Uso: node scripts/provar-api.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API ?? 'http://localhost:8870';
const APP = 'http://localhost:8872';

// A prova parte sempre da base local acabada de pôr. Os exemplos contam as
// datas a partir do dia em que entram (date('now', '+4 days')): numa base
// semeada há uma semana já há promoções acabadas. Só a base LOCAL.
const pastaDaApi = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api');
const naBaseLocal = (...args) =>
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'nunos-lab', '--local', ...args], {
    cwd: pastaDaApi,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
naBaseLocal(
  '--command',
  [
    'promocoes',
    'parceiros',
    'lojas',
    'categorias',
    'imagens',
    'definicoes',
    'contagens',
    'acessos',
    'sessoes',
    'registo',
    'admins',
    'cupoes',
    'registos_apple',
    'passes',
    'bilhetes',
    'vales',
    'carimbos',
    'cartoes',
    'servicos',
    'sessoes_da_equipa',
    'acessos_da_equipa',
    'equipa',
    'sessoes_de_cliente',
    'codigos_de_entrada',
    'identidades',
    'clientes',
  ]
    .map((t) => `DELETE FROM ${t};`)
    .join(' '),
);
naBaseLocal('--file', '../../base/exemplos.sql');
naBaseLocal('--file', '../../base/exemplos-fidelidade.sql');
/** Uma consulta à base local, com as linhas que vierem. */
const daBaseLocal = (sql) =>
  JSON.parse(
    execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'nunos-lab', '--local', '--json', '--command', sql],
      { cwd: pastaDaApi, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ),
  )[0].results;
let passos = 0;
async function passo(nome, f) {
  try {
    await f();
    passos++;
    console.log(`ok  ${nome}`);
  } catch (e) {
    console.error(`FALHOU  ${nome}\n  ${e.message}`);
    process.exitCode = 1;
  }
}
const pedir = (caminho, { token, ...o } = {}) =>
  fetch(API + caminho, {
    ...o,
    headers: {
      Origin: APP,
      ...(o.body && typeof o.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(o.headers ?? {}),
    },
  });
const json = (o) => JSON.stringify(o);
function novaLigacao(nome) {
  const saida = execFileSync('node', ['scripts/acesso.mjs', '--nome', nome], { encoding: 'utf8' });
  return saida.trim().split('#acesso=')[1];
}

let dados;
await passo('a app recebe os parceiros com promoções na app', async () => {
  const r = await pedir('/api/app');
  assert.equal(r.status, 200);
  dados = await r.json();
  assert.ok(dados.parceiros.length >= 8, `parceiros: ${dados.parceiros.length}`);
  const otica = dados.parceiros.find((p) => p.nome === 'Ótica Lume');
  assert.equal(otica.promocoes.length, 1, 'a agendada não aparece');
  assert.equal(otica.lojaId, 3, 'a app recebe a casa de cada parceiro');
  const gelataria = dados.parceiros.find((p) => p.nome === 'Gelataria Neve Doce');
  assert.equal(gelataria.promocoes.length, 1, 'a pausada não aparece');
  assert.ok(dados.parceiros.every((p) => p.exemplo));
  assert.equal(dados.barbearia.lojas.length, 3);
  assert.ok(
    !dados.categorias.some((k) => k.nome === 'Beleza'),
    'categoria sem parceiros fica de fora',
  );
});

await passo('a mesma resposta duas vezes dá 304', async () => {
  const r1 = await pedir('/api/app');
  const etiqueta = r1.headers.get('etag');
  assert.ok(etiqueta);
  const r2 = await pedir('/api/app', { headers: { 'If-None-Match': etiqueta } });
  assert.equal(r2.status, 304);
});

await passo('o CORS só abre às origens da lista', async () => {
  const boa = await pedir('/api/app');
  assert.equal(boa.headers.get('access-control-allow-origin'), APP);
  const ma = await fetch(`${API}/api/app`, { headers: { Origin: 'https://outro.exemplo' } });
  assert.equal(ma.headers.get('access-control-allow-origin'), null);
});

await passo('uma contagem com referência que não existe não fica', async () => {
  const r = await fetch(`${API}/api/contar`, {
    method: 'POST',
    body: json({ tipo: 'parceiro', ref: 999999 }),
  });
  assert.equal(r.status, 204);
});

await passo('as contagens da app entram (texto simples, sem pré-voo)', async () => {
  for (const tipo of ['abrir', 'parceiro', 'mapa', 'marcar']) {
    const ref = tipo === 'abrir' ? 0 : 1;
    const r = await fetch(`${API}/api/contar`, {
      method: 'POST',
      body: json({ tipo, ref }),
      headers: { 'Content-Type': 'text/plain' },
    });
    assert.equal(r.status, 204);
  }
});

await passo('sem sessão, o backoffice responde 401', async () => {
  assert.equal((await pedir('/api/bo/eu')).status, 401);
  assert.equal((await pedir('/api/bo/parceiros', { token: 'x'.repeat(43) })).status, 401);
});

let token;
await passo('uma ligação de acesso entra uma vez, e só uma', async () => {
  const codigo = novaLigacao('Prova');
  const r = await pedir('/api/bo/entrar', { method: 'POST', body: json({ acesso: codigo }) });
  assert.equal(r.status, 200);
  const corpo = await r.json();
  token = corpo.sessao;
  assert.equal(corpo.eu.nome, 'Prova');
  const outra = await pedir('/api/bo/entrar', { method: 'POST', body: json({ acesso: codigo }) });
  assert.equal(outra.status, 401);
  assert.equal((await outra.json()).erro, 'ligacao_invalida');
});

await passo('um parceiro mal escrito é recusado com os campos', async () => {
  const r = await pedir('/api/bo/parceiros', {
    method: 'POST',
    token,
    body: json({
      nome: '',
      categoriaId: 1,
      localidade: '',
      morada: '',
      telefone: '12',
      instagram: 'não serve',
      site: 'javascript:x',
      horario: '',
      descricao: '',
      cor: 'azul',
      logotipo: null,
      capa: null,
      activo: true,
    }),
  });
  assert.equal(r.status, 400);
  const { campos } = await r.json();
  for (const c of ['nome', 'telefone', 'instagram', 'site', 'cor'])
    assert.ok(campos.includes(c), `falta ${c}`);
});

let imagem;
await passo('uma imagem PNG entra, e serve-se com cache de um ano', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const r = await pedir('/api/bo/imagens?l=1&a=1', {
    method: 'POST',
    token,
    body: png,
    headers: { 'Content-Type': 'image/png' },
  });
  assert.equal(r.status, 201);
  imagem = (await r.json()).id;
  const g = await pedir(`/api/imagens/${imagem}`);
  assert.equal(g.status, 200);
  assert.equal(g.headers.get('content-type'), 'image/png');
  assert.match(g.headers.get('cache-control'), /immutable/);
  const errada = await pedir('/api/bo/imagens?l=1&a=1', {
    method: 'POST',
    token,
    body: png,
    headers: { 'Content-Type': 'image/jpeg' },
  });
  assert.equal(errada.status, 415);
});

let parceiro;
await passo('criar um parceiro, com contactos arrumados', async () => {
  const r = await pedir('/api/bo/parceiros', {
    method: 'POST',
    token,
    body: json({
      nome: 'Parceiro de Prova',
      categoriaId: 1,
      lojaId: 3,
      localidade: 'Aveiro',
      morada: 'Rua da Prova, 1',
      telefone: ' 912  345 678',
      instagram: 'https://instagram.com/prova.pt/',
      site: 'prova.pt',
      horario: '',
      descricao: '',
      cor: '#2456b8',
      logotipo: imagem,
      capa: null,
      activo: true,
    }),
  });
  assert.equal(r.status, 201);
  parceiro = (await r.json()).id;
  const g = await (await pedir(`/api/bo/parceiros/${parceiro}`, { token })).json();
  assert.equal(g.parceiro.telefone, '912 345 678');
  assert.equal(g.parceiro.instagram, 'prova.pt');
  assert.equal(g.parceiro.site, 'https://prova.pt/');
  assert.equal(g.parceiro.cor, '#2456B8');
  assert.equal(g.parceiro.lojaId, 3, 'a casa do parceiro');
  assert.equal(g.parceiro.promocoesNaApp, 0);
  const semCasa = await pedir(`/api/bo/parceiros/${parceiro}`, {
    method: 'PATCH',
    token,
    body: json({ lojaId: 999 }),
  });
  assert.equal(semCasa.status, 400, 'uma casa que não existe é recusada');
});

await passo('sem promoções, o parceiro não aparece na app', async () => {
  const d = await (await pedir('/api/app')).json();
  assert.ok(!d.parceiros.some((p) => p.id === parceiro));
});

let promocao;
await passo('com uma promoção, aparece; com datas trocadas, é recusada', async () => {
  const trocadas = await pedir('/api/bo/promocoes', {
    method: 'POST',
    token,
    body: json({
      parceiroId: parceiro,
      destaque: '-15 %',
      titulo: 'Em tudo',
      detalhe: '',
      inicio: '2026-12-31',
      fim: '2026-01-01',
      emDestaque: false,
      activa: true,
    }),
  });
  assert.equal(trocadas.status, 400);
  const r = await pedir('/api/bo/promocoes', {
    method: 'POST',
    token,
    body: json({
      parceiroId: parceiro,
      destaque: '-15 %',
      titulo: 'Em tudo',
      detalhe: 'Só às terças.',
      inicio: null,
      fim: null,
      emDestaque: true,
      activa: true,
    }),
  });
  assert.equal(r.status, 201);
  promocao = (await r.json()).id;
  const d = await (await pedir('/api/app')).json();
  const p = d.parceiros.find((x) => x.id === parceiro);
  assert.ok(p, 'aparece');
  assert.equal(p.promocoes[0].destaque, '−15%');
  assert.equal(p.novo, true);
});

await passo('pausar a promoção tira o parceiro da app', async () => {
  const r = await pedir(`/api/bo/promocoes/${promocao}`, {
    method: 'PATCH',
    token,
    body: json({ activa: false }),
  });
  assert.equal(r.status, 204);
  const d = await (await pedir('/api/app')).json();
  assert.ok(!d.parceiros.some((x) => x.id === parceiro));
});

await passo('desligar o parceiro: as promoções ligadas dele contam como pausadas', async () => {
  const ligar = (activa) =>
    pedir(`/api/bo/promocoes/${promocao}`, { method: 'PATCH', token, body: json({ activa }) });
  await ligar(true);
  const r = await pedir(`/api/bo/parceiros/${parceiro}`, {
    method: 'PATCH',
    token,
    body: json({ activo: false, instagram: 'https://m.instagram.com/outra.prova/' }),
  });
  assert.equal(r.status, 200, 'o PATCH devolve o parceiro gravado');
  const gravado = await r.json();
  assert.equal(gravado.activo, false);
  assert.equal(gravado.instagram, 'outra.prova', 'com os contactos arrumados');
  const lista = await (await pedir('/api/bo/promocoes', { token })).json();
  const p = lista.find((x) => x.id === promocao);
  assert.equal(p.estado, 'pausada');
  assert.equal(p.parceiroPausado, true);
  await pedir(`/api/bo/parceiros/${parceiro}`, {
    method: 'PATCH',
    token,
    body: json({ activo: true }),
  });
  await ligar(false);
});

await passo('o resumo conta as contagens e o que precisa de atenção', async () => {
  const r = await (await pedir('/api/bo/resumo?dias=7', { token })).json();
  assert.equal(r.aberturas.length, 7);
  assert.ok(r.totais.aberturas >= 1);
  assert.ok(r.totais.parceiros >= 1);
  assert.ok(r.semPromocoes.some((p) => p.id === parceiro));
  assert.ok(r.aAcabar.some((p) => p.parceiro === 'Lavagem Onda Azul'));
  assert.equal(r.marcacoes.length, 3);
});

await passo('apagar o parceiro apaga as promoções e as contagens dele', async () => {
  for (const [tipo, ref] of [
    ['parceiro', parceiro],
    ['ligar', parceiro],
    ['promocao', promocao],
  ])
    await fetch(`${API}/api/contar`, { method: 'POST', body: json({ tipo, ref }) });
  await new Promise((r) => setTimeout(r, 400));
  const contar = () =>
    daBaseLocal(
      `SELECT count(*) AS n FROM contagens WHERE (tipo IN ('parceiro', 'ligar') AND ref = ${parceiro}) OR (tipo = 'promocao' AND ref = ${promocao})`,
    )[0].n;
  assert.ok(contar() >= 3, 'as contagens entraram');
  assert.equal(
    (await pedir(`/api/bo/parceiros/${parceiro}`, { method: 'DELETE', token })).status,
    204,
  );
  assert.equal((await pedir(`/api/bo/promocoes/${promocao}`, { token })).status, 404);
  assert.equal(contar(), 0, 'um parceiro novo com o mesmo id não herda as vistas');
});

await passo('a barbearia grava-se inteira, e uma ligação sem https é recusada', async () => {
  const b = await (await pedir('/api/bo/barbearia', { token })).json();
  const ma = await pedir('/api/bo/barbearia', {
    method: 'PUT',
    token,
    body: json({ ...b, whatsapp: 'http://wa.link/x' }),
  });
  assert.equal(ma.status, 400);
  const boa = await pedir('/api/bo/barbearia', {
    method: 'PUT',
    token,
    body: json({ ...b, aviso: 'Novos parceiros esta semana', avisoAte: null }),
  });
  assert.equal(boa.status, 200, 'devolve o que gravou');
  const gravada = await boa.json();
  assert.equal(gravada.aviso, 'Novos parceiros esta semana');
  assert.ok(gravada.lojas.every((l) => Number.isInteger(l.id)));
  const d = await (await pedir('/api/app')).json();
  assert.equal(d.aviso, 'Novos parceiros esta semana');
  await pedir('/api/bo/barbearia', { method: 'PUT', token, body: json({ ...b, aviso: '' }) });
});

await passo('acessos: criar para outra pessoa, e não se tira a si próprio', async () => {
  const r = await pedir('/api/bo/acessos', {
    method: 'POST',
    token,
    body: json({ nome: 'Nuno (prova)' }),
  });
  assert.equal(r.status, 201);
  const { codigo, adminId } = await r.json();
  assert.match(codigo, /^[A-Za-z0-9_-]{43}$/);
  const lista = await (await pedir('/api/bo/acessos', { token })).json();
  const nuno = lista.find((p) => p.id === adminId);
  assert.equal(nuno.ligacoes.length, 1);
  const eu = lista.find((p) => p.eu);
  assert.equal((await pedir(`/api/bo/pessoas/${eu.id}`, { method: 'DELETE', token })).status, 409);
  assert.equal(
    (await pedir(`/api/bo/pessoas/${adminId}`, { method: 'DELETE', token })).status,
    204,
  );
  const entrar = await pedir('/api/bo/entrar', { method: 'POST', body: json({ acesso: codigo }) });
  assert.equal(entrar.status, 401, 'a ligação de quem foi tirado já não entra');
});

await passo('o registo guarda o que se fez', async () => {
  const r = await (await pedir('/api/bo/registo', { token })).json();
  const accoes = r.map((x) => x.accao);
  for (const a of [
    'parceiro.criado',
    'promocao.criada',
    'promocao.pausada',
    'parceiro.apagado',
    'pessoa.removida',
  ])
    assert.ok(accoes.includes(a), `falta ${a}`);
});

await passo('entrar com o Google: um token que não bate certo dá 401', async () => {
  const lixo = await pedir('/api/bo/entrar/google', {
    method: 'POST',
    body: json({ credencial: 'x'.repeat(40) }),
  });
  assert.equal(lixo.status, 401);
  assert.equal((await lixo.json()).erro, 'google_invalido');
  // Com a forma de um JWT, mas assinado por ninguém: a API vai às chaves do Google e recusa.
  const cab = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'nao-existe' })).toString(
    'base64url',
  );
  const corpo = Buffer.from(
    JSON.stringify({ email: 'renato.lima.valente@gmail.com', email_verified: true }),
  ).toString('base64url');
  const falso = await pedir('/api/bo/entrar/google', {
    method: 'POST',
    body: json({ credencial: `${cab}.${corpo}.YXNzaW5hdHVyYQ` }),
  });
  assert.equal(falso.status, 401);
});

await passo('pessoas: dar acesso com o email, sem repetir, e mudar o email', async () => {
  const r = await pedir('/api/bo/pessoas', {
    method: 'POST',
    token,
    body: json({ nome: 'Teste Google', email: '  Teste.Google@Gmail.com ' }),
  });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const lista = await (await pedir('/api/bo/acessos', { token })).json();
  assert.equal(lista.find((p) => p.id === id).email, 'teste.google@gmail.com');
  const repetida = await pedir('/api/bo/pessoas', {
    method: 'POST',
    token,
    body: json({ nome: 'Outra', email: 'teste.google@gmail.com' }),
  });
  assert.equal(repetida.status, 409);
  const ma = await pedir(`/api/bo/pessoas/${id}`, {
    method: 'PATCH',
    token,
    body: json({ email: 'sem-arroba' }),
  });
  assert.equal(ma.status, 400);
  assert.equal(
    (await pedir(`/api/bo/pessoas/${id}`, { method: 'PATCH', token, body: json({ email: null }) }))
      .status,
    204,
  );
  const depois = await (await pedir('/api/bo/acessos', { token })).json();
  assert.equal(depois.find((p) => p.id === id).email, null);
  assert.equal((await pedir(`/api/bo/pessoas/${id}`, { method: 'DELETE', token })).status, 204);
});

// ——— a fidelidade ———

await passo('o programa lê-se e grava-se', async () => {
  const antes = await (await pedir('/api/bo/programa', { token })).json();
  assert.equal(antes.objectivo, 10);
  const r = await pedir('/api/bo/programa', {
    method: 'PUT',
    token,
    body: json({
      objectivo: 8,
      recompensa: 'Corte grátis',
      porDia: 2,
      servicos: true,
      aniversario: '',
    }),
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).objectivo, 8);
  const mau = await pedir('/api/bo/programa', {
    method: 'PUT',
    token,
    body: json({ objectivo: 0, recompensa: '', porDia: 1, servicos: true, aniversario: '' }),
  });
  assert.equal(mau.status, 400);
  await pedir('/api/bo/programa', {
    method: 'PUT',
    token,
    body: json({
      objectivo: 10,
      recompensa: 'Corte grátis',
      porDia: 1,
      servicos: true,
      aniversario: '',
    }),
  });
});

await passo('serviços: criar, mudar o preço, apagar', async () => {
  const r = await pedir('/api/bo/servicos', {
    method: 'POST',
    token,
    body: json({ nome: 'Prova', preco: 500 }),
  });
  assert.equal(r.status, 201);
  const criado = (await r.json()).find((s) => s.nome === 'Prova');
  assert.ok(criado);
  const mudado = await (
    await pedir(`/api/bo/servicos/${criado.id}`, {
      method: 'PATCH',
      token,
      body: json({ preco: 700 }),
    })
  ).json();
  assert.equal(mudado.find((s) => s.id === criado.id).preco, 700);
  const depois = await (
    await pedir(`/api/bo/servicos/${criado.id}`, { method: 'DELETE', token })
  ).json();
  assert.ok(!depois.some((s) => s.id === criado.id), 'sem carimbos, apaga-se mesmo');
});

let tokenBalcao;
let barbeiroId;
await passo('equipa: um barbeiro, uma ligação de acesso, e a Balcão abre', async () => {
  const r = await pedir('/api/bo/equipa', {
    method: 'POST',
    token,
    body: json({
      nome: 'Prova Barbeiro',
      email: null,
      papel: 'barbeiro',
      lojaId: 3,
      parceiroId: null,
    }),
  });
  assert.equal(r.status, 201);
  barbeiroId = (await r.json()).find((p) => p.nome === 'Prova Barbeiro').id;
  const { codigo } = await (
    await pedir(`/api/bo/equipa/${barbeiroId}/acesso`, { method: 'POST', token })
  ).json();
  const entrada = await pedir('/api/balcao/entrar', {
    method: 'POST',
    body: json({ acesso: codigo }),
  });
  assert.equal(entrada.status, 200);
  tokenBalcao = (await entrada.json()).sessao;
  assert.equal(
    (await pedir('/api/balcao/entrar', { method: 'POST', body: json({ acesso: codigo }) })).status,
    401,
  );
  const eu = await (await pedir('/api/balcao/eu', { token: tokenBalcao })).json();
  assert.equal(eu.pessoa.papel, 'barbeiro');
  assert.equal(eu.pessoa.lojaId, 3);
  assert.equal(eu.lojas.length, 3);
  assert.equal(eu.programa.objectivo, 10);
  assert.ok(eu.servicos.length >= 3);
  assert.equal((await pedir('/api/balcao/eu')).status, 401);
});

let codigoDoCliente;
await passo('um cliente novo ao balcão, com o 1.º carimbo', async () => {
  const r = await pedir('/api/balcao/clientes', {
    method: 'POST',
    token: tokenBalcao,
    body: json({
      nome: 'Cliente Prova',
      email: 'cliente.prova@gmail.com',
      carimbo: { chave: 'prova-c-01', lojaId: 3, servicoId: 1 },
    }),
  });
  assert.equal(r.status, 200);
  const { ficha, carimbo } = await r.json();
  assert.equal(ficha.cartao.carimbos, 1);
  assert.equal(carimbo.cartao.carimbos, 1);
  assert.equal(ficha.cliente.cortes, 1);
  codigoDoCliente = ficha.cliente.codigo;
  assert.match(codigoDoCliente, /^[0-9A-HJKMNP-TV-Z]{8}$/);
  const repetido = await pedir('/api/balcao/clientes', {
    method: 'POST',
    token: tokenBalcao,
    body: json({ nome: 'Outro', email: 'cliente.prova@gmail.com' }),
  });
  assert.equal(repetido.status, 409);
});

await passo('a ficha pelo código (escrito à mão também), e um código que não existe', async () => {
  const r = await pedir(`/api/balcao/ficha/${codigoDoCliente}`, { token: tokenBalcao });
  assert.equal(r.status, 200);
  const ficha = await r.json();
  assert.equal(ficha.cliente.nome, 'Cliente Prova');
  assert.equal(ficha.hoje.carimbos, 1);
  const escrito = codigoDoCliente.toLowerCase().replace(/0/g, 'o');
  assert.equal(
    (await pedir(`/api/balcao/ficha/${encodeURIComponent(escrito)}`, { token: tokenBalcao }))
      .status,
    200,
  );
  assert.equal((await pedir('/api/balcao/ficha/ABCDEFGH', { token: tokenBalcao })).status, 404);
});

let ultimoCarimbo;
await passo(
  'o limite do dia avisa; confirmar carimba na mesma; a mesma chave conta uma vez; anula-se',
  async () => {
    const pedido = (corpo) =>
      pedir('/api/balcao/carimbar', { method: 'POST', token: tokenBalcao, body: json(corpo) });
    const aviso = await pedido({ codigo: codigoDoCliente, chave: 'prova-c-02', lojaId: 3 });
    assert.equal(aviso.status, 409);
    const j = await aviso.json();
    assert.equal(j.erro, 'limite_do_dia');
    assert.ok(j.ultimo.quando);
    const r = await pedido({
      codigo: codigoDoCliente,
      chave: 'prova-c-02',
      lojaId: 3,
      confirmar: true,
    });
    assert.equal(r.status, 200);
    const feito = await r.json();
    assert.equal(feito.cartao.carimbos, 2);
    const outraVez = await (
      await pedido({ codigo: codigoDoCliente, chave: 'prova-c-02', lojaId: 3, confirmar: true })
    ).json();
    assert.equal(outraVez.carimboId, feito.carimboId, 'a mesma chave devolve o mesmo carimbo');
    assert.equal(outraVez.cartao.carimbos, 2);
    const anular = await pedir('/api/balcao/anular', {
      method: 'POST',
      token: tokenBalcao,
      body: json({ carimboId: feito.carimboId }),
    });
    assert.equal(anular.status, 204);
    const ficha = await (
      await pedir(`/api/balcao/ficha/${codigoDoCliente}`, { token: tokenBalcao })
    ).json();
    assert.equal(ficha.cartao.carimbos, 1);
    assert.equal(
      (
        await pedir('/api/balcao/anular', {
          method: 'POST',
          token: tokenBalcao,
          body: json({ carimboId: feito.carimboId }),
        })
      ).status,
      409,
    );
    const outraCasa = await pedido({
      codigo: codigoDoCliente,
      chave: 'prova-c-xx',
      lojaId: 1,
      confirmar: true,
    });
    assert.equal(outraCasa.status, 403, 'um barbeiro de Aveiro não carimba em Nogueira');
  },
);

await passo(
  'completar o cartão dá a recompensa, que se usa uma vez; o carimbo que a deu já não se anula',
  async () => {
    let ultimo;
    for (let i = 3; i <= 11; i++) {
      const r = await pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: tokenBalcao,
        body: json({
          codigo: codigoDoCliente,
          chave: `prova-c-${String(i).padStart(2, '0')}`,
          lojaId: 3,
          servicoId: 3,
          confirmar: true,
        }),
      });
      assert.equal(r.status, 200, `carimbo ${i}`);
      ultimo = await r.json();
      assert.equal(ultimo.completo, i === 11, `completo no ${i}`);
    }
    assert.equal(ultimo.recompensa, 'Corte grátis');
    ultimoCarimbo = ultimo.carimboId;
    const ficha = await (
      await pedir(`/api/balcao/ficha/${codigoDoCliente}`, { token: tokenBalcao })
    ).json();
    assert.equal(ficha.cartao.numero, 2, 'abre o cartão seguinte');
    assert.equal(ficha.cartao.carimbos, 0);
    assert.equal(ficha.recompensas.length, 1);
    assert.equal(ficha.cliente.cortes, 10);
    const usar = await pedir('/api/balcao/usar-recompensa', {
      method: 'POST',
      token: tokenBalcao,
      body: json({ codigo: codigoDoCliente, cartaoId: ficha.recompensas[0].cartaoId, lojaId: 3 }),
    });
    assert.equal(usar.status, 200);
    assert.equal((await usar.json()).recompensas.length, 0);
    const outraVez = await pedir('/api/balcao/usar-recompensa', {
      method: 'POST',
      token: tokenBalcao,
      body: json({ codigo: codigoDoCliente, cartaoId: ficha.recompensas[0].cartaoId, lojaId: 3 }),
    });
    assert.equal(outraVez.status, 409);
    const anular = await pedir('/api/balcao/anular', {
      method: 'POST',
      token: tokenBalcao,
      body: json({ carimboId: ultimoCarimbo }),
    });
    assert.equal(anular.status, 409);
    assert.equal((await anular.json()).erro, 'recompensa_usada');
  },
);

await passo('o dia da casa, e procurar um cliente', async () => {
  const hoje = await (await pedir('/api/balcao/hoje', { token: tokenBalcao })).json();
  assert.ok(hoje.carimbos >= 10, `hoje: ${hoje.carimbos}`);
  assert.equal(hoje.novos, 1);
  assert.equal(hoje.recompensas, 1);
  assert.ok(hoje.ultimos.length >= 10);
  assert.ok(
    hoje.ultimos.some((u) => u.anulado),
    'o anulado aparece marcado',
  );
  assert.ok(
    hoje.ultimos.some((u) => u.recompensa),
    'o que completou o cartão aparece marcado',
  );
  const lista = await (await pedir('/api/balcao/clientes?q=prova', { token: tokenBalcao })).json();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].carimbos, 0);
  assert.equal(lista[0].objectivo, 10);
  assert.equal(
    (await (await pedir('/api/balcao/clientes?q=p', { token: tokenBalcao })).json()).length,
    0,
  );
});

let tokenDono;
await passo('o resumo é só do dono', async () => {
  assert.equal((await pedir('/api/balcao/resumo', { token: tokenBalcao })).status, 403);
  const r = await pedir('/api/bo/equipa', {
    method: 'POST',
    token,
    body: json({
      nome: 'Prova Dono',
      email: 'dono.prova@gmail.com',
      papel: 'dono',
      lojaId: null,
      parceiroId: null,
    }),
  });
  const dono = (await r.json()).find((p) => p.nome === 'Prova Dono');
  const { codigo } = await (
    await pedir(`/api/bo/equipa/${dono.id}/acesso`, { method: 'POST', token })
  ).json();
  tokenDono = (
    await (
      await pedir('/api/balcao/entrar', { method: 'POST', body: json({ acesso: codigo }) })
    ).json()
  ).sessao;
  const resumo = await (await pedir('/api/balcao/resumo?periodo=mes', { token: tokenDono })).json();
  assert.ok(resumo.carimbos > 10, `carimbos no mês: ${resumo.carimbos}`);
  assert.equal(resumo.porLoja.length, 3);
  assert.ok(resumo.porPessoa.some((p) => p.nome === 'Prova Barbeiro' && p.n === 10));
  assert.equal(typeof resumo.emRisco, 'number');
  const casa = await (
    await pedir('/api/balcao/resumo?periodo=hoje&lojaId=1', { token: tokenDono })
  ).json();
  assert.ok(casa.carimbos < resumo.carimbos);
});

let tokenCliente;
let euAntes;
await passo('o cliente entra com a Google e fica com o cartão aberto ao balcão', async () => {
  const r = await pedir('/api/eu/entrar/teste', {
    method: 'POST',
    body: json({
      tipo: 'google',
      sujeito: 'prova-google-1',
      email: 'cliente.prova@gmail.com',
      nome: 'Prova',
    }),
  });
  assert.equal(r.status, 200);
  tokenCliente = (await r.json()).sessao;
  euAntes = await (await pedir('/api/eu', { token: tokenCliente })).json();
  assert.equal(euAntes.nome, 'Cliente Prova', 'o nome escrito ao balcão fica');
  assert.equal(euAntes.codigo, codigoDoCliente);
  assert.equal(euAntes.cortes, 10);
  assert.equal(euAntes.cartao.numero, 2);
  assert.deepEqual(euAntes.formas.map((f) => f.tipo).sort(), ['email', 'google']);
  assert.equal(euAntes.provaRecente, true);
  assert.equal(euAntes.visitas.length, 10);
  assert.equal(euAntes.programa.objectivo, 10);
  assert.equal((await pedir('/api/eu')).status, 401);
});

await passo(
  'o perfil: nome, aniversário e casa; um aniversário que não existe é recusado',
  async () => {
    const r = await pedir('/api/eu/perfil', {
      method: 'PATCH',
      token: tokenCliente,
      body: json({ aniversario: '02-29', lojaId: 3, nome: 'Prova C.' }),
    });
    assert.equal(r.status, 200);
    const eu = await r.json();
    assert.equal(eu.aniversario, '02-29');
    assert.equal(eu.lojaId, 3);
    assert.equal(eu.nome, 'Prova C.');
    assert.equal(
      (
        await pedir('/api/eu/perfil', {
          method: 'PATCH',
          token: tokenCliente,
          body: json({ aniversario: '13-01' }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await pedir('/api/eu/perfil', {
          method: 'PATCH',
          token: tokenCliente,
          body: json({ lojaId: 999 }),
        })
      ).status,
      400,
    );
  },
);

// ——— a Wallet ———

/** Lê um ficheiro de um ZIP só armazenado (o .pkpass): o cabeçalho local, o nome, os bytes. */
function doZip(bytes, nome) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  while (pos + 30 <= bytes.length && v.getUint32(pos, true) === 0x04034b50) {
    const tamanho = v.getUint32(pos + 18, true);
    const nomeLen = v.getUint16(pos + 26, true);
    const extraLen = v.getUint16(pos + 28, true);
    const nomeDoFicheiro = new TextDecoder().decode(bytes.subarray(pos + 30, pos + 30 + nomeLen));
    const inicio = pos + 30 + nomeLen + extraLen;
    if (nomeDoFicheiro === nome) return bytes.subarray(inicio, inicio + tamanho);
    pos = inicio + tamanho;
  }
  return null;
}

let passe;
await passo(
  'o cliente pede o passe da Apple: uma ligação temporária que dá o .pkpass assinado',
  async () => {
    const r = await pedir('/api/eu/wallet/apple', { method: 'POST', token: tokenCliente });
    assert.equal(r.status, 200, 'a Wallet da Apple está ligada no local (.dev.vars)');
    const { url } = await r.json();
    assert.ok(url.includes('/api/wallet/apple/passe?'));
    const pk = await fetch(url);
    assert.equal(pk.status, 200);
    assert.equal(pk.headers.get('content-type'), 'application/vnd.apple.pkpass');
    assert.ok(pk.headers.get('last-modified'));
    const bytes = new Uint8Array(await pk.arrayBuffer());
    const json = doZip(bytes, 'pass.json');
    assert.ok(json, 'tem pass.json');
    passe = JSON.parse(new TextDecoder().decode(json));
    assert.equal(passe.passTypeIdentifier, 'pass.pt.nunoslab.cartao');
    assert.equal(passe.barcode.message, `NL1.${codigoDoCliente}`);
    assert.equal(passe.storeCard.headerFields[0].value, '0 de 10');
    assert.ok(doZip(bytes, 'signature').length > 1000, 'tem assinatura');
    assert.ok(doZip(bytes, 'icon.png') && doZip(bytes, 'logo@2x.png'), 'tem as imagens');
    assert.equal(passe.locations.length, 3);
    // A ligação assinada com outra assinatura não serve; caducada também não.
    assert.equal((await fetch(url.replace(/s=[0-9a-f]+/, 's=' + '0'.repeat(32)))).status, 403);
    assert.equal((await fetch(url.replace(/a=\d+/, 'a=1'))).status, 410);
  },
);

await passo(
  'o serviço web da Apple: registar o aparelho, saber o que mudou, o passe com 304, sair',
  async () => {
    const tipo = passe.passTypeIdentifier;
    const serie = passe.serialNumber;
    const auth = { Authorization: `ApplePass ${passe.authenticationToken}` };
    const base = `/api/wallet/apple/v1/devices/aparelho-de-prova-1/registrations/${tipo}`;
    assert.equal(
      (
        await pedir(`${base}/${serie}`, {
          method: 'POST',
          headers: { Authorization: 'ApplePass errado' },
          body: json({ pushToken: 'ab'.repeat(32) }),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await pedir(`${base}/${serie}`, {
          method: 'POST',
          headers: auth,
          body: json({ pushToken: 'ab'.repeat(32) }),
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await pedir(`${base}/${serie}`, {
          method: 'POST',
          headers: auth,
          body: json({ pushToken: 'ab'.repeat(32) }),
        })
      ).status,
      200,
      'o mesmo registo outra vez dá 200',
    );
    const lista = await pedir(`${base}?passesUpdatedSince=0`);
    assert.equal(lista.status, 200);
    const l = await lista.json();
    assert.deepEqual(l.serialNumbers, [serie]);
    assert.equal(typeof l.lastUpdated, 'string');
    assert.equal(
      (await pedir(`${base}?passesUpdatedSince=${l.lastUpdated}`)).status,
      204,
      'nada mudou desde a etiqueta',
    );
    const pk = await pedir(`/api/wallet/apple/v1/passes/${tipo}/${serie}`, { headers: auth });
    assert.equal(pk.status, 200);
    const data = pk.headers.get('last-modified');
    assert.equal(
      (
        await pedir(`/api/wallet/apple/v1/passes/${tipo}/${serie}`, {
          headers: { ...auth, 'If-Modified-Since': data },
        })
      ).status,
      304,
    );
    // Um carimbo toca o passe: a etiqueta sobe e o passe volta a vir.
    await new Promise((r) => setTimeout(r, 1100));
    const c = await pedir('/api/balcao/carimbar', {
      method: 'POST',
      token: tokenBalcao,
      body: json({ codigo: codigoDoCliente, chave: 'prova-wallet-01', lojaId: 3, confirmar: true }),
    });
    assert.equal(c.status, 200);
    await new Promise((r) => setTimeout(r, 600));
    const depois = await (await pedir(`${base}?passesUpdatedSince=${l.lastUpdated}`)).json();
    assert.deepEqual(depois.serialNumbers, [serie], 'o passe mudou com o carimbo');
    const novo = await pedir(`/api/wallet/apple/v1/passes/${tipo}/${serie}`, {
      headers: { ...auth, 'If-Modified-Since': data },
    });
    assert.equal(novo.status, 200);
    const pj = JSON.parse(
      new TextDecoder().decode(doZip(new Uint8Array(await novo.arrayBuffer()), 'pass.json')),
    );
    assert.equal(pj.storeCard.headerFields[0].value, '1 de 10');
    assert.equal(
      (await pedir(`${base}/${serie}`, { method: 'DELETE', headers: auth })).status,
      200,
    );
    assert.equal(
      (await pedir(`${base}?passesUpdatedSince=0`)).status,
      204,
      'sem registos, nada a dizer',
    );
    assert.equal(
      (await pedir('/api/wallet/apple/v1/log', { method: 'POST', body: json({ logs: ['prova'] }) }))
        .status,
      200,
    );
    const eu = await (await pedir('/api/eu', { token: tokenCliente })).json();
    assert.equal(eu.wallet.apple, true);
    assert.equal(eu.wallet.google, true);
  },
);

// ——— os vales dos parceiros ———

let tokenParceiro;
let promocaoValidavel;
await passo(
  'uma promoção com validação; o parceiro entra na Balcão; cada papel só faz o seu',
  async () => {
    const r = await pedir('/api/bo/promocoes', {
      method: 'POST',
      token,
      body: json({
        parceiroId: 1,
        destaque: '-10 %',
        titulo: 'Na refeição',
        detalhe: '',
        inicio: null,
        fim: null,
        emDestaque: false,
        activa: true,
        validar: true,
        limitePorCliente: 1,
        periodoDoLimite: 'dia',
        limiteTotal: 2,
        soClientesActivos: true,
      }),
    });
    assert.equal(r.status, 201);
    promocaoValidavel = (await r.json()).id;
    const app = await (await pedir('/api/app')).json();
    const pr = app.parceiros
      .find((x) => x.id === 1)
      .promocoes.find((x) => x.id === promocaoValidavel);
    assert.equal(pr.validar, true);
    assert.equal(pr.limitePorCliente, 1);
    assert.equal(pr.periodoDoLimite, 'dia');
    assert.equal(pr.soClientesActivos, true);
    assert.equal('limiteTotal' in pr, false, 'o limite total não vai para a app');
    const equipa = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Prova Parceiro',
        email: null,
        papel: 'parceiro',
        lojaId: null,
        parceiroId: 1,
      }),
    });
    assert.equal(equipa.status, 201);
    const pessoa = (await equipa.json()).find((p) => p.nome === 'Prova Parceiro');
    const { codigo } = await (
      await pedir(`/api/bo/equipa/${pessoa.id}/acesso`, { method: 'POST', token })
    ).json();
    tokenParceiro = (
      await (
        await pedir('/api/balcao/entrar', { method: 'POST', body: json({ acesso: codigo }) })
      ).json()
    ).sessao;
    const eu = await (await pedir('/api/balcao/eu', { token: tokenParceiro })).json();
    assert.equal(eu.pessoa.papel, 'parceiro');
    assert.equal(eu.parceiro.nome, 'Tasca Velha do Cravo');
    const carimbo = await pedir('/api/balcao/carimbar', {
      method: 'POST',
      token: tokenParceiro,
      body: json({ codigo: codigoDoCliente, chave: 'vale-prova-xx', lojaId: 1 }),
    });
    assert.equal(carimbo.status, 403, 'o parceiro não carimba');
    assert.equal(
      (await pedir(`/api/balcao/ficha-parceiro/${codigoDoCliente}`, { token: tokenBalcao })).status,
      403,
      'o barbeiro não valida',
    );
  },
);

await passo('o parceiro lê o cartão, valida uma vez por dia, anula e volta a validar', async () => {
  const ficha = await (
    await pedir(`/api/balcao/ficha-parceiro/${codigoDoCliente}`, { token: tokenParceiro })
  ).json();
  assert.equal(ficha.cliente.nome, 'Prova', 'só o nome próprio');
  assert.equal(ficha.cliente.activo, true);
  const v = ficha.vantagens.find((x) => x.id === promocaoValidavel);
  assert.equal(v.motivo, 'ok');
  assert.equal(v.usadas, 0);
  const validar = (chave) =>
    pedir('/api/balcao/validar', {
      method: 'POST',
      token: tokenParceiro,
      body: json({ codigo: codigoDoCliente, promocaoId: promocaoValidavel, chave }),
    });
  const r1 = await validar('vale-prova-01');
  assert.equal(r1.status, 200);
  const j1 = await r1.json();
  assert.equal(j1.vale.destaque, '−10%');
  assert.equal(j1.ficha.vantagens.find((x) => x.id === promocaoValidavel).motivo, 'ja_usou');
  const outraVez = await (await validar('vale-prova-01')).json();
  assert.equal(outraVez.vale.id, j1.vale.id, 'a mesma chave devolve o mesmo vale');
  const segundo = await validar('vale-prova-02');
  assert.equal(segundo.status, 409);
  assert.equal((await segundo.json()).erro, 'ja_usou');
  assert.equal(
    (
      await pedir('/api/balcao/anular-vale', {
        method: 'POST',
        token: tokenParceiro,
        body: json({ valeId: j1.vale.id }),
      })
    ).status,
    204,
  );
  assert.equal(
    (
      await pedir('/api/balcao/anular-vale', {
        method: 'POST',
        token: tokenParceiro,
        body: json({ valeId: j1.vale.id }),
      })
    ).status,
    409,
  );
  const r3 = await validar('vale-prova-03');
  assert.equal(r3.status, 200);
  const hoje = await (await pedir('/api/balcao/hoje-parceiro', { token: tokenParceiro })).json();
  assert.equal(hoje.validacoes, 1);
  assert.equal(hoje.ultimos.length, 2);
  assert.ok(hoje.ultimos.some((x) => x.anulado));
  const eu = await (await pedir('/api/eu', { token: tokenCliente })).json();
  assert.equal(eu.activo, true);
  assert.equal(eu.vales.length, 1);
  assert.equal(eu.vales[0].parceiro, 'Tasca Velha do Cravo');
});

await passo(
  'cliente inactivo não usa; o limite total fecha a vantagem; as métricas contam',
  async () => {
    const inactivo = await (
      await pedir('/api/eu/entrar/teste', {
        method: 'POST',
        body: json({
          tipo: 'google',
          sujeito: 'prova-google-inactivo',
          email: 'inactivo@gmail.com',
        }),
      })
    ).json();
    const euInactivo = await (await pedir('/api/eu', { token: inactivo.sessao })).json();
    assert.equal(euInactivo.activo, false);
    const ficha = await (
      await pedir(`/api/balcao/ficha-parceiro/${euInactivo.codigo}`, { token: tokenParceiro })
    ).json();
    assert.equal(ficha.cliente.activo, false);
    assert.equal(
      ficha.vantagens.find((x) => x.id === promocaoValidavel).motivo,
      'cliente_inactivo',
    );
    const recusa = await pedir('/api/balcao/validar', {
      method: 'POST',
      token: tokenParceiro,
      body: json({
        codigo: euInactivo.codigo,
        promocaoId: promocaoValidavel,
        chave: 'vale-prova-05',
      }),
    });
    assert.equal(recusa.status, 409);
    assert.equal((await recusa.json()).erro, 'cliente_inactivo');
    const [a, b] = daBaseLocal('SELECT codigo FROM clientes WHERE id IN (1003, 1015) ORDER BY id');
    const segunda = await pedir('/api/balcao/validar', {
      method: 'POST',
      token: tokenParceiro,
      body: json({ codigo: a.codigo, promocaoId: promocaoValidavel, chave: 'vale-prova-06' }),
    });
    assert.equal(segunda.status, 200, 'um cliente de exemplo activo usa');
    const terceira = await pedir('/api/balcao/validar', {
      method: 'POST',
      token: tokenParceiro,
      body: json({ codigo: b.codigo, promocaoId: promocaoValidavel, chave: 'vale-prova-07' }),
    });
    assert.equal(terceira.status, 409);
    assert.equal((await terceira.json()).erro, 'limite_total');
    const m = await (await pedir('/api/bo/metricas', { token })).json();
    assert.equal(m.parcerias.validacoes, 2);
    assert.equal(m.parcerias.clientesUnicos, 2);
    assert.ok(m.parcerias.porParceiro.find((x) => x.id === 1).n === 2);
    const pp = m.parcerias.porPromocao.find((x) => x.id === promocaoValidavel);
    assert.equal(pp.total, 2);
    assert.equal(pp.limiteTotal, 2);
    assert.ok(m.parcerias.semValidacoes.length >= 1);
    assert.equal(m.parcerias.porCasa.length, 3);
    const promo = await (await pedir(`/api/bo/promocoes/${promocaoValidavel}`, { token })).json();
    assert.equal(promo.validacoes, 2);
    assert.equal(promo.limiteTotal, 2);
    assert.equal(promo.validar, true);
    assert.equal(
      (await pedir(`/api/bo/promocoes/${promocaoValidavel}`, { method: 'DELETE', token })).status,
      204,
    );
  },
);

await passo(
  'o saco das surpresas: ao carimbar sai um cupão; o parceiro valida-o uma vez; anular devolve-o',
  async () => {
    const r = await pedir('/api/bo/promocoes', {
      method: 'POST',
      token,
      body: json({
        parceiroId: 1,
        destaque: 'Grátis',
        titulo: 'Sobremesa surpresa',
        detalhe: '',
        inicio: null,
        fim: null,
        emDestaque: false,
        activa: true,
        surpresa: true,
        surpresaDias: 30,
        surpresaPeso: 5,
        surpresaRestantes: 1,
      }),
    });
    assert.equal(r.status, 201);
    const surpresa = (await r.json()).id;
    const app = await (await pedir('/api/app')).json();
    assert.ok(
      !app.parceiros.find((x) => x.id === 1).promocoes.some((p) => p.id === surpresa),
      'as do saco não se listam como permanentes',
    );
    const c1 = await pedir('/api/balcao/carimbar', {
      method: 'POST',
      token: tokenBalcao,
      body: json({ codigo: codigoDoCliente, chave: 'prova-cupao-01', lojaId: 3, confirmar: true }),
    });
    assert.equal(c1.status, 200);
    const j1 = await c1.json();
    assert.equal(j1.cupao?.titulo, 'Sobremesa surpresa', 'saiu o cupão');
    assert.equal(j1.cupao.parceiro, 'Tasca Velha do Cravo');
    const eu = await (await pedir('/api/eu', { token: tokenCliente })).json();
    assert.equal(eu.cupoes.length, 1);
    assert.equal(eu.cupoes[0].usadoEm, null);
    const ficha = await (
      await pedir(`/api/balcao/ficha-parceiro/${codigoDoCliente}`, { token: tokenParceiro })
    ).json();
    const v = ficha.vantagens.find((x) => x.cupaoId);
    assert.ok(v, 'o parceiro vê o cupão');
    assert.equal(v.titulo, 'Sobremesa surpresa');
    const validar = (chave) =>
      pedir('/api/balcao/validar', {
        method: 'POST',
        token: tokenParceiro,
        body: json({ codigo: codigoDoCliente, promocaoId: v.id, chave, cupaoId: v.cupaoId }),
      });
    const r1 = await validar('vale-cupao-01');
    assert.equal(r1.status, 200);
    assert.equal((await r1.json()).vale.titulo, 'Sobremesa surpresa');
    const outraVez = await validar('vale-cupao-02');
    assert.equal(outraVez.status, 409);
    assert.equal((await outraVez.json()).erro, 'cupao_usado');
    const usado = await (await pedir('/api/eu', { token: tokenCliente })).json();
    assert.ok(usado.cupoes[0].usadoEm, 'o cliente vê o cupão como usado');
    const c2 = await (
      await pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: tokenBalcao,
        body: json({
          codigo: codigoDoCliente,
          chave: 'prova-cupao-02',
          lojaId: 3,
          confirmar: true,
        }),
      })
    ).json();
    assert.equal(c2.cupao, null, 'o saco esgotou: sem cupão');
    const hoje = await (await pedir('/api/balcao/hoje-parceiro', { token: tokenParceiro })).json();
    const vale = hoje.ultimos.find((x) => x.titulo === 'Sobremesa surpresa' && !x.anulado);
    assert.equal(
      (
        await pedir('/api/balcao/anular-vale', {
          method: 'POST',
          token: tokenParceiro,
          body: json({ valeId: vale.id }),
        })
      ).status,
      204,
    );
    const devolvido = await (await pedir('/api/eu', { token: tokenCliente })).json();
    assert.equal(devolvido.cupoes[0].usadoEm, null, 'anular o vale devolve o cupão');
    const m = await (await pedir('/api/bo/metricas', { token })).json();
    assert.ok(m.parcerias.cupoesSaidos >= 1);
    const promo = await (await pedir(`/api/bo/promocoes/${surpresa}`, { token })).json();
    assert.equal(promo.cupoes, 1);
    assert.equal(promo.surpresaRestantes, 0);
    assert.equal(promo.surpresa, true);
    assert.equal(
      (await pedir(`/api/bo/promocoes/${surpresa}`, { method: 'DELETE', token })).status,
      204,
    );
  },
);

let tokenOutro;
await passo(
  'a mesma caixa por outra porta cai na mesma conta; outra caixa é outra conta; não se rouba uma forma',
  async () => {
    const apple = await (
      await pedir('/api/eu/entrar/teste', {
        method: 'POST',
        body: json({ tipo: 'apple', sujeito: 'prova-apple-1', email: 'cliente.prova@gmail.com' }),
      })
    ).json();
    const mesma = await (await pedir('/api/eu', { token: apple.sessao })).json();
    assert.equal(mesma.id, euAntes.id);
    assert.equal(mesma.formas.length, 3);
    const outra = await (
      await pedir('/api/eu/entrar/teste', {
        method: 'POST',
        body: json({ tipo: 'apple', sujeito: 'prova-apple-2', email: 'outra@empresa.pt' }),
      })
    ).json();
    tokenOutro = outra.sessao;
    const outro = await (await pedir('/api/eu', { token: tokenOutro })).json();
    assert.notEqual(outro.id, euAntes.id);
    assert.equal(outro.cartao.carimbos, 0);
    const roubo = await pedir('/api/eu/formas/teste', {
      method: 'POST',
      token: tokenOutro,
      body: json({ tipo: 'google', sujeito: 'prova-google-1', email: 'cliente.prova@gmail.com' }),
    });
    assert.equal(roubo.status, 409);
    assert.equal((await roubo.json()).erro, 'noutra_conta');
    // E a Google de uma caixa de empresa (sem prova de dona) não se junta sozinha à Apple dessa caixa.
    const empresa = await (
      await pedir('/api/eu/entrar/teste', {
        method: 'POST',
        body: json({ tipo: 'google', sujeito: 'prova-google-2', email: 'outra@empresa.pt' }),
      })
    ).json();
    const terceira = await (await pedir('/api/eu', { token: empresa.sessao })).json();
    assert.notEqual(terceira.id, outro.id, 'sem prova de dona da caixa, não se junta');
  },
);

await passo('tirar uma forma: nunca a última, nem a que abriu esta sessão', async () => {
  const eu = await (await pedir('/api/eu', { token: tokenCliente })).json();
  const email = eu.formas.find((f) => f.tipo === 'email');
  const google = eu.formas.find((f) => f.tipo === 'google');
  assert.equal(
    (await pedir(`/api/eu/formas/${google.id}`, { method: 'DELETE', token: tokenCliente })).status,
    409,
  );
  const r = await pedir(`/api/eu/formas/${email.id}`, { method: 'DELETE', token: tokenCliente });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).formas.length, 2);
  const unica = await (await pedir('/api/eu', { token: tokenOutro })).json();
  const ultima = await pedir(`/api/eu/formas/${unica.formas[0].id}`, {
    method: 'DELETE',
    token: tokenOutro,
  });
  assert.equal(ultima.status, 409);
  assert.equal((await ultima.json()).erro, 'ultima_forma');
});

await passo('«perdi o telemóvel» troca o código e termina as outras sessões', async () => {
  const segunda = (
    await (
      await pedir('/api/eu/entrar/teste', {
        method: 'POST',
        body: json({ tipo: 'google', sujeito: 'prova-google-1', email: 'cliente.prova@gmail.com' }),
      })
    ).json()
  ).sessao;
  assert.equal((await pedir('/api/eu', { token: segunda })).status, 200);
  const r = await pedir('/api/eu/perdi-o-telemovel', { method: 'POST', token: tokenCliente });
  assert.equal(r.status, 200);
  const eu = await r.json();
  assert.notEqual(eu.codigo, codigoDoCliente);
  assert.equal(eu.sessoes.length, 1);
  assert.equal((await pedir('/api/eu', { token: segunda })).status, 401);
  assert.equal(
    (await pedir(`/api/balcao/ficha/${codigoDoCliente}`, { token: tokenBalcao })).status,
    404,
    'o código antigo morreu',
  );
  codigoDoCliente = eu.codigo;
  assert.equal(
    (await pedir(`/api/balcao/ficha/${codigoDoCliente}`, { token: tokenBalcao })).status,
    200,
  );
});

await passo('o backoffice vê os clientes, a ficha, o CSV e as métricas', async () => {
  const lista = await (await pedir('/api/bo/clientes', { token })).json();
  assert.ok(lista.length >= 62, `clientes: ${lista.length}`);
  const prova = lista.find((k) => k.codigo === codigoDoCliente);
  assert.equal(prova.cortes, 13, '10 + o da Wallet + 2 do saco');
  assert.equal(prova.formas.length, 2);
  const novos = await (await pedir('/api/bo/clientes?estado=novos', { token })).json();
  assert.ok(novos.some((k) => k.id === prova.id));
  const ficha = await (await pedir(`/api/bo/clientes/${prova.id}`, { token })).json();
  assert.equal(ficha.cartoes.length, 2);
  assert.equal(ficha.cartoes[1].usadoPor, 'Prova Barbeiro');
  assert.equal(ficha.historico.length, 14);
  assert.ok(ficha.historico.some((x) => x.anuladoEm));
  const csv = await pedir('/api/bo/clientes.csv', { token });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.ok((await csv.text()).includes('Prova C.'));
  const m = await (await pedir('/api/bo/metricas?lojaId=3', { token })).json();
  assert.equal(m.porDia.length, 30);
  assert.equal(m.mapaDeCalor.length, 7);
  assert.equal(m.mapaDeCalor[0].length, 24);
  assert.equal(m.coortes.length, 12);
  assert.ok(m.totais.carimbos >= 10);
  assert.equal(m.totais.recompensasUsadas >= 1, true);
  assert.ok(
    m.porPessoa.some(
      (p) => p.nome === 'Prova Barbeiro' && p.n === 13 && p.anulados === 1 && p.recompensas === 1,
    ),
  );
  assert.ok(m.clientes.total >= 62);
  assert.ok(m.clientes.distribuicao.length === 4);
  assert.ok(m.servicos.length >= 1);
  assert.equal(typeof m.contas.google, 'number');
  const tudo = await (
    await pedir('/api/bo/metricas?de=2020-01-01&ate=2020-01-31', { token })
  ).json();
  assert.equal(tudo.totais.carimbos, 0);
  assert.equal(tudo.porDia.length, 31);
});

await passo('apagar a conta deixa os carimbos sem dono, e a pessoa fora das listas', async () => {
  assert.equal((await pedir('/api/eu', { method: 'DELETE', token: tokenCliente })).status, 204);
  assert.equal((await pedir('/api/eu', { token: tokenCliente })).status, 401);
  assert.equal(
    (await pedir(`/api/balcao/ficha/${codigoDoCliente}`, { token: tokenBalcao })).status,
    404,
  );
  const lista = await (await pedir('/api/bo/clientes', { token })).json();
  assert.ok(!lista.some((k) => k.codigo === codigoDoCliente));
  const m = await (await pedir('/api/bo/metricas?lojaId=3', { token })).json();
  assert.ok(m.totais.carimbos >= 10, 'os carimbos continuam a contar');
  const apagado = await pedir('/api/eu/entrar/teste', {
    method: 'POST',
    body: json({ tipo: 'google', sujeito: 'prova-google-1', email: 'cliente.prova@gmail.com' }),
  });
  const renascido = await (await pedir('/api/eu', { token: (await apagado.json()).sessao })).json();
  assert.equal(renascido.cortes, 0, 'entrar outra vez é uma conta nova, vazia');
});

await passo('a porta da revisão das lojas entra com o código de demonstração', async () => {
  // Sem código, ou com o código errado, não existe nada.
  assert.equal((await pedir('/api/revisao')).status, 404);
  const errado = await pedir('/api/eu/entrar/demonstracao', {
    method: 'POST',
    body: json({ codigo: 'nao-e-este' }),
  });
  assert.equal(errado.status, 401);
  // O .dev.vars tem REVISAO_CODIGO=DEMOLOCAL2026, REVISAO_CLIENTE=JMP7ZT8A e REVISAO_PESSOA=905.
  const pagina = await pedir('/api/revisao?codigo=DEMOLOCAL2026');
  assert.equal(pagina.status, 200);
  const html = await pagina.text();
  assert.ok(
    html.includes('<svg') && html.includes('JMP7') && html.includes('ZT8A'),
    'a página traz o QR e o código',
  );
  const cliente = await (
    await pedir('/api/eu/entrar/demonstracao', {
      method: 'POST',
      body: json({ codigo: 'DEMOLOCAL2026' }),
    })
  ).json();
  const eu = await (await pedir('/api/eu', { token: cliente.sessao })).json();
  assert.equal(eu.codigo, 'JMP7ZT8A');
  const balcao = await (
    await pedir('/api/balcao/entrar/demonstracao', {
      method: 'POST',
      body: json({ codigo: 'DEMOLOCAL2026' }),
    })
  ).json();
  const pessoa = await (await pedir('/api/balcao/eu', { token: balcao.sessao })).json();
  assert.equal(pessoa.pessoa.id, 905);
});

await passo(
  'tirar alguém da equipa termina a sessão dele; apagar os exemplos limpa tudo',
  async () => {
    assert.equal(
      (await pedir(`/api/bo/equipa/${barbeiroId}`, { method: 'DELETE', token })).status,
      200,
    );
    assert.equal((await pedir('/api/balcao/eu', { token: tokenBalcao })).status, 401);
    const r = await (await pedir('/api/bo/clientes/exemplos', { method: 'DELETE', token })).json();
    // Ficam o cliente (JMP7ZT8A) e a pessoa (905) da porta da revisão das lojas.
    assert.equal(r.apagados, 59);
    const equipa = await (await pedir('/api/bo/equipa', { token })).json();
    assert.deepEqual(
      equipa.filter((p) => p.nome.endsWith('(exemplo)')).map((p) => p.id),
      [905],
    );
    assert.equal((await pedir('/api/revisao?codigo=DEMOLOCAL2026')).status, 200);
  },
);

await passo('sair termina a sessão', async () => {
  assert.equal((await pedir('/api/bo/sair', { method: 'POST', token })).status, 204);
  assert.equal((await pedir('/api/bo/eu', { token })).status, 401);
});

console.log(`\n${passos} passos certos${process.exitCode ? ', com falhas acima' : ''}.`);
