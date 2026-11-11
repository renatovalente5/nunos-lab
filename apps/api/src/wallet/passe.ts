import {
  codigoCurto,
  dataCurta as dataCurtaDoDominio,
  diaEmLisboa,
  fraseDoCartao,
  fraseDoPremioAMeio,
  fraseDesteCorte,
  fraseDoProximo,
  textoDoQr,
  type Lingua,
} from '@nunos-lab/dominio';
import { buffer, deBase64, hex, utf8 } from './bytes.ts';
import { assinarManifesto } from './cms.ts';
import { imagensDoCartao } from './grelha.ts';
import { IMAGENS_DO_PASSE } from './imagens.ts';
import { TEXTOS_DO_PASSE } from './textos.ts';
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
export const VERSAO_DO_PASSE = '2026-11-11';

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
  /** A língua da conta (a da app); sem ela, o português. */
  lingua?: Lingua;
  /** O prémio a meio do cartão em curso (10 nov 2026): em que carimbo, o quê, e se já se ganhou. */
  meio?: { carimbos: number; recompensa: string; ganho: boolean } | null;
  /** Os prémios a meio ganhos e por entregar: quantos, e o primeiro. */
  meiosPorUsar?: { n: number; recompensa: string } | null;
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

/** «7 nov» / «7 Nov», como nas apps: o pt-PT do Intl dava «7/11» (revisão das traduções, 9 nov). */
const dataCurta = (unix: number, etiqueta: string) =>
  dataCurtaDoDominio(
    diaEmLisboa(unix * 1000),
    diaEmLisboa(),
    etiqueta.startsWith('en') ? 'en' : 'pt',
  );

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** Um changeMessage é um formato da Apple: só o «%@» é especial, um «%» da recompensa escreve-se «%%». */
const semFormato = (s: string) => s.replace(/%/g, '%%');

/**
 * O aviso no ecrã bloqueado só vai num passe feito logo a seguir a um carimbo. A Apple mostra-o sempre
 * que o valor muda, e o valor também muda ao anular um carimbo (7 → 6 dizia «Carimbo novo: 6 de 10») e
 * ao mudar a língua da conta («7 de 10» → «7 of 10»). O aparelho vem buscar o passe segundos depois do
 * carimbo; um telemóvel desligado mais tempo do que isto recebe-o sem aviso.
 */
const MINUTOS_DO_AVISO = 30;

