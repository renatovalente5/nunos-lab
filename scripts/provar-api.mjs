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
      aniversario: '',
    }),
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).objectivo, 8);
  const mau = await pedir('/api/bo/programa', {
    method: 'PUT',
    token,
    body: json({ objectivo: 0, recompensa: '', porDia: 1, aniversario: '' }),
  });
  assert.equal(mau.status, 400);
  await pedir('/api/bo/programa', {
    method: 'PUT',
    token,
    body: json({
      objectivo: 10,
      recompensa: 'Corte grátis',
      porDia: 1,
      aniversario: '',
    }),
  });
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
      carimbo: { chave: 'prova-c-01', lojaId: 3 },
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
  'o 10.º carimbo completa o cartão e é ele a oferta: nada fica por usar, e o cartão segue cheio',
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
    assert.equal(ficha.cartao.numero, 1, 'o cartão cheio fica cheio até ao carimbo seguinte');
    assert.equal(ficha.cartao.carimbos, ficha.cartao.objectivo);
    assert.equal(ficha.recompensas.length, 0, 'o 10.º corte foi a oferta: nada fica por usar');
    assert.equal(ficha.cliente.cortes, 10);
    assert.equal(ficha.hoje.entregue, null, 'entregue pelo próprio carimbo, não «à parte»');
    const usar = await pedir('/api/balcao/usar-recompensa', {
      method: 'POST',
      token: tokenBalcao,
      body: json({ codigo: codigoDoCliente, cartaoId: ficha.cartao.id, lojaId: 3 }),
    });
    assert.equal(usar.status, 409, 'não há nada para entregar à parte');
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
  assert.equal(lista[0].carimbos, 10, 'o cartão cheio ainda à vista na procura');
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
  assert.equal(euAntes.cartao.numero, 1, 'o cartão cheio ainda à vista');
  assert.equal(euAntes.cartao.carimbos, 10);
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
    assert.equal(passe.storeCard.headerFields[0].value, '10 de 10');
    assert.equal(
      passe.storeCard.headerFields[0].changeMessage,
      'Cartão completo (%@): este corte foi grátis',
    );
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
  // O passe que está no telemóvel perdido: registado na Apple antes de o perder.
  const ligacao = (
    await (await pedir('/api/eu/wallet/apple', { method: 'POST', token: tokenCliente })).json()
  ).url;
  const passeAntigo = JSON.parse(
    new TextDecoder().decode(
      doZip(new Uint8Array(await (await fetch(ligacao)).arrayBuffer()), 'pass.json'),
    ),
  );
  const registo = await fetch(
    `${API}/api/wallet/apple/v1/devices/TELEMOVELPERDIDO01/registrations/${passeAntigo.passTypeIdentifier}/${passeAntigo.serialNumber}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApplePass ${passeAntigo.authenticationToken}`,
      },
      body: json({ pushToken: 'abcdef0123456789abcdef0123456789' }),
    },
  );
  assert.equal(registo.status, 201);
  const r = await pedir('/api/eu/perdi-o-telemovel', { method: 'POST', token: tokenCliente });
  assert.equal(r.status, 200);
  const eu = await r.json();
  assert.notEqual(eu.codigo, codigoDoCliente);
  // O telemóvel perdido deixa de conseguir o passe (a série morreu) e sai dos registos.
  const perdido = await fetch(
    `${API}/api/wallet/apple/v1/passes/${passeAntigo.passTypeIdentifier}/${passeAntigo.serialNumber}`,
    { headers: { Authorization: `ApplePass ${passeAntigo.authenticationToken}` } },
  );
  assert.equal(perdido.status, 404, 'o telemóvel perdido não recebe o passe com o código novo');
  assert.equal(
    (
      await fetch(
        `${API}/api/wallet/apple/v1/devices/TELEMOVELPERDIDO01/registrations/${passeAntigo.passTypeIdentifier}?passesUpdatedSince=0`,
      )
    ).status,
    204,
    'deixa de estar registado',
  );
  const ligacaoNova = (
    await (await pedir('/api/eu/wallet/apple', { method: 'POST', token: tokenCliente })).json()
  ).url;
  const passeNovo = JSON.parse(
    new TextDecoder().decode(
      doZip(new Uint8Array(await (await fetch(ligacaoNova)).arrayBuffer()), 'pass.json'),
    ),
  );
  assert.notEqual(
    passeNovo.serialNumber,
    passeAntigo.serialNumber,
    'o telemóvel novo leva outra série',
  );
  assert.equal(passeNovo.barcode.altText.replace(/\s/g, ''), eu.codigo);
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
  // A demonstração do cliente não roda o código, não apaga a conta, não junta formas.
  for (const [caminho, method] of [
    ['/api/eu/perdi-o-telemovel', 'POST'],
    ['/api/eu', 'DELETE'],
    ['/api/eu/sair-das-outras', 'POST'],
  ]) {
    const r = await pedir(caminho, { method, token: cliente.sessao });
    assert.equal(r.status, 403, `${method} ${caminho}`);
    assert.equal((await r.json()).erro, 'demonstracao');
  }
  assert.equal((await pedir('/api/revisao?codigo=DEMOLOCAL2026')).status, 200, 'a porta continua');
  // A demonstração da Balcão só vê clientes de exemplo: nem a ficha, nem a procura, nem o dia.
  const real = await (
    await pedir('/api/eu/entrar/teste', {
      method: 'POST',
      body: json({ tipo: 'google', sujeito: 'revisao-real', email: 'revisao.real@gmail.com' }),
    })
  ).json();
  const codigoReal = (await (await pedir('/api/eu', { token: real.sessao })).json()).codigo;
  assert.equal(
    (await pedir(`/api/balcao/ficha/${codigoReal}`, { token: balcao.sessao })).status,
    404,
  );
  assert.equal(
    (await pedir(`/api/balcao/ficha/JMP7ZT8A`, { token: balcao.sessao })).status,
    200,
    'o cliente de demonstração abre',
  );
  const procura = await (
    await pedir('/api/balcao/clientes?q=Pessoa%20Real', { token: balcao.sessao })
  ).json();
  assert.equal(procura.length, 0);
  const nascido = await (
    await pedir('/api/balcao/clientes', {
      method: 'POST',
      token: balcao.sessao,
      body: json({ nome: 'Nascido Na Demo' }),
    })
  ).json();
  const lista = await (await pedir('/api/bo/clientes', { token })).json();
  assert.equal(
    lista.find((k) => k.codigo === nascido.ficha.cliente.codigo)?.exemplo,
    true,
    'um cliente criado pela demonstração é um exemplo',
  );
  assert.equal((await pedir('/api/balcao/resumo', { token: balcao.sessao })).status, 200);
  assert.equal(
    (await pedir('/api/balcao/sair', { method: 'POST', token: balcao.sessao })).status,
    204,
  );
  assert.equal((await pedir('/api/balcao/eu', { token: balcao.sessao })).status, 401);
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
    // Ficam o cliente (JMP7ZT8A) e a pessoa (905) da porta da revisão das lojas; os 59 das
    // sementes mais os que a demonstração criou (nascem como exemplos).
    assert.ok(r.apagados >= 59, `apagados: ${r.apagados}`);
    const equipa = await (await pedir('/api/bo/equipa', { token })).json();
    assert.deepEqual(
      equipa.filter((p) => p.nome.endsWith('(exemplo)')).map((p) => p.id),
      [905],
    );
    assert.equal((await pedir('/api/revisao?codigo=DEMOLOCAL2026')).status, 200);
  },
);

