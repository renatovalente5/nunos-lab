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
    'movimentos_de_saldo',
    'convites',
    'marcas_de_contas_apagadas',
    'identidades_da_equipa',
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
let enderecos = 0;
/** Um endereço de ensaio por pedido de convite: a trava (30 por minuto) é por endereço. */
const ipNovo = () => {
  enderecos += 1;
  return `10.9.${(enderecos >> 8) & 255}.${enderecos & 255}`;
};
/** Dá acesso ao backoffice na base local, com o email da conta Google (scripts/acesso.mjs). */
function darAcesso(nome, email) {
  execFileSync('node', ['scripts/acesso.mjs', '--nome', nome, '--email', email], {
    encoding: 'utf8',
  });
}

/**
 * Entra na for partners pela porta de teste do wrangler dev, com o email que o backoffice registou
 * (as ligações de acesso saíram a 8 nov: na app entra-se com a Apple ou o Google desse email).
 */
async function entrarNaBalcao(email) {
  const r = await pedir('/api/balcao/entrar/teste', { method: 'POST', body: json({ email }) });
  assert.equal(r.status, 200, `entrar na for partners como ${email}`);
  return (await r.json()).sessao;
}

let dados;
await passo('a app recebe os parceiros com promoções na app', async () => {
  const r = await pedir('/api/app');
  assert.equal(r.status, 200);
  dados = await r.json();
  assert.ok(dados.parceiros.length >= 8, `parceiros: ${dados.parceiros.length}`);
  const otica = dados.parceiros.find((p) => p.nome === 'Ótica Lume');
  assert.equal(otica.promocoes.length, 1, 'a agendada não aparece');
  // A base ainda tem a Ótica em Nogueira (os exemplos de antes); a app recebe null, que as apps
  // instaladas antes de 8 nov lêem como «aparece em todas as barbearias».
  assert.ok(
    dados.parceiros.every((p) => p.lojaId === null),
    'nenhum parceiro é só de uma barbearia',
  );
  const gelataria = dados.parceiros.find((p) => p.nome === 'Gelataria Neve Doce');
  assert.equal(gelataria.promocoes.length, 1, 'a pausada não aparece');
  // O horário por dias (9 nov 2026): o texto escreve-se dele.
  const motor = dados.parceiros.find((p) => p.nome === 'Azeméis Motor');
  assert.equal(motor.horario, 'Seg a sex · 9h–19h\nSáb · 9h–13h');
  assert.equal(motor.horarioSemana.length, 2);
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
await passo(
  'o backoffice abre a quem tem acesso pelo email; as ligações já não existem',
  async () => {
    darAcesso('Prova', 'prova.backoffice@exemplo.pt');
    const r = await pedir('/api/bo/entrar/teste', {
      method: 'POST',
      body: json({ email: 'Prova.Backoffice@exemplo.pt' }),
    });
    assert.equal(r.status, 200);
    const corpo = await r.json();
    token = corpo.sessao;
    assert.equal(corpo.eu.nome, 'Prova');
    const fora = await pedir('/api/bo/entrar/teste', {
      method: 'POST',
      body: json({ email: 'ninguem@exemplo.pt' }),
    });
    assert.equal(fora.status, 403);
    // A porta das ligações já não existe: não abre sessão (401 sem sessão, ou 404).
    const ligacao = { method: 'POST', body: json({ acesso: 'x'.repeat(43) }) };
    for (const porta of ['/api/bo/entrar', '/api/balcao/entrar']) {
      const r = await pedir(porta, ligacao);
      assert.ok([401, 404].includes(r.status), `${porta}: ${r.status}`);
    }
  },
);

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
      // Como o backoffice de antes de 8 nov, que mandava a casa: ignora-se.
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
  assert.equal(g.parceiro.lojaId, undefined, 'o parceiro não tem barbearia');
  assert.equal(g.parceiro.promocoesNaApp, 0);
  // Um backoffice que ainda esteja aberto na versão antiga manda a casa: não se recusa, ignora-se.
  const antigo = await pedir(`/api/bo/parceiros/${parceiro}`, {
    method: 'PATCH',
    token,
    body: json({ localidade: 'Aveiro', lojaId: 999 }),
  });
  assert.equal(antigo.status, 200, 'a casa de um backoffice antigo ignora-se');
});

const SEMANA_DE_PROVA = [
  {
    dias: [1, 2, 3, 4, 5, 6],
    horas: [
      ['09:00', '12:30'],
      ['14:30', '19:00'],
    ],
  },
];
await passo(
  'o horário por dias põe de parte o texto livre, e tirá-lo não o traz de volta',
  async () => {
    const mudar = (corpo) =>
      pedir(`/api/bo/parceiros/${parceiro}`, { method: 'PATCH', token, body: json(corpo) });
    // Como um parceiro de antes de 9 nov: só o texto livre (com o inglês, para não ir à tradução).
    const antes = await (
      await mudar({ horario: 'Seg a sex 9-19', horarioEn: 'Mon to Fri 9-19' })
    ).json();
    assert.equal(antes.horario, 'Seg a sex 9-19');
    assert.equal(antes.horarioSemana, null);
    // Baralhado, como o pode mandar quem escolhe os dias por outra ordem: grava-se arrumado.
    const r = await mudar({
      horarioSemana: [{ dias: [6, 5, 4, 3, 2, 1], horas: [...SEMANA_DE_PROVA[0].horas].reverse() }],
    });
    assert.equal(r.status, 200);
    const g = await r.json();
    assert.deepEqual(g.horarioSemana, SEMANA_DE_PROVA);
    assert.equal(g.horario, '', 'o texto livre sai');
    assert.deepEqual(
      daBaseLocal(`SELECT horario, horario_en FROM parceiros WHERE id = ${parceiro}`),
      [{ horario: '', horario_en: '' }],
    );
    const mal = await mudar({ horarioSemana: [{ dias: [1], horas: [['09:00', '09:00']] }] });
    assert.equal(mal.status, 400, 'abrir e fechar à mesma hora não serve');
    const sem = await (await mudar({ horarioSemana: null })).json();
    assert.equal(sem.horarioSemana, null);
    assert.equal(sem.horario, '', 'o texto de antes não volta');
    assert.equal((await mudar({ horarioSemana: SEMANA_DE_PROVA })).status, 200);
  },
);

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
  // O horário em texto para as apps instaladas antes de 9 nov, nas duas línguas, e por dias.
  assert.equal(p.horario, 'Seg a sáb · 9h–12h30 e 14h30–19h');
  assert.deepEqual(p.horarioSemana, SEMANA_DE_PROVA);
  const en = (await (await pedir('/api/app?lingua=en')).json()).parceiros.find(
    (x) => x.id === parceiro,
  );
  assert.equal(en.horario, 'Mon to Sat · 9:00–12:30 and 14:30–19:00');
});

await passo('uma ordem só: arrastar as vantagens muda os destaques e a lista da app', async () => {
  // A vantagem nova vai para o fim da ordem, e o parceiro dela também (o Renato, 10 nov 2026).
  let d = await (await pedir('/api/app')).json();
  assert.equal(d.parceiros.at(-1).id, parceiro, 'a nova fica no fim');
  // Arrastá-la para cima da 1.ª da app, com a lista filtrada (só as duas): trocam de lugar.
  const primeira = d.parceiros[0].promocoes[0].id;
  const ids = async () =>
    (await (await pedir('/api/bo/promocoes', { token })).json()).map((p) => p.id);
  const antes = await ids();
  const r = await pedir('/api/bo/promocoes/ordem', {
    method: 'POST',
    token,
    body: json({ ids: [promocao, primeira] }),
  });
  assert.equal(r.status, 204);
  d = await (await pedir('/api/app')).json();
  assert.equal(d.parceiros[0].id, parceiro, 'o parceiro sobe ao lugar da vantagem');
  const destaques = d.parceiros
    .flatMap((p) => p.promocoes.filter((x) => x.emDestaque))
    .sort((a, b) => a.ordem - b.ordem);
  assert.equal(destaques[0].id, promocao, 'e o destaque dela passa a ser o primeiro');
  // As que não estavam na lista filtrada ficaram onde estavam.
  const troca = (id) => (id === primeira ? promocao : id === promocao ? primeira : id);
  assert.deepEqual(await ids(), antes.map(troca));
  const mau = await pedir('/api/bo/promocoes/ordem', {
    method: 'POST',
    token,
    body: json({ ids: [promocao, 999999] }),
  });
  assert.equal(mau.status, 400, 'uma vantagem que não existe é recusada');
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

await passo('a ordem das redes e contactos, escolhida no backoffice, vai para a app', async () => {
  const b = await (await pedir('/api/bo/barbearia', { token })).json();
  assert.deepEqual(b.redes, ['whatsapp', 'instagram', 'tiktok', 'site'], 'a ordem de sempre');
  const nova = ['instagram', 'site', 'whatsapp', 'tiktok'];
  const gravar = (redes) =>
    pedir('/api/bo/barbearia', { method: 'PUT', token, body: json({ ...b, redes }) });
  assert.equal((await gravar(nova)).status, 200);
  assert.deepEqual((await (await pedir('/api/bo/barbearia', { token })).json()).redes, nova);
  assert.deepEqual((await (await pedir('/api/app')).json()).barbearia.redes, nova);
  assert.equal((await gravar(['site', 'site', 'whatsapp', 'tiktok'])).status, 400, 'sem repetir');
  assert.equal((await gravar(['site'])).status, 400, 'as quatro');
  assert.equal((await gravar(b.redes)).status, 200);
});

await passo('acessos: dar a outra pessoa, tirar-lho, e não se tira a si próprio', async () => {
  const r = await pedir('/api/bo/pessoas', {
    method: 'POST',
    token,
    body: json({ nome: 'Nuno (prova)', email: 'nuno.prova@exemplo.pt' }),
  });
  assert.equal(r.status, 201);
  const { id: adminId } = await r.json();
  const lista = await (await pedir('/api/bo/acessos', { token })).json();
  assert.ok(lista.some((p) => p.id === adminId));
  assert.ok(
    lista.every((p) => !('ligacoes' in p)),
    'já não há ligações',
  );
  const eu = lista.find((p) => p.eu);
  assert.equal((await pedir(`/api/bo/pessoas/${eu.id}`, { method: 'DELETE', token })).status, 409);
  const entrada = (email) =>
    pedir('/api/bo/entrar/teste', { method: 'POST', body: json({ email }) });
  const doNuno = await entrada('nuno.prova@exemplo.pt');
  assert.equal(doNuno.status, 200);
  const sessaoDoNuno = (await doNuno.json()).sessao;
  assert.equal(
    (await pedir(`/api/bo/pessoas/${adminId}`, { method: 'DELETE', token })).status,
    204,
  );
  assert.equal((await pedir('/api/bo/eu', { token: sessaoDoNuno })).status, 401, 'sai já');
  assert.equal((await entrada('nuno.prova@exemplo.pt')).status, 403, 'e já não entra');
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
  // Sem email não se entra (as ligações saíram): tirá-lo é recusado.
  assert.equal(
    (await pedir(`/api/bo/pessoas/${id}`, { method: 'PATCH', token, body: json({ email: null }) }))
      .status,
    400,
  );
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
await passo(
  'equipa: um barbeiro com email (sem email é recusado), e a for partners abre',
  async () => {
    const pessoa = (email) => ({
      nome: 'Prova Barbeiro',
      email,
      papel: 'barbeiro',
      lojaId: 3,
      parceiroId: null,
    });
    const semEmail = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json(pessoa(null)),
    });
    assert.equal(semEmail.status, 400, 'sem email ninguém entra');
    const r = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json(pessoa('barbeiro.prova@exemplo.pt')),
    });
    assert.equal(r.status, 201);
    barbeiroId = (await r.json()).find((p) => p.nome === 'Prova Barbeiro').id;
    tokenBalcao = await entrarNaBalcao('barbeiro.prova@exemplo.pt');
    const eu = await (await pedir('/api/balcao/eu', { token: tokenBalcao })).json();
    assert.equal(eu.pessoa.papel, 'barbeiro');
    assert.equal(eu.pessoa.lojaId, 3);
    assert.equal(eu.lojas.length, 3);
    assert.equal(eu.programa.objectivo, 10);
    assert.equal((await pedir('/api/balcao/eu')).status, 401);
  },
);

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
    // Dez visitas num dia só são da prova: a equipa só carimba um a mais por dia (revisão de batota,
    // 11 nov 2026), e aqui o limite do dia sobe para 10 (o máximo) durante o passo.
    const programa = async (porDia) =>
      pedir('/api/bo/programa', {
        method: 'PUT',
        token,
        body: json({
          ...(await (await pedir('/api/bo/programa', { token })).json()),
          porDia,
        }),
      });
    assert.equal((await programa(10)).status, 200);
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
    assert.equal((await programa(1)).status, 200);
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
  assert.equal(r.status, 201);
  tokenDono = await entrarNaBalcao('dono.prova@gmail.com');
  const resumo = await (await pedir('/api/balcao/resumo?periodo=mes', { token: tokenDono })).json();
  // Só os carimbos a sério (os dos clientes de exemplo ficam fora desde a Fase 1): os 10 da prova.
  assert.ok(resumo.carimbos >= 10 && resumo.carimbos < 100, `carimbos no mês: ${resumo.carimbos}`);
  assert.equal(resumo.porLoja.length, 3);
  assert.ok(resumo.porPessoa.some((p) => p.nome === 'Prova Barbeiro' && p.n === 10));
  assert.equal(typeof resumo.emRisco, 'number');
  const casa = await (
    await pedir('/api/balcao/resumo?periodo=hoje&lojaId=1', { token: tokenDono })
  ).json();
  assert.ok(casa.carimbos <= resumo.carimbos);
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
      // Dito na hora, ao balcão: o corte que completa o cartão é o da oferta (o Renato, 8 nov).
      'Cartão completo (%@): este corte é grátis',
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
    const naCarteira = async () =>
      (await (await pedir('/api/eu', { token: tokenCliente })).json()).wallet.appleNaCarteira;
    assert.equal(await naCarteira(), false, 'antes de um iPhone o juntar, o selo aparece');
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
    assert.equal(await naCarteira(), true, 'com um iPhone registado, o selo sai');
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
    // O cliente já leva os 10 de hoje: o barbeiro passa do limite do dia (11 nov 2026), o dono não.
    const c = await pedir('/api/balcao/carimbar', {
      method: 'POST',
      token: tokenDono,
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
    assert.equal(await naCarteira(), false, 'tirado do iPhone, o selo volta');
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
  'uma promoção com regras ao ler o cartão; o parceiro entra na Balcão; cada papel só faz o seu',
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
        limitePorCliente: 1,
        periodoDoLimite: 'dia',
        limiteTotal: 2,
      }),
    });
    assert.equal(r.status, 201);
    promocaoValidavel = (await r.json()).id;
    const app = await (await pedir('/api/app')).json();
    const pr = app.parceiros
      .find((x) => x.id === 1)
      .promocoes.find((x) => x.id === promocaoValidavel);
    assert.equal(pr.validar, true, 'sempre: as apps de antes de 8 nov lêem-no');
    assert.equal(pr.limitePorCliente, 1);
    assert.equal(pr.periodoDoLimite, 'dia');
    assert.equal(pr.soClientesActivos, true, 'todas são só para clientes activos');
    assert.equal('limiteTotal' in pr, false, 'o limite total não vai para a app');
    const equipa = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Prova Parceiro',
        email: 'parceiro.prova@exemplo.pt',
        papel: 'parceiro',
        lojaId: null,
        parceiroId: 1,
      }),
    });
    assert.equal(equipa.status, 201);
    tokenParceiro = await entrarNaBalcao('parceiro.prova@exemplo.pt');
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
    // Os cartões de exemplo já não se encontram com uma sessão a sério (revisão de batota, 9 nov):
    // um parceiro ou um barbeiro usava-os, e nada aparecia nas contas do negócio.
    const [exemplo] = daBaseLocal('SELECT codigo FROM clientes WHERE id = 1003');
    const deExemplo = await pedir('/api/balcao/validar', {
      method: 'POST',
      token: tokenParceiro,
      body: json({ codigo: exemplo.codigo, promocaoId: promocaoValidavel, chave: 'vale-prova-06' }),
    });
    assert.equal(deExemplo.status, 404, 'um cartão de exemplo não se encontra');
    const [loja] = daBaseLocal('SELECT id FROM lojas ORDER BY id LIMIT 1');
    // Uma sessão própria para estes carimbos: a do dono já vai perto dos 60 por minuto da API.
    const donoAqui = await entrarNaBalcao('dono.prova@gmail.com');
    const activoNovo = async (n) => {
      const sessao = (
        await (
          await pedir('/api/eu/entrar/teste', {
            method: 'POST',
            body: json({
              tipo: 'google',
              sujeito: `prova-activo-${n}`,
              email: `activo${n}@gmail.com`,
            }),
          })
        ).json()
      ).sessao;
      const { codigo } = await (await pedir('/api/eu', { token: sessao })).json();
      const carimbo = await pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: donoAqui,
        body: json({ codigo, chave: `carimbo-activo-${n}x`, lojaId: loja.id }),
      });
      assert.equal(carimbo.status, 200);
      return codigo;
    };
    const a = await activoNovo(1);
    const b = await activoNovo(2);
    const segunda = await pedir('/api/balcao/validar', {
      method: 'POST',
      token: tokenParceiro,
      body: json({ codigo: a, promocaoId: promocaoValidavel, chave: 'vale-prova-06b' }),
    });
    assert.equal(segunda.status, 200, 'um cliente activo usa');
    const terceira = await pedir('/api/balcao/validar', {
      method: 'POST',
      token: tokenParceiro,
      body: json({ codigo: b, promocaoId: promocaoValidavel, chave: 'vale-prova-07' }),
    });
    assert.equal(terceira.status, 409);
    assert.equal((await terceira.json()).erro, 'limite_total');
    const m = await (await pedir('/api/bo/metricas', { token })).json();
    // As duas validações são de clientes a sério: entram nas métricas e no limite total.
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
  'sem saco das surpresas nem interruptor: qualquer promoção se lê ao balcão, e carimbar não dá cupões',
  async () => {
    // Um backoffice aberto antes de 8 nov ainda manda o saco e o interruptor: ignoram-se.
    const r = await pedir('/api/bo/promocoes', {
      method: 'POST',
      token,
      body: json({
        parceiroId: 1,
        destaque: 'Grátis',
        titulo: 'Sobremesa à escolha',
        detalhe: '',
        inicio: null,
        fim: null,
        emDestaque: false,
        activa: true,
        validar: false,
        surpresa: true,
        surpresaDias: 30,
        surpresaPeso: 5,
        surpresaRestantes: 1,
      }),
    });
    assert.equal(r.status, 201);
    const id = (await r.json()).id;
    const app = await (await pedir('/api/app')).json();
    assert.ok(
      app.parceiros.find((x) => x.id === 1).promocoes.some((p) => p.id === id),
      'está na lista, como as outras',
    );
    assert.ok(
      app.parceiros.every((x) => x.promocoes.every((p) => p.validar && !p.surpresa)),
      'as apps de antes de 8 nov lêem validar e surpresa',
    );
    const promo = await (await pedir(`/api/bo/promocoes/${id}`, { token })).json();
    assert.equal(
      'cupoes' in promo || 'surpresaDias' in promo,
      false,
      'o backoffice já não tem o saco',
    );
    // Sem ter ligado nada, o parceiro lê-a ao balcão; sem limite, valida as vezes que quiser.
    const ficha = await (
      await pedir(`/api/balcao/ficha-parceiro/${codigoDoCliente}`, { token: tokenParceiro })
    ).json();
    assert.equal(ficha.vantagens.find((x) => x.id === id)?.motivo, 'ok');
    assert.ok(ficha.vantagens.every((x) => !('cupaoId' in x)));
    const validar = (chave) =>
      pedir('/api/balcao/validar', {
        method: 'POST',
        token: tokenParceiro,
        body: json({ codigo: codigoDoCliente, promocaoId: id, chave }),
      });
    assert.equal((await validar('vale-sem-regras-01')).status, 200);
    assert.equal((await validar('vale-sem-regras-02')).status, 200, 'sem limite');
    for (const chave of ['prova-cupao-01', 'prova-cupao-02']) {
      // Pelo dono: o cliente já passou o limite do dia do barbeiro.
      const c = await pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: tokenDono,
        body: json({ codigo: codigoDoCliente, chave, lojaId: 3, confirmar: true }),
      });
      assert.equal(c.status, 200);
      assert.equal((await c.json()).cupao, null, 'carimbar não dá cupão');
    }
    const eu = await (await pedir('/api/eu', { token: tokenCliente })).json();
    assert.deepEqual(eu.cupoes, [], 'as apps de antes de 8 nov lêem a lista');
    const m = await (await pedir('/api/bo/metricas', { token })).json();
    assert.equal('cupoesSaidos' in m.parcerias, false);
    assert.ok(
      m.parcerias.porPromocao.some((x) => x.id === id),
      'conta nas parcerias',
    );
    assert.equal((await pedir(`/api/bo/promocoes/${id}`, { method: 'DELETE', token })).status, 204);
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
  // Os de exemplo (as sementes) não aparecem: só existem para a revisão das lojas.
  assert.ok(lista.length >= 2 && !lista.some((k) => k.exemplo), `clientes: ${lista.length}`);
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
  // Os 10 do barbeiro; o da Wallet e os 2 do saco já são do dono (o barbeiro passava do limite do dia).
  assert.ok(
    m.porPessoa.some(
      (p) => p.nome === 'Prova Barbeiro' && p.n === 10 && p.anulados === 1 && p.recompensas === 1,
    ),
    JSON.stringify(m.porPessoa),
  );
  assert.ok(m.porPessoa.some((p) => p.nome === 'Prova Dono' && p.n === 3));
  // Os clientes de exemplo ficam fora das métricas (Fase 1): só os da prova.
  assert.ok(m.clientes.total >= 2 && m.clientes.total < 60, `clientes: ${m.clientes.total}`);
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

