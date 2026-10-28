/**
 * A porta da revisão das lojas (Apple, Google): quem tem o código de
 * demonstração entra como um cliente de exemplo com o cartão a meio, ou como
 * uma pessoa da equipa de exemplo, sem Apple nem Google. Só existe quando o
 * segredo REVISAO_CODIGO está posto. A página /api/revisao?codigo=… mostra o
 * QR desse cliente, para o revisor da Balcão o ler noutro ecrã.
 */
import { Hono } from 'hono';
import { renderSVG } from 'uqr';
import { codigoCurto, textoDoQr } from '@nunos-lab/dominio';
import type { Ambiente, C } from './ambiente.ts';
import { hex, recusar, sha256 } from './util.ts';

type EnvDaRevisao = { REVISAO_CODIGO?: string; REVISAO_CLIENTE?: string; REVISAO_PESSOA?: string };

/** O código bate? Comparam-se resumos: o tempo não diz quantas letras acertaram. */
export async function codigoDeRevisaoValido(c: C, codigo: string): Promise<boolean> {
  const esperado = (c.env as EnvDaRevisao).REVISAO_CODIGO;
  if (!esperado || !codigo) return false;
  return hex(await sha256(codigo.trim())) === hex(await sha256(esperado));
}

/** O cliente de demonstração (o código do cartão em REVISAO_CLIENTE), ou 404. */
export async function clienteDeRevisao(
  c: C,
): Promise<{ id: number; codigo: string; nome: string }> {
  const codigo = (c.env as EnvDaRevisao).REVISAO_CLIENTE;
  if (!codigo) recusar(404, 'nao_existe');
  const cl = await c.env.DB.prepare('SELECT id, codigo, nome FROM clientes WHERE codigo = ?')
    .bind(codigo)
    .first<{ id: number; codigo: string; nome: string }>();
  if (!cl) recusar(404, 'nao_existe');
  return cl;
}

/** A pessoa da equipa de demonstração (REVISAO_PESSOA), activa, ou 404. */
export async function pessoaDeRevisao(c: C): Promise<number> {
  const id = Number((c.env as EnvDaRevisao).REVISAO_PESSOA);
  if (!id) recusar(404, 'nao_existe');
  const p = await c.env.DB.prepare(
    'SELECT id FROM equipa WHERE id = ? AND removido_em IS NULL AND activo = 1',
  )
    .bind(id)
    .first<{ id: number }>();
  if (!p) recusar(404, 'nao_existe');
  return p.id;
}

export const rotasDaRevisao = new Hono<Ambiente>();

/** A página com o QR do cliente de demonstração (em inglês: é para os revisores). */
rotasDaRevisao.get('/', async (c) => {
  if (!(await codigoDeRevisaoValido(c, c.req.query('codigo') ?? ''))) recusar(404, 'nao_existe');
  const cl = await clienteDeRevisao(c);
  const svg = renderSVG(textoDoQr(cl.codigo), {
    pixelSize: 6,
    whiteColor: '#fff',
    blackColor: '#000',
  });
  return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Nuno's Lab · demo card</title>
<style>body{margin:0;background:#0a0a0a;color:#f3f1ec;font:16px/1.5 -apple-system,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}
main{padding:32px 20px;max-width:420px}svg{width:min(80vw,320px);height:auto;border-radius:16px;background:#fff;padding:12px;box-sizing:border-box}
h1{font-size:20px;margin:0 0 16px}code{font-size:28px;letter-spacing:.12em;font-weight:700}p{color:#b7b2a8;margin:16px 0 0}</style></head>
<body><main><h1>Nuno's Lab · demo client card</h1>${svg}<div style="margin-top:16px"><code>${codigoCurto(cl.codigo)}</code></div>
<p>${cl.nome}. In the <b>Nuno's Lab Balcão</b> app, sign in with the demo code, tap “Ler o cartão” and scan this QR, or type the code in “Ou escreve o código”.</p></main></body></html>`);
});