// ——— As identidades, a fundo: a mesma pessoa por várias portas, cliente e equipa ———
const entrarTeste = (tipo, sujeito, email, extra = {}) =>
  pedir('/api/eu/entrar/teste', { method: 'POST', body: json({ tipo, sujeito, email, ...extra }) });
const euDe = async (sessao) => {
  const r = await pedir('/api/eu', { token: sessao });
  return { status: r.status, eu: r.status === 200 ? await r.json() : null };
};
const entrarEquipa = (email) =>
  pedir('/api/balcao/entrar/teste', { method: 'POST', body: json({ email }) });
const chaveNova = () => Math.random().toString(36).slice(2, 14).padEnd(12, 'x');
const lojaDaProva = (await (await pedir('/api/bo/barbearia', { token })).json()).lojas[0].id;

await passo('a mesma pessoa pela Google e pela Apple (o mesmo Gmail) é uma conta só', async () => {
  const g = await (await entrarTeste('google', 'id-g1', 'id.um@gmail.com', { nome: 'Um' })).json();
  const g2 = await (await entrarTeste('google', 'id-g1', 'id.um@gmail.com')).json();
  const a = await (
    await entrarTeste('apple', 'id-a1', 'id.um@gmail.com', { emailVerificado: true })
  ).json();
  assert.equal(g.nova, true);
  assert.equal(g2.nova, false);
  assert.equal(a.nova, false, 'a Apple com o mesmo Gmail verificado junta-se');
  const [eg, eg2, ea] = await Promise.all([euDe(g.sessao), euDe(g2.sessao), euDe(a.sessao)]);
  assert.equal(eg.status, 200, 'duas sessões vivas ao mesmo tempo');
  assert.equal(eg2.status, 200);
  assert.equal(ea.eu.id, eg.eu.id);
  assert.deepEqual(ea.eu.formas.map((f) => f.tipo).sort(), ['apple', 'google']);
  // Um email de empresa não é uma caixa que fique sempre com a mesma pessoa: Google e Apple dão duas contas.
  const ge = await (await entrarTeste('google', 'id-g5', 'id.cinco@empresa.pt')).json();
  const ae = await (
    await entrarTeste('apple', 'id-a5', 'id.cinco@empresa.pt', { emailVerificado: true })
  ).json();
  assert.equal(ae.nova, true);
  assert.notEqual((await euDe(ge.sessao)).eu.id, (await euDe(ae.sessao)).eu.id);
});

