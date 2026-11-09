import type { ClienteDoBackoffice, DefinicoesDaBarbearia, TipoDeEntrada } from '@nunos-lab/dominio';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { API, ErroDaApi, guardarSessao, pedir, sessao } from '../api';
import { linguaActual } from '../lingua';
import { Esqueleto, Etiqueta, Icone, Segmentado, useAccao, Vazio } from '../pecas';
import { useTextos } from '../textos';
import { haQuanto, ir, numero } from '../util';

type Estado = 'todos' | 'novos' | 'activos' | 'perdidos' | 'sem-app';

/** A API devolve no máximo estes: a partir daí a lista está cortada. */
const MAXIMO_DA_LISTA = 5000;

export const NOME_DA_FORMA: Record<TipoDeEntrada, string> = {
  apple: 'Apple',
  google: 'Google',
  email: 'Email',
};

/** As formas de entrar de um cliente, em etiquetas pequenas. */
export function Formas({ formas }: { formas: TipoDeEntrada[] }) {
  if (!formas.length) return <span className="detalhe">—</span>;
  return (
    <span className="formas-lista">
      {formas.map((f) => (
        <Etiqueta key={f} semPonto>
          {NOME_DA_FORMA[f]}
        </Etiqueta>
      ))}
    </span>
  );
}

/** Quem tem cartão: a lista, com procura e filtros; cada linha abre a ficha. */
export function Clientes() {
  const t = useTextos();
  const [estado, setEstado] = useState<Estado>('todos');
  const [lojaId, setLojaId] = useState<number | null>(null);
  const [procura, setProcura] = useState('');
  const [q, setQ] = useState('');
  // A procura só vai à API quando se pára de escrever.
  useEffect(() => {
    const espera = setTimeout(() => setQ(procura.trim()), 250);
    return () => clearTimeout(espera);
  }, [procura]);

  const parametros = new URLSearchParams({ estado });
  if (q) parametros.set('q', q);
  if (lojaId) parametros.set('lojaId', String(lojaId));
  const clientes = useQuery({
    queryKey: ['clientes', estado, q, lojaId],
    queryFn: () => pedir<ClienteDoBackoffice[]>(`/api/bo/clientes?${parametros}`),
    placeholderData: keepPreviousData,
  });
  const barbearia = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const { correr, aCorrer } = useAccao();

  const lista = clientes.data ?? [];

  const exportar = () =>
    correr(async () => {
      let r: Response;
      try {
        r = await fetch(`${API}/api/bo/clientes.csv?lingua=${linguaActual()}`, {
          headers: { Authorization: `Bearer ${sessao() ?? ''}` },
        });
      } catch {
        throw new ErroDaApi('rede');
      }
      // Como em «pedir»: um 401 é a sessão que acabou.
      if (r.status === 401) guardarSessao(null);
      if (!r.ok) throw new ErroDaApi(r.status === 401 ? 'sessao' : 'interno');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = t.clientes.ficheiroCsv;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.clientes}</h1>
          <p className="subtitulo">{t.clientes.subtitulo}</p>
        </div>
        <button type="button" className="botao secundario" disabled={aCorrer} onClick={exportar}>
          <Icone nome="descarregar" tamanho={18} /> {t.clientes.exportarCsv}
        </button>
      </div>

      <div className="filtros">
        <Segmentado<Estado>
          rotulo={t.clientes.estado}
          valor={estado}
          mudar={setEstado}
          opcoes={[
            { valor: 'todos', nome: t.clientes.estados.todos },
            { valor: 'novos', nome: t.clientes.estados.novos },
            { valor: 'activos', nome: t.clientes.estados.activos },
            { valor: 'perdidos', nome: t.clientes.estados.perdidos },
            { valor: 'sem-app', nome: t.clientes.estados.semApp },
          ]}
        />
      </div>
      <div className="filtros">
        {(barbearia.data?.lojas.length ?? 0) > 1 && (
          <select
            className="entrada"
            style={{ maxWidth: 280 }}
            aria-label={t.clientes.casa}
            value={lojaId ?? ''}
            onChange={(e) => setLojaId(Number(e.target.value) || null)}
          >
            <option value="">{t.clientes.todasAsCasas}</option>
            {(barbearia.data?.lojas ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        )}
        <input
          className="entrada procura"
          type="search"
          placeholder={t.clientes.pistaDaProcura}
          aria-label={t.clientes.procurarClientes}
          value={procura}
          onChange={(e) => setProcura(e.target.value)}
        />
      </div>

      {!clientes.data ? (
        <Esqueleto />
      ) : !lista.length ? (
        <div className="cartao">
          <Vazio
            titulo={
              estado === 'todos' && !q && !lojaId ? t.clientes.semClientes : t.clientes.nenhumAqui
            }
          />
        </div>
      ) : (
        <div className="cartao">
          <table className="quadro clientes">
            <thead>
              <tr>
                <th scope="col">{t.clientes.colunas.nome}</th>
                <th scope="col">{t.clientes.colunas.email}</th>
                <th scope="col" className="num">
                  {t.clientes.colunas.cortes}
                </th>
                <th scope="col">{t.clientes.colunas.ultimo}</th>
                <th scope="col">{t.clientes.colunas.cartao}</th>
                <th scope="col">{t.clientes.colunas.recompensas}</th>
                <th scope="col">{t.clientes.colunas.entraCom}</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr
                  key={c.id}
                  className="clicavel"
                  onClick={(e) => {
                    if ((e.target as Element).closest('a')) return;
                    ir(`clientes/${c.id}`);
                  }}
                >
                  <td className="nome">
                    <a className="ligacao-nome" href={`#/clientes/${c.id}`}>
                      {c.nome}
                    </a>
                  </td>
                  <td className="email">
                    {c.email ??
                      (c.emailOculto ? (
                        <span className="email-oculto">{t.clientes.emailOculto}</span>
                      ) : (
                        '—'
                      ))}
                  </td>
                  <td className="num cortes" data-sufixo={t.clientes.sufixoDosCortes(c.cortes)}>
                    {numero(c.cortes)}
                  </td>
                  <td className="ultimo">{c.ultimo ? haQuanto(c.ultimo) : '—'}</td>
                  <td className="carimbos forte">
                    {c.objectivo ? t.clientes.carimbosDe(c.carimbos, c.objectivo) : '—'}
                  </td>
                  <td className="por-usar">
                    {c.recompensasPorUsar > 0 && (
                      <Etiqueta tom="bom">{t.clientes.porUsar(c.recompensasPorUsar)}</Etiqueta>
                    )}
                  </td>
                  <td className="formas">
                    <Formas formas={c.formas} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length >= MAXIMO_DA_LISTA && (
            <p
              className="detalhe"
              style={{
                margin: 0,
                padding: '12px 20px 16px',
                color: 'var(--tinta-3)',
                fontSize: 13.5,
              }}
            >
              {t.clientes.aMostrar(MAXIMO_DA_LISTA)}
            </p>
          )}
        </div>
      )}
    </>
  );
}
