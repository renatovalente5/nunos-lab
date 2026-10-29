/**
 * As rotas da Wallet: o serviço web da Apple (PassKit Web Service: registar
 * aparelhos, que passes mudaram, o passe, o registo), a ligação temporária
 * para descarregar o passe, e o «Guardar na Google Wallet».
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Ambiente, C } from '../ambiente.ts';
import { agora, corpo, recusar } from '../util.ts';
import { buffer } from './bytes.ts';
import { ligacaoParaGuardar } from './google.ts';
import { heroDoCartao, VERSAO_DO_DESENHO } from './grelha.ts';
import {
  appleLigada,
  assinarTexto,
  cartaoDaGoogle,
  cartaoParaOPasse,
  construirPkpass,
  contaDaGoogle,
  googleLigada,
  passeDoCliente,
  testemunhoDoPasse,
} from './servico.ts';

const SERIE = /^[A-Za-z0-9_-]{8,64}$/;
const APARELHO = /^[A-Za-z0-9_-]{8,128}$/;

async function servirPkpass(c: C, clienteId: number, actualizadoEm: number) {
  const desde = c.req.header('If-Modified-Since');
  if (
    desde &&
    !Number.isNaN(Date.parse(desde)) &&
    Math.floor(Date.parse(desde) / 1000) >= actualizadoEm
  )
    return c.body(null, 304);
  const cartao = await cartaoParaOPasse(c.env.DB, clienteId);
  if (!cartao) recusar(404, 'nao_existe');
  const bytes = await construirPkpass(c.env, cartao, new Date(actualizadoEm * 1000));
  return c.body(buffer(bytes), 200, {
    'Content-Type': 'application/vnd.apple.pkpass',
    'Content-Disposition': 'attachment; filename="nunoslab.pkpass"',
    'Last-Modified': new Date(actualizadoEm * 1000).toUTCString(),
    'Cache-Control': 'no-store',
  });
}

// ——— a app do cliente (com sessão) ———

export const rotasDaWalletDoCliente = new Hono<Ambiente>();

/** Uma ligação que vale 10 minutos para descarregar o passe (a sessão vai no cabeçalho, e um .pkpass abre-se por GET). */
rotasDaWalletDoCliente.post('/wallet/apple', async (c) => {
  if (!appleLigada(c.env)) recusar(404, 'nao_existe');
  const { id } = c.get('cliente');
  await passeDoCliente(c.env.DB, id);
  const ate = agora() + 600;
  const assinatura = await assinarTexto(c.env, `descarregar:${id}:${ate}`);
  return c.json({
    url: `${c.env.ORIGEM_DA_API}/api/wallet/apple/passe?c=${id}&a=${ate}&s=${assinatura}`,
  });
});

rotasDaWalletDoCliente.post('/wallet/google', async (c) => {
  if (!googleLigada(c.env)) recusar(404, 'nao_existe');
  const { id } = c.get('cliente');
  const db = c.env.DB;
  await passeDoCliente(db, id);
  const cartao = await cartaoParaOPasse(db, id);
  if (!cartao) recusar(404, 'nao_existe');
  const origens = c.env.ORIGENS.split(',').map((o) => o.trim());
  const url = await ligacaoParaGuardar(
    contaDaGoogle(c.env),
    c.env.GOOGLE_WALLET_EMISSOR,
    origens,
    cartaoDaGoogle(c.env, cartao),
  );
  // A partir daqui, cada mudança do cartão vai à Google.
  await db
    .prepare('UPDATE passes SET google_em = coalesce(google_em, unixepoch()) WHERE cliente_id = ?')
    .bind(id)
    .run();
  return c.json({ url });
});

// ——— público: o passe pela ligação temporária, e o serviço web da Apple ———

export const rotasDaWallet = new Hono<Ambiente>();

rotasDaWallet.get('/apple/passe', async (c) => {
  if (!appleLigada(c.env)) return c.body(null, 404);
  const id = Number(c.req.query('c'));
  const ate = Number(c.req.query('a'));
  const s = c.req.query('s') ?? '';
  if (!Number.isInteger(id) || !Number.isInteger(ate) || ate < agora())
    return c.text('A ligação caducou. Pede outra na app.', 410);
  if (s !== (await assinarTexto(c.env, `descarregar:${id}:${ate}`))) return c.body(null, 403);
  const passe = await c.env.DB.prepare('SELECT actualizado_em FROM passes WHERE cliente_id = ?')
    .bind(id)
    .first<{ actualizado_em: number }>();
  if (!passe) return c.body(null, 404);
  return servirPkpass(c, id, passe.actualizado_em);
});

