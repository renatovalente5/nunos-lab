import { useQuery } from '@tanstack/react-query';
import {
  AJUSTE_DE_ORIGEM,
  CORES_DOS_PARCEIROS,
  DESENHOS_DAS_CATEGORIAS,
  ICONES_DAS_CATEGORIAS,
  ajusteDosDedos,
  caixaDoLogotipo,
  corParaBranco,
  eCor,
  limitarAjuste,
  luminancia,
  misturar,
  nomeDoDesenho,
  semPartir,
  validadeEmTexto,
  type AjusteDoLogotipo,
  type CategoriaComContagem,
  type IconeDaCategoria,
  type PontoNoCirculo,
} from '@nunos-lab/dominio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { API, mensagemDe, pedir } from './api';
import { carregarImagem, carregarLogotipo, corDoLogotipo } from './imagens';
import { useLingua } from './lingua';
import { textos, useTextos } from './textos';
import { numero } from './util';

// ——— ícones (linha, 24×24) ———

const DESENHOS = {
  resumo: ['M4 13h6V4H4z', 'M14 20h6v-9h-6z', 'M14 8h6V4h-6z', 'M4 20h6v-3H4z'],
  parceiros: ['M3 21V9l9-6 9 6v12', 'M9 21v-7h6v7'],
  promocoes: [
    'M3.5 12.4V4.5a1 1 0 0 1 1-1h7.9l8.6 8.6a1.4 1.4 0 0 1 0 2l-6.4 6.4a1.4 1.4 0 0 1-2 0z',
    'M8 8h.01',
  ],
  categorias: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  barbearia: [
    'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M8.4 7.6L20 18.5',
    'M8.4 16.4L20 5.5',
  ],
  acessos: ['M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M3 21a8 8 0 0 1 16 0'],
  registo: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3.2 2'],
  metricas: ['M4 4v16h16', 'M8 15l4-5 3 3 5-6'],
  clientes: [
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    'M2.5 20a6.5 6.5 0 0 1 13 0',
    'M16 4.3a3.5 3.5 0 0 1 0 6.7',
    'M17.5 13.6a6.5 6.5 0 0 1 4 6.4',
  ],
  equipa: [
    'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
    'M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    'M8 17.5a4 4 0 0 1 8 0',
  ],
  fidelidade: [
    'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    'M7.5 12h.01',
    'M12 12h.01',
    'M16.5 12h.01',
  ],
  descarregar: ['M12 4v11', 'M7.5 10.5L12 15l4.5-4.5', 'M5 19h14'],
  mais: ['M12 5v14', 'M5 12h14'],
  menos: ['M5 12h14'],
  seguinte: ['M9 5l7 7-7 7'],
  certo: ['M5 12.5l4.5 4.5L19 7.5'],
  voltar: ['M15 5l-7 7 7 7'],
  fechar: ['M6 6l12 12', 'M18 6L6 18'],
  subir: ['M12 19V5', 'M6 11l6-6 6 6'],
  descer: ['M12 5v14', 'M6 13l6 6 6-6'],
  estrela: ['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'],
  copiar: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  partilhar: ['M12 3v12', 'M7.5 7.5L12 3l4.5 4.5', 'M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'],
  sair: ['M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4', 'M10 16l4-4-4-4', 'M14 12H4'],
  aberto: [
    'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  lingua: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M3.5 12h17',
    'M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z',
  ],
} as const;

export type NomeDoIcone = keyof typeof DESENHOS;

export function Icone({
  nome,
  tamanho = 20,
  espessura = 1.9,
}: {
  nome: NomeDoIcone;
  tamanho?: number;
  espessura?: number;
}) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {DESENHOS[nome].map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

// ——— avisos curtos («Guardado») ———

type Aviso = { id: number; texto: string; mau: boolean };
const ContextoDosAvisos = createContext<(texto: string, mau?: boolean) => void>(() => {});

export function Avisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, mau = false) => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a.slice(-2), { id, texto, mau }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), mau ? 6000 : 2600);
  }, []);
  return (
    <ContextoDosAvisos.Provider value={avisar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`aviso${a.mau ? ' mau' : ''}`}>
            {a.texto}
          </div>
        ))}
      </div>
    </ContextoDosAvisos.Provider>
  );
}

export const useAvisar = () => useContext(ContextoDosAvisos);

/** Corre uma acção, mostra «feito» ou o erro, e devolve se correu bem. */
export function useAccao() {
  const avisar = useAvisar();
  const [aCorrer, setACorrer] = useState(false);
  const correr = useCallback(
    async (f: () => Promise<unknown>, feito?: string) => {
      setACorrer(true);
      try {
        await f();
        if (feito) avisar(feito);
        return true;
      } catch (e) {
        avisar(mensagemDe(e), true);
        return false;
      } finally {
        setACorrer(false);
      }
    },
    [avisar],
  );
  return { correr, aCorrer };
}

// ——— campos ———

