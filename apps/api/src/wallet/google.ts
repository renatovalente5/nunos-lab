import type { Lingua } from '@nunos-lab/dominio';
import { assinarJwt } from './jwt.ts';
import { TEXTOS_DO_PASSE } from './textos.ts';

/**
 * A Google Wallet: um cartão de fidelidade (loyaltyObject) de uma classe
 * nossa. «Guardar na Google Wallet» é uma ligação com um JWT RS256 assinado
 * pela conta de serviço; actualizar faz-se pela API, com um token OAuth da
 * mesma conta. Sem a conta (GOOGLE_WALLET_CONTA) ou o emissor, não há Google.
 */
export type ContaDeServico = { client_email: string; private_key: string };

export type CartaoDaGoogle = {
  id: string;
  codigo: string;
  qr: string;
  nome: string;
  carimbos: number;
  objectivo: number;
  recompensa: string;
  porUsar: number;
  /** Os prémios a meio por entregar (10 nov 2026): quantos, e o primeiro. */
  meiosPorUsar?: { n: number; recompensa: string } | null;
  cortes: number;
  /** A imagem com a grelha dos carimbos, num URL só deste estado (a Google guarda-a por URL). */
  hero: string;
  /** A língua da conta (a da app); sem ela, o português. */
  lingua?: Lingua;
};

export const classeId = (emissor: string) => `${emissor}.nunoslab-cartao`;

/** O nome do programa é da classe (de todos): a Google mostra o inglês aos telemóveis em inglês. */
const NOME_DO_PROGRAMA = {
  defaultValue: { language: 'pt-PT', value: TEXTOS_DO_PASSE.pt.descricao },
  translatedValues: [{ language: 'en', value: TEXTOS_DO_PASSE.en.descricao }],
};

/** A ligação para a app nas costas do cartão, na língua da conta («A app» saía a toda a gente). */
const PAGINA_DA_APP = (origemDaApp: string) => ({
  uri: origemDaApp,
  description: "Nuno's Lab",
  localizedDescription: {
    defaultValue: { language: 'pt-PT', value: "App do Nuno's Lab" },
    translatedValues: [{ language: 'en', value: "Nuno's Lab app" }],
  },
});

export function classe(emissor: string, origemDaApp: string) {
  return {
    id: classeId(emissor),
    issuerName: "Nuno's Lab",
    programName: TEXTOS_DO_PASSE.pt.descricao,
    localizedProgramName: NOME_DO_PROGRAMA,
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: '#0A0A0A',
    programLogo: {
      sourceUri: { uri: `${origemDaApp}/icone-512.png` },
      contentDescription: { defaultValue: { language: 'pt-PT', value: "Nuno's Lab" } },
    },
    homepageUri: PAGINA_DA_APP(origemDaApp),
  };
}

export function objeto(emissor: string, c: CartaoDaGoogle) {
  const t = TEXTOS_DO_PASSE[c.lingua ?? 'pt'];
  return {
    id: c.id,
    classId: classeId(emissor),
    state: 'ACTIVE',
    accountId: c.codigo,
    accountName: c.nome || t.clienteGoogle,
    loyaltyPoints: {
      label: t.carimbosGoogle,
      balance: { string: t.carimbosDe(c.carimbos, c.objectivo) },
    },
    secondaryLoyaltyPoints:
      c.porUsar > 0
        ? {
            label: t.porUsarGoogle,
            balance: {
              string: c.porUsar === 1 ? c.recompensa : `${c.porUsar} × ${c.recompensa}`,
            },
          }
        : c.meiosPorUsar && c.meiosPorUsar.n > 0
          ? {
              label: t.porUsarGoogle,
              balance: {
                string:
                  c.meiosPorUsar.n === 1
                    ? c.meiosPorUsar.recompensa
                    : `${c.meiosPorUsar.n} × ${c.meiosPorUsar.recompensa}`,
              },
            }
          : undefined,
    barcode: { type: 'QR_CODE', value: c.qr, alternateText: c.codigo },
    heroImage: {
      sourceUri: { uri: c.hero },
      contentDescription: {
        defaultValue: { language: t.etiqueta, value: t.carimbosNaImagem(c.carimbos, c.objectivo) },
      },
    },
    textModulesData: [
      { id: 'cortes', header: t.cortes, body: String(c.cortes) },
      {
        id: 'como',
        header: t.comoFunciona,
        body: t.como(c.objectivo, c.recompensa.charAt(0).toLowerCase() + c.recompensa.slice(1)),
      },
    ],
  };
}