await passo(
  'a Apple com o email escondido é outra conta; só se junta depois de apagar a outra',
  async () => {
    const relay = await (
      await entrarTeste('apple', 'id-ar', 'xyz@privaterelay.appleid.com', { emailVerificado: true })
    ).json();
    const g = await (await entrarTeste('google', 'id-g2', 'id.dois@gmail.com')).json();
    assert.equal(relay.nova, true);
    assert.equal(g.nova, true);
    const roubo = await pedir('/api/eu/formas/teste', {
      method: 'POST',
      token: g.sessao,
      body: json({ tipo: 'apple', sujeito: 'id-ar', email: 'xyz@privaterelay.appleid.com' }),
    });
    assert.equal(roubo.status, 409);
    assert.equal((await roubo.json()).erro, 'noutra_conta');
    assert.equal((await pedir('/api/eu', { method: 'DELETE', token: relay.sessao })).status, 204);
    const juntou = await pedir('/api/eu/formas/teste', {
      method: 'POST',
      token: g.sessao,
      body: json({ tipo: 'apple', sujeito: 'id-ar', email: 'xyz@privaterelay.appleid.com' }),
    });
    assert.equal(juntou.status, 200);
    const outraVez = await (
      await entrarTeste('apple', 'id-ar', 'xyz@privaterelay.appleid.com')
    ).json();
    assert.equal((await euDe(outraVez.sessao)).eu.id, (await euDe(g.sessao)).eu.id);
  },
);

let sessaoDonoProva;
await passo(
  'o email escrito ao balcão (até com maiúsculas) fica com quem o prova pela Google',
  async () => {
    // Um dono a sério: a pessoa de demonstração só vê clientes de exemplo.
    sessaoDonoProva = tokenDono;
    const novo = await pedir('/api/balcao/clientes', {
      method: 'POST',
      token: sessaoDonoProva,
      body: json({
        nome: 'Ao Balcão',
        email: '  Ao.Balcao@Gmail.com ',
        carimbo: { chave: chaveNova(), lojaId: lojaDaProva },
      }),
    });
    assert.equal(novo.status, 200);
    const codigo = (await novo.json()).ficha.cliente.codigo;
    const repetido = await pedir('/api/balcao/clientes', {
      method: 'POST',
      token: sessaoDonoProva,
      body: json({ nome: 'Outro', email: 'ao.balcao@gmail.com' }),
    });
    assert.equal(repetido.status, 409, 'o mesmo email não abre dois cartões');
    const g = await (
      await entrarTeste('google', 'id-g3', 'ao.balcao@gmail.com', { nome: 'Ao Balcão' })
    ).json();
    assert.equal(g.nova, false);
    const { eu } = await euDe(g.sessao);
    assert.equal(eu.codigo, codigo);
    assert.equal(eu.cartao.carimbos, 1, 'o carimbo dado ao balcão vem com o cartão');
    // Dois toques ao mesmo tempo na primeira entrada: uma conta só, sem órfãs.
    const antes = daBaseLocal('SELECT count(*) AS n FROM clientes')[0].n;
    const [c1, c2] = await Promise.all([
      entrarTeste('google', 'id-gc', 'id.conc@gmail.com'),
      entrarTeste('google', 'id-gc', 'id.conc@gmail.com'),
    ]);
    assert.equal(c1.status, 200);
    assert.equal(c2.status, 200);
    const [e1, e2] = await Promise.all([
      euDe((await c1.json()).sessao),
      euDe((await c2.json()).sessao),
    ]);
    assert.equal(e1.eu.id, e2.eu.id);
    assert.equal(daBaseLocal('SELECT count(*) AS n FROM clientes')[0].n, antes + 1);
  },
);