export function Campo({
  rotulo,
  valor,
  mudar,
  max,
  ajuda,
  erro,
  erroTexto,
  tipo = 'text',
  obrigatorio,
  placeholder,
  modoDeTeclado,
  autoFocus,
  minimo,
  maximo,
  passo,
}: {
  rotulo: string;
  valor: string;
  mudar: (v: string) => void;
  max?: number;
  ajuda?: ReactNode;
  erro?: boolean;
  /** Porque está mal («Põe só a conta…»); sem isto, «Revê este campo.». */
  erroTexto?: string;
  tipo?: 'text' | 'date' | 'url' | 'tel' | 'number';
  obrigatorio?: boolean;
  placeholder?: string;
  modoDeTeclado?: 'text' | 'tel' | 'url' | 'numeric' | 'decimal';
  autoFocus?: boolean;
  /** Só para `tipo="number"`. */
  minimo?: number;
  maximo?: number;
  passo?: number;
}) {
  const id = useId();
  return (
    <div className={`campo${erro ? ' erro' : ''}`}>
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        className="entrada"
        type={tipo}
        value={valor}
        maxLength={max}
        required={obrigatorio}
        placeholder={placeholder}
        inputMode={modoDeTeclado}
        autoFocus={autoFocus}
        min={minimo}
        max={maximo}
        step={passo}
        aria-invalid={erro || undefined}
        aria-describedby={ajuda || erro ? `${id}-a` : undefined}
        onChange={(e) => mudar(e.target.value)}
      />
      {erro ? (
        <div className="mensagem-erro" id={`${id}-a`}>
          {erroTexto ?? textos().geral.reveEsteCampo}
        </div>
      ) : (
        ajuda && (
          <div className="ajuda" id={`${id}-a`}>
            {ajuda}
          </div>
        )
      )}
    </div>
  );
}

export function AreaDeTexto({
  rotulo,
  valor,
  mudar,
  max,
  erro,
  ajuda,
}: {
  rotulo: string;
  valor: string;
  mudar: (v: string) => void;
  max: number;
  erro?: boolean;
  ajuda?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`campo${erro ? ' erro' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      <textarea
        id={id}
        className="entrada"
        value={valor}
        maxLength={max}
        aria-invalid={erro || undefined}
        onChange={(e) => mudar(e.target.value)}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span className="ajuda">
          {erro ? <span className="mensagem-erro">{textos().geral.reveEsteCampo}</span> : ajuda}
        </span>
        {/* A conta só aparece perto do limite: antes disso é ruído. */}
        {valor.length >= max * 0.8 && (
          <span className="conta">
            {valor.length}/{max}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Um número pequeno com − e +, como nos Ajustes do iPhone; vazio é «sem limite» (o texto de
 * `vazio`), e o − abaixo do mínimo volta a vazio. Também se escreve à mão (um total grande).
 * O valor é o texto do campo: quem o usa confere-o ao gravar.
 */
export function Contador({
  rotulo,
  valor,
  mudar,
  minimo,
  maximo,
  vazio,
  erro,
}: {
  rotulo: string;
  valor: string;
  mudar: (v: string) => void;
  minimo: number;
  maximo: number;
  vazio: string;
  erro?: boolean;
}) {
  const id = useId();
  const t = useTextos();
  const n = valor.trim() ? Number(valor) : null;
  const menos = () =>
    mudar(n === null || Number.isNaN(n) || n <= minimo ? '' : String(Math.min(n - 1, maximo)));
  const mais = () =>
    mudar(
      n === null || Number.isNaN(n)
        ? String(minimo)
        : String(Math.min(Math.max(n + 1, minimo), maximo)),
    );
  return (
    <div className={`campo${erro ? ' erro' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      <div className="contador">
        <button
          type="button"
          onClick={menos}
          disabled={n === null}
          aria-label={`${t.geral.menos} · ${rotulo}`}
        >
          <Icone nome="menos" tamanho={18} espessura={2.2} />
        </button>
        <input
          id={id}
          value={valor}
          placeholder={vazio}
          inputMode="numeric"
          aria-invalid={erro || undefined}
          onChange={(e) => mudar(e.target.value.replace(/\D/g, '').slice(0, String(maximo).length))}
        />
        <button
          type="button"
          onClick={mais}
          disabled={n !== null && n >= maximo}
          aria-label={`${t.geral.mais} · ${rotulo}`}
        >
          <Icone nome="mais" tamanho={18} espessura={2.2} />
        </button>
      </div>
      {erro && <div className="mensagem-erro">{t.geral.reveEsteCampo}</div>}
    </div>
  );
}

export function Seletor<T extends string | number>({
  rotulo,
  valor,
  mudar,
  opcoes,
  vazio,
  erro,
  ajuda,
  desligado,
}: {
  rotulo: string;
  valor: T | null;
  mudar: (v: T | null) => void;
  opcoes: { valor: T; nome: string }[];
  vazio?: string;
  erro?: boolean;
  ajuda?: ReactNode;
  /** Sem efeito agora (fica à vista, mais claro, para a linha não saltar). */
  desligado?: boolean;
}) {
  const id = useId();
  return (
    <div className={`campo${erro ? ' erro' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      <select
        id={id}
        className="entrada"
        disabled={desligado}
        value={valor === null ? '' : String(valor)}
        onChange={(e) => {
          const escolhida = opcoes.find((o) => String(o.valor) === e.target.value);
          mudar(escolhida ? escolhida.valor : null);
        }}
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={String(o.valor)} value={String(o.valor)}>
            {o.nome}
          </option>
        ))}
      </select>
      {ajuda && <div className="ajuda">{ajuda}</div>}
    </div>
  );
}

export function Interruptor({
  ligado,
  mudar,
  rotulo,
  ajuda,
}: {
  ligado: boolean;
  mudar: (v: boolean) => void;
  rotulo: string;
  ajuda?: string;
}) {
  const id = useId();
  return (
    <div className="interruptor-linha">
      <div id={id}>
        <div className="texto">{rotulo}</div>
        {ajuda && <div className="ajuda">{ajuda}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-labelledby={id}
        className="interruptor"
        onClick={() => mudar(!ligado)}
      />
    </div>
  );
}

export function Segmentado<T extends string | number>({
  opcoes,
  valor,
  mudar,
  rotulo,
  cheio = false,
}: {
  opcoes: { valor: T; nome: string }[];
  valor: T;
  mudar: (v: T) => void;
  rotulo: string;
  /** Num formulário: a largura dos campos, em partes iguais e com a altura deles. */
  cheio?: boolean;
}) {
  return (
    <div className={cheio ? 'segmentado cheio' : 'segmentado'} role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          aria-pressed={o.valor === valor}
          onClick={() => mudar(o.valor)}
        >
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function Cores({
  valor,
  mudar,
  doLogotipo = [],
}: {
  valor: string;
  mudar: (v: string) => void;
  /** As cores principais do logótipo, que vão à frente (o Renato, 10 nov). */
  doLogotipo?: string[];
}) {
  const t = useTextos();
  // Só as que servem de fundo à capa, com o texto branco por cima: nem quase brancas nem o preto (a
  // capa preta some-se no fundo da app; um verde quase preto, como o da Ourivesaria Bastos, serve).
  // As que já estão na lista não se repetem.
  const sugeridas = doLogotipo
    .filter((c) => {
      const l = luminancia(c);
      return l >= 0.005 && l <= 0.8 && !(CORES_DOS_PARCEIROS as readonly string[]).includes(c);
    })
    .slice(0, 3);
  return (
    <div className="campo">
      <span className="rotulo-campo" id="cor-do-parceiro">
        {t.geral.cor}
      </span>
      <div className="cores" role="group" aria-labelledby="cor-do-parceiro">
        {sugeridas.map((c) => (
          <button
            key={c}
            type="button"
            className="cor"
            style={{ background: c }}
            aria-pressed={valor.toUpperCase() === c}
            aria-label={t.geral.corDoLogotipo(c)}
            title={t.geral.corDoLogotipo(c)}
            onClick={() => mudar(c)}
          />
        ))}
        {sugeridas.length > 0 && <span className="separador-de-cores" aria-hidden="true" />}
        {CORES_DOS_PARCEIROS.map((c) => (
          <button
            key={c}
            type="button"
            className="cor"
            style={{ background: c }}
            aria-pressed={valor.toUpperCase() === c}
            aria-label={t.geral.corDe(c)}
            onClick={() => mudar(c)}
          />
        ))}
        <OutraCor valor={valor} mudar={mudar} />
      </div>
    </div>
  );
}

/**
 * Outra cor, com o código sempre à vista (o Renato, 9 nov: «por default deve aparecer sempre o
 * código Hex»): o círculo abre o selector do sistema, e o código escreve-se ou cola-se (#0A2020 ou
 * 0a2020). Mostra a cor de agora, seja ela das de cima ou não; um código a meio não muda nada.
 */
export function OutraCor({ valor, mudar }: { valor: string; mudar: (v: string) => void }) {
  const t = useTextos();
  const [texto, setTexto] = useState(valor.toUpperCase());
  useEffect(() => setTexto(valor.toUpperCase()), [valor]);
  return (
    <span className="outra-cor">
      <input
        type="color"
        value={valor.toLowerCase()}
        aria-label={t.geral.outraCor}
        onChange={(e) => mudar(e.target.value.toUpperCase())}
      />
      <input
        type="text"
        value={texto}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        aria-label={t.geral.codigoDaCor}
        onChange={(e) => {
          setTexto(e.target.value);
          const hex = `#${e.target.value.trim().replace(/^#/, '')}`.toUpperCase();
          if (eCor(hex)) mudar(hex);
        }}
        onBlur={() => setTexto(valor.toUpperCase())}
      />
    </span>
  );
}