await passo(
  'a porta de demonstração já não existe: nem a página do QR, nem as entradas',
  async () => {
    for (const caminho of ['/api/eu/entrar/demonstracao', '/api/balcao/entrar/demonstracao']) {
      const r = await pedir(caminho, { method: 'POST', body: json({ codigo: 'DEMOLOCAL2026' }) });
      assert.ok([401, 404].includes(r.status), `${caminho}: ${r.status}`);
      const corpo = await r.json().catch(() => ({}));
      assert.equal(corpo.sessao, undefined, `${caminho} não abre sessão`);
    }
    assert.equal((await pedir('/api/revisao')).status, 404);
    const pagina = await pedir('/api/revisao', {
      method: 'POST',
      body: new URLSearchParams({ codigo: 'DEMOLOCAL2026' }),
    });
    assert.equal(pagina.status, 404);
  },
);

await passo(
  'tirar alguém da equipa termina a sessão dele; os exemplos não se apagam em bloco',
  async () => {
    assert.equal(
      (await pedir(`/api/bo/equipa/${barbeiroId}`, { method: 'DELETE', token })).status,
      200,
    );
    assert.equal((await pedir('/api/balcao/eu', { token: tokenBalcao })).status, 401);
    // Os clientes de exemplo são da conta de revisão da Apple: o pedido antigo de os apagar
    // todos cai na ficha («exemplos» não é um número) e não apaga nada.
    assert.equal(
      (await pedir('/api/bo/clientes/exemplos', { method: 'DELETE', token })).status,
      404,
    );
    const exemplos = daBaseLocal('SELECT count(*) AS n FROM clientes WHERE exemplo = 1')[0].n;
    assert.ok(exemplos >= 59, `exemplos: ${exemplos}`);
    const clientes = await (await pedir('/api/bo/clientes', { token })).json();
    assert.equal(clientes.filter((k) => k.exemplo).length, 0, 'nenhum cliente de exemplo na lista');
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
  for (let i = 0; i < n; i++) {
    const chave = chaveNova();
    const carimbar = () =>
      pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: tokenDono,
        body: json({ codigo, chave, lojaId: lojaDaProva, confirmar: true }),
      });
    let r = await carimbar();
    // O limite de 60 carimbos por minuto por sessão: a prova gasta mais do que isso com o dono e,
    // quando corre depressa, um carimbo dava 429 e o passo falhava longe dali. Uma sessão nova segue.
    if (r.status === 429) {
      tokenDono = await entrarNaBalcao('dono.prova@gmail.com');
      r = await carimbar();
    }
    ultimo = await r.json();
  }
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

// A for partners deixou de carimbar sem rede (9 nov 2026), e a hora que vinha da fila servia para
// dar carimbos nos 7 dias de trás, sem «Carimbar na mesma» e fora do «Hoje» (revisão de batota).
await passo('a hora que vem da app já não conta: o carimbo conta quando chega', async () => {
  const s = (
    await (await entrarTeste('google', 'pf-p5', 'pf.p5@gmail.com', { nome: 'P Cinco' })).json()
  ).sessao;
  const codigo = (await euDe(s)).eu.codigo;
  const ontem = Math.floor(Date.now() / 1000) - 90_000;
  const antes = Math.floor(Date.now() / 1000);
  const r = await pedir('/api/balcao/carimbar', {
    method: 'POST',
    token: tokenDono,
    body: json({ codigo, chave: chaveNova(), lojaId: lojaDaProva, quando: ontem }),
  });
  assert.equal(r.status, 200);
  const outro = await pedir('/api/balcao/carimbar', {
    method: 'POST',
    token: tokenDono,
    body: json({ codigo, chave: chaveNova(), lojaId: lojaDaProva, quando: ontem - 86_400 }),
  });
  assert.equal(outro.status, 409, 'com a hora para trás, o limite do dia vale na mesma');
  const visitas = (await euDe(s)).eu.visitas;
  assert.equal(visitas.length, 1);
  assert.ok(visitas[0].quando >= antes, 'a visita fica com o instante em que chegou');
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
    // Com email, o segundo envio também devolve a ficha do primeiro (e não «email_ja_tem_cartao»).
    const comEmail = {
      nome: 'Duplo Email',
      email: '  DUPLO.Email@Exemplo.PT ',
      carimbo: { chave: chaveNova(), lojaId: lojaDaProva },
    };
    const primeiro = await pedir('/api/balcao/clientes', {
      method: 'POST',
      token: tokenDono,
      body: json(comEmail),
    });
    const segundo = await pedir('/api/balcao/clientes', {
      method: 'POST',
      token: tokenDono,
      body: json(comEmail),
    });
    assert.equal(primeiro.status, 200);
    assert.equal(segundo.status, 200, 'a mesma chave com email devolve o mesmo cliente');
    assert.equal((await primeiro.json()).ficha.cliente.id, (await segundo.json()).ficha.cliente.id);
    // A primeira sem email (a rede caiu depois de gravar) e a segunda com ele: o email junta-se,
    // e quem entra na app com esse email encontra o cartão com o carimbo.
    const semEmail = { nome: 'Rede Ma', carimbo: { chave: chaveNova(), lojaId: lojaDaProva } };
    const antes = await (
      await pedir('/api/balcao/clientes', {
        method: 'POST',
        token: tokenDono,
        body: json(semEmail),
      })
    ).json();
    const depois = await pedir('/api/balcao/clientes', {
      method: 'POST',
      token: tokenDono,
      body: json({ ...semEmail, email: 'rede.ma.prova@gmail.com' }),
    });
    assert.equal(depois.status, 200);
    const entrou = await (
      await entrarTeste('google', 'rede-ma-1', 'rede.ma.prova@gmail.com', { nome: 'Rede Ma' })
    ).json();
    assert.equal(entrou.nova, false, 'a conta é a do balcão, e não uma nova a zeros');
    const contaDele = (await euDe(entrou.sessao)).eu;
    assert.equal(contaDele.codigo, antes.ficha.cliente.codigo);
    assert.equal(contaDele.cartao.carimbos, 1);
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

await passo('a pessoa de um parceiro valida as promoções dele, e não as de outro', async () => {
  const parceiros = await (await pedir('/api/bo/parceiros', { token })).json();
  const B = parceiros[parceiros.length - 1].id;
  const A = parceiros[0].id;
  const doB = await (
    await pedir('/api/bo/promocoes', {
      method: 'POST',
      token,
      body: json({
        parceiroId: B,
        destaque: 'Oferta',
        titulo: 'Café',
        detalhe: '',
        inicio: null,
        fim: null,
        emDestaque: false,
        activa: true,
        limitePorCliente: 1,
        periodoDoLimite: 'sempre',
      }),
    })
  ).json();
  const s = (
    await (await entrarTeste('google', 'pf-s7', 'pf.s7@gmail.com', { nome: 'S Sete' })).json()
  ).sessao;
  const codigo = (await euDe(s)).eu.codigo;
  assert.equal((await carimbarVezes(codigo, 1)).cupao, null);
  const s2 = (
    await (await entrarTeste('google', 'pf-s7b', 'pf.s7b@gmail.com', { nome: 'S Oito' })).json()
  ).sessao;
  assert.equal((await carimbarVezes((await euDe(s2)).eu.codigo, 1)).cupao, null);
  const equipa = await (
    await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Pessoa do B',
        email: 'pessoa.b@exemplo.pt',
        papel: 'parceiro',
        lojaId: null,
        parceiroId: B,
      }),
    })
  ).json();
  assert.ok(equipa.some((p) => p.nome === 'Pessoa do B'));
  const tokenB = await entrarNaBalcao('pessoa.b@exemplo.pt');
  const ficha = await (
    await pedir(`/api/balcao/ficha-parceiro/${codigo}`, { token: tokenB })
  ).json();
  assert.ok(ficha.vantagens.some((v) => v.id === doB.id));
  const promoA = (await (await pedir('/api/bo/promocoes', { token })).json()).find(
    (p) => p.parceiroId === A,
  );
  const errada = await pedir('/api/balcao/validar', {
    method: 'POST',
    token: tokenB,
    body: json({ codigo, promocaoId: promoA.id, chave: chaveNova() }),
  });
  assert.equal(errada.status, 400, 'a promoção de outro parceiro não se valida aqui');
  const certa = await pedir('/api/balcao/validar', {
    method: 'POST',
    token: tokenB,
    body: json({ codigo, promocaoId: doB.id, chave: chaveNova() }),
  });
  assert.equal(certa.status, 200);
  const outraVez = await pedir('/api/balcao/validar', {
    method: 'POST',
    token: tokenB,
    body: json({ codigo, promocaoId: doB.id, chave: chaveNova() }),
  });
  assert.equal((await outraVez.json()).erro, 'limite_do_cliente', 'uma vez só, como o Nuno quis');
  const hoje = await (await pedir('/api/balcao/hoje-parceiro', { token: tokenB })).json();
  assert.equal(hoje.ultimos.filter((v) => v.codigo === codigo).length, 1);
  // Apagar o parceiro tira a pessoa da equipa (fica no histórico) e termina-lhe a sessão.
  assert.equal((await pedir(`/api/bo/parceiros/${B}`, { method: 'DELETE', token })).status, 204);
  assert.equal((await pedir('/api/balcao/eu', { token: tokenB })).status, 401);
});