await passo(
  'a mesma pessoa é cliente e equipa; tirar da equipa fecha só a sessão da for partners',
  async () => {
    const criar = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Barbeiro Prova',
        email: '  Barbeiro.Prova@Gmail.com ',
        papel: 'barbeiro',
        lojaId: lojaDaProva,
        parceiroId: null,
      }),
    });
    assert.equal(criar.status, 201);
    const pessoa = (await criar.json()).find((p) => p.nome === 'Barbeiro Prova');
    assert.equal(pessoa.email, 'barbeiro.prova@gmail.com', 'o email guarda-se normalizado');
    const repetido = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Repetido',
        email: 'barbeiro.prova@gmail.com',
        papel: 'barbeiro',
        lojaId: lojaDaProva,
        parceiroId: null,
      }),
    });
    assert.ok([400, 409].includes(repetido.status), `email repetido na equipa: ${repetido.status}`);
    const b = await (await entrarEquipa('BARBEIRO.PROVA@GMAIL.COM')).json();
    assert.ok(b.sessao, 'entra na for partners com o Google (o email em maiúsculas também)');
    const escondido = await entrarEquipa(null);
    assert.equal(escondido.status, 403, 'a Apple sem email partilhado não entra');
    assert.equal(
      (await escondido.json()).erro,
      'email_escondido',
      'e a app diz-lhe para partilhar o email',
    );
    assert.equal((await entrarEquipa('ninguem@gmail.com')).status, 403);
    const cliente = await (
      await entrarTeste('google', 'id-gb', 'barbeiro.prova@gmail.com', { nome: 'Barbeiro Prova' })
    ).json();
    const { eu } = await euDe(cliente.sessao);
    assert.ok(eu.cartao, 'como cliente tem o cartão dele, à parte');
    assert.equal((await pedir('/api/balcao/hoje', { token: b.sessao })).status, 200);
    // Desactivar fecha a sessão e a porta; reactivar abre; tirar fecha de vez — e a conta de cliente fica.
    assert.equal(
      (
        await pedir(`/api/bo/equipa/${pessoa.id}`, {
          method: 'PATCH',
          token,
          body: json({ activo: false }),
        })
      ).status,
      200,
    );
    assert.equal((await pedir('/api/balcao/hoje', { token: b.sessao })).status, 401);
    assert.equal((await entrarEquipa('barbeiro.prova@gmail.com')).status, 403);
    assert.equal(
      (
        await pedir(`/api/bo/equipa/${pessoa.id}`, {
          method: 'PATCH',
          token,
          body: json({ activo: true }),
        })
      ).status,
      200,
    );
    const b2 = await (await entrarEquipa('barbeiro.prova@gmail.com')).json();
    assert.ok(b2.sessao);
    assert.equal(
      (await pedir(`/api/bo/equipa/${pessoa.id}`, { method: 'DELETE', token })).status,
      200,
    );
    assert.equal((await pedir('/api/balcao/hoje', { token: b2.sessao })).status, 401);
    assert.equal((await entrarEquipa('barbeiro.prova@gmail.com')).status, 403);
    assert.equal((await euDe(cliente.sessao)).status, 200);
  },
);

