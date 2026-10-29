import { codigoCurto, fraseDoCartao, textoDoQr } from '@nunos-lab/dominio';
import { buffer, deBase64, hex, utf8 } from './bytes.ts';
import { assinarManifesto } from './cms.ts';
import { imagensDoCartao } from './grelha.ts';
import { IMAGENS_DO_PASSE } from './imagens.ts';
import { zipar } from './zip.ts';

/**
 * O passe da Apple: o pass.json de um cartão (um storeCard preto com a faixa
 * dos carimbos, e o poster do iOS 27 ao lado, com a mesma grelha na arte e o
 * código a meio), as imagens, o manifest.json (o SHA-1 de cada ficheiro) e a
 * assinatura (cms.ts). Não lê a base: a API dá-lhe o cartão já lido.
 */

/**
 * Muda sempre que o passe muda de cara (campos, imagens, estilos): o Worker,
 * ao ver uma versão diferente da guardada, refaz os passes de todos e avisa
 * os telemóveis (servico.ts, refrescarSePreciso).
 */
export const VERSAO_DO_PASSE = '2026-10-30c';

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
  lojas: { nome: string; telefone: string; lat: number | null; lng: number | null }[];
  site: string;
  instagram: string;
  whatsapp: string;
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

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function passJson(c: CartaoDoPasse, cfg: ConfiguracaoDoPasse) {
  const faltam = Math.max(0, c.objectivo - c.carimbos);
  const recompensa = c.recompensa.trim() || 'Prémio';
  // O aviso no ecrã bloqueado: «Carimbo novo: 7 de 10»; no 10.º, que o cartão está
  // completo; a zeros (a entrega do prémio, ou anulado o único) nada — era «Carimbo novo: 0 de 10».
  const carimbos = {
    key: 'carimbos',
    label: 'CARIMBOS',
    value: `${c.carimbos} de ${c.objectivo}`,
    ...(c.carimbos >= c.objectivo
      ? { changeMessage: `Cartão completo (%@): ${minuscula(recompensa)} na próxima visita` }
      : c.carimbos > 0
        ? { changeMessage: 'Carimbo novo: %@' }
        : {}),
  };
  const cliente = c.nome ? [{ key: 'nome', label: 'CLIENTE', value: c.nome }] : [];
  const porUsar =
    c.porUsar > 0
      ? [
          {
            key: 'porUsar',
            label: 'POR USAR',
            value: c.porUsar === 1 ? recompensa : `${c.porUsar} × ${recompensa}`,
          },
        ]
      : [];
  const contacto = [
    c.whatsapp ? `WhatsApp ${c.whatsapp}` : '',
    ...c.lojas.filter((l) => l.telefone).map((l) => `${l.nome}: ${l.telefone}`),
  ]
    .filter(Boolean)
    .join('\n');
  const costas = [
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
      value: `Um carimbo por corte. Ao ${c.objectivo}.º, ${minuscula(recompensa)}.`,
    },
    ...(c.lojas.length
      ? [{ key: 'casas', label: 'As casas', value: c.lojas.map((l) => l.nome).join(' · ') }]
      : []),
    ...(contacto ? [{ key: 'contacto', label: 'Contacto', value: contacto }] : []),
    ...(c.site ? [{ key: 'site', label: 'Site', value: c.site }] : []),
    ...(c.instagram
      ? [{ key: 'instagram', label: 'Instagram', value: `instagram.com/${c.instagram}` }]
      : []),
    { key: 'privacidade', label: 'Privacidade', value: `${cfg.origemDaApp}/privacidade/` },
  ];
  const codigo = {
    format: 'PKBarcodeFormatQR',
    message: textoDoQr(c.codigo),
    messageEncoding: 'iso-8859-1',
    altText: codigoCurto(c.codigo).replace(' ', ' '),
  };
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
    barcode: codigo,
    barcodes: [codigo],
    locations: c.lojas
      .filter((l) => l.lat !== null && l.lng !== null)
      .slice(0, 10)
      .map((l) => ({
        latitude: l.lat,
        longitude: l.lng,
        relevantText: `Nuno's Lab ${l.nome}: mostra o cartão.`,
      })),
    // O iOS 26 e anteriores: a faixa com as casas (strip.png) por cima da linha
    // de campos, e o código em baixo. Sem campos principais, para a faixa ficar limpa.
    storeCard: {
      headerFields: [carimbos],
      secondaryFields: [
        ...cliente,
        {
          key: 'faltam',
          label: recompensa.toUpperCase(),
          value: fraseDoCartao(c.carimbos, { objectivo: c.objectivo, recompensa: '' }),
        },
        ...porUsar,
      ],
      auxiliaryFields: [{ key: 'cortes', label: 'CORTES', value: String(c.cortes) }],
      backFields: costas,
    },
    // O iOS 27 prefere o poster: a arte (artwork.png) enche o cartão, com as
    // casas a meio e o código num quadro branco por baixo delas; o logótipo
    // principal em cima à esquerda, o cabeçalho à direita, e uma faixa em
    // baixo com o nome (um principal sem rótulo sai em título) e o que falta.
    posterGeneric: {
      headerFields: [carimbos],
      primaryFields: [
        ...(c.nome ? [{ key: 'nome', value: c.nome }] : []),
        porUsar[0] ?? {
          key: 'faltam',
          label: faltam === 1 ? 'FALTA' : 'FALTAM',
          value: String(faltam),
        },
      ],
      footerFields: [
        {
          key: 'rodape',
          value:
            c.porUsar > 0
              ? `Tens ${c.porUsar === 1 ? '' : `${c.porUsar} × `}${minuscula(recompensa)} por usar`
              : `${recompensa} ao ${c.objectivo}.º`,
        },
      ],
      backFields: [{ key: 'cortes', label: 'Cortes', value: String(c.cortes) }, ...costas],
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
  const geradas = await imagensDoCartao({ carimbos: cartao.carimbos, objectivo: cartao.objectivo });
  const ficheiros: [string, Uint8Array][] = [
    ['pass.json', utf8(JSON.stringify(passJson(cartao, cfg)))],
    ...Object.entries(IMAGENS_DO_PASSE).map(([nome, b64]): [string, Uint8Array] => [
      nome,
      deBase64(b64),
    ]),
    ...Object.entries(geradas),
  ];
  const manifesto: Record<string, string> = {};
  for (const [nome, bytes] of ficheiros) manifesto[nome] = await sha1(bytes);
  const manifestoBytes = utf8(JSON.stringify(manifesto));
  const assinatura = await assinarManifesto(manifestoBytes, identidade, quando);
  return zipar([...ficheiros, ['manifest.json', manifestoBytes], ['signature', assinatura]]);
}