await passo('nomes sem o que não se vê, e o programa de agora no /api/app', async () => {
  // Colado de outro sítio, um nome só de invisíveis passava e ficava em branco no cartão e no balcão (7 nov).
  const c = await (await entrarTeste('google', 'invisivel-1', null, { nome: 'Antes' })).json();
  const perfil = (nome) =>
    pedir('/api/eu/perfil', { method: 'PATCH', token: c.sessao, body: json({ nome }) });
  assert.equal((await perfil('\u200B\u200B\u200B')).status, 400, 'só invisíveis não é um nome');
  assert.equal((await perfil('\u200D')).status, 400, 'só um juntor não é um nome');
  assert.equal((await perfil('Ana\u200B  Maria\u202E')).status, 200);
  assert.equal(
    (await euDe(c.sessao)).eu.nome,
    'Ana Maria',
    'os invisíveis saem e os espaços juntam-se',
  );
  const novo = await pedir('/api/balcao/clientes', {
    method: 'POST',
    token: tokenDono,
    body: json({ nome: '\u200B', email: null }),
  });
  assert.equal(novo.status, 400, 'o cliente novo também');
  // O cartão de quem ainda não entrou promete o programa de agora.
  const programa = await (await pedir('/api/bo/programa', { token })).json();
  const dadosDaApp = await (await pedir('/api/app')).json();
  assert.deepEqual(dadosDaApp.programa, {
    objectivo: programa.objectivo,
    recompensa: programa.recompensa,
    meio: null,
  });
});

await passo(
  'mudar os carimbos da recompensa: o cartão em curso acaba com o número com que começou, os seguintes usam o novo',
  async () => {
    // O Renato, 8 nov: «deixar acabar o cartão atual e o novo número só se aplica aos próximos».
    const antes = await (await pedir('/api/bo/programa', { token })).json();
    const mudar = async (objectivo) => {
      const r = await pedir('/api/bo/programa', {
        method: 'PUT',
        token,
        body: json({
          objectivo,
          recompensa: antes.recompensa,
          porDia: antes.porDia,
          aniversario: antes.aniversario,
        }),
      });
      assert.equal(r.status, 200, `programa a ${objectivo}`);
    };
    const cliente = async (sujeito, nome) => {
      const s = (
        await (await entrarTeste('google', sujeito, `${sujeito}@gmail.com`, { nome })).json()
      ).sessao;
      return { sessao: s, codigo: (await euDe(s)).eu.codigo };
    };
    await mudar(10);

    // A subir (10 → 12): quem tem 5 de 10 acaba aos 10, e o cartão seguinte já pede 12.
    const a = await cliente('pf-obj-sobe', 'Obj Sobe');
    await carimbarVezes(a.codigo, 5);
    await mudar(12);
    assert.equal((await euDe(a.sessao)).eu.cartao.objectivo, 10, 'o cartão em curso fica com 10');
    assert.equal((await carimbarVezes(a.codigo, 5)).completo, true, 'completa aos 10');
    await carimbarVezes(a.codigo, 1);
    let eu = (await euDe(a.sessao)).eu;
    assert.equal(eu.cartao.objectivo, 12, 'o seguinte pede 12');
    assert.equal(eu.cartao.carimbos, 1);

    // A baixar (12 → 8) com quem já tem MAIS carimbos do que o número novo (9 de 12): o cartão não
    // se dá por completo à força; acaba aos 12, como começou, e o seguinte pede 8.
    const b = await cliente('pf-obj-desce', 'Obj Desce');
    await carimbarVezes(b.codigo, 9);
    await mudar(8);
    eu = (await euDe(b.sessao)).eu;
    assert.equal(eu.cartao.objectivo, 12, 'o cartão em curso fica com 12');
    assert.equal(eu.cartao.carimbos, 9, 'e com os 9 carimbos, sem perder nenhum');
    assert.equal((await carimbarVezes(b.codigo, 2)).completo, false, 'aos 11 ainda não');
    assert.equal((await carimbarVezes(b.codigo, 1)).completo, true, 'completa aos 12');
    await carimbarVezes(b.codigo, 1);
    eu = (await euDe(b.sessao)).eu;
    assert.equal(eu.cartao.objectivo, 8, 'o seguinte pede 8');
    assert.equal(eu.cartao.carimbos, 1);
    // Quem ainda não tem carimbos vê o número novo.
    assert.equal((await (await pedir('/api/app')).json()).programa.objectivo, 8);

    await mudar(antes.objectivo);
  },
);

// ——— Quem valida num parceiro (8 nov): um email só valida num parceiro, e cada um só o seu ———
const [pA, pB] = (await (await pedir('/api/bo/parceiros', { token })).json()).filter(
  (p) => p.activo,
);
const juntarQuemValida = (nome, email, parceiroId) =>
  pedir('/api/bo/equipa', {
    method: 'POST',
    token,
    body: json({ nome, email, papel: 'parceiro', lojaId: null, parceiroId }),
  });
const pessoaDaEquipa = async (nome) =>
  (await (await pedir('/api/bo/equipa', { token })).json()).find((p) => p.nome === nome);
const validarVantagem = (sessao, codigo, promocaoId, chave = chaveNova()) =>
  pedir('/api/balcao/validar', {
    method: 'POST',
    token: sessao,
    body: json({ codigo, promocaoId, chave }),
  });
async function promocaoQueSeValida(parceiroId, titulo) {
  const r = await pedir('/api/bo/promocoes', {
    method: 'POST',
    token,
    body: json({
      parceiroId,
      destaque: '-5 %',
      titulo,
      detalhe: '',
      inicio: null,
      fim: null,
      emDestaque: false,
      activa: true,
      // Um backoffice de antes de 8 nov ainda podia mandar «para todos»: ignora-se.
      soClientesActivos: false,
    }),
  });
  assert.equal(r.status, 201, `a promoção «${titulo}»`);
  return (await r.json()).id;
}
let promocaoDoA;
let codigoDeQuemUsa;

await passo(
  'quem valida: o mesmo email não fica em dois parceiros (nem em maiúsculas), nem na equipa',
  async () => {
    assert.ok(pA && pB, 'há dois parceiros ligados');
    assert.equal((await juntarQuemValida('Ana QV', 'ana.qv@exemplo.pt', pA.id)).status, 201);
    for (const email of ['ana.qv@exemplo.pt', '  ANA.QV@Exemplo.PT ']) {
      const r = await juntarQuemValida('Ana no B', email, pB.id);
      assert.equal(r.status, 409, `o mesmo email noutro parceiro («${email}»)`);
      assert.equal((await r.json()).erro, 'repetido');
    }
    const barbeira = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Ana barbeira',
        email: 'ana.qv@exemplo.pt',
        papel: 'barbeiro',
        lojaId: lojaDaProva,
        parceiroId: null,
      }),
    });
    assert.equal(barbeira.status, 409, 'nem como barbeira');
    assert.equal((await juntarQuemValida('Bruno QV', 'bruno.qv@exemplo.pt', pB.id)).status, 201);
    const bruno = await pessoaDaEquipa('Bruno QV');
    const mudarOEmail = await pedir(`/api/bo/equipa/${bruno.id}`, {
      method: 'PATCH',
      token,
      body: json({ email: 'ana.qv@exemplo.pt' }),
    });
    assert.equal(mudarOEmail.status, 409, 'nem a editar o email de outra pessoa');
    const ana = await pessoaDaEquipa('Ana QV');
    assert.equal(ana.parceiroId, pA.id, 'a Ana continua no A');
    assert.equal(ana.parceiro, pA.nome, 'e o backoffice diz qual');
    assert.equal((await pessoaDaEquipa('Bruno QV')).email, 'bruno.qv@exemplo.pt');
    assert.equal(await pessoaDaEquipa('Ana no B'), undefined);
    assert.equal(await pessoaDaEquipa('Ana barbeira'), undefined);
    assert.equal(
      daBaseLocal(
        "SELECT count(*) AS n FROM equipa WHERE email = 'ana.qv@exemplo.pt' AND removido_em IS NULL",
      )[0].n,
      1,
    );
  },
);

await passo(
  'quem valida: cada um vê, valida e anula só o do seu parceiro, e a lista do dia é só dele',
  async () => {
    promocaoDoA = await promocaoQueSeValida(pA.id, 'Vantagem do A');
    const promocaoDoB = await promocaoQueSeValida(pB.id, 'Vantagem do B');
    const cliente = (
      await (
        await entrarTeste('google', 'qv-cliente', 'qv.cliente@gmail.com', { nome: 'Quem Usa' })
      ).json()
    ).sessao;
    codigoDeQuemUsa = (await euDe(cliente)).eu.codigo;
    const ana = await entrarNaBalcao('ana.qv@exemplo.pt');
    // Todas as vantagens são só para clientes activos: sem um corte, nenhuma vale.
    const semCorte = await validarVantagem(ana, codigoDeQuemUsa, promocaoDoA);
    assert.equal((await semCorte.json()).erro, 'cliente_inactivo', 'sem corte no último ano');
    await carimbarVezes(codigoDeQuemUsa, 1);
    const bruno = await entrarNaBalcao('bruno.qv@exemplo.pt');
    assert.equal(
      (await (await pedir('/api/balcao/eu', { token: ana })).json()).parceiro.nome,
      pA.nome,
      'a Ana entra pelo A',
    );
    const fichaDaAna = await (
      await pedir(`/api/balcao/ficha-parceiro/${codigoDeQuemUsa}`, { token: ana })
    ).json();
    const vantagens = fichaDaAna.vantagens.map((v) => v.id);
    assert.ok(vantagens.includes(promocaoDoA), 'a Ana vê a vantagem do A');
    assert.ok(!vantagens.includes(promocaoDoB), 'e não a do B');
    const doOutro = await validarVantagem(ana, codigoDeQuemUsa, promocaoDoB);
    assert.equal(doOutro.status, 400, 'a Ana não valida a vantagem do B');
    assert.equal((await doOutro.json()).erro, 'referencia');
    const chaveDaAna = chaveNova();
    const certa = await validarVantagem(ana, codigoDeQuemUsa, promocaoDoA, chaveDaAna);
    assert.equal(certa.status, 200, 'valida a do A');
    const vale = (await certa.json()).vale;
    assert.equal(vale.pessoa, 'Ana QV');
    const mesmaChave = await validarVantagem(bruno, codigoDeQuemUsa, promocaoDoB, chaveDaAna);
    assert.equal(mesmaChave.status, 409, 'a chave do vale do A, pelo B, não devolve o vale do A');
    const hojeDoA = await (await pedir('/api/balcao/hoje-parceiro', { token: ana })).json();
    const hojeDoB = await (await pedir('/api/balcao/hoje-parceiro', { token: bruno })).json();
    assert.ok(
      hojeDoA.ultimos.some((v) => v.id === vale.id),
      'o A vê o que validou',
    );
    assert.ok(!hojeDoB.ultimos.some((v) => v.id === vale.id), 'o B não vê o que se validou no A');
    const anular = await pedir('/api/balcao/anular-vale', {
      method: 'POST',
      token: bruno,
      body: json({ valeId: vale.id }),
    });
    assert.equal(anular.status, 404, 'o B não anula o vale do A');
    assert.equal(
      (await validarVantagem(bruno, codigoDeQuemUsa, promocaoDoB)).status,
      200,
      'o Bruno valida a do B',
    );
    assert.equal(
      daBaseLocal(`SELECT parceiro_id AS p FROM vales WHERE id = ${vale.id}`)[0].p,
      pA.id,
    );
  },
);

await passo(
  'quem valida: mudar de parceiro é tirar num e juntar no outro; o que validou no primeiro fica',
  async () => {
    const ana = await pessoaDaEquipa('Ana QV');
    const sessaoNoA = await entrarNaBalcao('ana.qv@exemplo.pt');
    assert.equal(
      (await pedir(`/api/bo/equipa/${ana.id}`, { method: 'DELETE', token })).status,
      200,
    );
    assert.equal((await pedir('/api/balcao/eu', { token: sessaoNoA })).status, 401, 'sai do A');
    assert.equal((await entrarEquipa('ana.qv@exemplo.pt')).status, 403, 'e já não entra');
    assert.equal(
      (await juntarQuemValida('Ana QV', 'ana.qv@exemplo.pt', pB.id)).status,
      201,
      'o email ficou livre para o B',
    );
    const noB = await entrarNaBalcao('ana.qv@exemplo.pt');
    assert.equal(
      (await (await pedir('/api/balcao/eu', { token: noB })).json()).parceiro.nome,
      pB.nome,
      'agora entra pelo B',
    );
    const ficha = await (
      await pedir(`/api/balcao/ficha-parceiro/${codigoDeQuemUsa}`, { token: noB })
    ).json();
    assert.ok(!ficha.vantagens.some((v) => v.id === promocaoDoA), 'e já não vê a do A');
    const [vale] = daBaseLocal(
      `SELECT v.parceiro_id AS p, e.nome, e.removido_em AS r FROM vales v JOIN equipa e ON e.id = v.pessoa_id WHERE v.promocao_id = ${promocaoDoA}`,
    );
    assert.equal(vale.p, pA.id, 'o vale do A continua no A');
    assert.equal(vale.nome, 'Ana QV', 'com o nome de quem o deu');
    assert.ok(vale.r, 'pela pessoa de antes, já tirada');
  },
);