/** A guarda do serviço web: «Authorization: ApplePass <testemunho>», o testemunho derivado da série. */
async function passeAutorizado(
  c: C,
  serie: string,
): Promise<{ cliente_id: number; actualizado_em: number }> {
  if (!SERIE.test(serie)) recusar(404, 'nao_existe');
  const cabecalho = c.req.header('Authorization') ?? '';
  const dado = cabecalho.startsWith('ApplePass ') ? cabecalho.slice(10).trim() : '';
  if (!dado || dado !== (await testemunhoDoPasse(c.env, serie))) recusar(401, 'sessao');
  const passe = await c.env.DB.prepare(
    'SELECT cliente_id, actualizado_em FROM passes WHERE serie = ?',
  )
    .bind(serie)
    .first<{ cliente_id: number; actualizado_em: number }>();
  if (!passe) recusar(404, 'nao_existe');
  return passe;
}

function tipoCerto(c: C, tipo: string) {
  if (tipo !== c.env.APPLE_PASS_TIPO) recusar(404, 'nao_existe');
}

rotasDaWallet.post('/apple/v1/devices/:aparelho/registrations/:tipo/:serie', async (c) => {
  tipoCerto(c, c.req.param('tipo'));
  const aparelho = c.req.param('aparelho');
  if (!APARELHO.test(aparelho)) recusar(404, 'nao_existe');
  const serie = c.req.param('serie');
  await passeAutorizado(c, serie);
  const { pushToken } = await corpo(
    c,
    z.object({ pushToken: z.string().regex(/^[0-9A-Fa-f]{16,256}$/) }),
  );
  const existe = await c.env.DB.prepare(
    'SELECT push_token FROM registos_apple WHERE aparelho = ? AND serie = ?',
  )
    .bind(aparelho, serie)
    .first<{ push_token: string }>();
  await c.env.DB.prepare(
    'INSERT INTO registos_apple (aparelho, serie, push_token) VALUES (?, ?, ?) ON CONFLICT (aparelho, serie) DO UPDATE SET push_token = excluded.push_token',
  )
    .bind(aparelho, serie, pushToken)
    .run();
  return c.body(null, existe ? 200 : 201);
});

rotasDaWallet.delete('/apple/v1/devices/:aparelho/registrations/:tipo/:serie', async (c) => {
  tipoCerto(c, c.req.param('tipo'));
  const serie = c.req.param('serie');
  await passeAutorizado(c, serie);
  await c.env.DB.prepare('DELETE FROM registos_apple WHERE aparelho = ? AND serie = ?')
    .bind(c.req.param('aparelho'), serie)
    .run();
  return c.body(null, 200);
});

/** Que passes deste aparelho mudaram desde a etiqueta (sem testemunho: o segredo é o id do aparelho). */
rotasDaWallet.get('/apple/v1/devices/:aparelho/registrations/:tipo', async (c) => {
  tipoCerto(c, c.req.param('tipo'));
  const aparelho = c.req.param('aparelho');
  if (!APARELHO.test(aparelho)) recusar(404, 'nao_existe');
  const desde = Number(c.req.query('passesUpdatedSince') ?? 0) || 0;
  const linhas = (
    await c.env.DB.prepare(
      `SELECT p.serie, p.actualizado_em FROM registos_apple r JOIN passes p ON p.serie = r.serie
       WHERE r.aparelho = ? AND p.actualizado_em > ? ORDER BY p.actualizado_em`,
    )
      .bind(aparelho, desde)
      .all<{ serie: string; actualizado_em: number }>()
  ).results;
  if (!linhas.length) return c.body(null, 204);
  return c.json({
    serialNumbers: linhas.map((l) => l.serie),
    // Em TEXTO: há Wallets que não guardam um número, e o passesUpdatedSince chegava vazio.
    lastUpdated: String(Math.max(...linhas.map((l) => l.actualizado_em))),
  });
});

rotasDaWallet.get('/apple/v1/passes/:tipo/:serie', async (c) => {
  tipoCerto(c, c.req.param('tipo'));
  const passe = await passeAutorizado(c, c.req.param('serie'));
  return servirPkpass(c, passe.cliente_id, passe.actualizado_em);
});

/** A hero da Google: a grelha de um estado (objectivo, carimbos), pública e imutável (o URL muda com o desenho). */
rotasDaWallet.get('/imagem/:versao/:objectivo/:carimbos/hero.png', async (c) => {
  const objectivo = Number(c.req.param('objectivo'));
  const carimbos = Number(c.req.param('carimbos'));
  if (
    c.req.param('versao') !== VERSAO_DO_DESENHO ||
    !Number.isInteger(objectivo) ||
    !Number.isInteger(carimbos) ||
    objectivo < 1 ||
    objectivo > 50 ||
    carimbos < 0 ||
    carimbos > objectivo
  )
    return c.body(null, 404);
  return c.body(buffer(await heroDoCartao({ objectivo, carimbos })), 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
});

rotasDaWallet.post('/apple/v1/log', async (c) => {
  const texto = (await c.req.text()).slice(0, 2000);
  console.log('wallet apple log', texto);
  return c.body(null, 200);
});
