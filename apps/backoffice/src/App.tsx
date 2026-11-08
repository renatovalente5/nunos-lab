import { ETIQUETA_DA_LINGUA, NOME_DA_LINGUA, type Eu, type Lingua } from '@nunos-lab/dominio';
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
  { caminho: 'promocoes', nome: 'promocoes', icone: 'promocoes' },
  { caminho: 'barbearia', nome: 'barbearia', icone: 'barbearia' },
  { caminho: 'equipa', nome: 'equipa', icone: 'equipa' },
  { caminho: 'historico', nome: 'historico', icone: 'registo' },
];

/**
 * Moradas antigas: «registo» era o nome do Histórico; Fidelidade, Acessos e Categorias passaram a
 * gavetas de outras páginas (8 nov), que as abrem logo quando se chega por aqui; o essencial das
 * Métricas ficou no Resumo.
 */
const MORADAS_ANTIGAS: Record<string, string> = {
  registo: 'historico',
  metricas: '',
  fidelidade: 'barbearia',
  acessos: 'equipa',
  categorias: 'parceiros',
};

/** A língua: um botão com a outra, dita na própria língua («English», «Português»). Um toque muda. */
function BotaoDaLingua({ className }: { className: string }) {
  const lingua = useLingua();
  const outra: Lingua = lingua === 'pt' ? 'en' : 'pt';
  return (
    <button
      type="button"
      className={className}
      lang={ETIQUETA_DA_LINGUA[outra]}
      onClick={() => escolherLingua(outra)}
    >
      <Icone nome="lingua" tamanho={16} /> {NOME_DA_LINGUA[outra]}
    </button>
  );
}

/** A ligação de acesso traz o código no fragmento: «…/backoffice/#acesso=XXXX». */
function codigoNaMorada(): string | null {
  return /^#acesso=([A-Za-z0-9_-]{43})$/.exec(location.hash)?.[1] ?? null;
}

export function App() {
  const [temSessao, setTemSessao] = useState(() => !!sessao());
  const [entrada, setEntrada] = useState<{
    estado: 'parado' | 'a-entrar' | 'erro';
    erro?: unknown;
  }>({ estado: 'parado' });
  const tentados = useRef(new Set<string>());

  useEffect(() => {
    const mudou = () => setTemSessao(!!sessao());
    window.addEventListener('nunoslab:sessao', mudou);
    return () => window.removeEventListener('nunoslab:sessao', mudou);
  }, []);

  // A ligação pode chegar com a página já aberta: mudar só o fragmento não
  // recarrega nada, por isso ouve-se também o «hashchange».
  useEffect(() => {
    const tentar = () => {
      const codigo = codigoNaMorada();
      if (!codigo || tentados.current.has(codigo)) return;
      tentados.current.add(codigo);
      // O código sai logo da barra de endereço (e do histórico): vale uma vez só.
      history.replaceState(null, '', `${location.pathname}${location.search}#/`);
      setEntrada({ estado: 'a-entrar' });
      pedir<{ sessao: string }>('/api/bo/entrar', { metodo: 'POST', corpo: { acesso: codigo } })
        .then(async ({ sessao: s }) => {
          // Com uma sessão já aberta neste aparelho, fecha-se essa antes de ficar a nova.
          if (sessao()) await pedir('/api/bo/sair', { metodo: 'POST' }).catch(() => {});
          guardarSessao(s);
          setEntrada({ estado: 'parado' });
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        })
        .catch((e) => setEntrada({ estado: 'erro', erro: e }));
    };
    tentar();
    window.addEventListener('hashchange', tentar);
    return () => window.removeEventListener('hashchange', tentar);
  }, []);

  if (!temSessao || entrada.estado === 'a-entrar')
    return <Entrar estado={entrada.estado} erroDaLigacao={entrada.erro} />;
  return <Casca />;
}

function Entrar({ estado, erroDaLigacao }: { estado: string; erroDaLigacao?: unknown }) {
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
        {estado === 'a-entrar' || aEntrar ? (
          <h1>{t.geral.entrar.aEntrar}</h1>
        ) : (
          <>
            <h1>{t.geral.entrar.titulo}</h1>
            {CLIENTE_GOOGLE ? (
              <BotaoDoGoogle aoEntrar={entrarComGoogle} />
            ) : (
              <p>{t.geral.entrar.abreALigacao}</p>
            )}
          </>
        )}
        {(erro || estado === 'erro') && (
          <div className="caixa-aviso mau" role="alert">
            {erro
              ? erro.e instanceof ErroDaApi && erro.e.codigo === 'sem_acesso' && erro.email
                ? t.geral.entrar.semAcesso(erro.email)
                : mensagemDe(erro.e)
              : mensagemDe(erroDaLigacao)}
          </div>
        )}
        <BotaoDaLingua className="botao-lingua" />
      </div>
    </main>
  );
}

function Casca() {
  const t = useTextos();
  const rota = useRota();
  const eu = useQuery({ queryKey: ['eu'], queryFn: () => pedir<Eu>('/api/bo/eu') });
  const principal = useRef<HTMLElement>(null);
  const actual = MORADAS_ANTIGAS[rota[0] ?? ''] ?? rota[0] ?? '';
  useEffect(() => {
    principal.current?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, [actual, rota[1]]);
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
  else if (actual === 'promocoes') pagina = <Promocoes />;
  else if (actual === 'barbearia') pagina = <Barbearia />;
  else if (actual === 'historico') pagina = <Historico />;
  else pagina = <Resumo />;

  return (
    <div className="casca">
      <aside className="lateral">
        <img className="palavra" src={PALAVRA} alt="Nuno's Lab" />
        <div className="sobre-palavra">{t.geral.backoffice}</div>
        <nav className="navegacao" aria-label={t.geral.seccoesRotulo}>
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
          <BotaoDaLingua className="sair sair-movel" />
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
          <BotaoDaLingua className="sair" />
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