// ——— os textos em inglês ———

/** O que um campo é, para a tradução escolher as palavras (os mesmos da API, em traducao.ts). */
export type CampoDoTexto =
  | 'categoria'
  | 'horario'
  | 'descricao'
  | 'destaque'
  | 'titulo'
  | 'detalhe'
  | 'aviso'
  | 'recompensa'
  | 'aniversario'
  | 'meio';

/** O parceiro e a categoria («Azeméis Motor — Carros»), para a tradução escolher as palavras. */
export function useOnde(
  parceiro: { nome: string; categoriaId: number | null } | null,
): string | undefined {
  const categorias = useQuery({
    queryKey: ['categorias'],
    queryFn: () => pedir<CategoriaComContagem[]>('/api/bo/categorias'),
  });
  if (!parceiro) return undefined;
  const categoria = categorias.data?.find((k) => k.id === parceiro.categoriaId)?.nome;
  return categoria ? `${parceiro.nome} — ${categoria}` : parceiro.nome;
}

/** Um campo com inglês: o português de agora e como escrever a sugestão no campo inglês. */
export type ParDeTraducao = {
  campo: CampoDoTexto;
  pt: string;
  definir: (en: string) => void;
  /** O parceiro e a categoria («Azeméis Motor — Carros»), quando o campo é de um parceiro. */
  onde?: string;
};

/**
 * O inglês de um formulário, fechado: escreve-se só em português e, ao guardar, o inglês vazio
 * (ou que ficou para trás de um português novo) traduz-se sozinho na API. Abre-se só para ver ou
 * mudar a tradução; lá dentro, «Traduzir do português» escreve as sugestões (o Renato, 8 nov).
 */
