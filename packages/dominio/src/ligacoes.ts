/**
 * Os contactos de um parceiro, escritos como as pessoas os escrevem, e as
 * ligações que a app abre com eles. Cada `normalizar` devolve a forma que se
 * guarda, ou `null` quando o valor não serve; o vazio é sempre válido.
 */

const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;

/** «@tasca», «tasca», «instagram.com/tasca/?hl=pt» → «tasca». */
export function normalizarInstagram(entrada: string): string | null {
  let t = entrada.trim();
  if (!t) return '';
  t = t.replace(/^https?:\/\//i, '').replace(/^(www\.)?instagram\.com\//i, '');
  t = t.replace(/^@/, '').split(/[/?#]/)[0] ?? '';
  return INSTAGRAM.test(t) ? t : null;
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
  const t = entrada.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  if (!/^\+?[0-9 ]+$/.test(t)) return null;
  const algarismos = t.replace(/\D/g, '');
  return algarismos.length >= 9 && algarismos.length <= 15 ? t : null;
}

export function ligacaoDoTelefone(telefone: string): string {
  return `tel:${telefone.replace(/[^\d+]/g, '')}`;
}

/** A morada no mapa (abre a app de mapas no telemóvel). */
export function ligacaoDoMapa(morada: string, nome = ''): string {
  const q = [nome, morada].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Ligações que o backoffice deixa pôr (marcações, WhatsApp, TikTok): só https. */
export function normalizarLigacao(entrada: string): string | null {
  const n = normalizarSite(entrada);
  if (n === null || n === '') return n;
  return n.startsWith('https://') ? n : null;
}

/** Um email para comparar: sem espaços e em minúsculas. `null` se não tiver forma de email. */
export function normalizarEmail(entrada: string): string | null {
  const t = entrada.trim().toLowerCase();
  if (t.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}
