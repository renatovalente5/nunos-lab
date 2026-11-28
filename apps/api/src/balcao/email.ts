/**
 * O email com o código para entrar na for partners (28 nov 2026). Sai pelo Email Sending da Cloudflare:
 * o binding EMAIL e o remetente EMAIL_REMETENTE, que tem de ser de um domínio da conta (o nunoslab.com,
 * quando estiver na Cloudflare). Sem os dois, entrar por email fica desligado e a app não mostra o
 * botão. No «wrangler dev» fica sempre ligado, e o código vem na resposta (para a prova da API).
 */
import { MINUTOS_DO_CODIGO, type Lingua } from '@nunos-lab/dominio';

/** O que daqui se usa do binding do Email Sending: o send() com o email já montado. */
type Envio = {
  send(m: {
    to: string;
    from: { email: string; name: string };
    subject: string;
    text: string;
    html: string;
  }): Promise<{ messageId: string }>;
};
type ComEmail = { EMAIL?: Envio; EMAIL_REMETENTE?: string; MODO?: string };
const comEmail = (env: object) => env as ComEmail;

/** O «wrangler dev» (MODO=desenvolvimento, que a publicação não leva). */
export const emEnsaio = (env: object): boolean => comEmail(env).MODO === 'desenvolvimento';

/** Há como mandar o código: o binding e o remetente (ou o «wrangler dev», que não manda nada a ninguém). */
export function emailLigado(env: object): boolean {
  const e = comEmail(env);
  return (!!e.EMAIL && !!e.EMAIL_REMETENTE) || emEnsaio(env);
}

export const NOME_DO_REMETENTE = "Nuno's Lab for partners";

const FRASES = {
  pt: {
    assunto: (codigo: string) => `${codigo} é o teu código do Nuno's Lab`,
    antes: "O teu código para entrar na app Nuno's Lab for partners:",
    depois: `Vale ${MINUTOS_DO_CODIGO} minutos. Se não pediste este código, ignora este email.`,
    lang: 'pt-PT',
  },
  en: {
    assunto: (codigo: string) => `${codigo} is your Nuno's Lab code`,
    antes: "Your code to sign in to the Nuno's Lab for partners app:",
    depois: `It’s valid for ${MINUTOS_DO_CODIGO} minutes. If you didn’t ask for this code, ignore this email.`,
    lang: 'en-GB',
  },
} as const;

/**
 * O email do código, sem ligações nem imagens: o código no assunto (o iPhone e o Gmail mostram-no no
 * aviso e oferecem-se para o preencher) e grande no corpo. Nada vindo de quem pediu entra no email.
 */
export function emailDoCodigo(
  codigo: string,
  lingua: Lingua,
): { assunto: string; texto: string; html: string } {
  if (!/^\d{6}$/.test(codigo)) throw new Error('Um código tem 6 algarismos');
  const f = FRASES[lingua] ?? FRASES.pt;
  const texto = `${f.antes}\n\n${codigo}\n\n${f.depois}\n`;
  const html = `<!doctype html>
<html lang="${f.lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>${f.assunto(codigo)}</title></head>
<body style="margin:0;padding:0;background:#F4F1EC;">
<div style="max-width:480px;margin:0 auto;padding:36px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0A0A0A;">
<p style="margin:0 0 20px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#5E5A53;">${NOME_DO_REMETENTE}</p>
<p style="margin:0 0 16px;font-size:17px;line-height:1.5;">${f.antes}</p>
<p style="margin:0 0 20px;font-size:40px;line-height:1.2;font-weight:700;letter-spacing:8px;">${codigo}</p>
<p style="margin:0;font-size:15px;line-height:1.5;color:#3F3B35;">${f.depois}</p>
</div>
</body>
</html>
`;
  return { assunto: f.assunto(codigo), texto, html };
}

/**
 * Manda o código (depois da resposta, no waitUntil). Uma falha só fica no registo, sem o email nem o
 * código (o registo da Cloudflare guarda-se): a pessoa pede outro, e o porquê vê-se lá.
 */
export async function mandarCodigo(
  env: object,
  para: string,
  codigo: string,
  lingua: Lingua,
): Promise<void> {
  const e = comEmail(env);
  // No «wrangler dev» sem o binding: o código já veio na resposta.
  if (!e.EMAIL || !e.EMAIL_REMETENTE) return;
  const m = emailDoCodigo(codigo, lingua);
  try {
    await e.EMAIL.send({
      to: para,
      from: { email: e.EMAIL_REMETENTE, name: NOME_DO_REMETENTE },
      subject: m.assunto,
      text: m.texto,
      html: m.html,
    });
  } catch (erro) {
    const codigoDoErro = (erro as { code?: unknown }).code;
    console.error(
      'o código por email não saiu',
      typeof codigoDoErro === 'string' ? codigoDoErro : (erro as Error)?.name,
    );
  }
}
