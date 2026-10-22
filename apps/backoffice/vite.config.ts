import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * A política de segurança só vai na versão publicada: em desenvolvimento o
 * Vite injecta scripts em linha (o recarregamento a quente), que ela barraria.
 * Sem scripts de fora e com a API como única ligação, um texto mal-intencionado
 * gravado num campo nunca chega a correr nem a levar a sessão para outro lado.
 */
function politica(api: string): Plugin {
  // O botão «Entrar com o Google» precisa destes quatro (a lista que o Google publica).
  const google = 'https://accounts.google.com/gsi/';
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${google}client`,
    `style-src 'self' 'unsafe-inline' ${google}style`,
    `img-src 'self' data: blob: ${api}`,
    `connect-src ${api} ${google}`,
    `frame-src ${google}`,
    "font-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ');
  return {
    name: 'politica-de-seguranca',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="utf-8" />',
        `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      ),
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: command === 'build' ? '/nunos-lab/backoffice/' : '/',
    plugins: [react(), politica(env.VITE_API ?? '')],
    build: { outDir: 'dist', assetsDir: 'ficheiros', sourcemap: false },
    server: { port: 8871, strictPort: true },
  };
});
