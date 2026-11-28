import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { garantirClasse } from './google.ts';
import { avisosDaFila, refrescarPasses, tocarPasse, type AvisoDoPasse } from './servico.ts';

// Cada aviso deixa uma linha nos registos do Worker: aqui seriam centenas.
console.log = () => {};

/** O D1 de faz de conta: um SQLite em memória com as migrações, e o pouco do D1 que o serviço usa. */
function baseDeProva() {
  const sqlite = new DatabaseSync(':memory:');
  // A 0013 lê a tabela das migrações do D1 (vazia: não mexe em nada).
  sqlite.exec('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)');
  const pasta = new URL('../../../../base/migracoes/', import.meta.url);
  for (const f of readdirSync(pasta)
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync(new URL(f, pasta), 'utf8'));
  type Instrucao = ReturnType<typeof instrucao>;
  const instrucao = (sql: string, args: (string | number | null)[] = []) => {
    const i = {
      bind: (...a: (string | number | null)[]) => instrucao(sql, a),
      first: async () => sqlite.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: sqlite.prepare(sql).all(...args), meta: {} }),
      run: async () => ({
        results: [],
        meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) },
      }),
      correr: () => (/^\s*(SELECT|WITH)\b/i.test(sql) ? i.all() : i.run()),
    };
    return i;
  };
  const db = {
    prepare: (sql: string) => instrucao(sql),
    batch: async (instrucoes: Instrucao[]) => {
      const r = [];
      for (const i of instrucoes) r.push(await i.correr());
      return r;
    },
  };
  const n = (sql: string) => Number((sqlite.prepare(sql).get() as { n: number }).n);
  return { sqlite, db, n };
}

/** Clientes com passe: os primeiros `apple` com um iPhone registado (o 1.º com dois), os últimos `google` na Google. */
function semear(sqlite: DatabaseSync, { apple, google }: { apple: number; google: number }) {
  for (let i = 1; i <= apple + google; i++) {
    sqlite
      .prepare('INSERT INTO clientes (id, codigo, nome) VALUES (?, ?, ?)')
      .run(i, `C${String(i).padStart(7, '0')}`, `Cliente ${i}`);
    sqlite
      .prepare(
        'INSERT INTO passes (cliente_id, serie, actualizado_em, google_em) VALUES (?, ?, 1000, ?)',
      )
      .run(i, serie(i), i > apple ? 1000 : null);
    if (i <= apple)
      sqlite
        .prepare('INSERT INTO registos_apple (aparelho, serie, push_token) VALUES (?, ?, ?)')
        .run(`aparelho-${i}`, serie(i), token(i));
  }
  if (apple)
    sqlite
      .prepare('INSERT INTO registos_apple (aparelho, serie, push_token) VALUES (?, ?, ?)')
      .run('ipad-1', serie(1), token(9999));
}
const serie = (i: number) => `serie-${String(i).padStart(6, '0')}`;
const token = (i: number) => i.toString(16).padStart(64, '0');

const pem = (der: ArrayBuffer) =>
  `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64')}\n-----END PRIVATE KEY-----`;
const ec = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const rsa = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign'],
);
const EMISSOR = '3388000000000000000';
/** As chaves são de faz de conta, feitas aqui: nada sai para a Apple nem para a Google. */
const ENV = {
  APPLE_CERTIFICADO: 'c',
  APPLE_CHAVE: 'c',
  APPLE_CADEIA: 'c',
  WALLET_SEGREDO: 'segredo-de-prova',
  APNS_CHAVE: pem(await crypto.subtle.exportKey('pkcs8', ec.privateKey)),
  APNS_KID: 'ABCDE12345',
  APPLE_EQUIPA: '6M2QCLR98V',
  APPLE_PASS_TIPO: 'pass.pt.nunoslab.cartao',
  GOOGLE_WALLET_CONTA: JSON.stringify({
    client_email: 'prova@exemplo.iam.gserviceaccount.com',
    private_key: pem(await crypto.subtle.exportKey('pkcs8', rsa.privateKey)),
  }),
  GOOGLE_WALLET_EMISSOR: EMISSOR,
  ORIGENS: 'https://app.exemplo',
  ORIGEM_DA_API: 'https://api.exemplo',
};

type Pedido = { metodo: string; url: string; corpo: string; autorizacao: string };

/**
 * A Apple e a Google de faz de conta (o fetch de todos os pedidos): cada pedido demora um
 * bocadinho, para se ver quantos vão ao mesmo tempo.
 */
