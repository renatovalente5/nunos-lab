import { recompensaEmIngles } from '@nunos-lab/dominio';

/**
 * A tradução automática para inglês do que o backoffice guarda em português (o Renato, 8 nov:
 * «escrever só em português; se o inglês ficar vazio, traduz-se sozinho»). O motor é o Workers AI
 * da conta: sem chave nem conta nova. Se falhar, guarda-se na mesma e a app mostra o português.
 */

/** O modelo (escolhido a 8 nov 2026, comparando vários com os textos da base). */
export const MODELO_DE_TRADUCAO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const INSTRUCOES = `You translate short texts for Nuno's Lab, a barbershop in Portugal with a loyalty-card app, from European Portuguese into natural British English, as a native copywriter would write them in an app.
The input is a JSON list. Each item has "texto" (the text to translate) and may have "campo" (what the text is) and "onde" (the partner business and its category). Use "campo" and "onde" only to choose the right words (a used car, not a used item; "On your meal", not "On the meal"); never add them to the translation.
Rules:
- Keep the meaning and the length: a short label stays a short label; a sentence stays one sentence.
- Never translate proper names: people, shops, partner businesses, streets, towns and brands (Nuno's Lab, Tasca Velha do Cravo, Nogueira do Cravo, Santa Maria da Feira, Aveiro, WhatsApp, Instagram, Fresha).
- Keep numbers, percentages, times and symbols exactly (−10%, 2×1, 12:00–15:00), with plain hyphens and spaces. Write euro amounts the British way without converting them (−300 € becomes −€300; 15,00 € becomes €15.00).
- British spelling and usage (colour, centre, Mon to Fri).
- Answer with JSON only, nothing else: {"traducoes": ["...", "..."]}, one translation per input item, in the same order.`;

/** Tem letras: «−10%» e «2×1» ficam como estão, nas duas línguas. */
export function temLetras(texto: string): boolean {
  return /\p{L}/u.test(texto);
}

/**
 * Os sinais como no original: o hífen que não parte (U+2011) passa a hífen, e o menos (−) do
 * português não se perde num «-» antes de um número ou do euro.
 */