await passo(
  'o parceiro não carimba, não vê a ficha nem o resumo: só a ficha de parceiro',
  async () => {
    const parceiroId = daBaseLocal('SELECT id FROM parceiros ORDER BY id LIMIT 1')[0]?.id;
    assert.ok(parceiroId, 'há um parceiro na base');
    const criar = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Parceiro Prova',
        email: 'parceiro.prova@gmail.com',
        papel: 'parceiro',
        lojaId: null,
        parceiroId,
      }),
    });
    assert.equal(criar.status, 201);
    const pessoa = (await criar.json()).find((p) => p.nome === 'Parceiro Prova');
    const p = await (await entrarEquipa('parceiro.prova@gmail.com')).json();
    const alvo = await (await entrarTeste('google', 'id-g1', 'id.um@gmail.com')).json();
    const codigo = (await euDe(alvo.sessao)).eu.codigo;
    const carimbo = await pedir('/api/balcao/carimbar', {
      method: 'POST',
      token: p.sessao,
      body: json({ codigo, chave: chaveNova(), lojaId: lojaDaProva }),
    });
    assert.equal(carimbo.status, 403);
    assert.equal((await carimbo.json()).erro, 'so_barbearia');
    assert.equal((await pedir(`/api/balcao/ficha/${codigo}`, { token: p.sessao })).status, 403);
    assert.equal((await pedir('/api/balcao/resumo', { token: p.sessao })).status, 403);
    const ficha = await pedir(`/api/balcao/ficha-parceiro/${codigo}`, { token: p.sessao });
    assert.equal(ficha.status, 200);
    assert.ok(!(await ficha.text()).includes('id.um@gmail.com'), 'sem o email do cliente');
    assert.equal(
      (await pedir(`/api/bo/equipa/${pessoa.id}`, { method: 'DELETE', token })).status,
      200,
    );
  },
);

await passo(
  'o cartão cheio: o 10.º anula-se nos 10 min; o seguinte nasce no próximo carimbo; um prémio antigo entrega-se à parte',
  async () => {
    const g = await (
      await entrarTeste('google', 'id-cheio', 'id.cheio@gmail.com', { nome: 'Cheio' })
    ).json();
    const { eu } = await euDe(g.sessao);
    const carimba = (confirmar) =>
      pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: sessaoDonoProva,
        body: json({
          codigo: eu.codigo,
          chave: chaveNova(),
          lojaId: lojaDaProva,
          ...(confirmar ? { confirmar: true } : {}),
        }),
      });
    let r;
    for (let i = 0; i < eu.cartao.objectivo; i++) r = await (await carimba(true)).json();
    assert.equal(r.completo, true);
    assert.equal(r.cartao.carimbos, eu.cartao.objectivo);
    let e = (await euDe(g.sessao)).eu;
    assert.equal(e.cartao.numero, 1, 'o cliente vê o cartão cheio');
    assert.equal(e.cartao.carimbos, e.cartao.objectivo);
    assert.equal(e.recompensas.length, 0, 'o 10.º corte foi a oferta');
    // O 10.º anula-se nos 10 minutos (a entrega vai com ele): volta a 9, e completa-se outra vez.
    const anular = await pedir('/api/balcao/anular', {
      method: 'POST',
      token: sessaoDonoProva,
      body: json({ carimboId: r.carimboId }),
    });
    assert.equal(anular.status, 204);
    e = (await euDe(g.sessao)).eu;
    assert.equal(e.cartao.carimbos, e.cartao.objectivo - 1);
    r = await (await carimba(true)).json();
    assert.equal(r.completo, true);
    // O seguinte nasce no próximo carimbo.
    r = await (await carimba(true)).json();
    assert.equal(r.cartao.numero, 2);
    assert.equal(r.cartao.carimbos, 1);
    // Um cartão de antes da regra (completo, por entregar): «Entregar» ainda serve.
    daBaseLocal(
      // (completo há um minuto: uma entrega à parte nunca é no mesmo segundo do 10.º carimbo)
      `UPDATE cartoes SET usado_em = NULL, usado_loja_id = NULL, usado_por = NULL, completo_em = completo_em - 60 WHERE cliente_id = ${e.id} AND numero = 1`,
    );
    e = (await euDe(g.sessao)).eu;
    assert.equal(e.recompensas.length, 1);
    const usar = await pedir('/api/balcao/usar-recompensa', {
      method: 'POST',
      token: sessaoDonoProva,
      body: json({ codigo: eu.codigo, cartaoId: e.recompensas[0].cartaoId, lojaId: lojaDaProva }),
    });
    assert.equal(usar.status, 200);
    const f = await usar.json();
    assert.equal(f.cartao.numero, 2, 'o cartão 2 já existia: não nasce outro');
    assert.equal(f.recompensas.length, 0);
    assert.ok(f.hoje.entregue, 'a ficha diz que o prémio foi entregue hoje');
    // O corte grátis não leva carimbo: sem confirmar, 409 «entregue_hoje»; com confirmar, entra.
    const semConfirmar = await carimba(false);
    assert.equal(semConfirmar.status, 409);
    assert.equal((await semConfirmar.json()).erro, 'entregue_hoje');
    assert.equal((await carimba(true)).status, 200);
  },
);

