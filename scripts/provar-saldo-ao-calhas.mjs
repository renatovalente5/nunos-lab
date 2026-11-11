#!/usr/bin/env node
/**
 * O saldo e os convites ao calhas (o Renato, 11 nov 2026: «é dinheiro: imagina todos os casos e garante
 * que não há falhas»). Centenas de passos ao acaso contra a API local: aceitar convites, carimbar, anular
 * carimbos (na for partners e no backoffice), usar e anular o saldo, acertos, mudar as definições, apagar
 * contas, e pedidos ao mesmo tempo. Ao lado corre um modelo das regras: cada resposta tem de ser a que o
 * modelo prevê; depois de cada passo, a carteira de cada cliente tocado tem de ser a do modelo, e de 40
 * em 40 passos (e no fim) também a ficha da for partners, o backoffice e o «eu». No fim, as regras do
 * dinheiro em toda a base. As travas por minuto contornam-se com vários donos e um endereço por aceite.
 *
 * Precisa da API local (npm run dev --prefix apps/api) e da prova corrida antes (scripts/provar-api.mjs:
 * as barbearias e o acesso ao backoffice). Os clientes desta prova chamam-se «Calhas …».
 *
 *   node scripts/provar-saldo-ao-calhas.mjs [semente] [passos]
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API ?? 'http://localhost:8870';
const APP = 'http://localhost:8872';
const semente = Number(process.argv[2] ?? Date.now() % 1e9);
const PASSOS = Number(process.argv[3] ?? 300);
const json = (o) => JSON.stringify(o);

// ——— o acaso, repetível pela semente ———
let estado = semente >>> 0;
function acaso() {
  estado = (estado + 0x6d2b79f5) >>> 0;
  let t = estado;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const umDe = (lista) => lista[Math.floor(acaso() * lista.length)];
const chaveNova = () =>
  `calhas${Math.floor(acaso() * 1e12).toString(36)}${Date.now().toString(36)}`;

// Cada pedido de convite com um endereço seu: a trava de 30 por minuto é por endereço.
let enderecos = 0;
const pedir = (caminho, { token, ip, ...o } = {}) =>
  fetch(API + caminho, {
    ...o,
    headers: {
      Origin: APP,
      ...(o.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(ip ? { 'CF-Connecting-IP': ip } : {}),
    },
  });
const ipNovo = () => {
  enderecos += 1;
  return `10.${(enderecos >> 16) & 255}.${(enderecos >> 8) & 255}.${enderecos & 255}`;
};
const daBase = (sql) =>
  JSON.parse(
    execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'nunos-lab', '--local', '--json', '--command', sql],
      {
        cwd: join(raiz, 'apps/api'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ),
  )[0].results;

// ——— as portas ———
execFileSync(
  'node',
  ['scripts/acesso.mjs', '--nome', 'Teste local', '--email', 'teste.local@exemplo.pt'],
  {
    cwd: raiz,
    encoding: 'utf8',
  },
);
const bo = await pedir('/api/bo/entrar/teste', {
  method: 'POST',
  body: json({ email: 'teste.local@exemplo.pt' }),
});
assert.equal(bo.status, 200, 'entrar no backoffice');
const token = (await bo.json()).sessao;
const loja = (await (await pedir('/api/bo/barbearia', { token })).json()).lojas[0].id;
// Doze donos: as travas da for partners são por sessão (60 carimbos e 20 usos do saldo por minuto), e o
// modelo faz num minuto o que um balcão faz num mês.
const donos = [];
for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
  const email = `dono${n}.calhas@exemplo.pt`;
  const novo = await pedir('/api/bo/equipa', {
    method: 'POST',
    token,
    body: json({ nome: `Dono Calhas ${n}`, email, papel: 'dono', lojaId: null, parceiroId: null }),
  });
  assert.ok([201, 409].includes(novo.status), `o dono ${n}: ${novo.status}`);
  const r = await pedir('/api/balcao/entrar/teste', { method: 'POST', body: json({ email }) });
  assert.equal(r.status, 200, `entrar como dono ${n}`);
  donos.push((await r.json()).sessao);
}
let vez = 0;
const dono = () => donos[vez++ % donos.length];

// ——— o modelo ———
/** As definições de antes da prova (repõem-se no fim), e as desta prova: ligados, limite 3. */
const definicoesDeAntes = (await (await pedir('/api/bo/programa', { token })).json()).convites;
let definicoes = { ligado: true, valorPadrinho: 100, valorConvidado: 100, limite: 3 };
{
  const p = await (await pedir('/api/bo/programa', { token })).json();
  const r = await pedir('/api/bo/programa', {
    method: 'PUT',
    token,
    body: json({ ...p, convites: definicoes }),
  });
  assert.equal(r.status, 200, 'ligar os convites para a prova');
}
const clientes = [];
const corrida = Date.now().toString(36);