function internetDeProva({
  apns = (_token: string, _bilhete: string) => 200,
  classeActual = {} as object,
  objetoExiste = (_id: string) => true,
} = {}) {
  const pedidos: Pedido[] = [];
  let emCurso = 0;
  let maximo = 0;
  globalThis.fetch = (async (entrada: string | URL | Request, init: RequestInit = {}) => {
    const url = String(entrada);
    const metodo = init.method ?? 'GET';
    const autorizacao = new Headers(init.headers).get('authorization') ?? '';
    pedidos.push({ metodo, url, corpo: String(init.body ?? ''), autorizacao });
    maximo = Math.max(maximo, ++emCurso);
    try {
      await new Promise((r) => setTimeout(r, 5));
      const apple = url.match(/^https:\/\/api\.push\.apple\.com\/3\/device\/(\w+)$/);
      if (apple) {
        const estado = apns(apple[1]!, autorizacao.replace(/^bearer /, ''));
        const motivo = { 403: 'ExpiredProviderToken', 410: 'Unregistered', 429: 'TooManyRequests' };
        return estado === 200
          ? new Response(null, { status: 200 })
          : Response.json({ reason: motivo[estado as keyof typeof motivo] }, { status: estado });
      }
      if (url === 'https://oauth2.googleapis.com/token')
        return Response.json({ access_token: 'token-de-prova' });
      const g = url.match(/^https:\/\/walletobjects\.googleapis\.com\/walletobjects\/v1\/(.+)$/);
      if (g) {
        const [tipo, id] = g[1]!.split('/').map(decodeURIComponent);
        if (tipo === 'loyaltyClass' && id && metodo === 'GET') return Response.json(classeActual);
        if (tipo === 'loyaltyObject' && id && metodo === 'PUT' && !objetoExiste(id))
          return Response.json({ error: { message: 'not found' } }, { status: 404 });
        return Response.json({});
      }
      throw new Error(`Um pedido fora da prova: ${metodo} ${url}`);
    } finally {
      emCurso--;
    }
  }) as typeof fetch;
  const contar = (metodo: string, comeco: string) =>
    pedidos.filter((p) => p.metodo === metodo && p.url.startsWith(comeco)).length;
  return { pedidos, maximo: () => maximo, contar };
}
const APNS = 'https://api.push.apple.com/3/device/';
const CLASSE = 'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass';
const OBJETO = 'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject';
const TOKEN = 'https://oauth2.googleapis.com/token';

/** A fila de faz de conta: guarda o que se envia. */
function filaDeProva() {
  const envios: { body: AvisoDoPasse }[][] = [];
  return { envios, sendBatch: async (m: { body: AvisoDoPasse }[]) => void envios.push(m) };
}

/** Um lote da fila com estes avisos; `estado` diz o que ficou de cada um. */
function loteDeProva(avisos: AvisoDoPasse[]) {
  const estado = new Map<AvisoDoPasse, string>();
  const messages = avisos.map((body, i) => ({
    id: String(i),
    timestamp: new Date(),
    attempts: 1,
    body,
    ack: () => void estado.set(body, 'feito'),
    retry: () => void estado.set(body, 'outra vez'),
  }));
  const lote = { queue: 'nunos-lab-passes', messages, ackAll() {}, retryAll() {} };
  return { lote: lote as unknown as MessageBatch<AvisoDoPasse>, estado };
}

test('refrescarPasses só põe na fila: uma mensagem por série e por cartão da Google, 100 por envio', async () => {
  const { sqlite, db, n } = baseDeProva();
  semear(sqlite, { apple: 150, google: 9 });
  const internet = internetDeProva();
  const fila = filaDeProva();
  const feito = await refrescarPasses({ ...ENV, DB: db, PASSES: fila } as unknown as Env);
  assert.deepEqual(feito, { apple: 150, google: 9 });
  assert.deepEqual(
    fila.envios.map((e) => e.length),
    [100, 59],
  );
  assert.deepEqual(fila.envios[0]![0]!.body, { apple: serie(1) });
  assert.deepEqual(fila.envios[1]![58]!.body, { google: 159 });
  assert.equal(internet.pedidos.length, 0, 'nada sai para a Apple nem para a Google no pedido');
  assert.equal(n('SELECT count(*) AS n FROM passes WHERE actualizado_em > 1000'), 159);
});

