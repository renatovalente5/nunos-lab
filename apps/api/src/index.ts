import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { Ambiente } from './ambiente.ts';
import { rotasDaBalcao } from './balcao/rotas.ts';
import { exigirPessoa, rotasDeEntradaDaBalcao } from './balcao/sessao.ts';
import { rotasDosClientes } from './backoffice/clientes.ts';
import { rotasDoConteudo } from './backoffice/conteudo.ts';
import { rotasDaFidelidade } from './backoffice/fidelidade.ts';
import { rotasDasMetricas } from './backoffice/metricas.ts';
import { rotasDosNumeros } from './backoffice/numeros.ts';
import { exigirSessao, rotasDaSessao, rotasDosAcessos } from './backoffice/sessao.ts';
import { rotasDaConta, rotasDeEntradaDoCliente } from './cliente/conta.ts';
import { exigirCliente } from './cliente/sessao.ts';
import { limpar } from './limpeza.ts';
import { rotasPublicas } from './publico.ts';
import { rotasDaWallet, rotasDaWalletDoCliente } from './wallet/rotas.ts';

const app = new Hono<Ambiente>();

// A app e o backoffice vivem noutra origem (o GitHub Pages): o CORS só abre
// às origens da lista. As sessões vão no cabeçalho Authorization, nunca em
// cookies, por isso não há pedidos «com credenciais».
app.use('/api/*', async (c, next) => {
  const origens = c.env.ORIGENS.split(',').map((o) => o.trim());
  return cors({
    origin: (o) => (origens.includes(o) ? o : null),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400,
  })(c, next);
});
app.use('/api/*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  if (/^\/api\/(bo|eu|balcao)(\/|$)/.test(c.req.path)) c.header('Cache-Control', 'no-store');
});

app.route('/api', rotasPublicas);
app.route('/api/bo', rotasDaSessao);
app.use('/api/bo/*', exigirSessao);
app.route('/api/bo', rotasDosAcessos);
app.route('/api/bo', rotasDoConteudo);
app.route('/api/bo', rotasDosNumeros);
app.route('/api/bo', rotasDaFidelidade);
app.route('/api/bo', rotasDosClientes);
app.route('/api/bo', rotasDasMetricas);

// A conta do cliente (a app) e a Balcão (a equipa): entrar fica aberto; o resto com sessão.
app.route('/api/eu', rotasDeEntradaDoCliente);
app.use('/api/eu', exigirCliente);
app.use('/api/eu/*', exigirCliente);
app.route('/api/eu', rotasDaConta);
app.route('/api/eu', rotasDaWalletDoCliente);
// A Wallet: o serviço web da Apple e a ligação temporária do passe (sem CORS: é o iPhone a falar).
app.route('/api/wallet', rotasDaWallet);
app.route('/api/balcao', rotasDeEntradaDaBalcao);
app.use('/api/balcao/*', exigirPessoa);
app.route('/api/balcao', rotasDaBalcao);

app.get('/', (c) => c.text("Nuno's Lab · API"));
app.notFound((c) => c.json({ erro: 'nao_existe' }, 404));
app.onError((e, c) => {
  if (e instanceof HTTPException) return e.getResponse();
  console.error(e);
  return c.json({ erro: 'interno' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(limpar(env));
  },
} satisfies ExportedHandler<Env>;