/** A ligação «Guardar na Google Wallet», com o objecto inteiro dentro do JWT. */
export async function ligacaoParaGuardar(
  conta: ContaDeServico,
  emissor: string,
  origens: string[],
  c: CartaoDaGoogle,
) {
  const jwt = await assinarJwt(
    'RS256',
    conta.private_key,
    'GOOGLE_WALLET_CONTA',
    {},
    {
      iss: conta.client_email,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: origens,
      payload: { loyaltyObjects: [objeto(emissor, c)] },
    },
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

/** Um token OAuth da conta de serviço (vale uma hora; quem chama guarda-o). */
export async function tokenDaGoogle(conta: ContaDeServico): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const assercao = await assinarJwt(
    'RS256',
    conta.private_key,
    'GOOGLE_WALLET_CONTA',
    {},
    {
      iss: conta.client_email,
      scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
      aud: 'https://oauth2.googleapis.com/token',
      iat: agora,
      exp: agora + 3600,
    },
  );
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assercao}`,
  });
  if (!r.ok) throw new Error(`A Google não deu token: ${r.status}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

const API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const cabecalhos = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

/** O objecto antigo fica inactivo (o telemóvel perdido não o vê activo): «perdi o telemóvel». */
export async function desactivarObjeto(token: string, id: string) {
  const r = await fetch(`${API}/loyaltyObject/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: cabecalhos(token),
    body: JSON.stringify({ state: 'INACTIVE' }),
  });
  if (!r.ok && r.status !== 404) throw new Error(`O objecto não se desactivou: ${r.status}`);
}

/** O que a Google diz quando recusa (sem isto, só o número: o 400 da classe ficou três semanas por explicar). */
async function motivo(r: Response): Promise<string> {
  const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
  return j?.error?.message ?? '';
}

/**
 * A classe existe e tem o nome do programa e a ligação da app nas duas línguas. Uma vez por
 * refrescamento (e ao guardar o primeiro cartão), não por objecto. Só falha se a classe não existir
 * e não se criar: o resto fica nos registos e não pára os objectos.
 */
export async function garantirClasse(token: string, emissor: string, origemDaApp: string) {
  // A classe é uma só, a da produção: o «wrangler dev» (http://localhost) não a cria nem lhe muda a ligação.
  if (!origemDaApp.startsWith('https://')) return;
  const url = `${API}/loyaltyClass/${encodeURIComponent(classeId(emissor))}`;
  const r = await fetch(url, { headers: cabecalhos(token) });
  if (r.status === 404) {
    await r.body?.cancel();
    const criada = await fetch(`${API}/loyaltyClass`, {
      method: 'POST',
      headers: cabecalhos(token),
      body: JSON.stringify(classe(emissor, origemDaApp)),
    });
    if (!criada.ok && criada.status !== 409)
      throw new Error(`A classe não se criou: ${criada.status} ${await motivo(criada)}`);
    await criada.body?.cancel();
    return;
  }
  if (!r.ok) return console.error('classe da google', r.status, await motivo(r));
  const actual = (await r.json().catch(() => ({}))) as {
    localizedProgramName?: unknown;
    homepageUri?: { localizedDescription?: unknown };
  };
  if (actual.localizedProgramName && actual.homepageUri?.localizedDescription) return;
  // A classe de antes do inglês (7 nov) ganha o nome do programa e a ligação da app em inglês. Uma
  // classe aprovada só muda com «UNDER_REVIEW» (a Google aprova-a outra vez sozinha); sem ele dá 400
  // «Invalid review status "APPROVED"», como deu em todos os refrescamentos até 26 nov 2026.
  const p = await fetch(url, {
    method: 'PATCH',
    headers: cabecalhos(token),
    body: JSON.stringify({
      reviewStatus: 'UNDER_REVIEW',
      localizedProgramName: NOME_DO_PROGRAMA,
      homepageUri: PAGINA_DA_APP(origemDaApp),
    }),
  });
  if (!p.ok) return console.error('classe da google', p.status, await motivo(p));
  await p.body?.cancel();
}

/** Põe o objecto como está: substitui-o (PUT) e, se ainda não existe, cria-o (POST). */
export async function guardarObjeto(token: string, emissor: string, c: CartaoDaGoogle) {
  const pedido = (url: string, method: 'PUT' | 'POST') =>
    fetch(url, { method, headers: cabecalhos(token), body: JSON.stringify(objeto(emissor, c)) });
  let r = await pedido(`${API}/loyaltyObject/${encodeURIComponent(c.id)}`, 'PUT');
  if (r.status === 404) {
    await r.body?.cancel();
    r = await pedido(`${API}/loyaltyObject`, 'POST');
  }
  if (!r.ok) throw new Error(`O objecto não se guardou: ${r.status} ${await motivo(r)}`);
  // A Google devolve o objecto inteiro: não se lê, mas fecha-se (o Worker só tem 6 ligações).
  await r.body?.cancel();
}
