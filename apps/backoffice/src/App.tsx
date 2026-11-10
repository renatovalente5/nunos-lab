import { ETIQUETA_DA_LINGUA, type Eu, type Lingua } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ErroDaApi, guardarSessao, mensagemDe, pedir, sessao } from './api';
import { BotaoDoGoogle, CLIENTE_GOOGLE, emailDoToken } from './google';
import { Barbearia } from './paginas/Barbearia';
import { Cliente } from './paginas/Cliente';
import { Clientes } from './paginas/Clientes';
import { Equipa } from './paginas/Equipa';
import { Parceiro } from './paginas/Parceiro';
import { Parceiros } from './paginas/Parceiros';
import { Promocoes } from './paginas/Promocoes';
import { Historico } from './paginas/Historico';
import { Resumo } from './paginas/Resumo';
import { Icone, type NomeDoIcone } from './pecas';
import { escolherLingua, useLingua } from './lingua';
import { useTextos, type Textos } from './textos';
import { useRota } from './util';

const PALAVRA = `${import.meta.env.BASE_URL}palavra.png`;

const SECCOES: {
  caminho: string;
  nome: keyof Textos['geral']['seccoes'];
  icone: NomeDoIcone;
}[] = [
  { caminho: '', nome: 'resumo', icone: 'resumo' },
  { caminho: 'clientes', nome: 'clientes', icone: 'clientes' },
  { caminho: 'parceiros', nome: 'parceiros', icone: 'parceiros' },
  { caminho: 'vantagens', nome: 'promocoes', icone: 'promocoes' },
  { caminho: 'barbearia', nome: 'barbearia', icone: 'barbearia' },
  { caminho: 'equipa', nome: 'equipa', icone: 'equipa' },
  { caminho: 'historico', nome: 'historico', icone: 'registo' },
];

/**
 * Moradas antigas: «registo» era o nome do Histórico; Fidelidade, Acessos e Categorias passaram a
 * gavetas de outras páginas (8 nov), que as abrem logo quando se chega por aqui; o essencial das
 * Métricas ficou no Resumo; «promocoes» passou a «vantagens» (o Renato, 9 nov: diz-se sempre «vantagem»).
 */
const MORADAS_ANTIGAS: Record<string, string> = {
  registo: 'historico',
  promocoes: 'vantagens',
  metricas: '',
  fidelidade: 'barbearia',
  acessos: 'equipa',
  categorias: 'parceiros',
};

/**
 * A língua: mostra a de agora («PT») e, num toque, as duas (PT e EN) — o Renato, 8 nov. O <select>
 * fica por cima, transparente: o menu é o do sistema e abre onde quer que o botão esteja.
 */