export function GrupoEmIngles({
  children,
  pares,
  seccao = false,
}: {
  children: ReactNode;
  pares: ParDeTraducao[];
  seccao?: boolean;
}) {
  const t = useTextos();
  const [aTraduzir, setATraduzir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const comTexto = pares.filter((p) => p.pt.trim());
  const traduzir = async () => {
    setATraduzir(true);
    setErro(null);
    try {
      const r = await pedir<{ traducoes: string[] }>('/api/bo/traduzir', {
        metodo: 'POST',
        corpo: {
          itens: comTexto.map(({ campo, pt, onde }) => ({
            texto: pt.trim(),
            campo,
            ...(onde ? { onde } : {}),
          })),
        },
      });
      comTexto.forEach((p, i) => p.definir(r.traducoes[i] ?? ''));
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setATraduzir(false);
    }
  };
  const conteudo = (
    <div className="formulario">
      <div className="ajuda">{t.geral.emIngles.ajuda}</div>
      {children}
      <div className="linha-traduzir">
        <button
          type="button"
          className="botao secundario"
          disabled={aTraduzir || !comTexto.length}
          onClick={() => void traduzir()}
        >
          {aTraduzir ? t.geral.emIngles.aTraduzir : t.geral.emIngles.traduzir}
        </button>
        {erro && (
          <span className="ajuda erro" role="alert">
            {erro}
          </span>
        )}
      </div>
    </div>
  );
  // Uma secção da página: é uma gaveta como as outras (8 nov).
  if (seccao)
    return (
      <Gaveta titulo={t.geral.emIngles.titulo} resumo={t.geral.emIngles.resumo}>
        {conteudo}
      </Gaveta>
    );
  return (
    <details className="em-ingles">
      <summary>
        <span className="rotulo-campo">{t.geral.emIngles.titulo}</span>
        <span className="ajuda">{t.geral.emIngles.resumo}</span>
      </summary>
      {conteudo}
    </details>
  );
}

// ——— gavetas: secções que abrem e fecham ———

const CHAVE_DAS_GAVETAS = 'nunoslab:backoffice:gavetas';

function gavetasAbertas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_DAS_GAVETAS) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Uma secção que abre e fecha (o Renato, 8 nov: «mais dropdowns, para ver a página toda de uma
 * vez»). Fechada, é uma linha com o título e um resumo; aberta, mostra o que tem dentro. Com `id`,
 * fica como se deixou neste aparelho; com um erro lá dentro, abre-se sozinha.
 */
export function Gaveta({
  id,
  titulo,
  resumo,
  erro = false,
  interior = false,
  abertaDeInicio = false,
  lista = false,
  chegarAqui = false,
  children,
}: {
  /** Para ficar aberta da próxima vez: «barbearia.lojas». */
  id?: string;
  titulo: ReactNode;
  resumo?: ReactNode;
  erro?: boolean;
  /** Dentro de outra gaveta (as lojas, uma a uma): uma linha, sem cartão à volta. */
  interior?: boolean;
  /** Abre logo (uma loja acabada de juntar, ou quem chega por uma morada antiga como #/fidelidade). */
  abertaDeInicio?: boolean;
  /** O que tem dentro é uma lista: encosta às margens (como num cartão), com o botão no `.pe-gaveta`. */
  lista?: boolean;
  /** Quem chega por um aviso do Resumo («#/parceiros/5?abrir=quem-valida»): abre e mostra-se. */
  chegarAqui?: boolean;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(
    () => abertaDeInicio || chegarAqui || (id ? gavetasAbertas().has(id) : false),
  );
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!chegarAqui) return;
    // Logo a seguir, depois de a casca voltar ao topo ao mudar de página; sem animação (uma
    // rolagem suave interrompida, ou num separador que não pinta, ficava no topo).
    const espera = setTimeout(() => ref.current?.scrollIntoView({ block: 'start' }), 50);
    return () => clearTimeout(espera);
    // Só ao chegar: depois, abre e fecha como as outras.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (erro) setAberta(true);
  }, [erro]);
  const mudar = (agora: boolean) => {
    setAberta(agora);
    if (!id) return;
    const abertas = gavetasAbertas();
    if (agora) abertas.add(id);
    else abertas.delete(id);
    try {
      localStorage.setItem(CHAVE_DAS_GAVETAS, JSON.stringify([...abertas]));
    } catch {
      // Sem armazenamento (navegação privada): abre e fecha na mesma, só não se lembra.
    }
  };
  const Titulo = interior ? 'h3' : 'h2';
  return (
    <details
      ref={ref}
      className={interior ? 'gaveta interior' : 'gaveta'}
      open={aberta}
      onToggle={(e) => {
        if (e.currentTarget.open !== aberta) mudar(e.currentTarget.open);
      }}
    >
      <summary>
        <Titulo>{titulo}</Titulo>
        {resumo && <span className="resumo">{resumo}</span>}
      </summary>
      <div className={lista ? 'corpo-gaveta sem-margem' : 'corpo-gaveta'}>{children}</div>
    </details>
  );
}

// ——— folhas (diálogos) ———