await passo(
  'quem valida: desligar um parceiro, ou só a pessoa, fecha a porta só a quem é dele',
  async () => {
    assert.equal((await juntarQuemValida('Carla QV', 'carla.qv@exemplo.pt', pA.id)).status, 201);
    const carla = await entrarNaBalcao('carla.qv@exemplo.pt');
    const bruno = await entrarNaBalcao('bruno.qv@exemplo.pt');
    const ligarOB = (activo) =>
      pedir(`/api/bo/parceiros/${pB.id}`, { method: 'PATCH', token, body: json({ activo }) });
    assert.equal((await ligarOB(false)).status, 200);
    const fechada = await pedir('/api/balcao/eu', { token: bruno });
    assert.equal(fechada.status, 403);
    assert.equal((await fechada.json()).erro, 'parceiro_desligado');
    const entrar = await entrarEquipa('bruno.qv@exemplo.pt');
    assert.equal(entrar.status, 403);
    assert.equal((await entrar.json()).erro, 'parceiro_desligado');
    assert.equal((await pedir('/api/balcao/eu', { token: carla })).status, 200, 'o A não sente');
    assert.equal((await ligarOB(true)).status, 200);
    assert.equal((await pedir('/api/balcao/eu', { token: bruno })).status, 200, 'religado, volta');
    // O «Activo» da pessoa, na folha do parceiro: desligado não entra; ligado volta a entrar.
    const pessoa = await pessoaDaEquipa('Bruno QV');
    const activo = (v) =>
      pedir(`/api/bo/equipa/${pessoa.id}`, { method: 'PATCH', token, body: json({ activo: v }) });
    assert.equal((await activo(false)).status, 200);
    assert.equal((await pedir('/api/balcao/eu', { token: bruno })).status, 401);
    assert.equal((await entrarEquipa('bruno.qv@exemplo.pt')).status, 403);
    assert.equal(
      (await pedir('/api/balcao/eu', { token: carla })).status,
      200,
      'a Carla não sente',
    );
    assert.equal((await activo(true)).status, 200);
    assert.ok(await entrarNaBalcao('bruno.qv@exemplo.pt'));
    for (const nome of ['Ana QV', 'Bruno QV', 'Carla QV']) {
      const p = await pessoaDaEquipa(nome);
      assert.equal(
        (await pedir(`/api/bo/equipa/${p.id}`, { method: 'DELETE', token })).status,
        200,
      );
    }
  },
);

// A revisão de batota (9 nov 2026): com a chave de um carimbo qualquer, um barbeiro juntava o seu email
// a um cliente sem email e entrava na conta dele pela app.
await passo('a chave de outro carimbo não junta um email a um cliente', async () => {
  // Uma sessão própria: a do dono já gastou os 60 carimbos por minuto da API nos passos de cima.
  const dono = await entrarNaBalcao('dono.prova@gmail.com');
  const novo = await pedir('/api/balcao/clientes', {
    method: 'POST',
    token: dono,
    body: json({ nome: 'Sem Email Prova', carimbo: { chave: chaveNova(), lojaId: lojaDaProva } }),
  });
  assert.equal(novo.status, 200);
  const { codigo } = (await novo.json()).ficha.cliente;
  const k = chaveNova();
  const carimbo = await pedir('/api/balcao/carimbar', {
    method: 'POST',
    token: dono,
    body: json({ codigo, chave: k, lojaId: lojaDaProva, confirmar: true }),
  });
  assert.equal(carimbo.status, 200);
  const roubo = await pedir('/api/balcao/clientes', {
    method: 'POST',
    token: dono,
    body: json({
      nome: 'x',
      email: 'atacante.prova@gmail.com',
      carimbo: { chave: k, lojaId: lojaDaProva },
    }),
  });
  assert.equal(roubo.status, 409);
  assert.equal((await roubo.json()).erro, 'repetido');
  assert.equal(
    daBaseLocal("SELECT count(*) AS n FROM identidades WHERE email = 'atacante.prova@gmail.com'")[0]
      .n,
    0,
  );
});

await passo(
  'o prémio a meio: ganha-se no carimbo dele, entrega-se uma vez, e entregue o carimbo já não se anula',
  async () => {
    // Uma sessão própria: a do dono já gastou os 60 carimbos por minuto da API nos passos de cima.
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const programa = await (await pedir('/api/bo/programa', { token })).json();
    const guardar = (extra) =>
      pedir('/api/bo/programa', { method: 'PUT', token, body: json({ ...programa, ...extra }) });
    const vinte = { meioRecompensa: '20% num produto', meioRecompensaEn: '20% off a product' };
    assert.equal(
      (await guardar({ ...vinte, meio: programa.objectivo })).status,
      400,
      'no último, não',
    );
    assert.equal((await guardar({ ...vinte, meio: 3 })).status, 200);
    const app = await (await pedir('/api/app')).json();
    assert.deepEqual(app.programa.meio, { carimbos: 3, recompensa: '20% num produto' });

    const cliente = async (nome) => {
      const r = await pedir('/api/balcao/clientes', {
        method: 'POST',
        token: dono,
        body: json({ nome, carimbo: { chave: chaveNova(), lojaId: lojaDaProva } }),
      });
      assert.equal(r.status, 200);
      return (await r.json()).ficha.cliente.codigo;
    };
    const carimbar = async (codigo) =>
      (
        await pedir('/api/balcao/carimbar', {
          method: 'POST',
          token: dono,
          body: json({ codigo, chave: chaveNova(), lojaId: lojaDaProva, confirmar: true }),
        })
      ).json();
    const ficha = async (codigo) =>
      (await pedir(`/api/balcao/ficha/${codigo}`, { token: dono })).json();
    const anular = (carimboId) =>
      pedir('/api/balcao/anular', { method: 'POST', token: dono, body: json({ carimboId }) });

    // O 1.º carimbo vem com o cliente novo; ao 3.º ganha-se, e fica por entregar.
    const a = await cliente('Meio Prova A');
    assert.equal((await carimbar(a)).premioAMeio, null, 'ao 2.º ainda não');
    const terceiro = await carimbar(a);
    assert.equal(terceiro.premioAMeio, '20% num produto');
    let f = await ficha(a);
    assert.equal(f.cartao.meio.ganho, true);
    assert.equal(f.premiosAMeio.length, 1);
    // Três «Entregar» ao mesmo tempo: sai uma vez.
    const entregas = await Promise.all(
      [1, 2, 3].map(() =>
        pedir('/api/balcao/usar-premio-a-meio', {
          method: 'POST',
          token: dono,
          body: json({ codigo: a, cartaoId: f.premiosAMeio[0].cartaoId, lojaId: lojaDaProva }),
        }),
      ),
    );
    assert.deepEqual(entregas.map((r) => r.status).sort(), [200, 409, 409]);
    f = await ficha(a);
    assert.equal(f.premiosAMeio.length, 0);
    assert.equal(f.premioAMeioEntregue.recompensa, '20% num produto');
    // Entregue, o carimbo que o deu já não se anula, nem pelo dono: era o prémio dado e outro a seguir.
    const recusado = await anular(terceiro.carimboId);
    assert.equal(recusado.status, 409);
    assert.equal((await recusado.json()).erro, 'premio_a_meio_entregue');

    // Por entregar, anular o carimbo tira o prémio, e o carimbo seguinte volta a dá-lo (um só).
    const b = await cliente('Meio Prova B');
    await carimbar(b);
    const deu = await carimbar(b);
    assert.equal(deu.premioAMeio, '20% num produto');
    assert.equal((await anular(deu.carimboId)).status, 204);
    assert.equal((await ficha(b)).premiosAMeio.length, 0);
    assert.equal((await carimbar(b)).premioAMeio, '20% num produto');
    assert.equal((await ficha(b)).premiosAMeio.length, 1);

    // Mudar o prémio vale para os cartões em curso que ainda não chegaram lá; quem o ganhou fica com o seu.
    const c = await cliente('Meio Prova C');
    assert.equal(
      (await guardar({ meioRecompensa: 'Cera grátis', meioRecompensaEn: 'Free wax', meio: 2 }))
        .status,
      200,
    );
    assert.equal((await ficha(c)).cartao.meio.recompensa, 'Cera grátis');
    assert.equal((await ficha(a)).cartao.meio.recompensa, '20% num produto');
    // Sem texto, os cartões em curso que não o ganharam ficam sem prémio a meio.
    assert.equal((await guardar({ meioRecompensa: '', meioRecompensaEn: '' })).status, 200);
    assert.equal((await ficha(c)).cartao.meio, null);
    assert.equal((await (await pedir('/api/app')).json()).programa.meio, null);
  },
);

// O Renato, 10 nov 2026: o «Ir» de um parceiro sem perfil no Google ia a outro sítio (agora vai às
// coordenadas, se o Nuno as puser), e um código de cupão numa vantagem só para quem não tem o cadeado.
await passo(
  'o sítio exato do parceiro, e o código de cupão só para quem não tem o cadeado',
  async () => {
    const novo = await pedir('/api/bo/parceiros', {
      method: 'POST',
      token,
      body: json({
        nome: 'Parceiro do Cupão',
        categoriaId: 1,
        localidade: 'Aveiro',
        morada: '',
        lat: 40.6457766,
        lng: -8.6408181,
        telefone: '',
        instagram: '',
        site: '',
        descricao: '',
        cor: '#2456B8',
        logotipo: null,
        capa: null,
        activo: true,
      }),
    });
    assert.equal(novo.status, 201);
    const pid = (await novo.json()).id;
    const lido = (await (await pedir(`/api/bo/parceiros/${pid}`, { token })).json()).parceiro;
    assert.deepEqual([lido.lat, lido.lng], [40.6457766, -8.6408181]);
    const vantagem = await pedir('/api/bo/promocoes', {
      method: 'POST',
      token,
      body: json({
        parceiroId: pid,
        destaque: '−15%',
        titulo: 'Na loja online',
        detalhe: '',
        cupao: '  PROVA15 ',
        inicio: null,
        fim: null,
        emDestaque: false,
        activa: true,
      }),
    });
    assert.equal(vantagem.status, 201);
    const vid = (await vantagem.json()).id;
    const noBackoffice = await (await pedir(`/api/bo/promocoes/${vid}`, { token })).json();
    assert.equal(noBackoffice.cupao, 'PROVA15', 'sem os espaços à volta');

    // Na lista de toda a gente só se diz que há código; o sítio vai, para o «Ir».
    const textoDaApp = await (await pedir('/api/app')).text();
    assert.ok(!textoDaApp.includes('PROVA15'), 'o código não vai na lista pública');
    const naApp = JSON.parse(textoDaApp).parceiros.find((p) => p.id === pid);
    assert.deepEqual([naApp.lat, naApp.lng], [40.6457766, -8.6408181]);
    assert.equal(naApp.promocoes.find((v) => v.id === vid).temCupao, true);

    // Quem cortou agora (o 1.º carimbo ao balcão, com o email) vê o código no «eu».
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const aoBalcao = await pedir('/api/balcao/clientes', {
      method: 'POST',
      token: dono,
      body: json({
        nome: 'Cupão Activo',
        email: 'cupao.activo@gmail.com',
        carimbo: { chave: chaveNova(), lojaId: lojaDaProva },
      }),
    });
    assert.equal(aoBalcao.status, 200);
    const activo = await euDe(
      (await (await entrarTeste('google', 'prova-cupao-1', 'cupao.activo@gmail.com')).json())
        .sessao,
    );
    assert.equal(activo.eu.activo, true);
    assert.equal(activo.eu.codigosDasVantagens[String(vid)], 'PROVA15');

    // Quem nunca cortou tem o cadeado: o código nem chega ao telemóvel.
    const semCorte = (
      await (await entrarTeste('google', 'prova-cupao-2', 'cupao.novo@gmail.com')).json()
    ).sessao;
    const r = await pedir('/api/eu', { token: semCorte });
    const texto = await r.text();
    assert.equal(JSON.parse(texto).activo, false);
    assert.deepEqual(JSON.parse(texto).codigosDasVantagens, {});
    assert.ok(!texto.includes('PROVA15'));

    // Sem coordenadas, o «Ir» volta a procurar pela morada; fora do mundo é recusado.
    const tirar = await pedir(`/api/bo/parceiros/${pid}`, {
      method: 'PATCH',
      token,
      body: json({ lat: null, lng: null }),
    });
    assert.equal(tirar.status, 200);
    const semSitio = await tirar.json();
    assert.deepEqual([semSitio.lat, semSitio.lng], [null, null]);
    const fora = await pedir(`/api/bo/parceiros/${pid}`, {
      method: 'PATCH',
      token,
      body: json({ lat: 91, lng: 0 }),
    });
    assert.equal(fora.status, 400);
    assert.equal(
      (await pedir(`/api/bo/parceiros/${pid}`, { method: 'DELETE', token })).status,
      204,
    );
  },
);