await passo(
  'coisas incomuns: fórmulas no CSV, a mesma chave noutro cliente, procurar sem acentos',
  async () => {
    const novo = async (nome) =>
      (
        await (
          await pedir('/api/balcao/clientes', {
            method: 'POST',
            token: sessaoDonoProva,
            body: json({ nome }),
          })
        ).json()
      ).ficha;
    const formula = await novo('=HYPERLINK("http://x")');
    const csv = await (await pedir('/api/bo/clientes.csv', { token })).text();
    const linha = csv.split(/\r?\n/).find((l) => l.includes('HYPERLINK'));
    assert.ok(linha && linha.startsWith(`"'=`), `a fórmula desarmada: ${linha}`);
    const x = await novo('Chave X');
    const y = await novo('Chave Y');
    const chave = chaveNova();
    const a = await pedir('/api/balcao/carimbar', {
      method: 'POST',
      token: sessaoDonoProva,
      body: json({ codigo: x.cliente.codigo, chave, lojaId: lojaDaProva }),
    });
    assert.equal(a.status, 200);
    const b = await pedir('/api/balcao/carimbar', {
      method: 'POST',
      token: sessaoDonoProva,
      body: json({ codigo: y.cliente.codigo, chave, lojaId: lojaDaProva }),
    });
    assert.equal(b.status, 409, 'a mesma chave noutro cliente não devolve o carimbo do primeiro');
    await novo('João Ñandú');
    const balcao = await (
      await pedir('/api/balcao/clientes?q=joao', { token: sessaoDonoProva })
    ).json();
    assert.ok(
      balcao.some((k) => k.nome === 'João Ñandú'),
      'o balcão encontra «João» com «joao»',
    );
    const bo = await (await pedir('/api/bo/clientes?q=nandu', { token })).json();
    assert.ok(
      bo.some((k) => k.nome === 'João Ñandú'),
      'o backoffice encontra «Ñandú» com «nandu»',
    );
    assert.ok(formula.cliente.codigo);
  },
);

// ——— O pente fino de 30 out: o prémio não se dá duas vezes, cupões, idempotência, a fila ———
const carimbarVezes = async (codigo, n) => {
  let ultimo;
  for (let i = 0; i < n; i++)
    ultimo = await (
      await pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: tokenDono,
        body: json({ codigo, chave: chaveNova(), lojaId: lojaDaProva, confirmar: true }),
      })
    ).json();
  return ultimo;
};

await passo(
  'anular um carimbo antigo de um cartão entregue não dá o corte grátis outra vez',
  async () => {
    const s = (
      await (await entrarTeste('google', 'pf-b2', 'pf.b2@gmail.com', { nome: 'B Dois' })).json()
    ).sessao;
    const codigo = (await euDe(s)).eu.codigo;
    await carimbarVezes(codigo, 2);
    const terceiro = await carimbarVezes(codigo, 1);
    const decimo = await carimbarVezes(codigo, 7);
    assert.equal(decimo.completo, true, 'o 10.º completa e entrega');
    const an = await pedir('/api/balcao/anular', {
      method: 'POST',
      token: tokenDono,
      body: json({ carimboId: terceiro.carimboId }),
    });
    assert.equal(an.status, 409);
    assert.equal((await an.json()).erro, 'recompensa_usada');
    const seguinte = await carimbarVezes(codigo, 1);
    assert.equal(seguinte.completo, false, 'o carimbo seguinte abre o cartão 2');
    assert.equal(seguinte.cartao.carimbos, 1);
    // A chave do 3.º reenviada (a fila) não diz «completo».
    const outra = await (
      await pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: tokenDono,
        body: json({ codigo, chave: chaveNova(), lojaId: lojaDaProva, confirmar: true, quando: 1 }),
      })
    ).json();
    assert.equal(outra.completo, false);
  },
);

