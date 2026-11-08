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
    homepageUri: { uri: origemDaApp, description: 'A app' },
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
        ? { label: t.porUsarGoogle, balance: { string: `${c.porUsar} × ${c.recompensa}` } }
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
        body: t.como(c.objectivo, c.recompensa.toLowerCase()),
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

/** O objecto antigo fica inactivo (o telemóvel perdido não o vê activo): «perdi o telemóvel». */
export async function desactivarObjeto(token: string, id: string) {
  const r = await fetch(`${API}/loyaltyObject/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'INACTIVE' }),
  });
  if (!r.ok && r.status !== 404) throw new Error(`O objecto não se desactivou: ${r.status}`);
}

/** Garante a classe e põe o objecto como está (cria ou substitui). */
export async function actualizarObjeto(
  token: string,
  emissor: string,
  origemDaApp: string,
  c: CartaoDaGoogle,
) {
  const cabecalhos = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const classeR = await fetch(`${API}/loyaltyClass/${encodeURIComponent(classeId(emissor))}`, {
    headers: cabecalhos,
  });
  if (classeR.status === 404) {
    const criada = await fetch(`${API}/loyaltyClass`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify(classe(emissor, origemDaApp)),
    });
    if (!criada.ok && criada.status !== 409)
      throw new Error(`A classe não se criou: ${criada.status}`);
  } else if (classeR.ok) {
    // A classe de antes do inglês (7 nov) ganha o nome do programa em inglês. Falhar aqui não pára o objecto.
    const actual = (await classeR.json().catch(() => ({}))) as { localizedProgramName?: unknown };
    if (!actual.localizedProgramName)
      await fetch(`${API}/loyaltyClass/${encodeURIComponent(classeId(emissor))}`, {
        method: 'PATCH',
        headers: cabecalhos,
        body: JSON.stringify({ localizedProgramName: NOME_DO_PROGRAMA }),
      })
        .then((r) => !r.ok && console.error('classe da google', r.status))
        .catch((e) => console.error('classe da google', e));
  }
  const existe = await fetch(`${API}/loyaltyObject/${encodeURIComponent(c.id)}`, {
    headers: cabecalhos,
  });
  const r = await fetch(
    existe.status === 404
      ? `${API}/loyaltyObject`
      : `${API}/loyaltyObject/${encodeURIComponent(c.id)}`,
    {
      method: existe.status === 404 ? 'POST' : 'PUT',
      headers: cabecalhos,
      body: JSON.stringify(objeto(emissor, c)),
    },
  );
  if (!r.ok) throw new Error(`O objecto não se guardou: ${r.status}`);
}