// O Renato, 10 nov 2026: quem convida ganha quando o convidado vai à barbearia; o convidado ganha logo;
// a carteira mostra tudo; o barbeiro usa o saldo em euros inteiros; o Nuno define os valores e o limite.
await passo(
  'saldo e convites: aceitar, a visita, anular, o balcão, o acerto, o limite e desligar',
  async () => {
    const sessaoDe = async (sujeito, email, nome) => {
      const r = await entrarTeste('google', sujeito, email, { nome });
      assert.equal(r.status, 200, `entrar como ${email}`);
      return (await r.json()).sessao;
    };
    const carteira = async (s) => {
      const r = await pedir('/api/eu/carteira', { token: s });
      assert.equal(r.status, 200);
      return r.json();
    };
    const aceitar = (s, codigo) =>
      pedir('/api/eu/convite', {
        method: 'POST',
        token: s,
        body: json({ codigo }),
        headers: { 'CF-Connecting-IP': ipNovo() },
      });
    const programa = async (convites) =>
      pedir('/api/bo/programa', {
        method: 'PUT',
        token,
        body: json({ ...(await (await pedir('/api/bo/programa', { token })).json()), convites }),
      });

    // As predefinições (desligados até o Nuno os ligar), e o Nuno liga-os com o limite em 2 para a prova.
    const antes = await (await pedir('/api/bo/programa', { token })).json();
    assert.deepEqual(antes.convites, {
      ligado: false,
      valorPadrinho: 100,
      valorConvidado: 100,
      limite: 10,
    });
    assert.equal(
      (await programa({ ligado: true, valorPadrinho: 100, valorConvidado: 100, limite: 2 })).status,
      200,
    );

    // Quem convida: a carteira dá-lhe o código (o mesmo de cada vez), sem saldo nem convites.
    const padrinho = await sessaoDe(
      'prova-conv-padrinho',
      'padrinho.conv@gmail.com',
      'Padrinho Prova',
    );
    const c0 = await carteira(padrinho);
    assert.match(c0.convites.codigo, /^[0-9A-HJKMNP-TV-Z]{8}$/);
    assert.equal((await carteira(padrinho)).convites.codigo, c0.convites.codigo);
    assert.equal(c0.saldo, 0);
    assert.equal(c0.convites.aceites, 0);
    assert.equal(c0.podeUsarCodigo, true);
    const codigo = c0.convites.codigo;

    // A página do convite, antes de entrar: só o nome curto e o que se ganha.
    const pagina = await pedir(`/api/convite/${codigo}`);
    assert.equal(pagina.status, 200);
    assert.deepEqual(await pagina.json(), { nome: 'Padrinho P.', valorConvidado: 100 });
    assert.equal((await pedir('/api/convite/AAAAAAAA')).status, 404);

    // O convidado aceita (a ligação inteira colada também serve) e ganha logo 1 €.
    const convidado = await sessaoDe('prova-conv-1', 'convidado1.conv@gmail.com', 'Convidado Um');
    const aceite = await aceitar(convidado, `https://exemplo.pt/?convite=${codigo}`);
    assert.equal(aceite.status, 200);
    const cc = await aceite.json();
    assert.equal(cc.saldo, 100);
    assert.deepEqual(cc.convidadoPor.nome, 'Padrinho P.');
    assert.equal(cc.podeUsarCodigo, false);
    assert.equal(cc.movimentos[0].tipo, 'convidado');
    assert.equal(cc.movimentos[0].quem, 'Padrinho P.');
    const euConvidado = (await euDe(convidado)).eu;
    assert.equal(euConvidado.saldo.saldo, 100);
    assert.equal(euConvidado.saldo.ultimo.tipo, 'convidado');
    assert.equal(euConvidado.saldo.convites, true);

    // Outra vez, o próprio, ou um código que não existe: recusados.
    assert.equal((await aceitar(convidado, codigo)).status, 409, 'já convidado');
    assert.equal((await aceitar(padrinho, codigo)).status, 409, 'o próprio');
    assert.equal((await aceitar(convidado, 'AAAAAAAA')).status, 404);

    // Quem convida vê o convite, ainda sem visita e ainda sem prémio.
    let cp = await carteira(padrinho);
    assert.equal(cp.convites.aceites, 1);
    assert.equal(cp.convites.visitaram, 0);
    assert.equal(cp.convites.lista[0].nome, 'Convidado U.');
    assert.equal(cp.convites.lista[0].visitouEm, null);
    assert.equal(cp.saldo, 0);

    // O convidado vai à barbearia: o primeiro carimbo dá 1 € a quem convidou.
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const carimbar = (codigoDoCartao) =>
      pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: dono,
        body: json({ codigo: codigoDoCartao, chave: chaveNova(), lojaId: lojaDaProva }),
      });
    const primeiro = await carimbar(euConvidado.codigo);
    assert.equal(primeiro.status, 200);
    const { carimboId } = await primeiro.json();
    cp = await carteira(padrinho);
    assert.equal(cp.saldo, 100);
    assert.equal(cp.convites.visitaram, 1);
    assert.ok(cp.convites.lista[0].visitouEm > 0);
    const euPadrinho = (await euDe(padrinho)).eu;
    assert.equal(euPadrinho.saldo.ultimo.tipo, 'convite');
    assert.equal(euPadrinho.saldo.ultimo.quem, 'Convidado U.');

    // Anular esse carimbo desfaz o prémio (fica na lista, anulado); o carimbo seguinte volta a dá-lo.
    assert.equal(
      (
        await pedir('/api/balcao/anular', {
          method: 'POST',
          token: dono,
          body: json({ carimboId }),
        })
      ).status,
      204,
    );
    cp = await carteira(padrinho);
    assert.equal(cp.saldo, 0);
    assert.equal(cp.convites.visitaram, 0);
    assert.equal(cp.movimentos[0].anulado, true);
    assert.equal((await carimbar(euConvidado.codigo)).status, 200);
    assert.equal((await carteira(padrinho)).saldo, 100);

    // Depois do primeiro corte, já não se aceita um código.
    const comCorte = await pedir('/api/balcao/clientes', {
      method: 'POST',
      token: dono,
      body: json({
        nome: 'Com Corte Prova',
        email: 'comcorte.conv@gmail.com',
        carimbo: { chave: chaveNova(), lojaId: lojaDaProva },
      }),
    });
    assert.equal(comCorte.status, 200);
    const jaCortou = await sessaoDe('prova-conv-2', 'comcorte.conv@gmail.com', 'Com Corte Prova');
    assert.equal((await carteira(jaCortou)).podeUsarCodigo, false);
    const r2 = await aceitar(jaCortou, codigo);
    assert.equal(r2.status, 409);
    assert.equal((await r2.json()).erro, 'ja_cortou');

    // O limite (2): o segundo convidado cabe, o terceiro já não.
    const segundo = await sessaoDe('prova-conv-3', 'convidado3.conv@gmail.com', 'Convidado Tres');
    assert.equal((await aceitar(segundo, codigo)).status, 200);
    const terceiro = await sessaoDe(
      'prova-conv-4',
      'convidado4.conv@gmail.com',
      'Convidado Quatro',
    );
    const r4 = await aceitar(terceiro, codigo);
    assert.equal(r4.status, 409);
    assert.equal((await r4.json()).erro, 'convites_esgotados');

    // Ao balcão: o barbeiro vê o saldo do convidado (1 €) e usa-o; mais do que o saldo é recusado, e a
    // mesma chave conta uma vez só.
    const ficha = async () =>
      (await pedir(`/api/balcao/ficha/${euConvidado.codigo}`, { token: dono })).json();
    assert.equal((await ficha()).saldo.valor, 100);
    const usar = (valor, chave) =>
      pedir('/api/balcao/usar-saldo', {
        method: 'POST',
        token: dono,
        body: json({ codigo: euConvidado.codigo, valor, chave, lojaId: lojaDaProva }),
      });
    const demais = await usar(200, chaveNova());
    assert.equal(demais.status, 409);
    assert.equal((await demais.json()).erro, 'saldo_insuficiente');
    const chave = chaveNova();
    const usado = await usar(100, chave);
    assert.equal(usado.status, 200);
    const depois = await usado.json();
    assert.equal(depois.saldo.valor, 0);
    assert.equal(depois.saldo.usadoHoje.valor, 100);
    assert.equal(depois.saldo.usadoHoje.podeAnular, true);
    assert.equal((await (await usar(100, chave)).json()).saldo.valor, 0, 'a mesma chave conta uma');
    const euDepois = (await euDe(convidado)).eu;
    assert.equal(euDepois.saldo.saldo, 0);
    assert.equal(euDepois.saldo.ultimo.tipo, 'uso');
    assert.ok(euDepois.saldo.ultimo.loja);

    // Anular o uso devolve o saldo; outra vez é recusado.
    const anular = (movimentoId) =>
      pedir('/api/balcao/anular-saldo', {
        method: 'POST',
        token: dono,
        body: json({ movimentoId }),
      });
    assert.equal((await anular(depois.saldo.usadoHoje.movimentoId)).status, 204);
    assert.equal((await ficha()).saldo.valor, 100);
    assert.equal((await anular(depois.saldo.usadoHoje.movimentoId)).status, 409);

    // O backoffice: a ficha do cliente com o saldo, os movimentos e quem o convidou; e um acerto.
    const lista = await (
      await pedir(`/api/bo/clientes?q=${encodeURIComponent('Convidado Um')}`, { token })
    ).json();
    const idDoConvidado = lista.find((k) => k.nome === 'Convidado Um').id;
    const fichaBo = await (await pedir(`/api/bo/clientes/${idDoConvidado}`, { token })).json();
    assert.equal(fichaBo.saldo.valor, 100);
    assert.equal(fichaBo.saldo.convidadoPor.nome, 'Padrinho Prova');
    assert.ok(fichaBo.saldo.movimentos.some((m) => m.tipo === 'uso' && m.anulado));
    const acertar = (valor, nota) =>
      pedir(`/api/bo/clientes/${idDoConvidado}/saldo`, {
        method: 'POST',
        token,
        body: json({ valor, nota }),
      });
    const dado = await acertar(500, 'Oferta de prova');
    assert.equal(dado.status, 200);
    assert.equal((await dado.json()).saldo.valor, 600);
    const tirarDemais = await acertar(-1000, 'Demais');
    assert.equal(tirarDemais.status, 409);
    assert.equal((await acertar(0, 'Nada')).status, 400);
    assert.equal((await acertar(100, '')).status, 400, 'a nota é precisa');
    const acerto = (await carteira(convidado)).movimentos[0];
    assert.equal(acerto.tipo, 'acerto');
    assert.equal(acerto.nota, 'Oferta de prova');

    // Desligados: a carteira não dá código e nenhum código se aceita.
    assert.equal(
      (await programa({ ligado: false, valorPadrinho: 100, valorConvidado: 100, limite: 2 }))
        .status,
      200,
    );
    assert.equal((await carteira(padrinho)).convites.codigo, null);
    assert.equal((await euDe(padrinho)).eu.saldo.convites, false);
    const novo = await sessaoDe('prova-conv-5', 'convidado5.conv@gmail.com', 'Convidado Cinco');
    const r5 = await aceitar(novo, codigo);
    assert.equal(r5.status, 409);
    assert.equal((await r5.json()).erro, 'convites_desligados');
    assert.equal((await pedir(`/api/convite/${codigo}`)).status, 404);
    // As predefinições outra vez.
    assert.equal((await programa(antes.convites)).status, 200);
  },
);

// ——— Saldo e convites: os casos-limite (o Renato, 11 nov 2026: «é dinheiro: imagina todos os casos
// possíveis e estuda tudo muito bem») ———
const saldoProva = {
  /** Um cliente novo pela porta de teste (sem cortes), com a sessão, o código do cartão e o id. */
  async cliente(nome) {
    const sujeito = `prova-saldo-${nome
      .normalize('NFD')
      .replace(/[^\w]+/g, '-')
      .toLowerCase()}`;
    const r = await entrarTeste('google', sujeito, `${sujeito}@gmail.com`, { nome });
    assert.equal(r.status, 200, `entrar como ${nome}`);
    const sessao = (await r.json()).sessao;
    const eu = (await euDe(sessao)).eu;
    const lista = await (
      await pedir(`/api/bo/clientes?q=${encodeURIComponent(nome)}`, { token })
    ).json();
    const id = lista.find((k) => k.nome === nome)?.id;
    assert.ok(id, `o backoffice encontra ${nome}`);
    return { nome, sessao, codigo: eu.codigo, id };
  },
  async carteira(k) {
    const r = await pedir('/api/eu/carteira', { token: k.sessao });
    assert.equal(r.status, 200, `a carteira de ${k.nome}`);
    return r.json();
  },
  async saldo(k) {
    return (await saldoProva.carteira(k)).saldo;
  },
  async codigo(k) {
    return (await saldoProva.carteira(k)).convites.codigo;
  },
  aceitar: (k, codigo) =>
    pedir('/api/eu/convite', {
      method: 'POST',
      token: k.sessao,
      body: json({ codigo }),
      headers: { 'CF-Connecting-IP': ipNovo() },
    }),
  async carimbar(k, sessao, lojaId = lojaDaProva) {
    const r = await pedir('/api/balcao/carimbar', {
      method: 'POST',
      token: sessao,
      body: json({ codigo: k.codigo, chave: chaveNova(), lojaId, confirmar: true }),
    });
    assert.equal(r.status, 200, `carimbar ${k.nome}`);
    return (await r.json()).carimboId;
  },
  usar: (k, valor, sessao, { chave = chaveNova(), lojaId = lojaDaProva, semLeitura } = {}) =>
    pedir('/api/balcao/usar-saldo', {
      method: 'POST',
      token: sessao,
      body: json({ codigo: k.codigo, valor, chave, lojaId, semLeitura }),
    }),
  anularUso: (movimentoId, sessao) =>
    pedir('/api/balcao/anular-saldo', {
      method: 'POST',
      token: sessao,
      body: json({ movimentoId }),
    }),
  anularCarimbo: (carimboId, sessao) =>
    pedir('/api/balcao/anular', { method: 'POST', token: sessao, body: json({ carimboId }) }),
  anularCarimboNoBackoffice: (carimboId) =>
    pedir(`/api/bo/carimbos/${carimboId}/anular`, { method: 'POST', token }),
  acertar: (k, valor, nota = 'Prova') =>
    pedir(`/api/bo/clientes/${k.id}/saldo`, {
      method: 'POST',
      token,
      body: json({ valor, nota }),
    }),
  async convites(convites) {
    const p = await (await pedir('/api/bo/programa', { token })).json();
    const r = await pedir('/api/bo/programa', {
      method: 'PUT',
      token,
      body: json({ ...p, convites: { ...p.convites, ...convites } }),
    });
    assert.equal(r.status, 200, 'mudar os convites');
  },
  apagar: (k) => pedir('/api/eu', { method: 'DELETE', token: k.sessao }),
  /** A ficha da for partners (o saldo que o barbeiro vê). */
  async ficha(k, sessao) {
    const r = await pedir(`/api/balcao/ficha/${k.codigo}`, { token: sessao });
    assert.equal(r.status, 200, `a ficha de ${k.nome}`);
    return r.json();
  },
};
const PREDEFINIDOS = { ligado: true, valorPadrinho: 100, valorConvidado: 100, limite: 10 };
// Os convites nascem desligados: os casos-limite correm com eles ligados (e desligam-se no fim).
await saldoProva.convites(PREDEFINIDOS);

await passo(
  'convites: anular o 1.º corte do convidado com outro válido mantém o prémio; sem nenhum, tira-o',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const a = await saldoProva.cliente('Padrinho Repoe');
    const b = await saldoProva.cliente('Convidado Repoe');
    assert.equal((await saldoProva.aceitar(b, await saldoProva.codigo(a))).status, 200);
    const c1 = await saldoProva.carimbar(b, dono);
    assert.equal(await saldoProva.saldo(a), 100);
    const c2 = await saldoProva.carimbar(b, dono);
    assert.equal(await saldoProva.saldo(a), 100, 'o 2.º corte não dá outro prémio');
    // Anular o 1.º (no backoffice: um engano de outro dia): o 2.º continua a ser a visita.
    assert.equal((await saldoProva.anularCarimboNoBackoffice(c1)).status, 200);
    assert.equal(await saldoProva.saldo(a), 100, 'o prémio fica com o corte que resta');
    const ca = await saldoProva.carteira(a);
    assert.equal(ca.convites.visitaram, 1);
    assert.equal(
      daBaseLocal(`SELECT carimbo_id FROM convites WHERE convidado_id = ${b.id}`)[0].carimbo_id,
      c2,
    );
    // Sem nenhum corte válido, o prémio sai e o convite volta a «ainda não foi».
    assert.equal((await saldoProva.anularCarimbo(c2, dono)).status, 204);
    assert.equal(await saldoProva.saldo(a), 0);
    assert.equal((await saldoProva.carteira(a)).convites.visitaram, 0);
    // O corte seguinte volta a dá-lo, uma vez.
    await saldoProva.carimbar(b, dono);
    assert.equal(await saldoProva.saldo(a), 100);
    const premios = daBaseLocal(
      `SELECT count(*) AS n, sum(anulado_em IS NULL) AS activos FROM movimentos_de_saldo
       WHERE cliente_id = ${a.id} AND tipo = 'convite'`,
    )[0];
    assert.deepEqual([premios.n, premios.activos], [2, 1]);
  },
);

await passo(
  'saldo: o prémio gasto e o corte anulado deixam o saldo negativo; não se usa abaixo de zero; o acerto repõe',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const a = await saldoProva.cliente('Padrinho Gasta');
    const b = await saldoProva.cliente('Convidado Gasta');
    assert.equal((await saldoProva.aceitar(b, await saldoProva.codigo(a))).status, 200);
    const c1 = await saldoProva.carimbar(b, dono);
    await saldoProva.carimbar(a, dono);
    assert.equal((await saldoProva.usar(a, 100, dono)).status, 200);
    assert.equal(await saldoProva.saldo(a), 0);
    assert.equal((await saldoProva.anularCarimbo(c1, dono)).status, 204);
    // A visita não contou: o prémio sai, e quem já o gastou fica a dever 1 € (à vista nos três lados).
    assert.equal(await saldoProva.saldo(a), -100);
    assert.equal((await euDe(a.sessao)).eu.saldo.saldo, -100);
    assert.equal((await saldoProva.ficha(a, dono)).saldo.valor, -100);
    const bo = await (await pedir(`/api/bo/clientes/${a.id}`, { token })).json();
    assert.equal(bo.saldo.valor, -100);
    const r = await saldoProva.usar(a, 100, dono);
    assert.equal(r.status, 409);
    assert.equal((await r.json()).erro, 'saldo_insuficiente');
    assert.equal((await saldoProva.acertar(a, -100)).status, 409, 'tirar mais não');
    assert.equal((await saldoProva.acertar(a, 100, 'Acerto da prova')).status, 200);
    assert.equal(await saldoProva.saldo(a), 0);
  },
);

