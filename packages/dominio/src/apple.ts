/**
 * O desfecho da janela «Iniciar sessão com a Apple» (14 nov 2026).
 *
 * A janela é do sistema. Quando a Apple falha lá dentro («Não foi possível estabelecer ligação», com
 * a rede boa), a app não recebe nada e a API nem chega a ser chamada: três clientes num sábado, e nos
 * registos nada. As apps passam a contar o que aconteceu à janela, sem saber de quem, pelo
 * /api/contar: na base fica só o dia, o tipo e o número (o «ref» diz de que app veio), e o resto (o
 * código, os segundos, a tentativa) vai para o registo do Worker, que dura poucos dias.
 */
export type DesfechoDaApple = {
  /**
   * «fechou» tanto é quem desistiu como quem viu a Apple falhar e fechou a janela: o iOS dá o mesmo
   * código aos dois (ERR_REQUEST_CANCELED). Os segundos ajudam a separar.
   */
  desfecho: 'entrou' | 'fechou' | 'falhou';
  /** O código do erro, como a Apple o dá (ERR_REQUEST_CANCELED, popup_closed_by_user…). */
  codigo: string;
  /** Do toque no botão até ao desfecho. */
  segundos: number;
  /** A 1.ª, a 2.ª… vez que a janela abre neste ecrã. */
  tentativa: number;
};

/** De que app veio: o «ref» destas contagens. */
export const ORIGEM_DA_APPLE = { cliente: 1, clienteWeb: 2, balcao: 3, balcaoWeb: 4 } as const;
export type OrigemDaApple = (typeof ORIGEM_DA_APPLE)[keyof typeof ORIGEM_DA_APPLE];

const NOME_DA_ORIGEM: Record<number, keyof typeof ORIGEM_DA_APPLE> = {
  1: 'cliente',
  2: 'clienteWeb',
  3: 'balcao',
  4: 'balcaoWeb',
};
const DESFECHOS = ['entrou', 'fechou', 'falhou'] as const;

const inteiro = (v: unknown, minimo: number, maximo: number, seNao: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : seNao;
  return Math.min(maximo, Math.max(minimo, n));
};

/**
 * O corpo do pedido ao /api/contar. Curto de propósito: a API só lê os primeiros 200 caracteres.
 * «reenvios» é quantas vezes o envio falhou antes deste (0 = à primeira): diz se a rede estava má.
 */
export function corpoDoDesfechoDaApple(
  origem: OrigemDaApple,
  d: DesfechoDaApple,
  reenvios = 0,
): string {
  return JSON.stringify({
    tipo: `apple_${d.desfecho}`,
    ref: origem,
    c: d.codigo.replace(/[^A-Za-z0-9_]/g, '').slice(0, 40),
    s: inteiro(d.segundos, 0, 3600, 0),
    n: inteiro(d.tentativa, 1, 99, 1),
    r: inteiro(reenvios, 0, 9, 0),
  });
}

export type DesfechoDaAppleLido = {
  tipo: `apple_${DesfechoDaApple['desfecho']}`;
  ref: OrigemDaApple;
  desfecho: DesfechoDaApple['desfecho'];
  origem: keyof typeof ORIGEM_DA_APPLE;
  codigo: string;
  segundos: number;
  tentativa: number;
  reenvios: number;
};

/** O que a API aceita desse corpo; null se não for um desfecho da Apple bem formado. */
export function lerDesfechoDaApple(dados: unknown): DesfechoDaAppleLido | null {
  if (typeof dados !== 'object' || dados === null) return null;
  const { tipo, ref, c, s, n, r } = dados as Record<string, unknown>;
  if (typeof tipo !== 'string' || !tipo.startsWith('apple_')) return null;
  const desfecho = DESFECHOS.find((x) => x === tipo.slice(6));
  if (!desfecho) return null;
  const origem = typeof ref === 'number' ? NOME_DA_ORIGEM[ref] : undefined;
  if (!origem) return null;
  return {
    tipo: `apple_${desfecho}`,
    ref: ORIGEM_DA_APPLE[origem],
    desfecho,
    origem,
    codigo: typeof c === 'string' ? c.replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) : '',
    segundos: inteiro(s, 0, 3600, 0),
    tentativa: inteiro(n, 1, 99, 1),
    reenvios: inteiro(r, 0, 9, 0),
  };
}