function EscolhaDaLingua({ className }: { className: string }) {
  const t = useTextos();
  const lingua = useLingua();
  return (
    <label className={`${className} escolha-lingua`}>
      <Icone nome="lingua" tamanho={16} />
      <span aria-hidden="true">{lingua.toUpperCase()}</span>
      <svg className="seta-lingua" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M2 3.5l3 3 3-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <select
        value={lingua}
        aria-label={t.geral.lingua}
        onChange={(e) => escolherLingua(e.target.value as Lingua)}
      >
        {(['pt', 'en'] as const).map((l) => (
          <option key={l} value={l} lang={ETIQUETA_DA_LINGUA[l]}>
            {l.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}

export function App() {
  const [temSessao, setTemSessao] = useState(() => !!sessao());

  useEffect(() => {
    const mudou = () => setTemSessao(!!sessao());
    window.addEventListener('nunoslab:sessao', mudou);
    return () => window.removeEventListener('nunoslab:sessao', mudou);
  }, []);

  return temSessao ? <Casca /> : <Entrar />;
}

/** Entrar: só com o Google do email que está no Acesso ao backoffice (as ligações saíram a 8 nov). */
function Entrar() {
  const t = useTextos();
  // O erro guarda-se como erro (e o email com que se tentou): a mensagem diz-se na língua de agora.
  const [erro, setErro] = useState<{ e: unknown; email: string | null } | null>(null);
  const [aEntrar, setAEntrar] = useState(false);
  const entrarComGoogle = async (credencial: string) => {
    setAEntrar(true);
    setErro(null);
    try {
      const r = await pedir<{ sessao: string }>('/api/bo/entrar/google', {
        metodo: 'POST',
        corpo: { credencial },
      });
      guardarSessao(r.sessao);
    } catch (e) {
      setErro({ e, email: emailDoToken(credencial) });
    } finally {
      setAEntrar(false);
    }
  };
  return (
    <main className="entrada-pagina">
      <div className="caixa">
        <img className="palavra" src={PALAVRA} alt="Nuno's Lab" />
        <div className="sobre-palavra">{t.geral.backoffice}</div>
        {aEntrar ? (
          <h1>{t.geral.entrar.aEntrar}</h1>
        ) : (
          <>
            <h1>{t.geral.entrar.titulo}</h1>
            {CLIENTE_GOOGLE && <BotaoDoGoogle aoEntrar={entrarComGoogle} />}
          </>
        )}
        {erro && (
          <div className="caixa-aviso mau" role="alert">
            {erro.e instanceof ErroDaApi && erro.e.codigo === 'sem_acesso' && erro.email
              ? t.geral.entrar.semAcesso(erro.email)
              : mensagemDe(erro.e)}
          </div>
        )}
        <EscolhaDaLingua className="botao-lingua" />
      </div>
    </main>
  );
}

function Casca() {
  const t = useTextos();
  const rota = useRota();
  const eu = useQuery({ queryKey: ['eu'], queryFn: () => pedir<Eu>('/api/bo/eu') });
  const principal = useRef<HTMLElement>(null);
  const navegacao = useRef<HTMLElement>(null);
  const actual = MORADAS_ANTIGAS[rota[0] ?? ''] ?? rota[0] ?? '';
  useEffect(() => {
    principal.current?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, [actual, rota[1]]);
  // No telemóvel o menu rola de lado: a secção aberta vem para o meio (na Barbearia, na Equipa e no
  // Histórico ficava cortada ou fora do ecrã), e as pontas esbatem-se quando há mais desse lado.
  useEffect(() => {
    const nav = navegacao.current;
    if (!nav) return;
    const marcar = () => {
      nav.toggleAttribute('data-mais-a-esquerda', nav.scrollLeft > 4);
      nav.toggleAttribute(
        'data-mais-a-direita',
        nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4,
      );
    };
    const aberta = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (aberta && nav.scrollWidth > nav.clientWidth) {
      const desvio = aberta.getBoundingClientRect().left - nav.getBoundingClientRect().left;
      nav.scrollTo({
        left: nav.scrollLeft + desvio - (nav.clientWidth - aberta.offsetWidth) / 2,
        behavior: 'smooth',
      });
    }
    marcar();
    nav.addEventListener('scroll', marcar, { passive: true });
    window.addEventListener('resize', marcar);
    return () => {
      nav.removeEventListener('scroll', marcar);
      window.removeEventListener('resize', marcar);
    };
  }, [actual, t]);
  // O título da página também muda com a língua (sem voltar ao topo).
  useEffect(() => {
    const s = SECCOES.find((x) => x.caminho === actual);
    document.title = `${s ? t.geral.seccoes[s.nome] : t.geral.backoffice} · Nuno's Lab`;
  }, [actual, t]);
  if (eu.error instanceof ErroDaApi && eu.error.codigo === 'sessao') return null;

  // Sair: no rodapé da barra lateral e, no telemóvel, no fim do menu.
  const sair = async () => {
    try {
      await pedir('/api/bo/sair', { metodo: 'POST' });
    } finally {
      guardarSessao(null);
    }
  };

  let pagina;
  if (actual === 'clientes' && rota[1]) pagina = <Cliente key={rota[1]} id={rota[1]} />;
  else if (actual === 'clientes') pagina = <Clientes />;
  else if (actual === 'equipa') pagina = <Equipa />;
  else if (actual === 'parceiros' && rota[1]) pagina = <Parceiro key={rota[1]} id={rota[1]} />;
  else if (actual === 'parceiros') pagina = <Parceiros />;
  else if (actual === 'vantagens') pagina = <Promocoes />;
  else if (actual === 'barbearia') pagina = <Barbearia />;
  else if (actual === 'historico') pagina = <Historico />;
  else pagina = <Resumo />;

  return (
    <div className="casca">
      <aside className="lateral">
        <img className="palavra" src={PALAVRA} alt="Nuno's Lab" />
        <div className="sobre-palavra">{t.geral.backoffice}</div>
        <nav ref={navegacao} className="navegacao" aria-label={t.geral.seccoesRotulo}>
          {SECCOES.map((s) => (
            <a
              key={s.caminho}
              href={`#/${s.caminho}`}
              aria-current={actual === s.caminho ? 'page' : undefined}
            >
              <Icone nome={s.icone} />
              {t.geral.seccoes[s.nome]}
            </a>
          ))}
          <EscolhaDaLingua className="sair sair-movel" />
          <button type="button" className="sair sair-movel" onClick={sair}>
            <Icone nome="sair" tamanho={16} /> {t.geral.sair}
          </button>
        </nav>
        <div className="rodape-lateral">
          {eu.data && (
            <>
              {t.geral.entrasteComo} <strong>{eu.data.nome}</strong>
            </>
          )}
          <EscolhaDaLingua className="sair" />
          <button type="button" className="sair" onClick={sair}>
            <Icone nome="sair" tamanho={16} /> {t.geral.sair}
          </button>
        </div>
      </aside>
      <main className="principal" ref={principal}>
        <div className="conteudo">{pagina}</div>
      </main>
    </div>
  );
}