await passo(
  'saldo: anular o corte não devolve o uso sozinho; anular o uso devolve-o; só quem usou (ou o dono)',
  async () => {
    const r = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Barbeiro Saldo',
        email: 'barbeiro.saldo@exemplo.pt',
        papel: 'barbeiro',
        lojaId: 3,
        parceiroId: null,
      }),
    });
    assert.equal(r.status, 201);
    const barbeiro = await entrarNaBalcao('barbeiro.saldo@exemplo.pt');
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const a = await saldoProva.cliente('Padrinho Anula');
    const b = await saldoProva.cliente('Convidado Anula');
    assert.equal((await saldoProva.aceitar(b, await saldoProva.codigo(a))).status, 200);
    assert.equal(await saldoProva.saldo(b), 100, 'as boas-vindas');
    // As boas-vindas usam-se com o primeiro corte: antes, nada (contas feitas só para aceitar convites).
    const cedo = await saldoProva.usar(b, 100, barbeiro, { lojaId: 3 });
    assert.equal(cedo.status, 409);
    assert.equal((await cedo.json()).erro, 'saldo_antes_do_corte');
    // Ao balcão: carimba e usa o saldo; depois anula o carimbo (um engano).
    const c1 = await saldoProva.carimbar(b, barbeiro, 3);
    assert.equal(await saldoProva.saldo(a), 100);
    const usado = await saldoProva.usar(b, 100, barbeiro, { lojaId: 3 });
    assert.equal(usado.status, 200);
    const uso = (await usado.json()).saldo.usadoHoje;
    assert.equal(uso.podeAnular, true);
    // O barbeiro não deixa o uso sem o corte: com um só carimbo hoje, anula primeiro o uso (a app faz os
    // dois pela ordem); o dono decide à parte, e aí o uso fica até se anular.
    const comUso = await saldoProva.anularCarimbo(c1, barbeiro);
    assert.equal(comUso.status, 409);
    assert.equal((await comUso.json()).erro, 'saldo_usado_hoje');
    assert.equal((await saldoProva.anularCarimbo(c1, dono)).status, 204);
    assert.equal(await saldoProva.saldo(a), 0, 'o prémio de quem convidou sai');
    assert.equal(await saldoProva.saldo(b), 0, 'o uso fica até se anular');
    // Outro corte (os usos seguintes precisam dele): o prémio volta a quem convidou.
    await saldoProva.carimbar(b, dono);
    assert.equal(await saldoProva.saldo(a), 100);
    // Outro barbeiro (aqui: o dono a usar, o barbeiro a anular) não anula o uso de outra pessoa.
    assert.equal((await saldoProva.acertar(b, 200)).status, 200);
    const doDono = await (await saldoProva.usar(b, 100, dono)).json();
    const r403 = await saldoProva.anularUso(doDono.saldo.usadoHoje.movimentoId, barbeiro);
    assert.equal(r403.status, 403);
    assert.equal((await r403.json()).erro, 'uso_de_outra_pessoa');
    // Quem usou anula; o dono anula qualquer um; duas vezes não.
    assert.equal((await saldoProva.anularUso(uso.movimentoId, barbeiro)).status, 204);
    assert.equal(
      (await saldoProva.anularUso(doDono.saldo.usadoHoje.movimentoId, dono)).status,
      204,
    );
    assert.equal((await saldoProva.anularUso(uso.movimentoId, dono)).status, 409);
    assert.equal(await saldoProva.saldo(b), 300);
    // Passados 10 minutos, quem usou já não anula (o dono sim): o uso «envelhece» na base local.
    const tarde = await (await saldoProva.usar(b, 100, barbeiro, { lojaId: 3 })).json();
    const id = tarde.saldo.usadoHoje.movimentoId;
    daBaseLocal(`UPDATE movimentos_de_saldo SET criado_em = criado_em - 660 WHERE id = ${id}`);
    assert.equal((await saldoProva.ficha(b, barbeiro)).saldo.usadoHoje.podeAnular, false);
    assert.equal((await saldoProva.ficha(b, dono)).saldo.usadoHoje.podeAnular, true);
    const r409 = await saldoProva.anularUso(id, barbeiro);
    assert.equal(r409.status, 409);
    assert.equal((await r409.json()).erro, 'tarde_para_anular_uso');
    assert.equal((await saldoProva.anularUso(id, dono)).status, 204);
    assert.equal(await saldoProva.saldo(b), 300);
    // Um acerto ou um prémio não se anulam como um uso.
    const acerto = (await saldoProva.carteira(b)).movimentos.find((m) => m.tipo === 'acerto');
    assert.equal((await saldoProva.anularUso(acerto.id, dono)).status, 404);
  },
);

await passo(
  'convites: contas apagadas — quem convidou e apagou não recebe; o convidado apagado fica sem nome',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const a = await saldoProva.cliente('Padrinho Apaga');
    const b = await saldoProva.cliente('Convidado Fica');
    const codigoA = await saldoProva.codigo(a);
    assert.equal((await saldoProva.aceitar(b, codigoA)).status, 200);
    assert.equal((await saldoProva.apagar(a)).status, 204);
    await saldoProva.carimbar(b, dono);
    const visita = daBaseLocal(
      `SELECT v.visitou_em, (SELECT count(*) FROM movimentos_de_saldo m WHERE m.convite_id = v.id AND m.tipo = 'convite') AS premios
       FROM convites v WHERE v.convidado_id = ${b.id}`,
    )[0];
    assert.ok(visita.visitou_em, 'a visita fica marcada');
    assert.equal(visita.premios, 0, 'a conta apagada não recebe');
    // O código de quem apagou já não vale, nem na página do convite.
    const c = await saldoProva.cliente('Chega Tarde');
    assert.equal((await saldoProva.aceitar(c, codigoA)).status, 404);
    assert.equal((await pedir(`/api/convite/${codigoA}`)).status, 404);
    // O convidado que apaga: quem convidou vê o convite sem nome; não há acerto nem uso numa conta apagada.
    const d = await saldoProva.cliente('Padrinho Fica');
    const e = await saldoProva.cliente('Convidado Apaga');
    assert.equal((await saldoProva.aceitar(e, await saldoProva.codigo(d))).status, 200);
    assert.equal((await saldoProva.apagar(e)).status, 204);
    const cd = await saldoProva.carteira(d);
    assert.equal(cd.convites.aceites, 1);
    assert.equal(cd.convites.lista[0].nome, '');
    assert.equal((await saldoProva.acertar(e, 100)).status, 404);
    assert.equal((await saldoProva.usar(e, 100, dono)).status, 404, 'o cartão apagado já não abre');
  },
);

await passo(
  'backoffice: o histórico diz quem anulou e quando, liga os dois lados do convite e o prémio de cada um',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const a = await saldoProva.cliente('Padrinho Historico');
    const b = await saldoProva.cliente('Convidado Historico');
    assert.equal((await saldoProva.aceitar(b, await saldoProva.codigo(a))).status, 200);
    const fichaBo = async (k) => {
      const r = await pedir(`/api/bo/clientes/${k.id}`, { token });
      assert.equal(r.status, 200, `a ficha de ${k.nome} no backoffice`);
      return r.json();
    };
    // Antes do 1.º corte: o convite à espera, sem prémio; as boas-vindas ligam a quem convidou.
    let fa = await fichaBo(a);
    assert.equal(fa.saldo.convites.length, 1);
    assert.equal(fa.saldo.convites[0].clienteId, b.id);
    assert.equal(fa.saldo.convites[0].premioEm, null);
    assert.equal(fa.saldo.convites[0].visitouEm, null);
    assert.equal(fa.saldo.convites[0].apagado, false);
    let fb = await fichaBo(b);
    const boasVindas = fb.saldo.movimentos.find((m) => m.tipo === 'convidado');
    assert.equal(boasVindas.quemId, a.id, 'as boas-vindas ligam à ficha de quem convidou');
    assert.equal(boasVindas.quemApagado, false);
    assert.equal(fb.saldo.convidadoPor.clienteId, a.id);
    assert.equal(fb.saldo.convidadoPor.apagado, false);
    // O 1.º corte paga o convite: quando, e por quem.
    const carimbo = await saldoProva.carimbar(b, dono);
    fa = await fichaBo(a);
    assert.ok(fa.saldo.convites[0].premioEm > 0, 'o prémio recebido, com a data');
    assert.ok(fa.saldo.convites[0].visitouEm > 0);
    const premio = fa.saldo.movimentos.find((m) => m.tipo === 'convite');
    assert.equal(premio.quemId, b.id, 'o prémio liga à ficha de quem foi');
    assert.equal(premio.anuladoEm, null);
    // Um uso anulado ao balcão: quem o anulou e a que horas.
    const u = await saldoProva.usar(b, 100, dono);
    assert.equal(u.status, 200);
    const { movimentoId } = (await u.json()).usoFeito;
    assert.equal((await saldoProva.anularUso(movimentoId, dono)).status, 204);
    fb = await fichaBo(b);
    const anulado = fb.saldo.movimentos.find((m) => m.id === movimentoId);
    assert.equal(anulado.anulado, true);
    assert.equal(anulado.anuladoPor, 'Prova Dono');
    assert.ok(
      Math.abs(anulado.anuladoEm - Math.floor(Date.now() / 1000)) < 120,
      'a hora em que se anulou',
    );
    // O corte anulado no backoffice: o prémio sai (sem nome: foi o backoffice), com a hora.
    assert.equal((await saldoProva.anularCarimboNoBackoffice(carimbo)).status, 200);
    fa = await fichaBo(a);
    assert.equal(fa.saldo.convites[0].premioEm, null, 'o prémio anulado já não conta');
    assert.equal(fa.saldo.convites[0].visitouEm, null);
    const premioAnulado = fa.saldo.movimentos.find((m) => m.tipo === 'convite');
    assert.equal(premioAnulado.anulado, true);
    assert.equal(premioAnulado.anuladoPor, null);
    assert.ok(premioAnulado.anuladoEm > 0);
    fb = await fichaBo(b);
    const visita = fb.historico.find((x) => x.id === carimbo);
    assert.ok(visita.anuladoEm > 0);
    assert.equal(visita.anuladoPor, null);
    // O convidado apaga a conta: quem convidou vê-o apagado (sem nome), e a ligação fica.
    assert.equal((await saldoProva.apagar(b)).status, 204);
    fa = await fichaBo(a);
    assert.equal(fa.saldo.convites[0].apagado, true);
    assert.equal(fa.saldo.convites[0].nome, '');
    assert.equal(fa.saldo.movimentos.find((m) => m.tipo === 'convite').quemApagado, true);
  },
);

await passo(
  'backoffice: a página de cada pessoa da equipa — o que fez, o que lhe anularam, o que anulou e os números',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const r = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Barbeiro Historico',
        email: 'barbeiro.historico@exemplo.pt',
        papel: 'barbeiro',
        lojaId: lojaDaProva,
        parceiroId: null,
      }),
    });
    assert.equal(r.status, 201);
    const equipa = await (await pedir('/api/bo/equipa', { token })).json();
    const barbeiroId = equipa.find((p) => p.email === 'barbeiro.historico@exemplo.pt').id;
    const donoId = equipa.find((p) => p.email === 'dono.prova@gmail.com').id;
    const barbeiro = await entrarNaBalcao('barbeiro.historico@exemplo.pt');
    // Um carimbo e um uso (anulado pelo dono), um repetido que ele anulou, e o 1.º anulado no backoffice.
    const k = await saldoProva.cliente('Cliente Da Pessoa');
    assert.equal((await saldoProva.acertar(k, 200)).status, 200);
    const primeiro = await saldoProva.carimbar(k, barbeiro);
    const u = await saldoProva.usar(k, 100, barbeiro);
    assert.equal(u.status, 200);
    const { movimentoId } = (await u.json()).usoFeito;
    const repetido = await saldoProva.carimbar(k, barbeiro);
    assert.equal((await saldoProva.anularCarimbo(repetido, barbeiro)).status, 204);
    assert.equal((await saldoProva.anularUso(movimentoId, dono)).status, 204);
    assert.equal((await saldoProva.anularCarimboNoBackoffice(primeiro)).status, 200);
    // O 10.º corte de outro cliente (o prémio, entregue pelo próprio carimbo): os 9 do dono foram ontem.
    const k2 = await saldoProva.cliente('Cliente Do Premio');
    for (let i = 0; i < 9; i++) await saldoProva.carimbar(k2, dono);
    naBaseLocal(
      '--command',
      `UPDATE carimbos SET dia = date(dia, '-1 day'), criado_em = criado_em - 86400 WHERE cliente_id = ${k2.id}`,
    );
    const decimo = await saldoProva.carimbar(k2, barbeiro);
    const historicoDe = async (id, antes) => {
      const x = await pedir(`/api/bo/equipa/${id}/historico${antes ? `?antes=${antes}` : ''}`, {
        token,
      });
      assert.equal(x.status, 200, `o histórico da pessoa ${id}`);
      return x.json();
    };
    const hb = await historicoDe(barbeiroId);
    const carimbos = hb.acontecimentos.filter((a) => a.tipo === 'carimbo');
    assert.deepEqual(
      carimbos.map((a) => a.id).sort((a, b) => a - b),
      [primeiro, repetido, decimo].sort((a, b) => a - b),
      'só os carimbos dele',
    );
    const rep = carimbos.find((a) => a.id === repetido);
    assert.equal(rep.repetido, true);
    assert.equal(rep.anulado.por, 'Barbeiro Historico', 'anulou o seu');
    assert.equal(rep.cliente.id, k.id);
    const prim = carimbos.find((a) => a.id === primeiro);
    assert.equal(prim.anulado.por, null, 'anulado no backoffice');
    assert.ok(prim.loja);
    const uso = hb.acontecimentos.find((a) => a.tipo === 'uso');
    assert.equal(uso.id, movimentoId);
    assert.equal(uso.valor, -100);
    assert.equal(uso.anulado.por, 'Prova Dono');
    const premio = hb.acontecimentos.find((a) => a.tipo === 'premio');
    assert.equal(premio.cliente.id, k2.id, 'o prémio que entregou');
    assert.ok(premio.recompensa);
    assert.deepEqual(
      hb.numeros,
      { carimbos: 1, saldoUsado: 0, anulados: 3, semLeitura: 0 },
      'os números de 30 dias',
    );
    const quandos = hb.acontecimentos.map((a) => a.quando);
    assert.deepEqual(
      [...quandos].sort((a, b) => b - a),
      quandos,
      'do mais recente para trás',
    );
    // O dono vê o uso que anulou de outra pessoa, com de quem era; os carimbos do dono são dele.
    const hd = await historicoDe(donoId);
    const anulou = hd.acontecimentos.find((a) => a.tipo === 'anulou-uso' && a.id === movimentoId);
    assert.equal(anulou.de.pessoa, 'Barbeiro Historico');
    assert.equal(anulou.valor, -100);
    assert.equal(anulou.cliente.id, k.id);
    assert.ok(hd.acontecimentos.some((a) => a.tipo === 'carimbo' && a.cliente?.id === k2.id));
    // A página seguinte começa depois da última linha: sem os números, sem repetir.
    const c0 = hb.acontecimentos[0];
    const resto = await historicoDe(barbeiroId, `${c0.quando}.${c0.tipo}.${c0.id}`);
    assert.equal(resto.numeros, null);
    assert.equal(resto.acontecimentos.length, hb.acontecimentos.length - 1);
    assert.equal(resto.seguinte, null);
    assert.equal(
      (await pedir(`/api/bo/equipa/${barbeiroId}/historico?antes=xyz`, { token })).status,
      400,
    );
    assert.equal((await pedir('/api/bo/equipa/999999/historico', { token })).status, 404);
    // Sem sessão do backoffice, nada.
    assert.equal((await pedir(`/api/bo/equipa/${barbeiroId}/historico`)).status, 401);
  },
);