test('um lote: os iPhones 6 de cada vez com um bilhete, a Google com um token e uma classe só', async () => {
  const { sqlite, db, n } = baseDeProva();
  semear(sqlite, { apple: 80, google: 9 });
  // O 2.º iPhone já não existe (410) e a APNs pede para repetir o 3.º (429).
  const internet = internetDeProva({
    apns: (t) => (t === token(2) ? 410 : t === token(3) ? 429 : 200),
    classeActual: { id: `${EMISSOR}.nunoslab-cartao`, reviewStatus: 'APPROVED' },
    objetoExiste: (id) => !id.endsWith(serie(89)),
  });
  const avisos: AvisoDoPasse[] = [
    ...Array.from({ length: 80 }, (_, i) => ({ apple: serie(i + 1) })),
    ...Array.from({ length: 9 }, (_, i) => ({ google: 81 + i })),
  ];
  const { lote, estado } = loteDeProva(avisos);
  await avisosDaFila(lote, { ...ENV, DB: db } as unknown as Env);

  // A Apple: 81 aparelhos (o 1.º passe tem dois), ao mesmo tempo mas nunca mais de 6, e um bilhete só.
  assert.equal(internet.contar('POST', APNS), 81);
  assert.equal(internet.maximo(), 6);
  assert.equal(
    new Set(internet.pedidos.filter((p) => p.url.startsWith(APNS)).map((p) => p.autorizacao)).size,
    1,
  );
  assert.equal(n(`SELECT count(*) AS n FROM registos_apple WHERE aparelho = 'aparelho-2'`), 0);
  assert.equal(n('SELECT count(*) AS n FROM registos_apple'), 80);

  // A Google: um token e uma leitura da classe para os 9; o PATCH leva o UNDER_REVIEW.
  assert.equal(internet.contar('POST', TOKEN), 1);
  assert.equal(internet.contar('GET', CLASSE), 1);
  const patch = internet.pedidos.filter((p) => p.metodo === 'PATCH' && p.url.startsWith(CLASSE));
  assert.equal(patch.length, 1);
  const corpo = JSON.parse(patch[0]!.corpo);
  assert.equal(corpo.reviewStatus, 'UNDER_REVIEW');
  assert.equal(corpo.localizedProgramName.translatedValues[0].language, 'en');
  assert.equal(corpo.homepageUri.uri, 'https://app.exemplo/nunos-lab');
  assert.ok(corpo.homepageUri.localizedDescription);
  // Um PUT por cartão; o que ainda não existia na Google cria-se (POST).
  assert.equal(internet.contar('PUT', OBJETO), 9);
  assert.equal(internet.contar('POST', OBJETO), 1);
  assert.equal(internet.contar('GET', OBJETO), 0);

  // Só o passe do 429 volta à fila.
  assert.deepEqual(
    avisos.filter((a) => estado.get(a) === 'outra vez'),
    [{ apple: serie(3) }],
  );
  assert.equal([...estado.values()].filter((e) => e === 'feito').length, 88);
});

test('o bilhete recusado a meio: só um pede outro, e todos os iPhones recebem o toque', async () => {
  const { sqlite, db, n } = baseDeProva();
  semear(sqlite, { apple: 20, google: 0 });
  // Um bilhete guardado que a Apple já não aceita.
  sqlite
    .prepare("INSERT INTO bilhetes (nome, valor, criado_em) VALUES ('apns', 'velho', unixepoch())")
    .run();
  const internet = internetDeProva({ apns: (_t, b) => (b === 'velho' ? 403 : 200) });
  const { lote, estado } = loteDeProva(
    Array.from({ length: 20 }, (_, i) => ({ apple: serie(i + 1) })),
  );
  await avisosDaFila(lote, { ...ENV, DB: db } as unknown as Env);
  const usados = internet.pedidos.filter((p) => p.url.startsWith(APNS)).map((p) => p.autorizacao);
  assert.equal(new Set(usados).size, 2, 'o velho e um novo');
  // 6 tentaram com o velho ao mesmo tempo; os 21 aparelhos acabaram com o novo.
  assert.equal(usados.filter((u) => u !== 'bearer velho').length, 21);
  assert.equal(n(`SELECT count(*) AS n FROM bilhetes WHERE valor != 'velho'`), 1);
  assert.equal([...estado.values()].filter((e) => e === 'feito').length, 20);
});

test('a classe já com as duas línguas não se muda; a do «wrangler dev» (http) nem se lê', async () => {
  const internet = internetDeProva({
    classeActual: {
      localizedProgramName: { defaultValue: { language: 'pt-PT', value: 'x' } },
      homepageUri: { uri: 'https://app.exemplo/nunos-lab', localizedDescription: {} },
    },
  });
  await garantirClasse('t', EMISSOR, 'https://app.exemplo/nunos-lab');
  assert.deepEqual(
    internet.pedidos.map((p) => p.metodo),
    ['GET'],
  );
  await garantirClasse('t', EMISSOR, 'http://localhost:8872/nunos-lab');
  assert.equal(internet.pedidos.length, 1);
});

test('um carimbo: a Google só para quem guardou o cartão lá, e sem ler a classe', async () => {
  const { sqlite, db } = baseDeProva();
  semear(sqlite, { apple: 1, google: 1 });
  const internet = internetDeProva();
  const esperas: Promise<unknown>[] = [];
  const c = {
    env: { ...ENV, DB: db },
    executionCtx: { waitUntil: (p: Promise<unknown>) => esperas.push(p) },
  };
  tocarPasse(c as never, 1);
  await Promise.all(esperas);
  assert.deepEqual(
    internet.pedidos.map((p) => p.metodo + ' ' + p.url.split('/').slice(0, 3).join('/')),
    ['POST https://api.push.apple.com', 'POST https://api.push.apple.com'],
  );
  tocarPasse(c as never, 2);
  await Promise.all(esperas);
  assert.equal(internet.contar('POST', TOKEN), 1);
  assert.equal(internet.contar('PUT', OBJETO), 1);
  assert.equal(internet.contar('GET', CLASSE), 0);
});
