/**
 * Os contactos de um parceiro, escritos como as pessoas os escrevem, e as
 * ligações que a app abre com eles. Cada `normalizar` devolve a forma que se
 * guarda, ou `null` quando o valor não serve; o vazio é sempre válido.
 */

const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;

/** Caminhos do Instagram que não são contas: uma publicação colada não grava a conta «p». */
const NAO_SAO_CONTAS = new Set(['p', 'reel', 'reels', 'tv', 'explore', 'accounts', 'direct']);

/**
 * «@tasca», «tasca», «instagram.com/tasca/?hl=pt», «m.instagram.com/tasca»,
 * «instagram.com/stories/tasca/123» → «tasca». A ligação de uma publicação
 * (/p/…, /reel/…) não diz de quem é: recusa-se.
 */
export function normalizarInstagram(entrada: string): string | null {
  let t = entrada.trim();
  if (!t) return '';
  const eLigacao = /^(https?:\/\/)?([a-z]+\.)?instagram\.com\//i.test(t);
  t = t.replace(/^https?:\/\//i, '').replace(/^([a-z]+\.)?instagram\.com\//i, '');
  const partes = t.replace(/^@/, '').split(/[?#]/)[0]!.split('/').filter(Boolean);
  if (eLigacao && partes[0] === 'stories') partes.shift();
  const conta = partes[0] ?? '';
  if (eLigacao && NAO_SAO_CONTAS.has(conta.toLowerCase())) return null;
  return INSTAGRAM.test(conta) ? conta : null;
}

export function ligacaoDoInstagram(conta: string): string {
  return `https://instagram.com/${encodeURIComponent(conta)}`;
}

/** Acrescenta o https:// que falta; só aceita endereços http(s) com um nome com ponto. */
export function normalizarSite(entrada: string): string | null {
  const t = entrada.trim();
  if (!t) return '';
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(comEsquema);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.') || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Telefones portugueses e internacionais: algarismos, espaços e um «+» no início. */
export function normalizarTelefone(entrada: string): string | null {
  // «912-345-678», «(+351) 912 345 678», «912.345.678»: a pontuação vira espaço.
  const t = entrada
    .replace(/[().\-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  if (!t) return '';
  if (!/^\+?[0-9 ]+$/.test(t)) return null;
  const algarismos = t.replace(/\D/g, '');
  return algarismos.length >= 9 && algarismos.length <= 15 ? t : null;
}

export function ligacaoDoTelefone(telefone: string): string {
  return `tel:${telefone.replace(/[^\d+]/g, '')}`;
}

/**
 * A morada nas apps de mapas, para quem a abre escolher. Os endereços https abrem
 * a app no telemóvel quando está instalada, e o mapa no browser quando não está.
 */
export function ligacoesDosMapas(
  morada: string,
  nome = '',
  sitio: Sitio | null = null,
): Record<'apple' | 'google' | 'waze', string> {
  // Com o sítio exato (as coordenadas do backoffice), as três vão ao ponto: procurar pelo nome levava
  // a outro sítio quando o parceiro não tem perfil no Google (o Renato, 10 nov 2026). Os Mapas da
  // Apple põem o nome no pino; o Google Maps e o Waze mostram o ponto.
  if (sitio) {
    const ponto = `${sitio.lat},${sitio.lng}`;
    const rotulo = encodeURIComponent(nome || morada);
    return {
      apple: `https://maps.apple.com/?ll=${ponto}${rotulo ? `&q=${rotulo}` : ''}`,
      google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ponto)}`,
      waze: `https://waze.com/ul?ll=${ponto}&navigate=yes`,
    };
  }
  const q = encodeURIComponent([nome, morada].filter(Boolean).join(', '));
  return {
    apple: `https://maps.apple.com/?q=${q}`,
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: `https://waze.com/ul?q=${q}`,
  };
}

/** Um ponto no mapa, em graus decimais. */
export type Sitio = { lat: number; lng: number };

const seisCasas = (x: number) => Math.round(x * 1e6) / 1e6;

/**
 * As coordenadas de um sítio, coladas como o Google Maps as dá: «40.884, -8.452» (o que aparece ao
 * carregar sem largar no mapa), em graus, minutos e segundos («40°53'02.6"N 8°27'06.1"W»), ou numa
 * ligação do Google Maps que as traga (o pino «!3d…!4d…», «?q=40.884,-8.452», ou o centro «@…»). As
 * ligações curtas («maps.app.goo.gl/…») não as trazem: recusam-se. Vazio: sem coordenadas
 * ({ lat: null, lng: null }); outra coisa, ou fora do mundo: null.
 */
export function lerCoordenadas(entrada: string): { lat: number | null; lng: number | null } | null {
  const t = entrada.trim();
  if (!t) return { lat: null, lng: null };
  const ponto = (lat: number, lng: number) =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : null;
  const decimal = /^(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(t);
  if (decimal) return ponto(Number(decimal[1]), Number(decimal[2]));
  const graus =
    /^(\d{1,2})°\s*(\d{1,2})['′]\s*(\d+(?:\.\d+)?)["″]?\s*([NS])[\s,]+(\d{1,3})°\s*(\d{1,2})['′]\s*(\d+(?:\.\d+)?)["″]?\s*([EWO])$/i.exec(
      t,
    );
  if (graus) {
    const [, la, lm, ls, ns, ga, gm, gs, eo] = graus as unknown as string[];
    const lat = (Number(la) + Number(lm) / 60 + Number(ls) / 3600) * (/s/i.test(ns!) ? -1 : 1);
    const lng = (Number(ga) + Number(gm) / 60 + Number(gs) / 3600) * (/[wo]/i.test(eo!) ? -1 : 1);
    return ponto(seisCasas(lat), seisCasas(lng));
  }
  if (/^https?:\/\//i.test(t)) {
    let u = t;
    try {
      u = decodeURIComponent(t);
    } catch {
      // Um «%» partido: lê-se como veio.
    }
    const n = '(-?\\d{1,3}(?:\\.\\d+)?)';
    const m =
      new RegExp(`!3d${n}!4d${n}`).exec(u) ??
      new RegExp(`[?&](?:q|query|ll|destination|daddr|center)=${n},\\s*${n}`).exec(u) ??
      new RegExp(`@${n},${n}`).exec(u);
    if (m) return ponto(Number(m[1]), Number(m[2]));
  }
  return null;
}

/** Ligações que o backoffice deixa pôr (marcações, WhatsApp, TikTok): só https. */
export function normalizarLigacao(entrada: string): string | null {
  const n = normalizarSite(entrada);
  if (n === null || n === '') return n;
  return n.startsWith('https://') ? n : null;
}

/** Um email para comparar: sem espaços e em minúsculas. `null` se não tiver forma de email. */
/** Um nome para procurar: sem acentos nem maiúsculas, espaços arrumados («João Ñandú» → «joao nandu»). */
const LETRAS_QUE_O_NFD_NAO_PARTE: Record<string, string> = {
  ø: 'o',
  ł: 'l',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
};
export function textoDeBusca(entrada: string): string {
  return entrada
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[øłßæœđðþı]/g, (l) => LETRAS_QUE_O_NFD_NAO_PARTE[l] ?? l)
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarEmail(entrada: string): string | null {
  const t = entrada.trim().toLowerCase();
  if (t.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}

/** «re…@gmail.com»: chega para distinguir homónimos ao balcão, não para escrever a ninguém. */
export function emailCurto(email: string | null | undefined): string | null {
  if (!email) return null;
  const arroba = email.indexOf('@');
  if (arroba < 0) return `${email.slice(0, 2)}…`;
  return `${email.slice(0, Math.min(2, arroba))}…@${email.slice(arroba + 1)}`;
}

/** As redes e contactos da barbearia, pela ordem com que a app as mostra (o Nuno escolhe-a, 8 nov). */
export const REDES = ['whatsapp', 'instagram', 'tiktok', 'site'] as const;
export type Rede = (typeof REDES)[number];

/**
 * A ordem gravada («instagram,whatsapp,…»): as quatro, sem repetir, e o que faltar (ou uma ordem
 * vazia, de antes de se poder escolher) vai para o fim pela ordem de sempre.
 */
export function ordemDasRedes(texto: string | null | undefined): Rede[] {
  const lidas = (texto ?? '')
    .split(',')
    .filter((r): r is Rede => (REDES as readonly string[]).includes(r));
  return [...new Set<Rede>([...lidas, ...REDES])];
}
