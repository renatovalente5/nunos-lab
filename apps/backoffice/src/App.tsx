import type { Eu } from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ErroDaApi, guardarSessao, mensagemDe, pedir, sessao } from './api';
import { BotaoDoGoogle, CLIENTE_GOOGLE, emailDoToken } from './google';
import { Acessos } from './paginas/Acessos';
import { Barbearia } from './paginas/Barbearia';
import { Categorias } from './paginas/Categorias';
import { Parceiro } from './paginas/Parceiro';
import { Parceiros } from './paginas/Parceiros';
import { Promocoes } from './paginas/Promocoes';
import { Registo } from './paginas/Registo';
import { Resumo } from './paginas/Resumo';
import { Icone, type NomeDoIcone } from './pecas';
import { useRota } from './util';

const PALAVRA = `${import.meta.env.BASE_URL}palavra.png`;

const SECCOES: { caminho: string; nome: string; icone: NomeDoIcone }[] = [
  { caminho: '', nome: 'Resumo', icone: 'resumo' },
  { caminho: 'parceiros', nome: 'Parceiros', icone: 'parceiros' },
  { caminho: 'promocoes', nome: 'Promoções', icone: 'promocoes' },
  { caminho: 'categorias', nome: 'Categorias', icone: 'categorias' },
  { caminho: 'barbearia', nome: 'Barbearia', icone: 'barbearia' },
  { caminho: 'acessos', nome: 'Acessos', icone: 'acessos' },
  { caminho: 'registo', nome: 'Registo', icone: 'registo' },
];

/** A ligação de acesso traz o código no fragmento: «…/backoffice/#acesso=XXXX». */
function codigoNaMorada(): string | null {
  return /^#acesso=([A-Za-z0-9_-]{43})$/.exec(location.hash)?.[1] ?? null;
}

export function App() {
  const [temSessao, setTemSessao] = useState(() => !!sessao());
  const [entrada, setEntrada] = useState<{
    estado: 'parado' | 'a-entrar' | 'erro';
    mensagem?: string;
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
        .then(({ sessao: s }) => {
          guardarSessao(s);
          setEntrada({ estado: 'parado' });
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        })
        .catch((e) => setEntrada({ estado: 'erro', mensagem: mensagemDe(e) }));
    };
    tentar();
    window.addEventListener('hashchange', tentar);
    return () => window.removeEventListener('hashchange', tentar);
  }, []);

  if (!temSessao || entrada.estado === 'a-entrar')
    return <Entrar estado={entrada.estado} mensagem={entrada.mensagem} />;
  return <Casca />;
}

function Entrar({ estado, mensagem }: { estado: string; mensagem?: string }) {
  const [erro, setErro] = useState<string | null>(null);
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
      const email = emailDoToken(credencial);
      setErro(
        e instanceof ErroDaApi && e.codigo === 'sem_acesso' && email
          ? `${email} não tem acesso ao backoffice. Entra com a conta que te deu acesso, ou pede ao Renato para a juntar.`
          : mensagemDe(e),
      );
    } finally {
      setAEntrar(false);
    }
  };
  return (
    <main className="entrada-pagina">
      <div className="caixa">
        <img className="palavra" src={PALAVRA} alt="Nuno's Lab" />
        <div className="sobre-palavra">Backoffice</div>
        {estado === 'a-entrar' || aEntrar ? (
          <h1>A entrar…</h1>
        ) : (
          <>
            <h1>Entrar</h1>
            {CLIENTE_GOOGLE ? (
              <BotaoDoGoogle aoEntrar={entrarComGoogle} />
            ) : (
              <p>Abre a ligação de acesso que te mandaram.</p>
            )}
          </>
        )}
        {(erro || estado === 'erro') && (
          <div className="caixa-aviso mau" role="alert">
            {erro ?? mensagem}
          </div>
        )}
      </div>
    </main>
  );
}

function Casca() {
  const rota = useRota();
  const eu = useQuery({ queryKey: ['eu'], queryFn: () => pedir<Eu>('/api/bo/eu') });
  const principal = useRef<HTMLElement>(null);
  const actual = rota[0] ?? '';
  useEffect(() => {
    principal.current?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    const s = SECCOES.find((x) => x.caminho === actual);
    document.title = `${s?.nome ?? 'Backoffice'} · Nuno's Lab`;
  }, [actual, rota[1]]);
  if (eu.error instanceof ErroDaApi && eu.error.codigo === 'sessao') return null;

  let pagina;
  if (actual === 'parceiros' && rota[1]) pagina = <Parceiro id={rota[1]} />;
  else if (actual === 'parceiros') pagina = <Parceiros />;
  else if (actual === 'promocoes') pagina = <Promocoes />;
  else if (actual === 'categorias') pagina = <Categorias />;
  else if (actual === 'barbearia') pagina = <Barbearia />;
  else if (actual === 'acessos') pagina = <Acessos />;
  else if (actual === 'registo') pagina = <Registo />;
  else pagina = <Resumo />;

  return (
    <div className="casca">
      <aside className="lateral">
        <img className="palavra" src={PALAVRA} alt="Nuno's Lab" />
        <div className="sobre-palavra">Backoffice</div>
        <nav className="navegacao" aria-label="Secções">
          {SECCOES.map((s) => (
            <a
              key={s.caminho}
              href={`#/${s.caminho}`}
              aria-current={actual === s.caminho ? 'page' : undefined}
            >
              <Icone nome={s.icone} />
              {s.nome}
            </a>
          ))}
        </nav>
        {eu.data && (
          <div className="rodape-lateral">
            Entraste como <strong>{eu.data.nome}</strong>
          </div>
        )}
      </aside>
      <main className="principal" ref={principal}>
        <div className="conteudo">{pagina}</div>
      </main>
    </div>
  );
}