/** Um diálogo nativo: prende o foco, fecha com Escape, devolve o foco a quem o abriu. */
export function Folha({
  aberta,
  fechar,
  titulo,
  children,
  pe,
  sujo = false,
}: {
  aberta: boolean;
  fechar: () => void;
  titulo: string;
  children: ReactNode;
  pe?: ReactNode;
  /** Há alterações por guardar: fechar pergunta primeiro. */
  sujo?: boolean;
}) {
  const t = useTextos();
  const ref = useRef<HTMLDialogElement>(null);
  const fecharSePuder = () => {
    if (!sujo || window.confirm(t.geral.fecharSemGuardar)) fechar();
  };
  // Fecha com um clique FORA, e só se o clique também começou fora: seleccionar
  // texto num campo e largar o rato fora da folha não a fecha.
  const comecouFora = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);
  return (
    <dialog
      ref={ref}
      className="folha"
      aria-labelledby="titulo-da-folha"
      onCancel={(e) => {
        e.preventDefault();
        fecharSePuder();
      }}
      onPointerDown={(e) => {
        comecouFora.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && comecouFora.current) fecharSePuder();
        comecouFora.current = false;
      }}
    >
      {aberta && (
        <>
          <div className="topo-folha">
            <h2 id="titulo-da-folha">{titulo}</h2>
            <button
              type="button"
              className="botao secundario icone"
              aria-label={t.geral.fechar}
              onClick={fecharSePuder}
            >
              <Icone nome="fechar" />
            </button>
          </div>
          <div className="corpo-folha">{children}</div>
          {pe && <div className="pe-folha">{pe}</div>}
        </>
      )}
    </dialog>
  );
}

/** Uma pergunta de «tens a certeza?» para o que não se desfaz. */
export function useConfirmar() {
  const t = useTextos();
  const [pedido, setPedido] = useState<{
    titulo: string;
    texto: string;
    accao: string;
    resolver: (sim: boolean) => void;
  } | null>(null);
  const confirmar = useCallback(
    (titulo: string, texto: string, accao: string) =>
      new Promise<boolean>((resolver) => setPedido({ titulo, texto, accao, resolver })),
    [],
  );
  const responder = (sim: boolean) => {
    pedido?.resolver(sim);
    setPedido(null);
  };
  const dialogo = (
    <Folha
      aberta={!!pedido}
      fechar={() => responder(false)}
      titulo={pedido?.titulo ?? ''}
      pe={
        <>
          <button type="button" className="botao perigo" onClick={() => responder(true)}>
            {pedido?.accao}
          </button>
          <button type="button" className="botao secundario" onClick={() => responder(false)}>
            {t.geral.cancelar}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--tinta-2)' }}>{pedido?.texto}</p>
    </Folha>
  );
  return { confirmar, dialogo };
}

// ——— peças do conteúdo ———

export function Etiqueta({
  tom,
  children,
  semPonto,
}: {
  tom?: 'bom' | 'atencao' | 'mau' | 'fraco';
  children: ReactNode;
  semPonto?: boolean;
}) {
  return (
    <span className={`etiqueta${tom ? ` ${tom}` : ''}${semPonto ? ' sem-ponto' : ''}`}>
      {children}
    </span>
  );
}

/** Um número grande num cartão (o Resumo, as Métricas). */
export function Numero({
  rotulo,
  valor,
  nota,
  pequeno,
}: {
  rotulo: string;
  valor: number | string;
  nota?: ReactNode;
  pequeno?: boolean;
}) {
  return (
    <div className={`cartao numero${pequeno ? ' pequeno' : ''}`}>
      <div className="rotulo">{rotulo}</div>
      <div className="valor">{typeof valor === 'number' ? numero(valor) : valor}</div>
      {nota && <div className="nota">{nota}</div>}
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <strong>{titulo}</strong>
      {children}
    </div>
  );
}

export function Esqueleto({ linhas = 4 }: { linhas?: number }) {
  const t = useTextos();
  return (
    <div className="cartao recheado" aria-busy="true" aria-label={t.geral.aCarregar}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="esqueleto" style={{ height: 44, marginTop: i ? 12 : 0 }} />
      ))}
    </div>
  );
}

const PEQUENAS = /^(do|da|dos|das|de|e|o|a|os|as)$/i;
export function iniciaisDe(nome: string): string {
  const palavras = nome.split(/\s+/).filter((p) => p && !PEQUENAS.test(p));
  return ((palavras[0]?.[0] ?? '') + (palavras[1]?.[0] ?? '')).toUpperCase();
}

export function urlDaImagem(id: string) {
  return `${API}/api/imagens/${id}`;
}

/** A imagem do logótipo na caixa do ajuste, em percentagem do círculo (as contas da app). */
function estiloDoLogotipo(ajuste: AjusteDoLogotipo | null | undefined) {
  const caixa = caixaDoLogotipo(ajuste);
  const pc = (n: number) => `${n * 100}%`;
  return {
    width: pc(caixa.lado),
    height: pc(caixa.lado),
    left: pc(caixa.esquerda),
    top: pc(caixa.topo),
  };
}

export function Logotipo({
  nome,
  cor,
  logotipo,
  ajuste,
  tamanho = 44,
}: {
  nome: string;
  cor: string;
  logotipo: string | null;
  /** O fundo, o tamanho e o sítio no círculo; sem ele, branco e a 70 %. */
  ajuste?: AjusteDoLogotipo | null;
  tamanho?: number;
}) {
  if (logotipo)
    return (
      <span
        className="logotipo"
        style={{
          width: tamanho,
          height: tamanho,
          background: caixaDoLogotipo(ajuste).fundo,
          border: '1px solid var(--linha)',
        }}
        aria-hidden="true"
      >
        <img src={urlDaImagem(logotipo)} alt="" style={estiloDoLogotipo(ajuste)} />
      </span>
    );
  return (
    <span
      className="logotipo"
      style={{
        width: tamanho,
        height: tamanho,
        background: corParaBranco(cor),
        color: '#fff',
        fontSize: Math.round(tamanho * 0.36),
      }}
      aria-hidden="true"
    >
      {iniciaisDe(nome)}
    </span>
  );
}

