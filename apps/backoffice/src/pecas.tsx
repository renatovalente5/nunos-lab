import {
  CORES_DOS_PARCEIROS,
  DESENHOS_DAS_CATEGORIAS,
  ICONES_DAS_CATEGORIAS,
  NOMES_DOS_DESENHOS,
  misturar,
  semPartir,
  tintaSobre,
  validadeEmTexto,
  type IconeDaCategoria,
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
import { API, mensagemDe } from './api';
import { carregarImagem } from './imagens';

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
  mais: ['M12 5v14', 'M5 12h14'],
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
  tipo = 'text',
  obrigatorio,
  placeholder,
  modoDeTeclado,
  autoFocus,
}: {
  rotulo: string;
  valor: string;
  mudar: (v: string) => void;
  max?: number;
  ajuda?: ReactNode;
  erro?: boolean;
  tipo?: 'text' | 'date' | 'url' | 'tel';
  obrigatorio?: boolean;
  placeholder?: string;
  modoDeTeclado?: 'text' | 'tel' | 'url';
  autoFocus?: boolean;
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
        aria-invalid={erro || undefined}
        aria-describedby={ajuda || erro ? `${id}-a` : undefined}
        onChange={(e) => mudar(e.target.value)}
      />
      {erro ? (
        <div className="mensagem-erro" id={`${id}-a`}>
          Revê este campo.
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
          {erro ? <span className="mensagem-erro">Revê este campo.</span> : ajuda}
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

export function Seletor<T extends string | number>({
  rotulo,
  valor,
  mudar,
  opcoes,
  vazio,
  erro,
}: {
  rotulo: string;
  valor: T | null;
  mudar: (v: T | null) => void;
  opcoes: { valor: T; nome: string }[];
  vazio?: string;
  erro?: boolean;
}) {
  const id = useId();
  return (
    <div className={`campo${erro ? ' erro' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      <select
        id={id}
        className="entrada"
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
}: {
  opcoes: { valor: T; nome: string }[];
  valor: T;
  mudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div className="segmentado" role="group" aria-label={rotulo}>
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

export function Cores({ valor, mudar }: { valor: string; mudar: (v: string) => void }) {
  return (
    <div className="campo">
      <span className="rotulo-campo" id="cor-do-parceiro">
        Cor
      </span>
      <div className="cores" role="group" aria-labelledby="cor-do-parceiro">
        {CORES_DOS_PARCEIROS.map((c) => (
          <button
            key={c}
            type="button"
            className="cor"
            style={{ background: c }}
            aria-pressed={valor.toUpperCase() === c}
            aria-label={`Cor ${c}`}
            onClick={() => mudar(c)}
          />
        ))}
        <input
          type="color"
          className="cor-propria"
          value={valor}
          aria-label="Outra cor"
          onChange={(e) => mudar(e.target.value.toUpperCase())}
        />
      </div>
    </div>
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
}: {
  aberta: boolean;
  fechar: () => void;
  titulo: string;
  children: ReactNode;
  pe?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
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
        fechar();
      }}
      onPointerDown={(e) => {
        comecouFora.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && comecouFora.current) fechar();
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
              aria-label="Fechar"
              onClick={fechar}
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
            Cancelar
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
  tom?: 'bom' | 'atencao' | 'mau';
  children: ReactNode;
  semPonto?: boolean;
}) {
  return (
    <span className={`etiqueta${tom ? ` ${tom}` : ''}${semPonto ? ' sem-ponto' : ''}`}>
      {children}
    </span>
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
  return (
    <div className="cartao recheado" aria-busy="true" aria-label="A carregar">
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

export function Logotipo({
  nome,
  cor,
  logotipo,
  tamanho = 44,
}: {
  nome: string;
  cor: string;
  logotipo: string | null;
  tamanho?: number;
}) {
  if (logotipo)
    return (
      <span
        className="logotipo"
        style={{
          width: tamanho,
          height: tamanho,
          background: '#fff',
          border: '1px solid var(--linha)',
        }}
        aria-hidden="true"
      >
        <img src={urlDaImagem(logotipo)} alt="" />
      </span>
    );
  return (
    <span
      className="logotipo"
      style={{
        width: tamanho,
        height: tamanho,
        background: cor,
        color: tintaSobre(cor),
        fontSize: Math.round(tamanho * 0.36),
      }}
      aria-hidden="true"
    >
      {iniciaisDe(nome)}
    </span>
  );
}

export function CampoDeImagem({
  rotulo,
  valor,
  mudar,
  modo,
  ajuda,
}: {
  rotulo: string;
  valor: string | null;
  mudar: (id: string | null) => void;
  modo: 'logotipo' | 'capa';
  ajuda: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const avisar = useAvisar();
  const [aCarregar, setACarregar] = useState(false);
  return (
    <div className="campo">
      <span className="rotulo-campo">{rotulo}</span>
      <div className="imagem-campo">
        <div className={`previa${modo === 'capa' ? ' capa' : ''}`}>
          {valor ? <img src={urlDaImagem(valor)} alt="" /> : <span className="ajuda">—</span>}
        </div>
        <div className="botoes">
          <button
            type="button"
            className="botao secundario pequeno"
            disabled={aCarregar}
            onClick={() => entrada.current?.click()}
          >
            {aCarregar ? 'A carregar…' : valor ? 'Trocar' : 'Escolher imagem'}
          </button>
          {valor && (
            <button type="button" className="botao secundario pequeno" onClick={() => mudar(null)}>
              Tirar
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
              mudar(await carregarImagem(ficheiro, modo));
            } catch (erro) {
              avisar(mensagemDe(erro), true);
            } finally {
              setACarregar(false);
            }
          }}
        />
      </div>
      <div className="ajuda">{ajuda}</div>
    </div>
  );
}

/** Desenho de fundo de uma capa sem fotografia: a cor do parceiro a escurecer. */
export function fundoDaCapa(cor: string) {
  return `linear-gradient(135deg, ${cor}, ${misturar(cor, '#000000', 0.42)})`;
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
}: {
  parceiro: { nome: string; cor: string; logotipo: string | null; capa: string | null } | null;
  destaque: string;
  titulo: string;
  detalhe: string;
  inicio: string | null;
  fim: string | null;
  hoje: string;
  icone?: IconeDaCategoria;
}) {
  const validade = validadeEmTexto({ inicio, fim }, hoje);
  const cor = parceiro?.cor ?? '#5C544C';
  return (
    <div className="previsao" aria-label="Como fica na app">
      <div className="rotulo-previsao">Na app</div>
      <div className="capa-previsao" style={{ background: fundoDaCapa(cor) }}>
        {parceiro?.capa && <img className="fundo" src={urlDaImagem(parceiro.capa)} alt="" />}
        <div className="topo-capa">
          {parceiro && (
            <Logotipo nome={parceiro.nome} cor={cor} logotipo={parceiro.logotipo} tamanho={30} />
          )}
          <span>{parceiro?.nome ?? 'Parceiro'}</span>
        </div>
        <div className="fundo-capa">
          <div className="grande">{semPartir(destaque || '−10%')}</div>
          <div className="titulo-previsao">{semPartir(titulo || 'Título da vantagem')}</div>
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
  return (
    <div className="campo">
      <span className="rotulo-campo" id="desenho-da-categoria">
        Desenho
      </span>
      <div className="desenhos" role="radiogroup" aria-labelledby="desenho-da-categoria">
        {ICONES_DAS_CATEGORIAS.map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={valor === i}
            aria-label={NOMES_DOS_DESENHOS[i]}
            title={NOMES_DOS_DESENHOS[i]}
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