async function clienteNovo() {
  const n = clientes.length;
  const nome = `Calhas ${corrida} ${n}`;
  const sujeito = `calhas-${corrida}-${n}`;
  const r = await pedir('/api/eu/entrar/teste', {
    method: 'POST',
    body: json({ tipo: 'google', sujeito, email: `${sujeito}@gmail.com`, nome }),
  });
  assert.equal(r.status, 200, `entrar como ${nome}`);
  const sessao = (await r.json()).sessao;
  const eu = await (await pedir('/api/eu', { token: sessao })).json();
  const lista = await (
    await pedir(`/api/bo/clientes?q=${encodeURIComponent(nome)}`, { token })
  ).json();
  const k = {
    n,
    nome,
    sessao,
    codigo: eu.codigo,
    id: lista.find((x) => x.nome === nome).id,
    codigoDoConvite: null,
    apagado: false,
    carimbos: [],
    /** O convite que aceitou: de quem, os prémios do dia, e o carimbo que foi a visita. */
    convite: null,
    movimentos: [],
  };
  clientes.push(k);
  return k;
}
const saldo = (k) => k.movimentos.filter((m) => !m.anulado).reduce((s, m) => s + m.valor, 0);
const validos = (k) => k.carimbos.filter((x) => x.valido);
const convidadosDe = (j) => clientes.filter((k) => k.convite?.padrinho === j.n);
const premioActivo = (j, convidado) =>
  j.movimentos.find((m) => m.tipo === 'convite' && m.convidado === convidado.n && !m.anulado);

// ——— conferir a API contra o modelo ———
const conferidos = { carteira: 0, ficha: 0, backoffice: 0 };
async function conferir(k, tudo = false) {
  if (k.apagado) return;
  const c = await (await pedir('/api/eu/carteira', { token: k.sessao })).json();
  const onde = `${k.nome} (passo ${passo})`;
  assert.equal(c.saldo, saldo(k), `saldo na carteira de ${onde}`);
  const daApi = c.movimentos.map((m) => `${m.tipo}:${m.valor}:${m.anulado}`).sort();
  const doModelo = k.movimentos.map((m) => `${m.tipo}:${m.valor}:${m.anulado}`).sort();
  assert.deepEqual(daApi, doModelo, `movimentos de ${onde}`);
  const meus = convidadosDe(k);
  assert.equal(c.convites.aceites, meus.length, `convites aceites de ${onde}`);
  assert.equal(
    c.convites.visitaram,
    meus.filter((x) => x.convite.carimboId !== null).length,
    `convidados que foram, de ${onde}`,
  );
  assert.equal(c.convidadoPor !== null, k.convite !== null, `convidado por, de ${onde}`);
  conferidos.carteira += 1;
  if (!tudo) return;
  const f = await (await pedir(`/api/balcao/ficha/${k.codigo}`, { token: dono() })).json();
  assert.equal(f.saldo.valor, saldo(k), `saldo na for partners de ${onde}`);
  conferidos.ficha += 1;
  const b = await (await pedir(`/api/bo/clientes/${k.id}`, { token })).json();
  assert.equal(b.saldo.valor, saldo(k), `saldo no backoffice de ${onde}`);
  const eu = await (await pedir('/api/eu', { token: k.sessao })).json();
  assert.equal(eu.saldo.saldo, saldo(k), `saldo no «eu» de ${onde}`);
  conferidos.backoffice += 1;
}

async function codigoDoConvite(k) {
  if (k.codigoDoConvite) return k.codigoDoConvite;
  if (!definicoes.ligado || k.apagado) return null;
  const c = await (await pedir('/api/eu/carteira', { token: k.sessao })).json();
  k.codigoDoConvite = c.convites.codigo;
  return k.codigoDoConvite;
}