/**
 * O logótipo no círculo, para acertar como fica na app: arrastar muda-o de sítio, dois dedos
 * aproximam ou afastam (o segundo pode assentar fora do círculo, pequeno para dois dedos no
 * telemóvel), a roda (ou os dedos no trackpad, que chegam como roda com Ctrl) aproxima, e no teclado
 * as setas e o + e o −.
 */
function EditorDoLogotipo({
  id,
  ajuste,
  mudar,
}: {
  id: string;
  ajuste: AjusteDoLogotipo;
  mudar: (a: AjusteDoLogotipo) => void;
}) {
  const t = useTextos();
  const lado = 112;
  const idDasTeclas = useId();
  const moldura = useRef<HTMLDivElement>(null);
  // Os tratadores lêem daqui o último ajuste e o último «mudar» (a roda é um ouvinte posto uma vez).
  const ultimo = useRef(ajuste);
  const mudarAgora = useRef(mudar);
  useEffect(() => {
    ultimo.current = ajuste;
    mudarAgora.current = mudar;
  }, [ajuste, mudar]);
  const aplicar = (novo: Partial<AjusteDoLogotipo>) => {
    const a = limitarAjuste({ ...ultimo.current, ...novo });
    if (!a) return;
    ultimo.current = a;
    mudarAgora.current(a);
  };
  // Os dedos (ou o rato) a carregar, pela ordem em que assentaram, onde estão no ecrã; e o ajuste e
  // os dedos de quando o gesto mudou: as contas fazem-se sempre a partir daí, e um dedo que chega ou
  // sai recomeça-o, sem a imagem saltar (o Renato, 10 nov: com dois dedos, no telemóvel, ela fugia).
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const partida = useRef<{ ajuste: AjusteDoLogotipo; dedos: PontoNoCirculo[] } | null>(null);
  // Os dedos que assentaram fora do círculo sem gesto a decorrer: se um assenta no círculo logo a
  // seguir (os dois quase ao mesmo tempo, como quem afasta os dedos), também contam.
  const soltos = useRef(new Map<number, { x: number; y: number; quando: number }>());
  // Só mexem em refs: os ouvintes postos uma vez podem chamá-las.
  const noCirculo = (): PontoNoCirculo[] => {
    // O lado medido, não o 112: o CSS pode mudá-lo.
    const r = moldura.current?.getBoundingClientRect();
    if (!r?.width) return [];
    return [...dedos.current.values()].slice(0, 2).map((d) => ({
      x: (d.x - r.left - r.width / 2) / r.width,
      y: (d.y - r.top - r.height / 2) / r.height,
    }));
  };
  const recomecar = () => {
    partida.current = dedos.current.size ? { ajuste: ultimo.current, dedos: noCirculo() } : null;
  };
  const assentar = (e: PointerEvent) => {
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.current.size === 1)
      for (const [id, d] of soltos.current)
        if (e.timeStamp - d.quando < 250) dedos.current.set(id, { x: d.x, y: d.y });
    soltos.current.clear();
    recomecar();
  };
  // A roda do React é passiva: para a página não rolar enquanto se aproxima, um ouvinte nativo.
  useEffect(() => {
    const el = moldura.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const a = ultimo.current;
      const novo = limitarAjuste({
        ...a,
        zoom: a.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)),
      });
      if (!novo) return;
      ultimo.current = novo;
      mudarAgora.current(novo);
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []);
  // O resto do gesto ouve-se no documento: o dedo que assenta fora do círculo não chega a ele.
  useEffect(() => {
    const fora = (e: PointerEvent) => {
      const el = moldura.current;
      if (!el || e.pointerType !== 'touch' || el.contains(e.target as Node)) return;
      if (!dedos.current.size) {
        soltos.current.set(e.pointerId, { x: e.clientX, y: e.clientY, quando: e.timeStamp });
        return;
      }
      if (dedos.current.size !== 1) return;
      // Com um dedo já no círculo, este é o segundo: entra no gesto e não toca no que tem por baixo.
      e.preventDefault();
      e.stopPropagation();
      assentar(e);
    };
    const mexer = (e: PointerEvent) => {
      const solto = soltos.current.get(e.pointerId);
      if (solto) soltos.current.set(e.pointerId, { ...solto, x: e.clientX, y: e.clientY });
      if (!dedos.current.has(e.pointerId)) return;
      dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = partida.current;
      const novo = p && ajusteDosDedos(p.ajuste, p.dedos, noCirculo());
      if (!novo) return;
      ultimo.current = novo;
      mudarAgora.current(novo);
    };
    const largar = (e: PointerEvent) => {
      soltos.current.delete(e.pointerId);
      if (dedos.current.delete(e.pointerId)) recomecar();
    };
    document.addEventListener('pointerdown', fora, true);
    document.addEventListener('pointermove', mexer, true);
    document.addEventListener('pointerup', largar, true);
    document.addEventListener('pointercancel', largar, true);
    return () => {
      document.removeEventListener('pointerdown', fora, true);
      document.removeEventListener('pointermove', mexer, true);
      document.removeEventListener('pointerup', largar, true);
      document.removeEventListener('pointercancel', largar, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={moldura}
      className="ajuste-do-logotipo"
      style={{ width: lado, height: lado, background: ajuste.fundo }}
      tabIndex={0}
      role="group"
      aria-label={t.parceiro.ajustarLogotipo}
      aria-describedby={idDasTeclas}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Sem a captura, o resto do gesto ouve-se na mesma no documento.
        }
        assentar(e.nativeEvent);
      }}
      onKeyDown={(e) => {
        const a = ultimo.current;
        const passo = e.shiftKey ? 0.1 : 0.02;
        const teclas: Record<string, Partial<AjusteDoLogotipo>> = {
          ArrowLeft: { x: a.x - passo },
          ArrowRight: { x: a.x + passo },
          ArrowUp: { y: a.y - passo },
          ArrowDown: { y: a.y + passo },
          '+': { zoom: a.zoom * 1.08 },
          '=': { zoom: a.zoom * 1.08 },
          '-': { zoom: a.zoom / 1.08 },
        };
        const novo = teclas[e.key];
        if (!novo) return;
        e.preventDefault();
        aplicar(novo);
      }}
    >
      <img src={urlDaImagem(id)} alt="" draggable={false} style={estiloDoLogotipo(ajuste)} />
      <span id={idDasTeclas} className="so-leitor">
        {t.parceiro.teclasDoLogotipo}
      </span>
    </div>
  );
}