function sinais(traducao: string, original: string): string {
  const t = traducao.replace(/\u2011/g, '-');
  return original.includes('−') ? t.replace(/(^|[\s(])-(?=[€\d])/g, '$1−') : t;
}

/** O texto da resposta, seja qual for a forma do modelo (Workers AI ou a das APIs da OpenAI). */
function textoDaResposta(r: unknown): string {
  const x = r as {
    response?: unknown;
    choices?: { message?: { content?: unknown } }[];
    output_text?: unknown;
    output?: { type?: string; content?: { text?: unknown }[] }[];
  };
  if (typeof x?.response === 'string') return x.response;
  if (x?.response && typeof x.response === 'object') return JSON.stringify(x.response);
  const escolha = x?.choices?.[0]?.message?.content;
  if (typeof escolha === 'string') return escolha;
  if (typeof x?.output_text === 'string') return x.output_text;
  const mensagem = x?.output?.find((o) => o.type === 'message')?.content?.[0]?.text;
  return typeof mensagem === 'string' ? mensagem : '';
}

/** O que cada campo é, para o modelo escolher as palavras (dito em inglês, como as instruções). */
export const CAMPOS = {
  categoria:
    'name of a category of partner businesses, short like a tab label (Comer → Food, Café → Coffee, Carros → Cars, Treino → Fitness, Barbas e cabelo → Beards & hair)',
  horario: 'opening hours of a partner business',
  descricao: 'one-line description of a partner business',
  destaque: 'the big highlight of a perk, very short (Grátis → Free, 2×1 → 2 for 1)',
  titulo:
    'the second line of a perk: what the discount is on, or the thing that is free (Na refeição → On your meal, Na revisão → On a service, Sobremesa da casa → House dessert)',
  detalhe: 'the conditions of a perk',
  aviso: 'a notice shown to clients at the top of the app',
  recompensa:
    'the loyalty-card reward a client gets at the barbershop when the card is full (a corte is a haircut)',
  aniversario:
    'the gift clients get on their birthday at the barbershop (a corte is a haircut, barba is a beard trim)',
} as const;
export type CampoDoTexto = keyof typeof CAMPOS;

/** Um texto a traduzir, com o campo e o parceiro (nome e categoria) quando se sabem. */
export type ItemATraduzir = { texto: string; campo?: CampoDoTexto; onde?: string };

/**
 * Traduz de uma vez os textos (em português) e devolve-os pela mesma ordem; `null` se o motor
 * faltar, falhar ou responder outra coisa (nunca meia lista).
 */
export async function traduzir(
  ai: Ai | undefined,
  itens: ItemATraduzir[],
  modelo: string = MODELO_DE_TRADUCAO,
): Promise<string[] | null> {
  if (!itens.length) return [];
  if (!ai) return null;
  const textos = itens.map((i) => i.texto);
  const entrada = itens.map(({ texto, campo, onde }) => ({
    texto,
    ...(campo ? { campo: CAMPOS[campo] } : {}),
    ...(onde ? { onde } : {}),
  }));
  try {
    const r = await ai.run(
      modelo as Parameters<Ai['run']>[0],
      {
        messages: [
          { role: 'system', content: INSTRUCOES },
          { role: 'user', content: JSON.stringify(entrada) },
        ],
        temperature: 0,
        max_tokens: 2048,
      } as never,
    );
    const bruto = textoDaResposta(r);
    const json = bruto.slice(bruto.indexOf('{'), bruto.lastIndexOf('}') + 1);
    const lista = (JSON.parse(json) as { traducoes?: unknown }).traducoes;
    if (!Array.isArray(lista) || lista.length !== textos.length) return null;
    const limpas = lista.map((t, i) => (typeof t === 'string' ? sinais(t.trim(), textos[i]!) : ''));
    // Uma tradução vazia, ou muito maior do que o original, é o modelo a divagar.
    if (limpas.some((t, i) => !t || t.length > textos[i]!.length * 3 + 40)) return null;
    return limpas;
  } catch (e) {
    console.error('traduzir', e);
    return null;
  }
}

/**
 * Um campo com inglês num formulário: o português e o inglês que vieram (undefined = não veio) e,
 * ao alterar, os de antes. O prémio do cartão (`recompensa`) traduz-se primeiro pelas regras do
 * domínio («50% de desconto» → «50% off»), porque as frases do cartão dependem delas.
 */
export type CampoComIngles = {
  campo: CampoDoTexto;
  pt: string | undefined;
  en: string | undefined;
  ptAntes?: string;
  enAntes?: string;
  /** O parceiro e a categoria («Tasca Velha do Cravo — Comer»), quando o campo é de um parceiro. */
  onde?: string;
};

/**
 * O inglês a guardar em cada campo. Traduz-se quando o inglês fica vazio, ou quando o português
 * mudou e o inglês ficou como estava (já não diz o mesmo). O inglês escrito nessa vez fica. Devolve
 * undefined onde não há nada a mudar.
 */
export async function completarIngles(
  ai: Ai | undefined,
  campos: CampoComIngles[],
): Promise<(string | undefined)[]> {
  const aTraduzir: number[] = [];
  // Os que se traduzem porque o português mudou: se o motor falhar, o inglês antigo sai (dizia outra
  // coisa — um desconto que já não existe); a app mostra o português até haver tradução.
  const velhos = new Set<number>();
  const decididos = campos.map((f, i) => {
    // Nem o português nem o inglês vieram (pausar um parceiro, mudar a ordem): não se mexe.
    if (f.pt === undefined && f.en === undefined) return undefined;
    const pt = (f.pt ?? f.ptAntes ?? '').trim();
    const en = (f.en ?? f.enAntes ?? '').trim();
    if (!pt || !temLetras(pt)) return f.en;
    const ptMudou = f.pt !== undefined && f.ptAntes !== undefined && pt !== f.ptAntes.trim();
    const enIntocado = f.en === undefined || (f.enAntes !== undefined && f.en === f.enAntes);
    if (en && !(ptMudou && enIntocado)) return f.en;
    if (en) velhos.add(i);
    if (f.campo === 'recompensa') {
      const pelasRegras = recompensaEmIngles(pt);
      if (pelasRegras !== pt) return pelasRegras;
    }
    aTraduzir.push(i);
    return f.en;
  });
  if (!aTraduzir.length) return decididos;
  const traduzidos = await traduzir(
    ai,
    aTraduzir.map((i) => ({
      texto: (campos[i]!.pt ?? campos[i]!.ptAntes ?? '').trim(),
      campo: campos[i]!.campo,
      onde: campos[i]!.onde,
    })),
  );
  if (!traduzidos) return decididos.map((v, i) => (velhos.has(i) ? '' : v));
  aTraduzir.forEach((i, k) => (decididos[i] = traduzidos[k]));
  return decididos;
}