/** O que a API deve responder a «k aceita o código de j», pela ordem das recusas dela. */
function previsaoDoAceite(k, j) {
  if (!definicoes.ligado) return [409, 'convites_desligados'];
  if (j.apagado) return [404, 'convite_desconhecido'];
  if (k.n === j.n) return [409, 'convite_proprio'];
  if (k.convite) return [409, 'ja_convidado'];
  // Algum carimbo, mesmo anulado: o código é só para quem nunca teve nenhum.
  if (k.carimbos.length > 0) return [409, 'ja_cortou'];
  if (j.convite?.padrinho === k.n) return [409, 'convite_reciproco'];
  if (j.id > k.id) return [409, 'convite_mais_recente'];
  if (definicoes.limite !== null && convidadosDe(j).length >= definicoes.limite)
    return [409, 'convites_esgotados'];
  return [200, null];
}
function aceitou(k, j) {
  k.convite = {
    padrinho: j.n,
    premioPadrinho: definicoes.valorPadrinho,
    premioConvidado: definicoes.valorConvidado,
    carimboId: null,
  };
  if (definicoes.valorConvidado > 0)
    k.movimentos.push({ tipo: 'convidado', valor: definicoes.valorConvidado, anulado: false });
}

/** O carimbo no modelo: o primeiro válido de quem foi convidado é a visita, e dá o prémio. */
function carimbou(k, id) {
  k.carimbos.push({ id, valido: true });
  const v = k.convite;
  if (!v || v.carimboId !== null || validos(k).length !== 1) return;
  v.carimboId = id;
  const j = clientes[v.padrinho];
  if (v.premioPadrinho > 0 && !j.apagado && !premioActivo(j, k))
    j.movimentos.push({ tipo: 'convite', valor: v.premioPadrinho, convidado: k.n, anulado: false });
}
/** Anular: o convite passa para o carimbo válido mais antigo; sem nenhum, o prémio sai. */
function anulou(k, id) {
  k.carimbos.find((x) => x.id === id).valido = false;
  const v = k.convite;
  if (!v || v.carimboId !== id) return;
  const outro = validos(k).sort((a, b) => a.id - b.id)[0];
  if (outro) {
    v.carimboId = outro.id;
    return;
  }
  v.carimboId = null;
  const premio = premioActivo(clientes[v.padrinho], k);
  if (premio) premio.anulado = true;
}

async function esperarStatus(r, esperado, erro, o) {
  const corpo = await r.text();
  assert.equal(r.status, esperado, `${o} (passo ${passo}): ${r.status} ${corpo.slice(0, 160)}`);
  if (erro) assert.equal(JSON.parse(corpo).erro, erro, `${o}: o erro`);
  return corpo ? JSON.parse(corpo) : null;
}

// ——— os passos ———
const feitos = {};
const conta = (nome) => (feitos[nome] = (feitos[nome] ?? 0) + 1);
const vivos = () => clientes.filter((k) => !k.apagado);