/**
 * O logótipo do parceiro: a imagem, acertada no círculo como fica na app, e a cor do fundo do
 * círculo (o Renato, 9 nov: um logótipo quadrado de fundo verde ficava num círculo branco). A
 * primeira cor é a das orlas do logótipo; uma imagem nova já vem com ela, se for de uma cor só.
 */
export function CampoDoLogotipo({
  rotulo,
  valor,
  ajuste,
  cor,
  mudar,
  ajuda,
  erro,
}: {
  rotulo: string;
  valor: string | null;
  ajuste: AjusteDoLogotipo | null;
  /** A cor do parceiro, que é uma das hipóteses para o fundo. */
  cor: string;
  mudar: (id: string | null, ajuste: AjusteDoLogotipo | null) => void;
  ajuda: string;
  erro?: boolean;
}) {
  const t = useTextos();
  const entrada = useRef<HTMLInputElement>(null);
  const idDoFundo = useId();
  const avisar = useAvisar();
  const [aCarregar, setACarregar] = useState(false);
  const daImagem = useQuery({
    queryKey: ['cor-do-logotipo', valor],
    queryFn: () => (valor ? corDoLogotipo(valor) : null),
    enabled: !!valor,
    staleTime: Infinity,
  });
  const a = ajuste ?? AJUSTE_DE_ORIGEM;
  const fundos = [
    { cor: daImagem.data, nome: t.parceiro.fundos.logotipo },
    { cor: '#FFFFFF', nome: t.parceiro.fundos.branco },
    { cor: '#000000', nome: t.parceiro.fundos.preto },
    { cor: corParaBranco(cor).toUpperCase(), nome: t.parceiro.fundos.parceiro },
  ].filter(
    (f, i, l): f is { cor: string; nome: string } =>
      !!f.cor && l.findIndex((g) => g.cor === f.cor) === i,
  );
  return (
    <div className={`campo${erro ? ' erro' : ''}`}>
      <span className="rotulo-campo">{rotulo}</span>
      <div className="imagem-campo">
        {valor ? (
          <EditorDoLogotipo id={valor} ajuste={a} mudar={(novo) => mudar(valor, novo)} />
        ) : (
          <div className="previa">
            <span className="ajuda">—</span>
          </div>
        )}
        <div className="botoes">
          <button
            type="button"
            className="botao secundario pequeno"
            disabled={aCarregar}
            onClick={() => entrada.current?.click()}
          >
            {aCarregar
              ? t.geral.imagem.aCarregar
              : valor
                ? t.geral.imagem.trocar
                : t.geral.imagem.escolher}
          </button>
          {valor && (
            <button
              type="button"
              className="botao secundario pequeno"
              onClick={() => mudar(null, null)}
            >
              {t.geral.imagem.tirar}
            </button>
          )}
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const ficheiro = e.target.files?.[0];
            e.target.value = '';
            if (!ficheiro) return;
            setACarregar(true);
            try {
              const { id, ajuste: sugestao } = await carregarLogotipo(ficheiro);
              mudar(id, sugestao);
            } catch (erro) {
              avisar(mensagemDe(erro), true);
            } finally {
              setACarregar(false);
            }
          }}
        />
      </div>
      {valor && (
        <div className="fundo-do-logotipo">
          <span className="rotulo-campo" id={idDoFundo}>
            {t.parceiro.fundo}
          </span>
          <div className="cores" role="group" aria-labelledby={idDoFundo}>
            {fundos.map((f) => (
              <button
                key={f.cor}
                type="button"
                className="cor"
                style={{ background: f.cor }}
                aria-pressed={a.fundo === f.cor}
                aria-label={f.nome}
                onClick={() => mudar(valor, { ...a, fundo: f.cor })}
              />
            ))}
            <OutraCor valor={a.fundo} mudar={(fundo) => mudar(valor, { ...a, fundo })} />
          </div>
        </div>
      )}
      {erro ? (
        <div className="mensagem-erro">{t.geral.reveEsteCampo}</div>
      ) : (
        <div className="ajuda">{ajuda}</div>
      )}
    </div>
  );
}