await passo('um carimbo que vem da fila conta no dia em que foi dado', async () => {
  const s = (
    await (await entrarTeste('google', 'pf-p5', 'pf.p5@gmail.com', { nome: 'P Cinco' })).json()
  ).sessao;
  const codigo = (await euDe(s)).eu.codigo;
  const ontem = Math.floor(Date.now() / 1000) - 90_000;
  const r = await pedir('/api/balcao/carimbar', {
    method: 'POST',
    token: tokenDono,
    body: json({ codigo, chave: chaveNova(), lojaId: lojaDaProva, quando: ontem }),
  });
  assert.equal(r.status, 200);
  const hoje = await pedir('/api/balcao/carimbar', {
    method: 'POST',
    token: tokenDono,
    body: json({ codigo, chave: chaveNova(), lojaId: lojaDaProva }),
  });
  assert.equal(hoje.status, 200, 'o de ontem não gasta o limite de hoje');
  const visitas = (await euDe(s)).eu.visitas;
  assert.equal(visitas.length, 2);
  assert.ok(
    visitas.some((v) => v.quando === ontem),
    'a visita fica com o instante do toque',
  );
});

await passo(
  '«cliente novo» duas vezes com a mesma chave é um cliente só; a casa confere-se antes',
  async () => {
    const chave = chaveNova();
    const corpo = { nome: 'Duplo Toque', carimbo: { chave, lojaId: lojaDaProva } };
    const [a, b] = await Promise.all([
      pedir('/api/balcao/clientes', { method: 'POST', token: tokenDono, body: json(corpo) }),
      pedir('/api/balcao/clientes', { method: 'POST', token: tokenDono, body: json(corpo) }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal((await a.json()).ficha.cliente.id, (await b.json()).ficha.cliente.id);
    const lista = await (
      await pedir('/api/balcao/clientes?q=Duplo%20Toque', { token: tokenDono })
    ).json();
    assert.equal(lista.length, 1);
    const casaMa = await pedir('/api/balcao/clientes', {
      method: 'POST',
      token: tokenDono,
      body: json({ nome: 'Casa Errada', carimbo: { chave: chaveNova(), lojaId: 999999 } }),
    });
    assert.equal(casaMa.status, 400);
    const nada = await (
      await pedir('/api/balcao/clientes?q=Casa%20Errada', { token: tokenDono })
    ).json();
    assert.equal(nada.length, 0, 'o cliente não nasceu');
    // Procurar com um texto enorme não rebenta.
    const longa = await pedir(`/api/balcao/clientes?q=${'a'.repeat(5000)}`, { token: tokenDono });
    assert.equal(longa.status, 200);
    assert.equal((await pedir(`/api/bo/clientes?q=${'a'.repeat(5000)}`, { token })).status, 200);
    assert.equal(
      (await (await pedir('/api/balcao/clientes?q=--', { token: tokenDono })).json()).length,
      0,
      'dois caracteres que a normalização apaga não listam toda a gente',
    );
  },
);

await passo('um cupão valida-se só na promoção dele, e só uma vez', async () => {
  const parceiros = await (await pedir('/api/bo/parceiros', { token })).json();
  const B = parceiros[parceiros.length - 1].id;
  const A = parceiros[0].id;
  const surp = await (
    await pedir('/api/bo/promocoes', {
      method: 'POST',
      token,
      body: json({
        parceiroId: B,
        destaque: 'Surpresa',
        titulo: 'Café surpresa',
        detalhe: '',
        inicio: null,
        fim: null,
        emDestaque: false,
        activa: true,
        surpresa: true,
        surpresaDias: 30,
        surpresaPeso: 100,
        surpresaRestantes: 1,
      }),
    })
  ).json();
  const outras = (await (await pedir('/api/bo/promocoes', { token })).json()).filter(
    (p) => p.surpresa && p.id !== surp.id,
  );
  for (const p of outras)
    await pedir(`/api/bo/promocoes/${p.id}`, {
      method: 'PATCH',
      token,
      body: json({ surpresa: false }),
    });
  const s = (
    await (await entrarTeste('google', 'pf-s7', 'pf.s7@gmail.com', { nome: 'S Sete' })).json()
  ).sessao;
  const codigo = (await euDe(s)).eu.codigo;
  const c1 = await carimbarVezes(codigo, 1);
  assert.ok(c1.cupao, 'sai o cupão da única promoção no saco');
  // O saco esgotou-se (restantes 1): o cliente seguinte não leva cupão, e nada rebenta.
  const s2 = (
    await (await entrarTeste('google', 'pf-s7b', 'pf.s7b@gmail.com', { nome: 'S Oito' })).json()
  ).sessao;
  const c2 = await carimbarVezes((await euDe(s2)).eu.codigo, 1);
  assert.equal(c2.cupao, null);
  const equipa = await (
    await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Pessoa do B',
        email: null,
        papel: 'parceiro',
        lojaId: null,
        parceiroId: B,
      }),
    })
  ).json();
  const pessoaB = equipa.find((p) => p.nome === 'Pessoa do B');
  const { codigo: acesso } = await (
    await pedir(`/api/bo/equipa/${pessoaB.id}/acesso`, { method: 'POST', token })
  ).json();
  const tokenB = (
    await (await pedir('/api/balcao/entrar', { method: 'POST', body: json({ acesso }) })).json()
  ).sessao;
  const ficha = await (
    await pedir(`/api/balcao/ficha-parceiro/${codigo}`, { token: tokenB })
  ).json();
  const cupao = ficha.vantagens.find((v) => v.cupaoId);
  assert.ok(cupao);
  const promoA = (await (await pedir('/api/bo/promocoes', { token })).json()).find(
    (p) => p.parceiroId === A && !p.surpresa,
  );
  const errada = await pedir('/api/balcao/validar', {
    method: 'POST',
    token: tokenB,
    body: json({ codigo, promocaoId: promoA.id, chave: chaveNova(), cupaoId: cupao.cupaoId }),
  });
  assert.equal(errada.status, 400, 'o cupão não se valida noutra promoção');
  const [v1, v2] = await Promise.all([
    pedir('/api/balcao/validar', {
      method: 'POST',
      token: tokenB,
      body: json({ codigo, promocaoId: surp.id, chave: chaveNova(), cupaoId: cupao.cupaoId }),
    }),
    pedir('/api/balcao/validar', {
      method: 'POST',
      token: tokenB,
      body: json({ codigo, promocaoId: surp.id, chave: chaveNova(), cupaoId: cupao.cupaoId }),
    }),
  ]);
  assert.deepEqual(
    [v1.status, v2.status].sort(),
    [200, 409],
    'o mesmo cupão em dois pedidos dá um vale',
  );
  const hoje = await (await pedir('/api/balcao/hoje-parceiro', { token: tokenB })).json();
  assert.equal(hoje.ultimos.filter((v) => v.codigo === codigo).length, 1);
  // Apagar o parceiro tira a pessoa da equipa (fica no histórico) e termina-lhe a sessão.
  assert.equal((await pedir(`/api/bo/parceiros/${B}`, { method: 'DELETE', token })).status, 204);
  assert.equal((await pedir('/api/balcao/eu', { token: tokenB })).status, 401);
  for (const p of outras)
    await pedir(`/api/bo/promocoes/${p.id}`, {
      method: 'PATCH',
      token,
      body: json({ surpresa: true }),
    });
});

await passo('sair termina a sessão', async () => {
  assert.equal((await pedir('/api/bo/sair', { method: 'POST', token })).status, 204);
  assert.equal((await pedir('/api/bo/eu', { token })).status, 401);
});

console.log(`\n${passos} passos certos${process.exitCode ? ', com falhas acima' : ''}.`);
