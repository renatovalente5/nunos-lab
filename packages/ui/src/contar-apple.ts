import { Platform } from 'react-native';
import {
  corpoDoDesfechoDaApple,
  type DesfechoDaApple,
  type OrigemDaApple,
} from '@nunos-lab/dominio';

/** Quanto se espera antes de mandar outra vez uma contagem que não saiu (a 2.ª e a 3.ª vez). */
const ESPERAS = [4000, 15_000];

/**
 * Conta o que aconteceu à janela «Iniciar sessão com a Apple», sem saber de quem (apple.ts no
 * domínio). Nunca falha à vista. No telemóvel, se o envio falhar tenta mais duas vezes e diz
 * quantas falharam: se a contagem só sai à terceira, a rede estava má, e é isso que se quer saber.
 */
export function contarDesfechoDaApple(api: string, origem: OrigemDaApple, d: DesfechoDaApple) {
  const morada = `${api}/api/contar`;
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(morada, corpoDoDesfechoDaApple(origem, d));
      return;
    }
  } catch {
    // Segue pelo fetch.
  }
  const enviar = (reenvios: number) => {
    fetch(morada, {
      method: 'POST',
      body: corpoDoDesfechoDaApple(origem, d, reenvios),
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
    }).catch(() => {
      const espera = ESPERAS[reenvios];
      if (espera) setTimeout(() => enviar(reenvios + 1), espera);
    });
  };
  try {
    enviar(0);
  } catch {
    // Uma contagem perdida não estraga nada.
  }
}