/**
 * Desenho de fundo de uma capa sem fotografia: a cor do parceiro a escurecer,
 * como na app (uma cor clara desce até o texto branco se ler).
 */
export function fundoDaCapa(cor: string) {
  const base = corParaBranco(cor);
  return `linear-gradient(135deg, ${base}, ${misturar(base, '#000000', 0.45)})`;
}

/**
 * O desenho da categoria numa capa sem fotografia, como a `Capa` da app: em grande (95 % da
 * altura), rodado e a sair pelo canto, branco a 13 %. Vai dentro da caixa com a cor, por baixo
 * do véu (o Renato, 9 nov: «mesmo que não haja foto de capa, mostrar com a cor e o icon certo»).
 */
export function DesenhoDaCapa({ icone }: { icone: IconeDaCategoria }) {
  return (
    <span className="desenho-da-capa" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        {(DESENHOS_DAS_CATEGORIAS[icone] ?? DESENHOS_DAS_CATEGORIAS.outro).map((d) => (
          <path
            key={d}
            d={d}
            stroke="#FFFFFF"
            strokeWidth={1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </span>
  );
}

/** O desenho verdadeiro da categoria de um parceiro (o diamante das Joias); sem categoria, os pontos. */
export function useDesenhoDaCategoria(categoriaId: number | null | undefined): IconeDaCategoria {
  const categorias = useQuery({
    queryKey: ['categorias'],
    queryFn: () => pedir<CategoriaComContagem[]>('/api/bo/categorias'),
  });
  const k = categorias.data?.find((c) => c.id === categoriaId);
  return k?.desenho ?? k?.icone ?? 'outro';
}

/** A promoção como fica no cartão grande da app (para ver antes de gravar). */
export function PrevisaoDaPromocao({
  parceiro,
  destaque,
  titulo,
  detalhe,
  inicio,
  fim,
  hoje,
  limite = null,
  comCodigo = false,
}: {
  parceiro: {
    nome: string;
    cor: string;
    logotipo: string | null;
    logotipoAjuste?: AjusteDoLogotipo | null;
    capa: string | null;
    categoriaId?: number | null;
  } | null;
  destaque: string;
  titulo: string;
  detalhe: string;
  inicio: string | null;
  fim: string | null;
  hoje: string;
  /** O limite ao ler o cartão («1 por dia»), ao lado do «Mostra o cartão ao balcão». */
  limite?: string | null;
  /** Com código de cupão, usa-se ao pagar, e não ao mostrar o cartão (como na app, 11 nov 2026). */
  comCodigo?: boolean;
}) {
  const t = useTextos();
  const lingua = useLingua();
  const validade = validadeEmTexto({ inicio, fim }, hoje, lingua);
  const comoSeUsa = comCodigo ? t.geral.previsao.usaOCodigo : t.geral.previsao.mostraOCartao;
  const cor = parceiro?.cor ?? '#5C544C';
  const desenho = useDesenhoDaCategoria(parceiro?.categoriaId);
  return (
    <div className="previsao" aria-label={t.geral.previsao.rotulo}>
      <div className="rotulo-previsao">{t.geral.previsao.naApp}</div>
      <div className="capa-previsao" style={{ background: fundoDaCapa(cor) }}>
        {/* Só a cor e o desenho, como na app (sem fotografias de capa desde 11 nov 2026). */}
        {parceiro && <DesenhoDaCapa icone={desenho} />}
        <div className="topo-capa">
          {parceiro && (
            <Logotipo
              nome={parceiro.nome}
              cor={cor}
              logotipo={parceiro.logotipo}
              ajuste={parceiro.logotipoAjuste}
              tamanho={30}
            />
          )}
          <span>{parceiro?.nome ?? t.geral.previsao.parceiro}</span>
        </div>
        <div className="fundo-capa">
          <div className="grande">{semPartir(destaque || '−10%')}</div>
          <div className="titulo-previsao">{semPartir(titulo || t.geral.previsao.titulo)}</div>
          <div className="vale">{semPartir(limite ? `${comoSeUsa} · ${limite}` : comoSeUsa)}</div>
          {validade && <div className="validade">{validade}</div>}
        </div>
      </div>
      {detalhe && (
        <div className="cartao-promocao">
          <div className="condicoes">{semPartir(detalhe)}</div>
        </div>
      )}
    </div>
  );
}

// ——— os desenhos das categorias (os mesmos da app) ———

export function DesenhoDaCategoria({
  icone,
  tamanho = 22,
}: {
  icone: IconeDaCategoria;
  tamanho?: number;
}) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {DESENHOS_DAS_CATEGORIAS[icone].map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/** Escolher o desenho de uma categoria a ver os desenhos, e não uma lista de nomes. */
export function EscolhaDoDesenho({
  valor,
  mudar,
}: {
  valor: IconeDaCategoria;
  mudar: (v: IconeDaCategoria) => void;
}) {
  const t = useTextos();
  const lingua = useLingua();
  return (
    <div className="campo">
      <span className="rotulo-campo" id="desenho-da-categoria">
        {t.geral.desenho}
      </span>
      <div className="desenhos" role="radiogroup" aria-labelledby="desenho-da-categoria">
        {ICONES_DAS_CATEGORIAS.map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={valor === i}
            aria-label={nomeDoDesenho(i, lingua)}
            title={nomeDoDesenho(i, lingua)}
            className="desenho"
            onClick={() => mudar(i)}
          >
            <DesenhoDaCategoria icone={i} tamanho={24} />
          </button>
        ))}
      </div>
    </div>
  );
}