await passo(
  'convites: desligados, os já aceites pagam na mesma; o saldo usa-se na mesma; nada de novo entra',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const a = await saldoProva.cliente('Padrinho Desliga');
    const b = await saldoProva.cliente('Convidado Desliga');
    const codigoA = await saldoProva.codigo(a);
    assert.equal((await saldoProva.aceitar(b, codigoA)).status, 200);
    await saldoProva.convites({ ligado: false });
    try {
      await saldoProva.carimbar(b, dono);
      assert.equal(await saldoProva.saldo(a), 100, 'a promessa feita cumpre-se');
      assert.equal((await saldoProva.usar(b, 100, dono)).status, 200, 'o saldo usa-se na mesma');
      const c = await saldoProva.cliente('Novo Desliga');
      const r = await saldoProva.aceitar(c, codigoA);
      assert.equal(r.status, 409);
      assert.equal((await r.json()).erro, 'convites_desligados');
      const cc = await saldoProva.carteira(c);
      assert.equal(cc.convites.codigo, null);
      assert.equal(cc.podeUsarCodigo, false);
      assert.equal((await euDe(c.sessao)).eu.saldo.convites, false);
      assert.equal((await pedir(`/api/convite/${codigoA}`)).status, 404);
    } finally {
      await saldoProva.convites(PREDEFINIDOS);
    }
    // Ligados outra vez, o mesmo código volta a valer.
    assert.equal(await saldoProva.codigo(a), codigoA);
  },
);

await passo(
  'convites: os valores novos valem só para os convites novos; a zero não há movimentos',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const a = await saldoProva.cliente('Padrinho Valores');
    const codigoA = await saldoProva.codigo(a);
    try {
      await saldoProva.convites({ valorPadrinho: 300, valorConvidado: 200 });
      const b = await saldoProva.cliente('Convidado Valores');
      assert.equal((await saldoProva.aceitar(b, codigoA)).status, 200);
      assert.equal(await saldoProva.saldo(b), 200);
      await saldoProva.convites({ valorPadrinho: 100, valorConvidado: 100 });
      await saldoProva.carimbar(b, dono);
      assert.equal(await saldoProva.saldo(a), 300, 'o prémio do dia em que aceitou');
      await saldoProva.convites({ valorPadrinho: 0, valorConvidado: 0 });
      const c = await saldoProva.cliente('Convidado Zero');
      assert.equal((await saldoProva.aceitar(c, codigoA)).status, 200);
      assert.equal(await saldoProva.saldo(c), 0);
      assert.equal((await saldoProva.carteira(c)).movimentos.length, 0);
      await saldoProva.carimbar(c, dono);
      assert.equal(await saldoProva.saldo(a), 300, 'um prémio a zero não entra');
      const ca = await saldoProva.carteira(a);
      assert.equal(ca.convites.visitaram, 2);
      assert.equal(ca.convites.lista.find((v) => v.nome === 'Convidado Z.').premio, 0);
    } finally {
      await saldoProva.convites(PREDEFINIDOS);
    }
  },
);

await passo(
  'convites: não se convidam um ao outro; a ligação colada (com mais coisas), a frase e o código escrito à mão',
  async () => {
    const a = await saldoProva.cliente('Amigo Um');
    const b = await saldoProva.cliente('Amigo Dois');
    const codigoA = await saldoProva.codigo(a);
    assert.equal((await saldoProva.aceitar(b, codigoA)).status, 200);
    const r = await saldoProva.aceitar(a, await saldoProva.codigo(b));
    assert.equal(r.status, 409);
    assert.equal((await r.json()).erro, 'convite_reciproco');
    assert.equal(await saldoProva.saldo(a), 0);
    const ligacao = `https://renatovalente5.github.io/nunos-lab/?convite=${codigoA}&utm_source=whatsapp&fbclid=abc123`;
    assert.ok(ligacao.length > 60);
    const c = await saldoProva.cliente('Amigo Tres');
    assert.equal((await saldoProva.aceitar(c, ligacao)).status, 200, 'a ligação inteira');
    const d = await saldoProva.cliente('Amigo Quatro');
    const frase = `Ganha 1 € no Nuno’s Lab com o meu convite. Código: ${codigoA}`;
    assert.equal((await saldoProva.aceitar(d, frase)).status, 200, 'a frase da partilha');
    const e = await saldoProva.cliente('Amigo Cinco');
    const escrito = `${codigoA.slice(0, 4)} ${codigoA.slice(4)}`.toLowerCase();
    assert.equal((await saldoProva.aceitar(e, escrito)).status, 200, 'à mão, com espaço');
    const f = await saldoProva.cliente('Amigo Seis');
    assert.equal((await saldoProva.aceitar(f, 'ABCD')).status, 404);
    assert.equal((await saldoProva.aceitar(f, 'x'.repeat(501))).status, 400);
    assert.equal((await saldoProva.carteira(a)).convites.aceites, 4);
    // Só o código de quem já cá estava: a conta mais antiga não usa o de uma mais recente (sem rodas).
    const g = await saldoProva.cliente('Amigo Mais Novo');
    const r2 = await saldoProva.aceitar(f, await saldoProva.codigo(g));
    assert.equal(r2.status, 409);
    assert.equal((await r2.json()).erro, 'convite_mais_recente');
  },
);

await passo(
  'saldo: ao mesmo tempo — usos não passam do saldo; a mesma chave conta uma; no limite entra um só convite',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const x = await saldoProva.cliente('Cliente Corrida');
    await saldoProva.carimbar(x, dono);
    assert.equal((await saldoProva.acertar(x, 200)).status, 200);
    const tres = await Promise.all([1, 2, 3].map(() => saldoProva.usar(x, 100, dono)));
    assert.deepEqual(tres.map((r) => r.status).sort(), [200, 200, 409]);
    assert.equal(await saldoProva.saldo(x), 0);
    // A API diz o uso que esta chave fez (o que a folha anula), e se o cartão foi lido.
    assert.equal((await saldoProva.acertar(x, 100)).status, 200);
    const semLer = await (await saldoProva.usar(x, 100, dono, { semLeitura: true })).json();
    const naCarteira = (await saldoProva.carteira(x)).movimentos[0];
    assert.equal(semLer.usoFeito.movimentoId, naCarteira.id);
    assert.equal(semLer.usoFeito.valor, 100);
    const noBackoffice = await (await pedir(`/api/bo/clientes/${x.id}`, { token })).json();
    assert.equal(noBackoffice.saldo.movimentos[0].semLeitura, true);
    assert.equal(noBackoffice.saldo.movimentos[1].semLeitura, false);
    // A mesma chave em dois clientes ao mesmo tempo: um uso; o outro é recusado, sem mexer no saldo.
    const y = await saldoProva.cliente('Cliente Corrida Dois');
    await saldoProva.carimbar(y, dono);
    assert.equal((await saldoProva.acertar(x, 100)).status, 200);
    assert.equal((await saldoProva.acertar(y, 100)).status, 200);
    const partilhada = chaveNova();
    const doisClientes = await Promise.all([
      saldoProva.usar(x, 100, dono, { chave: partilhada }),
      saldoProva.usar(y, 100, dono, { chave: partilhada }),
    ]);
    assert.deepEqual(doisClientes.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await saldoProva.saldo(x)) + (await saldoProva.saldo(y)), 100);
    if ((await saldoProva.saldo(x)) > 0)
      assert.equal((await saldoProva.acertar(x, -100)).status, 200);
    // A mesma chave três vezes ao mesmo tempo: um uso só.
    assert.equal((await saldoProva.acertar(x, 100)).status, 200);
    const chave = chaveNova();
    const iguais = await Promise.all([1, 2, 3].map(() => saldoProva.usar(x, 100, dono, { chave })));
    assert.deepEqual(
      iguais.map((r) => r.status),
      [200, 200, 200],
    );
    assert.equal(await saldoProva.saldo(x), 0);
    assert.equal(
      daBaseLocal(`SELECT count(*) AS n FROM movimentos_de_saldo WHERE chave = '${chave}'`)[0].n,
      1,
    );
    // Um acerto a tirar e um uso ao mesmo tempo: só um passa, e o saldo nunca fica negativo.
    assert.equal((await saldoProva.acertar(x, 100)).status, 200);
    const [tirar, usar] = await Promise.all([
      saldoProva.acertar(x, -100),
      saldoProva.usar(x, 100, dono),
    ]);
    assert.deepEqual([tirar.status, usar.status].sort(), [200, 409]);
    assert.equal(await saldoProva.saldo(x), 0);
    // O limite: com um lugar, dois convidados ao mesmo tempo, entra um.
    try {
      await saldoProva.convites({ limite: 1 });
      const a = await saldoProva.cliente('Padrinho Corrida');
      const codigoA = await saldoProva.codigo(a);
      const b = await saldoProva.cliente('Corrida Um');
      const c = await saldoProva.cliente('Corrida Dois');
      const dois = await Promise.all([
        saldoProva.aceitar(b, codigoA),
        saldoProva.aceitar(c, codigoA),
      ]);
      assert.deepEqual(dois.map((r) => r.status).sort(), [200, 409]);
      assert.equal((await saldoProva.carteira(a)).convites.aceites, 1);
      // No limite, a página do convite já não promete nada.
      assert.equal((await pedir(`/api/convite/${codigoA}`)).status, 404);
      assert.equal((await saldoProva.saldo(b)) + (await saldoProva.saldo(c)), 100);
    } finally {
      await saldoProva.convites(PREDEFINIDOS);
    }
  },
);

await passo(
  'saldo: quem pode — sem sessão, o parceiro, o cliente, o próprio cartão; e o parceiro não vê o saldo',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const daEquipa = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Parceiro Saldo',
        email: 'parceiro.saldo@exemplo.pt',
        papel: 'parceiro',
        lojaId: null,
        parceiroId: 1,
      }),
    });
    assert.equal(daEquipa.status, 201);
    const tokenParceiro = await entrarNaBalcao('parceiro.saldo@exemplo.pt');
    const x = await saldoProva.cliente('Cliente Portas');
    await saldoProva.carimbar(x, dono);
    assert.equal((await saldoProva.acertar(x, 300)).status, 200);
    assert.equal((await pedir('/api/eu/carteira')).status, 401);
    assert.equal(
      (await pedir('/api/eu/convite', { method: 'POST', body: json({ codigo: 'ABCD1234' }) }))
        .status,
      401,
    );
    assert.equal((await saldoProva.usar(x, 100, undefined)).status, 401);
    assert.equal((await saldoProva.usar(x, 100, x.sessao)).status, 401, 'a sessão de um cliente');
    const doParceiro = await saldoProva.usar(x, 100, tokenParceiro);
    assert.equal(doParceiro.status, 403);
    const usado = await (await saldoProva.usar(x, 100, dono)).json();
    assert.equal(
      (await saldoProva.anularUso(usado.saldo.usadoHoje.movimentoId, tokenParceiro)).status,
      403,
    );
    assert.equal(
      (await pedir(`/api/balcao/ficha/${x.codigo}`, { token: tokenParceiro })).status,
      403,
    );
    const doLadoDoParceiro = await pedir(`/api/balcao/ficha-parceiro/${x.codigo}`, {
      token: tokenParceiro,
    });
    assert.ok(!('saldo' in (await doLadoDoParceiro.json())), 'o parceiro não vê o saldo');
    assert.equal(
      (
        await pedir(`/api/bo/clientes/${x.id}/saldo`, {
          method: 'POST',
          body: json({ valor: 100, nota: 'x' }),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await pedir(`/api/bo/clientes/${x.id}/saldo`, {
          method: 'POST',
          token: dono,
          body: json({ valor: 100, nota: 'x' }),
        })
      ).status,
      401,
      'a sessão da for partners não abre o backoffice',
    );
    // Um barbeiro que também é cliente não usa o próprio saldo: é outro que o faz.
    const r = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Barbeiro Cliente',
        email: 'prova-saldo-barbeiro-cliente@gmail.com',
        papel: 'barbeiro',
        lojaId: 3,
        parceiroId: null,
      }),
    });
    assert.equal(r.status, 201);
    const proprio = await saldoProva.cliente('Barbeiro Cliente');
    await saldoProva.carimbar(proprio, dono);
    assert.equal((await saldoProva.acertar(proprio, 100)).status, 200);
    const barbeiro = await entrarNaBalcao('prova-saldo-barbeiro-cliente@gmail.com');
    const r403 = await saldoProva.usar(proprio, 100, barbeiro, { lojaId: 3 });
    assert.equal(r403.status, 403);
    assert.equal((await r403.json()).erro, 'proprio_cartao');
    assert.equal((await saldoProva.usar(proprio, 100, dono)).status, 200, 'outro usa');
  },
);

await passo(
  'saldo: valores errados recusados; os cêntimos contam ao balcão e no backoffice',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const x = await saldoProva.cliente('Cliente Valores');
    for (const valor of [0, -100, 1.5, '100', 50001, null])
      assert.equal((await saldoProva.usar(x, valor, dono)).status, 400, `usar ${valor}`);
    assert.equal((await saldoProva.usar(x, 100, dono, { chave: 'curta' })).status, 400);
    assert.equal((await saldoProva.usar(x, 100, dono, { lojaId: 999 })).status, 400);
    for (const valor of [0, 50001, -50001, 2.5, '100'])
      assert.equal((await saldoProva.acertar(x, valor)).status, 400, `acertar ${valor}`);
    assert.equal((await saldoProva.acertar(x, 100, '   ')).status, 400, 'a nota é precisa');
    // O acerto com a chave da folha: a resposta perdida e o clique outra vez contam um.
    const chave = chaveNova();
    const acertoComChave = () =>
      pedir(`/api/bo/clientes/${x.id}/saldo`, {
        method: 'POST',
        token,
        body: json({ valor: 200, nota: 'Com chave', chave }),
      });
    const duas = await Promise.all([acertoComChave(), acertoComChave()]);
    assert.deepEqual(
      duas.map((r) => r.status),
      [200, 200],
    );
    assert.equal((await acertoComChave()).status, 200);
    assert.equal(await saldoProva.saldo(x), 200, 'três vezes a mesma chave: um acerto');
    assert.equal((await saldoProva.acertar(x, -200, 'Repor')).status, 200);
    assert.equal((await saldoProva.acertar(x, 100, 'n'.repeat(141))).status, 400);
    // A base aceita cêntimos: 1,50 € dá para usar 1 € e depois os 0,50 € (pela API).
    await saldoProva.carimbar(x, dono);
    assert.equal((await saldoProva.acertar(x, 150, 'Cêntimos')).status, 200);
    assert.equal((await saldoProva.usar(x, 100, dono)).status, 200);
    assert.equal((await saldoProva.usar(x, 100, dono)).status, 409);
    assert.equal((await saldoProva.usar(x, 50, dono)).status, 200);
    assert.equal(await saldoProva.saldo(x), 0);
    const p = await (await pedir('/api/bo/programa', { token })).json();
    for (const convites of [
      { ...p.convites, valorPadrinho: 5001 },
      { ...p.convites, valorConvidado: -1 },
      { ...p.convites, valorPadrinho: 1.5 },
      { ...p.convites, limite: 0 },
      { ...p.convites, limite: 101 },
      { ...p.convites, ligado: 'sim' },
    ])
      assert.equal(
        (await pedir('/api/bo/programa', { method: 'PUT', token, body: json({ ...p, convites }) }))
          .status,
        400,
        JSON.stringify(convites),
      );
  },
);

