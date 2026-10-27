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
  ]
    .map((t) => `DELETE FROM ${t};`)
    .join(' '),
);
naBaseLocal('--file', '../../base/exemplos.sql');
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
  assert.equal(g.parceiro.promocoesNaApp, 0);
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

await passo('sair termina a sessão', async () => {
  assert.equal((await pedir('/api/bo/sair', { method: 'POST', token })).status, 204);
  assert.equal((await pedir('/api/bo/eu', { token })).status, 401);
});

console.log(`\n${passos} passos certos${process.exitCode ? ', com falhas acima' : ''}.`);