export function passJson(c: CartaoDoPasse, cfg: ConfiguracaoDoPasse, agoraS = Date.now() / 1000) {
  const lingua = c.lingua ?? 'pt';
  const t = TEXTOS_DO_PASSE[lingua];
  const faltam = Math.max(0, c.objectivo - c.carimbos);
  const recompensa = c.recompensa.trim() || t.premio;
  // O prémio a meio: antes dele, o passe fala dele (como a app); ganho, fica «por usar» até se entregar.
  const meio = c.meio ?? null;
  const antesDoMeio = !!meio && !meio.ganho && c.carimbos < meio.carimbos;
  const meiosPorUsar = c.meiosPorUsar && c.meiosPorUsar.n > 0 ? c.meiosPorUsar : null;
  // O aviso no ecrã bloqueado: «Carimbo novo: 7 de 10»; no 10.º, que o cartão está completo e que
  // este corte (o que se está a pagar) tem a oferta; a zeros (a entrega do prémio, ou anulado o
  // único) nada — era «Carimbo novo: 0 de 10». Sem carimbo há pouco, também nada (MINUTOS_DO_AVISO).
  const carimboAgora = !!c.ultima && agoraS - c.ultima.quando < MINUTOS_DO_AVISO * 60;
  const carimbos = {
    key: 'carimbos',
    label: t.carimbos,
    value: t.carimbosDe(c.carimbos, c.objectivo),
    ...(!carimboAgora
      ? {}
      : c.carimbos > 0 && c.carimbos >= c.objectivo
        ? {
            changeMessage: t.avisoCompleto(
              semFormato(minuscula(fraseDesteCorte(recompensa, lingua))),
            ),
          }
        : meio && meio.ganho && c.carimbos === meio.carimbos
          ? {
              changeMessage: t.avisoNovoEProximo(
                semFormato(t.ganhaste(minuscula(meio.recompensa))),
              ),
            }
          : c.carimbos > 0 && c.carimbos === c.objectivo - 1
            ? {
                changeMessage: t.avisoNovoEProximo(
                  semFormato(minuscula(fraseDoProximo(recompensa, lingua))),
                ),
              }
            : antesDoMeio && meio && c.carimbos > 0 && c.carimbos === meio.carimbos - 1
              ? {
                  changeMessage: t.avisoNovoEProximo(
                    semFormato(minuscula(fraseDoPremioAMeio(1, meio.recompensa, lingua))),
                  ),
                }
              : c.carimbos > 0
                ? { changeMessage: t.avisoNovo }
                : {}),
  };
  const cliente = c.nome ? [{ key: 'nome', label: t.cliente, value: c.nome }] : [];
  const porUsar = [
    ...(c.porUsar > 0
      ? [
          {
            key: 'porUsar',
            label: t.porUsar,
            value: c.porUsar === 1 ? recompensa : `${c.porUsar} × ${recompensa}`,
          },
        ]
      : []),
    ...(meiosPorUsar
      ? [
          {
            key: 'meioPorUsar',
            label: t.porUsar,
            value:
              meiosPorUsar.n === 1
                ? meiosPorUsar.recompensa
                : `${meiosPorUsar.n} × ${meiosPorUsar.recompensa}`,
          },
        ]
      : []),
  ];
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
            label: t.ultimaVisita,
            value: [dataCurta(c.ultima.quando, t.etiqueta), c.ultima.loja, c.ultima.pessoa]
              .filter(Boolean)
              .join(' · '),
          },
        ]
      : []),
    {
      key: 'como',
      label: t.comoFunciona,
      value: meio
        ? `${t.como(c.objectivo, minuscula(recompensa))} ${t.comoMeio(meio.carimbos, minuscula(meio.recompensa))}`
        : t.como(c.objectivo, minuscula(recompensa)),
    },
    ...(c.lojas.length
      ? [{ key: 'casas', label: t.asCasas, value: c.lojas.map((l) => l.nome).join(' · ') }]
      : []),
    ...(contacto ? [{ key: 'contacto', label: t.contacto, value: contacto }] : []),
    ...(c.site ? [{ key: 'site', label: t.site, value: c.site }] : []),
    ...(c.instagram
      ? [{ key: 'instagram', label: 'Instagram', value: `instagram.com/${c.instagram}` }]
      : []),
    {
      key: 'privacidade',
      label: t.privacidade,
      value: `${cfg.origemDaApp}/privacidade/${lingua === 'en' ? '?lingua=en' : ''}`,
    },
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
    description: t.descricao,
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
        relevantText: t.mostraOCartao(l.nome),
      })),
    // O iOS 26 e anteriores: a faixa com as casas (strip.png) por cima da linha
    // de campos, e o código em baixo. Sem campos principais, para a faixa ficar limpa.
    storeCard: {
      headerFields: [carimbos],
      secondaryFields: [
        ...cliente,
        antesDoMeio && meio
          ? {
              key: 'faltam',
              label: meio.recompensa.toUpperCase(),
              value: fraseDoCartao(
                c.carimbos,
                { objectivo: meio.carimbos, recompensa: '' },
                lingua,
              ),
            }
          : {
              key: 'faltam',
              label: recompensa.toUpperCase(),
              value: fraseDoCartao(c.carimbos, { objectivo: c.objectivo, recompensa: '' }, lingua),
            },
        ...porUsar,
      ],
      // Antes do prémio a meio, o do cartão numa linha por baixo, como na app (o Renato, 10 nov).
      ...(antesDoMeio
        ? {
            auxiliaryFields: [
              {
                key: 'premio',
                label: recompensa.toUpperCase(),
                value: fraseDoCartao(
                  c.carimbos,
                  { objectivo: c.objectivo, recompensa: '' },
                  lingua,
                ),
              },
            ],
          }
        : {}),
      // Sem «CORTES» na frente: o Renato tirou-o (7 nov, «não faz falta»); fica nas costas do poster.
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
        porUsar[0] ??
          (faltam === 0
            ? { key: 'cartao', label: t.cartao, value: t.completo }
            : { key: 'faltam', label: t.faltam(faltam), value: String(faltam) }),
      ],
      footerFields: [
        {
          key: 'rodape',
          value:
            c.porUsar > 0
              ? t.tensPorUsar(c.porUsar, minuscula(recompensa))
              : meiosPorUsar
                ? t.tensPorUsar(meiosPorUsar.n, minuscula(meiosPorUsar.recompensa))
                : antesDoMeio && meio
                  ? fraseDoPremioAMeio(meio.carimbos - c.carimbos, meio.recompensa, lingua)
                  : faltam === 0
                    ? t.cartaoCompleto
                    : faltam === 1
                      ? fraseDoProximo(recompensa, lingua)
                      : t.aoObjectivo(recompensa, c.objectivo),
        },
      ],
      backFields: [{ key: 'cortes', label: t.cortes, value: String(c.cortes) }, ...costas],
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
  const geradas = await imagensDoCartao({
    carimbos: cartao.carimbos,
    objectivo: cartao.objectivo,
    meio: cartao.meio?.carimbos ?? null,
  });
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
