import { Platform } from 'react-native';

/**
 * O nome deste aparelho para a lista das sessões («iPhone», «iPad», «Android · Samsung SM-S911B»),
 * que as apps mandam no cabeçalho `X-Aparelho`. Na web fica vazio: a API lê o browser do User-Agent.
 * Sem módulo nativo, para chegar às apps já instaladas por actualização.
 */
export function nomeDoAparelho(): string {
  if (Platform.OS === 'ios') return Platform.isPad ? 'iPad' : 'iPhone';
  if (Platform.OS !== 'android') return '';
  const k = Platform.constants as { Manufacturer?: string; Brand?: string; Model?: string };
  const marca = (k.Manufacturer ?? k.Brand ?? '').trim();
  const modelo = (k.Model ?? '').trim();
  const nome =
    !marca || modelo.toLowerCase().startsWith(marca.toLowerCase())
      ? modelo
      : `${marca.charAt(0).toUpperCase()}${marca.slice(1)} ${modelo}`;
  return nome ? `Android · ${nome}` : 'Android';
}

/**
 * O cabeçalho com o nome do aparelho, só nas apps nativas (na web pedia uma autorização a mais).
 * Vai codificado (só ASCII), e a API descodifica-o: o fetch do Expo no Android junta os cabeçalhos com o
 * `Headers.Builder.add()` do OkHttp, que recusa o «·» de «Android · Samsung…». O pedido rebentava no
 * telemóvel, antes de sair, e a entrada dizia «Sem ligação» em todos os Android (13 nov 2026).
 */
export function cabecalhoDoAparelho(): Record<string, string> {
  const nome = nomeDoAparelho();
  return nome ? { 'X-Aparelho': encodeURIComponent(nome) } : {};
}