await passo(
  'convites: o barbeiro que convidou não carimba o primeiro corte do convidado (outro carimba)',
  async () => {
    const email = 'prova-saldo-barbeiro-padrinho@gmail.com';
    const r = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Barbeiro Padrinho',
        email,
        papel: 'barbeiro',
        lojaId: 3,
        parceiroId: null,
      }),
    });
    assert.equal(r.status, 201);
    const dele = await saldoProva.cliente('Barbeiro Padrinho');
    const amigo = await saldoProva.cliente('Amigo Do Barbeiro');
    assert.equal((await saldoProva.aceitar(amigo, await saldoProva.codigo(dele))).status, 200);
    const barbeiro = await entrarNaBalcao(email);
    const carimbarComo = (sessao, lojaId) =>
      pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: sessao,
        body: json({ codigo: amigo.codigo, chave: chaveNova(), lojaId, confirmar: true }),
      });
    const proprio = await carimbarComo(barbeiro, 3);
    assert.equal(proprio.status, 403);
    assert.equal((await proprio.json()).erro, 'convidado_proprio');
    assert.equal(await saldoProva.saldo(dele), 0);
    // Outro barbeiro (aqui o dono) carimba: o prémio entra; depois da visita, o barbeiro já carimba.
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    assert.equal((await carimbarComo(dono, lojaDaProva)).status, 200);
    assert.equal(await saldoProva.saldo(dele), 100);
    assert.equal((await carimbarComo(barbeiro, 3)).status, 200);
  },
);

await passo(
  'batota: apagar a conta e voltar não faz de ninguém um «novo»; um carimbo anulado também conta',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const a = await saldoProva.cliente('Padrinho Batota');
    const codigoA = await saldoProva.codigo(a);
    // Um cliente que cortou apaga a conta e volta com a mesma Google: já não aceita convites.
    const b = await saldoProva.cliente('Volta Outra Vez');
    await saldoProva.carimbar(b, dono);
    assert.equal((await saldoProva.apagar(b)).status, 204);
    const b2 = await saldoProva.cliente('Volta Outra Vez');
    assert.notEqual(b2.id, b.id, 'uma conta nova');
    assert.equal((await saldoProva.carteira(b2)).podeUsarCodigo, false);
    assert.equal((await euDe(b2.sessao)).eu.saldo.podeUsarCodigo, false);
    const r1 = await saldoProva.aceitar(b2, codigoA);
    assert.equal(r1.status, 409);
    assert.equal((await r1.json()).erro, 'conta_ja_usada');
    // Quem nunca fez nada e apaga, volta como novo (não há marca de quem não cortou nem foi convidado).
    const c = await saldoProva.cliente('Nunca Fez Nada');
    assert.equal((await saldoProva.apagar(c)).status, 204);
    const c2 = await saldoProva.cliente('Nunca Fez Nada');
    assert.equal((await saldoProva.aceitar(c2, codigoA)).status, 200);
    // Carimbar e anular não deixa ninguém «novo»: o código é só para quem nunca teve carimbo nenhum.
    const d = await saldoProva.cliente('Carimbo Anulado');
    const x = await saldoProva.carimbar(d, dono);
    assert.equal((await saldoProva.anularCarimbo(x, dono)).status, 204);
    assert.equal((await saldoProva.carteira(d)).podeUsarCodigo, false);
    const r2 = await saldoProva.aceitar(d, codigoA);
    assert.equal(r2.status, 409);
    assert.equal((await r2.json()).erro, 'ja_cortou');
  },
);

await passo(
  'batota ao balcão: o saldo só com o cartão lido e um corte de hoje; anular só os usos de hoje; «carimbar na mesma» é um a mais',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const barbeiro = await entrarNaBalcao('barbeiro.saldo@exemplo.pt');
    const x = await saldoProva.cliente('Cliente Ausente');
    await saldoProva.carimbar(x, dono);
    assert.equal((await saldoProva.acertar(x, 500)).status, 200);
    // Um corte noutro dia (o carimbo «envelhece» na base local): hoje, a equipa não usa o saldo dele.
    daBaseLocal(
      `UPDATE carimbos SET dia = '2026-01-01', criado_em = criado_em - 86400 * 300 WHERE cliente_id = ${x.id}`,
    );
    const semCorte = await saldoProva.usar(x, 100, barbeiro, { lojaId: 3 });
    assert.equal(semCorte.status, 409);
    assert.equal((await semCorte.json()).erro, 'saldo_sem_corte_hoje');
    assert.equal((await saldoProva.usar(x, 100, dono)).status, 200, 'o dono sim');
    // Sem o cartão lido (escrito, procurado, «tenho cartão»), só o dono.
    await saldoProva.carimbar(x, barbeiro, 3);
    const semLer = await saldoProva.usar(x, 100, barbeiro, { lojaId: 3, semLeitura: true });
    assert.equal(semLer.status, 403);
    assert.equal((await semLer.json()).erro, 'saldo_so_com_cartao');
    assert.equal((await saldoProva.usar(x, 100, dono, { semLeitura: true })).status, 200);
    // Lido e com o corte de hoje: a equipa usa.
    const usado = await (await saldoProva.usar(x, 100, barbeiro, { lojaId: 3 })).json();
    // A chave de um uso anulado não o repete como feito.
    const chave = chaveNova();
    const comChave = await (await saldoProva.usar(x, 100, barbeiro, { lojaId: 3, chave })).json();
    assert.equal((await saldoProva.anularUso(comChave.usoFeito.movimentoId, barbeiro)).status, 204);
    const outraVez = await saldoProva.usar(x, 100, barbeiro, { lojaId: 3, chave });
    assert.equal(outraVez.status, 409);
    assert.equal((await outraVez.json()).erro, 'uso_anulado');
    // Um uso de ontem já não se anula ao balcão, nem pelo dono (acerta-se no backoffice).
    daBaseLocal(
      `UPDATE movimentos_de_saldo SET criado_em = criado_em - 86400 * 2 WHERE id = ${usado.usoFeito.movimentoId}`,
    );
    const ontem = await saldoProva.anularUso(usado.usoFeito.movimentoId, dono);
    assert.equal(ontem.status, 409);
    assert.equal((await ontem.json()).erro, 'uso_de_outro_dia');
    // «Carimbar na mesma»: a equipa, um a mais por dia (já tem um hoje: o segundo passa, o terceiro não).
    const y = await saldoProva.cliente('Cliente Cheio');
    await saldoProva.carimbar(y, barbeiro, 3);
    await saldoProva.carimbar(y, barbeiro, 3);
    const terceiro = await pedir('/api/balcao/carimbar', {
      method: 'POST',
      token: barbeiro,
      body: json({ codigo: y.codigo, chave: chaveNova(), lojaId: 3, confirmar: true }),
    });
    assert.equal(terceiro.status, 409);
    assert.equal((await terceiro.json()).erro, 'limite_do_dia_maximo');
    await saldoProva.carimbar(y, dono);
  },
);

await passo(
  'batota: o «Ocultar o meu email» da Apple não engana a regra do próprio cartão',
  async () => {
    const email = 'prova-saldo-barbeiro-escondido@gmail.com';
    const r = await pedir('/api/bo/equipa', {
      method: 'POST',
      token,
      body: json({
        nome: 'Barbeiro Escondido',
        email,
        papel: 'barbeiro',
        lojaId: 3,
        parceiroId: null,
      }),
    });
    assert.equal(r.status, 201);
    // Entra na for partners com a Apple (o «sub» fica com ele)…
    const e = await pedir('/api/balcao/entrar/teste', {
      method: 'POST',
      body: json({ email, tipo: 'apple', sujeito: 'apple-sub-barbeiro-escondido' }),
    });
    assert.equal(e.status, 200);
    const barbeiro = (await e.json()).sessao;
    // …e é cliente com a mesma Apple, mas com um email de retransmissão (outro email).
    const c = await entrarTeste(
      'apple',
      'apple-sub-barbeiro-escondido',
      'xyz123@privaterelay.appleid.com',
      { nome: 'Cliente Escondido' },
    );
    assert.equal(c.status, 200);
    const codigo = (await euDe((await c.json()).sessao)).eu.codigo;
    const proprio = await pedir('/api/balcao/carimbar', {
      method: 'POST',
      token: barbeiro,
      body: json({ codigo, chave: chaveNova(), lojaId: 3 }),
    });
    assert.equal(proprio.status, 403);
    assert.equal((await proprio.json()).erro, 'proprio_cartao');
  },
);

await passo(
  'batota: dois «Anular» ao mesmo tempo nos dois cortes do convidado tiram o prémio',
  async () => {
    const dono = await entrarNaBalcao('dono.prova@gmail.com');
    const a = await saldoProva.cliente('Padrinho Corrida Anular');
    const b = await saldoProva.cliente('Convidado Corrida Anular');
    assert.equal((await saldoProva.aceitar(b, await saldoProva.codigo(a))).status, 200);
    const s1 = await saldoProva.carimbar(b, dono);
    const s2 = await saldoProva.carimbar(b, dono);
    assert.equal(await saldoProva.saldo(a), 100);
    const dois = await Promise.all([
      saldoProva.anularCarimbo(s1, dono),
      saldoProva.anularCarimbo(s2, dono),
    ]);
    assert.deepEqual(
      dois.map((x) => x.status),
      [204, 204],
    );
    assert.equal(await saldoProva.saldo(a), 0, 'sem cortes válidos, sem prémio');
    assert.equal((await saldoProva.carteira(a)).convites.visitaram, 0);
    // A visita de um amigo só com o dia (a carteira de quem convida não sabe a hora).
    await saldoProva.carimbar(b, dono);
    const ca = await saldoProva.carteira(a);
    const v = ca.convites.lista[0].visitouEm;
    assert.ok([0, 23].includes(new Date(v * 1000).getUTCHours()), 'à meia-noite de Lisboa');
    assert.equal(ca.movimentos.find((m) => m.tipo === 'convite' && !m.anulado).criadoEm, v);
  },
);

await passo('saldo: as contas batem — as regras do dinheiro em toda a base', async () => {
  const uma = (sql) => daBaseLocal(sql)[0].n;
  // A visita do convite aponta para um corte válido do próprio convidado; sem visita, nada aponta.
  assert.equal(
    uma(`SELECT count(*) AS n FROM convites v LEFT JOIN carimbos x ON x.id = v.carimbo_id
         WHERE v.visitou_em IS NOT NULL AND (x.id IS NULL OR x.anulado_em IS NOT NULL OR x.cliente_id != v.convidado_id)`),
    0,
    'visitas com um corte que não vale',
  );
  assert.equal(
    uma('SELECT count(*) AS n FROM convites WHERE visitou_em IS NULL AND carimbo_id IS NOT NULL'),
    0,
  );
  // O prémio de quem convidou: no máximo um activo, só com a visita feita, com o valor do convite.
  assert.equal(
    uma(`SELECT count(*) AS n FROM (SELECT convite_id FROM movimentos_de_saldo
         WHERE tipo = 'convite' AND anulado_em IS NULL GROUP BY convite_id HAVING count(*) > 1)`),
    0,
    'dois prémios activos no mesmo convite',
  );
  assert.equal(
    uma(`SELECT count(*) AS n FROM movimentos_de_saldo m JOIN convites v ON v.id = m.convite_id
         WHERE m.tipo = 'convite' AND m.anulado_em IS NULL
           AND (v.visitou_em IS NULL OR m.cliente_id != v.padrinho_id OR m.valor != v.premio_padrinho)`),
    0,
    'prémios sem visita, ou na pessoa errada, ou com outro valor',
  );
  // As boas-vindas: uma por convite, ao convidado, com o valor do convite.
  assert.equal(
    uma(`SELECT count(*) AS n FROM (SELECT convite_id FROM movimentos_de_saldo
         WHERE tipo = 'convidado' GROUP BY convite_id HAVING count(*) > 1)`),
    0,
  );
  assert.equal(
    uma(`SELECT count(*) AS n FROM movimentos_de_saldo m JOIN convites v ON v.id = m.convite_id
         WHERE m.tipo = 'convidado' AND (m.cliente_id != v.convidado_id OR m.valor != v.premio_convidado)`),
    0,
  );
  // Os sinais: entra nos prémios, sai nos usos; nunca zero.
  assert.equal(
    uma(`SELECT count(*) AS n FROM movimentos_de_saldo WHERE valor = 0
         OR (tipo IN ('convite', 'convidado') AND valor < 0) OR (tipo = 'uso' AND valor > 0)`),
    0,
  );
  // Ninguém fica negativo, a não ser por um prémio tirado depois de gasto.
  assert.equal(
    uma(`SELECT count(*) AS n FROM (SELECT cliente_id, sum(valor) AS s FROM movimentos_de_saldo
         WHERE anulado_em IS NULL GROUP BY cliente_id HAVING s < 0) n
         WHERE NOT EXISTS (SELECT 1 FROM movimentos_de_saldo m WHERE m.cliente_id = n.cliente_id
                           AND m.tipo = 'convite' AND m.anulado_em IS NOT NULL)`),
    0,
    'saldo negativo sem prémio tirado',
  );
  // Ninguém convida quem o convidou, nem a si mesmo.
  assert.equal(
    uma(`SELECT count(*) AS n FROM convites a JOIN convites b
         ON a.padrinho_id = b.convidado_id AND a.convidado_id = b.padrinho_id`),
    0,
  );
});

// Os convites voltam a ficar como nascem: desligados.
await saldoProva.convites({ ligado: false, valorPadrinho: 100, valorConvidado: 100, limite: 10 });

await passo('sair termina a sessão', async () => {
  assert.equal((await pedir('/api/bo/sair', { method: 'POST', token })).status, 204);
  assert.equal((await pedir('/api/bo/eu', { token })).status, 401);
});

console.log(`\n${passos} passos certos${process.exitCode ? ', com falhas acima' : ''}.`);
