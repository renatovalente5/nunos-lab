/**
 * O mapa das casas da Barbearia. O site mostra o mapa vivo da Apple (MapKit JS),
 * com a autorização que /mapa/token assina aqui; o iPhone usa o mapa do próprio
 * sistema. Quando o mapa vivo não pode vir (o Android sem a chave da Google), fica
 * uma imagem dos Mapas da Apple (Web Snapshots), pedida daqui, assinada com a chave
 * MapKit (segredo MAPKIT_CHAVE, id MAPKIT_KID) e guardada em cache seis horas: os
 * termos da Apple só deixam guardar o mapa «de forma temporária e limitada», e o
 * logótipo da Apple fica na imagem. A app calcula o mesmo enquadramento
 * (packages/dominio, mapa.ts) para pôr os toques sobre os pinos.
 */
import { Hono } from 'hono';
import { enquadrar, versaoDasCasas } from '@nunos-lab/dominio';
import type { Ambiente } from './ambiente.ts';
import { recusar } from './util.ts';
import { buffer, paraBase64url, utf8 } from './wallet/bytes.ts';
import { assinarJwt } from './wallet/jwt.ts';
import { chaveDeAssinatura } from './wallet/pem.ts';

export const rotasDoMapa = new Hono<Ambiente>();

/** A cor do logótipo, sem «#»: a Apple recusa o pedido com ele. */
const COR_DO_PINO = 'F4F1EC';
/** Seis horas: «temporária e limitada», como os termos da Apple pedem, mas sem fazer o telemóvel ir buscar 400 KB a cada abertura. */
const SEIS_HORAS = 6 * 3600;

/** Os tamanhos numa grelha de 16 pontos: sem isso cada largura de janela era uma chave de cache e um pedido assinado à Apple. */
const naGrelha = (n: number) => Math.min(640, Math.max(112, Math.round(n / 16) * 16));

rotasDoMapa.get('/mapa', async (c) => {
  const w0 = Number(c.req.query('w'));
  const h0 = Number(c.req.query('h'));
  const s = Number(c.req.query('s') ?? 2);
  // A app desenha os pinos (o ícone da app) por cima da imagem e pede-a sem os balões da
  // Apple; as apps de antes, que não os desenham, continuam a receber os balões.
  const comBaloes = c.req.query('pinos') !== '0';
  // Os limites dos Snapshots: 50 a 640 pontos de lado, escala 1 a 3. A cache é por tamanho.
  if (![w0, h0].every((n) => Number.isInteger(n) && n >= 100 && n <= 640) || ![1, 2, 3].includes(s))
    recusar(400, 'invalido');
  if (!c.env.MAPKIT_CHAVE || !c.env.MAPKIT_KID) recusar(404, 'sem_mapa');
  // A app já pede na grelha; um tamanho fora dela (uma app antiga) recebe o mais próximo.
  const w = naGrelha(w0);
  const h = naGrelha(h0);

  // As casas lêem-se antes da cache: a impressão das coordenadas entra na chave, e uma casa que
  // muda de sítio dá outra imagem (a da app vem no «v», só para as caches do caminho).
  const lojas = (
    await c.env.DB.prepare(
      'SELECT lat, lng FROM lojas WHERE lat IS NOT NULL AND lng IS NOT NULL ORDER BY ordem, id',
    ).all<{ lat: number; lng: number }>()
  ).results;
  const cache = caches.default;
  const chaveDaCache = new Request(
    new URL(
      `/api/mapa?w=${w}&h=${h}&s=${s}&pinos=${comBaloes ? 1 : 0}&v=${versaoDasCasas(lojas)}`,
      c.req.url,
    ),
  );
  const guardada = await cache.match(chaveDaCache);
  if (guardada) return guardada;
  // Cada falha da cache é um pedido assinado à Apple: por IP, não mais do que as contagens (60/min).
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  if (!(await c.env.CONTAR.limit({ key: `mapa:${ip}` }))?.success)
    recusar(429, 'muitas_tentativas');

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

/** A validade da autorização do mapa vivo: quando acaba, o MapKit JS pede outra. */
const MEIA_HORA = 30 * 60;

/**
 * A autorização do mapa vivo do site (MapKit JS): um JWT de meia hora, assinado com a
 * chave MapKit e preso à origem que o pede, que tem de ser uma das da API.
 */
rotasDoMapa.get('/mapa/token', async (c) => {
  if (!c.env.MAPKIT_CHAVE || !c.env.MAPKIT_KID) recusar(404, 'sem_mapa');
  const origem = c.req.header('Origin') ?? '';
  if (!c.env.ORIGENS.split(',').some((o) => o.trim() === origem)) recusar(403, 'origem');
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  if (!(await c.env.CONTAR.limit({ key: `mapa:${ip}` }))?.success)
    recusar(429, 'muitas_tentativas');
  const agora = Math.floor(Date.now() / 1000);
  const token = await assinarJwt(
    'ES256',
    c.env.MAPKIT_CHAVE,
    'MAPKIT_CHAVE',
    { kid: c.env.MAPKIT_KID },
    { iss: c.env.APPLE_EQUIPA, iat: agora, exp: agora + MEIA_HORA, origin: origem },
  );
  return c.text(token, 200, { 'Cache-Control': 'no-store' });
});
