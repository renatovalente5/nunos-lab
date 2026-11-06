/**
 * O mapa das casas da Barbearia: uma imagem dos Mapas da Apple (Web Snapshots)
 * com um pino por casa. É pedida daqui, assinada com a chave MapKit (segredo
 * MAPKIT_CHAVE, id MAPKIT_KID) e guardada em cache seis horas: os termos da Apple
 * só deixam guardar o mapa «de forma temporária e limitada», e o logótipo da
 * Apple fica na imagem. O aparelho nunca fala com a Apple, só com esta API. A
 * app calcula o mesmo enquadramento (packages/dominio, mapa.ts) para pôr os
 * toques sobre os pinos.
 */
import { Hono } from 'hono';
import { enquadrar } from '@nunos-lab/dominio';
import type { Ambiente } from './ambiente.ts';
import { recusar } from './util.ts';
import { buffer, paraBase64url, utf8 } from './wallet/bytes.ts';
import { chaveDeAssinatura } from './wallet/pem.ts';

export const rotasDoMapa = new Hono<Ambiente>();

/** A cor do logótipo, sem «#»: a Apple recusa o pedido com ele. */
const COR_DO_PINO = 'F4F1EC';
/** Seis horas: «temporária e limitada», como os termos da Apple pedem, mas sem fazer o telemóvel ir buscar 400 KB a cada abertura. */
const SEIS_HORAS = 6 * 3600;

rotasDoMapa.get('/mapa', async (c) => {
  const w = Number(c.req.query('w'));
  const h = Number(c.req.query('h'));
  const s = Number(c.req.query('s') ?? 2);
  // A app desenha os pinos (o ícone da app) por cima da imagem e pede-a sem os balões da
  // Apple; as apps de antes, que não os desenham, continuam a receber os balões.
  const comBaloes = c.req.query('pinos') !== '0';
  // Os limites dos Snapshots: 50 a 640 pontos de lado, escala 1 a 3. A cache é por tamanho.
  if (![w, h].every((n) => Number.isInteger(n) && n >= 100 && n <= 640) || ![1, 2, 3].includes(s))
    recusar(400, 'invalido');
  if (!c.env.MAPKIT_CHAVE || !c.env.MAPKIT_KID) recusar(404, 'sem_mapa');

  const cache = caches.default;
  const chaveDaCache = new Request(
    new URL(`/api/mapa?w=${w}&h=${h}&s=${s}&pinos=${comBaloes ? 1 : 0}`, c.req.url),
  );
  const guardada = await cache.match(chaveDaCache);
  if (guardada) return guardada;

  const lojas = (
    await c.env.DB.prepare(
      'SELECT lat, lng FROM lojas WHERE lat IS NOT NULL AND lng IS NOT NULL ORDER BY ordem, id',
    ).all<{ lat: number; lng: number }>()
  ).results;
  const e = enquadrar(lojas, w, h);
  if (!e) recusar(404, 'sem_mapa');

  const pedido = new URLSearchParams({
    center: `${e.lat},${e.lng}`,
    z: String(e.z),
    size: `${w}x${h}`,
    scale: String(s),
    colorScheme: 'dark',
    poi: '0',
    lang: 'pt-PT',
    ...(comBaloes
      ? {
          annotations: JSON.stringify(
            lojas.map((l) => ({
              point: `${l.lat},${l.lng}`,
              color: COR_DO_PINO,
              markerStyle: 'balloon',
            })),
          ),
        }
      : {}),
    teamId: c.env.APPLE_EQUIPA,
    keyId: c.env.MAPKIT_KID,
  });
  const caminho = `/api/v1/snapshot?${pedido}`;
  const chave = await chaveDeAssinatura(c.env.MAPKIT_CHAVE, 'ECDSA-P256', 'MAPKIT_CHAVE');
  const assinatura = paraBase64url(
    new Uint8Array(
      await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chave, buffer(utf8(caminho))),
    ),
  );
  const morada = `https://snapshot.apple-mapkit.com${caminho}&signature=${assinatura}`;
  // Um pedido sem User-Agent leva um «403 Forbidden» genérico da Apple (visto no wrangler dev).
  const cabecalhos = {
    'User-Agent': 'NunosLab/1.0 (+https://nunoslab.com)',
    Accept: 'image/png,image/*',
  };
  let r = await fetch(morada, { headers: cabecalhos });
  if (!r.ok) {
    // A Apple recusa de vez em quando um pedido bom (um 403 passageiro): segunda tentativa.
    await new Promise((fim) => setTimeout(fim, 400));
    r = await fetch(morada, { headers: cabecalhos });
  }
  if (!r.ok) {
    console.error('mapa: a Apple respondeu', r.status);
    recusar(404, 'sem_mapa');
  }
  const resposta = new Response(await r.arrayBuffer(), {
    headers: {
      'Content-Type': r.headers.get('Content-Type') ?? 'image/png',
      'Cache-Control': `public, max-age=${SEIS_HORAS}, stale-while-revalidate=86400`,
    },
  });
  c.executionCtx.waitUntil(cache.put(chaveDaCache, resposta.clone()));
  return resposta;
});
