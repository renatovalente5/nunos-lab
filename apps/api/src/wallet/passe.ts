import { codigoCurto, fraseDoCartao, textoDoQr } from '@nunos-lab/dominio';
import { buffer, deBase64, hex, utf8 } from './bytes.ts';
import { assinarManifesto } from './cms.ts';
import { IMAGENS_DO_PASSE } from './imagens.ts';
import { zipar } from './zip.ts';

/**
 * O passe da Apple: o pass.json de um cartão (um storeCard preto, com o
 * logótipo oficial), as imagens, o manifest.json (o SHA-1 de cada ficheiro)
 * e a assinatura (cms.ts). Não lê a base: a API dá-lhe o cartão já lido.
 */

export type CartaoDoPasse = {
  serie: string;
  codigo: string;
  nome: string;
  carimbos: number;
  objectivo: number;
  recompensa: string;
  porUsar: number;
  cortes: number;
  ultima: { quando: number; loja: string | null; pessoa: string | null } | null;
  lojas: { nome: string; lat: number | null; lng: number | null }[];
  site: string;
  instagram: string;
};

export type ConfiguracaoDoPasse = {
  passTipo: string;
  equipa: string;
  /** A origem da API, para o serviço web (fica no passe para sempre). */
  origemDaApi: string;
  /** A origem da app, para a privacidade. */
  origemDaApp: string;
  testemunho: string;
};

const RGB = (hex6: string) => {
  const n = parseInt(hex6.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const dataCurta = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Lisbon',
  });

export function passJson(c: CartaoDoPasse, cfg: ConfiguracaoDoPasse) {
  const porUsar =
    c.porUsar > 0
      ? [
          {
            key: 'porUsar',
            label: 'POR USAR',
            value: c.porUsar === 1 ? c.recompensa : `${c.porUsar} × ${c.recompensa}`,
          },
        ]
      : [];
  return {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTipo,
    teamIdentifier: cfg.equipa,
    serialNumber: c.serie,
    organizationName: "Nuno's Lab",
    description: "Cartão Nuno's Lab",
    backgroundColor: RGB('#0A0A0A'),
    foregroundColor: RGB('#F4F1EC'),
    labelColor: RGB('#A9A49C'),
    sharingProhibited: true,
    webServiceURL: `${cfg.origemDaApi}/api/wallet/apple`,
    authenticationToken: cfg.testemunho,
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: textoDoQr(c.codigo),
      messageEncoding: 'iso-8859-1',
      altText: codigoCurto(c.codigo).replace(' ', ' '),
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: textoDoQr(c.codigo),
        messageEncoding: 'iso-8859-1',
        altText: codigoCurto(c.codigo).replace(' ', ' '),
      },
    ],
    locations: c.lojas
      .filter((l) => l.lat !== null && l.lng !== null)
      .slice(0, 10)
      .map((l) => ({
        latitude: l.lat,
        longitude: l.lng,
        relevantText: `Nuno's Lab ${l.nome}: mostra o cartão.`,
      })),
    storeCard: {
      headerFields: [
        {
          key: 'carimbos',
          label: 'CARIMBOS',
          value: `${c.carimbos} de ${c.objectivo}`,
          changeMessage: 'Carimbo novo: %@',
        },
      ],
      primaryFields: [{ key: 'nome', label: 'CLIENTE', value: c.nome || 'Nuno’s Lab' }],
      secondaryFields: [
        {
          key: 'faltam',
          label: c.recompensa.toUpperCase(),
          value: fraseDoCartao(c.carimbos, { objectivo: c.objectivo, recompensa: '' }),
        },
        ...porUsar,
      ],
      auxiliaryFields: [{ key: 'cortes', label: 'CORTES', value: String(c.cortes) }],
      backFields: [
        ...(c.ultima
          ? [
              {
                key: 'ultima',
                label: 'Última visita',
                value: [dataCurta(c.ultima.quando), c.ultima.loja, c.ultima.pessoa]
                  .filter(Boolean)
                  .join(' · '),
              },
            ]
          : []),
        {
          key: 'como',
          label: 'Como funciona',
          value: `Um carimbo por corte. Ao ${c.objectivo}.º, ${c.recompensa.toLowerCase()}. Serve nas três casas.`,
        },
        { key: 'casas', label: 'As casas', value: c.lojas.map((l) => l.nome).join(' · ') },
        ...(c.site ? [{ key: 'site', label: 'Site', value: c.site }] : []),
        ...(c.instagram
          ? [{ key: 'instagram', label: 'Instagram', value: `instagram.com/${c.instagram}` }]
          : []),
        { key: 'privacidade', label: 'Privacidade', value: `${cfg.origemDaApp}/privacidade/` },
      ],
    },
  };
}

async function sha1(bytes: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-1', buffer(bytes))));
}

/** O .pkpass inteiro, pronto a servir. */
export async function pkpass(
  cartao: CartaoDoPasse,
  cfg: ConfiguracaoDoPasse,
  identidade: { certificado: string; chave: string; cadeia: string },
  quando = new Date(),
): Promise<Uint8Array> {
  const ficheiros: [string, Uint8Array][] = [
    ['pass.json', utf8(JSON.stringify(passJson(cartao, cfg)))],
    ...Object.entries(IMAGENS_DO_PASSE).map(([nome, b64]): [string, Uint8Array] => [
      nome,
      deBase64(b64),
    ]),
  ];
  const manifesto: Record<string, string> = {};
  for (const [nome, bytes] of ficheiros) manifesto[nome] = await sha1(bytes);
  const manifestoBytes = utf8(JSON.stringify(manifesto));
  const assinatura = await assinarManifesto(manifestoBytes, identidade, quando);
  return zipar([...ficheiros, ['manifest.json', manifestoBytes], ['signature', assinatura]]);
}