const accoes = [
  // Um cliente novo (ainda sem cortes): quem aceita convites.
  [8, async () => [await clienteNovo()]],
  // Aceitar o código de outro (às vezes o próprio, um apagado, o de quem convidou…).
  [
    22,
    async () => {
      const k = umDe(vivos());
      // Quase sempre o código de quem chegou antes (o caso normal); às vezes o de qualquer um.
      const antes = clientes.filter((x) => x.id < k.id);
      const j = acaso() < 0.08 ? k : acaso() < 0.75 && antes.length ? umDe(antes) : umDe(clientes);
      const codigo = await codigoDoConvite(j);
      if (!codigo) return [];
      const [status, erro] = previsaoDoAceite(k, j);
      const forma = umDe([
        codigo,
        `${codigo.slice(0, 4)} ${codigo.slice(4)}`.toLowerCase(),
        `https://renatovalente5.github.io/nunos-lab/?convite=${codigo}&fbclid=x`,
      ]);
      const r = await pedir('/api/eu/convite', {
        method: 'POST',
        token: k.sessao,
        ip: ipNovo(),
        body: json({ codigo: forma }),
      });
      await esperarStatus(r, status, erro, `${k.nome} aceita o código de ${j.nome}`);
      if (status === 200) aceitou(k, j);
      conta(status === 200 ? 'aceite' : `recusa:${erro}`);
      return [k, j];
    },
  ],
  // Carimbar (até 8 válidos: o cartão não completa nesta prova).
  [
    22,
    async () => {
      const k = umDe(vivos());
      if (validos(k).length >= 8) return [];
      const r = await pedir('/api/balcao/carimbar', {
        method: 'POST',
        token: dono(),
        body: json({ codigo: k.codigo, chave: chaveNova(), lojaId: loja, confirmar: true }),
      });
      const { carimboId } = await esperarStatus(r, 200, null, `carimbar ${k.nome}`);
      carimbou(k, carimboId);
      conta('carimbo');
      return [k, k.convite ? clientes[k.convite.padrinho] : null];
    },
  ],
  // Anular um carimbo válido (na for partners ou no backoffice).
  [
    10,
    async () => {
      const k = umDe(vivos().filter((x) => validos(x).length));
      if (!k) return [];
      const x = umDe(validos(k));
      const noBackoffice = acaso() < 0.4;
      const r = noBackoffice
        ? await pedir(`/api/bo/carimbos/${x.id}/anular`, { method: 'POST', token })
        : await pedir('/api/balcao/anular', {
            method: 'POST',
            token: dono(),
            body: json({ carimboId: x.id }),
          });
      await esperarStatus(
        r,
        noBackoffice ? 200 : 204,
        null,
        `anular o carimbo ${x.id} de ${k.nome}`,
      );
      anulou(k, x.id);
      conta('carimbo anulado');
      return [k, k.convite ? clientes[k.convite.padrinho] : null];
    },
  ],
  // Usar o saldo ao balcão (às vezes mais do que há; às vezes a mesma chave outra vez).
  [
    16,
    async () => {
      const k = umDe(vivos());
      const valor = umDe([100, 100, 200, 300, 50]);
      const chave = chaveNova();
      // Só depois de um corte (as boas-vindas usam-se com o primeiro), e só até ao saldo.
      const cortou = validos(k).length > 0;
      const pode = cortou && saldo(k) >= valor;
      const r = await pedir('/api/balcao/usar-saldo', {
        method: 'POST',
        token: dono(),
        body: json({ codigo: k.codigo, valor, chave, lojaId: loja }),
      });
      const f = await esperarStatus(
        r,
        pode ? 200 : 409,
        pode ? null : cortou ? 'saldo_insuficiente' : 'saldo_antes_do_corte',
        `usar ${valor} de ${k.nome} (saldo ${saldo(k)})`,
      );
      if (pode) {
        k.movimentos.push({
          tipo: 'uso',
          valor: -valor,
          anulado: false,
          id: f.saldo.usadoHoje.movimentoId,
        });
        if (acaso() < 0.3) {
          const outra = await pedir('/api/balcao/usar-saldo', {
            method: 'POST',
            token: dono(),
            body: json({ codigo: k.codigo, valor, chave, lojaId: loja }),
          });
          await esperarStatus(outra, 200, null, 'a mesma chave outra vez');
          conta('chave repetida');
        }
      }
      conta(pode ? 'uso' : cortou ? 'recusa:saldo_insuficiente' : 'recusa:saldo_antes_do_corte');
      return [k];
    },
  ],
  // Anular um uso (às vezes um já anulado).
  [
    8,
    async () => {
      const k = umDe(vivos().filter((x) => x.movimentos.some((m) => m.tipo === 'uso' && m.id)));
      if (!k) return [];
      const m = umDe(k.movimentos.filter((x) => x.tipo === 'uso' && x.id));
      const r = await pedir('/api/balcao/anular-saldo', {
        method: 'POST',
        token: dono(),
        body: json({ movimentoId: m.id }),
      });
      await esperarStatus(
        r,
        m.anulado ? 409 : 204,
        m.anulado ? 'uso_anulado' : null,
        `anular o uso ${m.id} de ${k.nome}`,
      );
      conta(m.anulado ? 'recusa:uso_anulado' : 'uso anulado');
      m.anulado = true;
      return [k];
    },
  ],
  // O Nuno acerta (dá ou tira, com cêntimos).
  [
    8,
    async () => {
      const k = umDe(clientes);
      const valor = umDe([-300, -150, -100, -50, 50, 100, 150, 250]);
      const status = k.apagado ? 404 : valor > 0 || saldo(k) + valor >= 0 ? 200 : 409;
      const r = await pedir(`/api/bo/clientes/${k.id}/saldo`, {
        method: 'POST',
        token,
        body: json({ valor, nota: `Calhas ${passo}` }),
      });
      await esperarStatus(r, status, null, `acertar ${valor} em ${k.nome} (saldo ${saldo(k)})`);
      if (status === 200) k.movimentos.push({ tipo: 'acerto', valor, anulado: false });
      conta(status === 200 ? 'acerto' : `acerto recusado ${status}`);
      return [k];
    },
  ],
  // O Nuno muda os convites: ligados ou não, os valores, o limite.
  [
    5,
    async () => {
      const p = await (await pedir('/api/bo/programa', { token })).json();
      const novos = {
        ligado: acaso() < 0.8,
        valorPadrinho: umDe([0, 100, 100, 150, 200]),
        valorConvidado: umDe([0, 100, 100, 250]),
        limite: umDe([null, 1, 2, 3, 5]),
      };
      const r = await pedir('/api/bo/programa', {
        method: 'PUT',
        token,
        body: json({ ...p, convites: novos }),
      });
      await esperarStatus(r, 200, null, 'mudar os convites');
      definicoes = novos;
      conta('definições');
      return [];
    },
  ],
  // Um cliente apaga a conta (raro).
  [
    2,
    async () => {
      const k = umDe(vivos());
      if (!k || vivos().length < 6) return [];
      const r = await pedir('/api/eu', { method: 'DELETE', token: k.sessao });
      await esperarStatus(r, 204, null, `${k.nome} apaga a conta`);
      k.apagado = true;
      conta('conta apagada');
      return [k.convite ? clientes[k.convite.padrinho] : null];
    },
  ],
  // Três usos ao mesmo tempo, com chaves diferentes: passam os que o saldo paga, nem mais um.
  [
    4,
    async () => {
      const k = umDe(vivos().filter((x) => saldo(x) >= 100 && validos(x).length > 0));
      if (!k) return [];
      const valor = 100;
      const r = await Promise.all(
        [0, 1, 2].map(() =>
          pedir('/api/balcao/usar-saldo', {
            method: 'POST',
            token: dono(),
            body: json({ codigo: k.codigo, valor, chave: chaveNova(), lojaId: loja }),
          }),
        ),
      );
      const passaram = r.filter((x) => x.status === 200).length;
      assert.equal(
        passaram,
        Math.min(3, Math.floor(saldo(k) / valor)),
        `usos ao mesmo tempo de ${k.nome} (saldo ${saldo(k)}, passo ${passo})`,
      );
      assert.ok(
        r.every((x) => [200, 409].includes(x.status)),
        `usos ao mesmo tempo: ${r.map((x) => x.status).join(', ')}`,
      );
      // Os ids dos usos novos, da carteira.
      const c = await (await pedir('/api/eu/carteira', { token: k.sessao })).json();
      const conhecidos = new Set(k.movimentos.map((m) => m.id).filter(Boolean));
      const novos = c.movimentos.filter((m) => m.tipo === 'uso' && !conhecidos.has(m.id));
      assert.equal(novos.length, passaram);
      for (const m of novos)
        k.movimentos.push({ tipo: 'uso', valor: -valor, anulado: false, id: m.id });
      conta('usos ao mesmo tempo');
      return [k];
    },
  ],
  // Dois ou três amigos novos a aceitar o mesmo código ao mesmo tempo (o limite conta-os um a um).
  [
    4,
    async () => {
      const j = umDe(vivos());
      const codigo = await codigoDoConvite(j);
      if (!codigo) return [];
      const novos = [];
      for (let i = 0; i < umDe([2, 3]); i++) novos.push(await clienteNovo());
      const r = await Promise.all(
        novos.map((k) =>
          pedir('/api/eu/convite', {
            method: 'POST',
            token: k.sessao,
            ip: ipNovo(),
            body: json({ codigo }),
          }),
        ),
      );
      const [status, erro] = previsaoDoAceite(novos[0], j);
      const lugares =
        status !== 200
          ? 0
          : definicoes.limite === null
            ? novos.length
            : Math.min(novos.length, definicoes.limite - convidadosDe(j).length);
      const passaram = r.filter((x) => x.status === 200).length;
      assert.equal(
        passaram,
        lugares,
        `aceites ao mesmo tempo no código de ${j.nome} (passo ${passo})`,
      );
      for (const [i, x] of r.entries()) {
        if (x.status === 200) aceitou(novos[i], j);
        else {
          const e = (await x.json()).erro;
          assert.ok(
            [erro, 'convites_esgotados'].includes(e),
            `recusa ao mesmo tempo: ${x.status} ${e}`,
          );
        }
      }
      conta('aceites ao mesmo tempo');
      return [j, ...novos];
    },
  ],
];
const pesoTotal = accoes.reduce((s, [p]) => s + p, 0);
function escolher() {
  let x = acaso() * pesoTotal;
  for (const [p, f] of accoes) {
    if ((x -= p) < 0) return f;
  }
  return accoes[0][1];
}

