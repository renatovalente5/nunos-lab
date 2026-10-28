import { assinarJwt } from './jwt.ts';

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
};

export const classeId = (emissor: string) => `${emissor}.nunoslab-cartao`;

export function classe(emissor: string, origemDaApp: string) {
  return {
    id: classeId(emissor),
    issuerName: "Nuno's Lab",
    programName: "Cartão Nuno's Lab",
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
  return {
    id: c.id,
    classId: classeId(emissor),
    state: 'ACTIVE',
    accountId: c.codigo,
    accountName: c.nome || 'Cliente',
    loyaltyPoints: {
      label: 'Carimbos',
      balance: { string: `${c.carimbos} de ${c.objectivo}` },
    },
    secondaryLoyaltyPoints:
      c.porUsar > 0
        ? { label: 'Por usar', balance: { string: `${c.porUsar} × ${c.recompensa}` } }
        : undefined,
    barcode: { type: 'QR_CODE', value: c.qr, alternateText: c.codigo },
    textModulesData: [
      { id: 'cortes', header: 'Cortes', body: String(c.cortes) },
      {
        id: 'como',
        header: 'Como funciona',
        body: `Um carimbo por corte. Ao ${c.objectivo}.º, ${c.recompensa.toLowerCase()}.`,
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