let passo = 0;
console.log(`semente ${semente}, ${PASSOS} passos`);
for (let i = 0; i < 8; i++) await clienteNovo();
for (passo = 1; passo <= PASSOS; passo++) {
  const tocados = await escolher()();
  for (const k of new Set(tocados.filter(Boolean))) await conferir(k);
  if (passo % 40 === 0) for (const k of clientes) await conferir(k, true);
}
for (const k of clientes) await conferir(k, true);

// ——— as regras do dinheiro em toda a base ———
const uma = (sql) => daBase(sql)[0].n;
const regras = {
  'visitas com um corte que não vale': `SELECT count(*) AS n FROM convites v LEFT JOIN carimbos x ON x.id = v.carimbo_id
     WHERE v.visitou_em IS NOT NULL AND (x.id IS NULL OR x.anulado_em IS NOT NULL OR x.cliente_id != v.convidado_id)`,
  'convites sem visita a apontar para um corte':
    'SELECT count(*) AS n FROM convites WHERE visitou_em IS NULL AND carimbo_id IS NOT NULL',
  'dois prémios activos no mesmo convite': `SELECT count(*) AS n FROM (SELECT convite_id FROM movimentos_de_saldo
     WHERE tipo = 'convite' AND anulado_em IS NULL GROUP BY convite_id HAVING count(*) > 1)`,
  'prémios sem visita, na pessoa errada ou com outro valor': `SELECT count(*) AS n FROM movimentos_de_saldo m JOIN convites v ON v.id = m.convite_id
     WHERE m.tipo = 'convite' AND m.anulado_em IS NULL
       AND (v.visitou_em IS NULL OR m.cliente_id != v.padrinho_id OR m.valor != v.premio_padrinho)`,
  'boas-vindas repetidas': `SELECT count(*) AS n FROM (SELECT convite_id FROM movimentos_de_saldo
     WHERE tipo = 'convidado' GROUP BY convite_id HAVING count(*) > 1)`,
  'boas-vindas na pessoa errada ou com outro valor': `SELECT count(*) AS n FROM movimentos_de_saldo m JOIN convites v ON v.id = m.convite_id
     WHERE m.tipo = 'convidado' AND (m.cliente_id != v.convidado_id OR m.valor != v.premio_convidado)`,
  'sinais trocados ou zeros': `SELECT count(*) AS n FROM movimentos_de_saldo WHERE valor = 0
     OR (tipo IN ('convite', 'convidado') AND valor < 0) OR (tipo = 'uso' AND valor > 0)`,
  'saldo negativo sem prémio tirado': `SELECT count(*) AS n FROM (SELECT cliente_id, sum(valor) AS s FROM movimentos_de_saldo
     WHERE anulado_em IS NULL GROUP BY cliente_id HAVING s < 0) n
     WHERE NOT EXISTS (SELECT 1 FROM movimentos_de_saldo m WHERE m.cliente_id = n.cliente_id
                       AND m.tipo = 'convite' AND m.anulado_em IS NOT NULL)`,
  'convites recíprocos': `SELECT count(*) AS n FROM convites a JOIN convites b
     ON a.padrinho_id = b.convidado_id AND a.convidado_id = b.padrinho_id`,
};
for (const [nome, sql] of Object.entries(regras)) assert.equal(uma(sql), 0, nome);

// ——— o modelo e a base, cliente a cliente ———
const naBase = daBase(
  `SELECT k.id, coalesce(sum(CASE WHEN m.anulado_em IS NULL THEN m.valor END), 0) AS saldo
   FROM clientes k LEFT JOIN movimentos_de_saldo m ON m.cliente_id = k.id
   WHERE k.id IN (${clientes.map((k) => k.id).join(',')}) GROUP BY k.id`,
);
for (const k of clientes)
  assert.equal(naBase.find((x) => x.id === k.id)?.saldo, saldo(k), `a base e o modelo: ${k.nome}`);

// As definições como estavam antes da prova.
const p = await (await pedir('/api/bo/programa', { token })).json();
await pedir('/api/bo/programa', {
  method: 'PUT',
  token,
  body: json({ ...p, convites: definicoesDeAntes }),
});
const negativos = clientes.filter((k) => !k.apagado && saldo(k) < 0).length;
console.log(
  `ok  ${PASSOS} passos certos (semente ${semente}): ${clientes.length} clientes, ${negativos} com saldo negativo;`,
  JSON.stringify(feitos),
  JSON.stringify(conferidos),
);
