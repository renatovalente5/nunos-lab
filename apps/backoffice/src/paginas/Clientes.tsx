import type { ClienteDoBackoffice, DefinicoesDaBarbearia, TipoDeEntrada } from '@nunos-lab/dominio';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { API, ErroDaApi, pedir, refrescar, sessao } from '../api';
import { Esqueleto, Etiqueta, Icone, Segmentado, useAccao, useConfirmar, Vazio } from '../pecas';
import { haQuanto, ir, plural } from '../util';

type Estado = 'todos' | 'novos' | 'activos' | 'em-risco' | 'perdidos' | 'sem-app';

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
  const [estado, setEstado] = useState<Estado>('todos');
  const [lojaId, setLojaId] = useState<number | null>(null);
  const [procura, setProcura] = useState('');
  const [q, setQ] = useState('');
  // A procura só vai à API quando se pára de escrever.
  useEffect(() => {
    const t = setTimeout(() => setQ(procura.trim()), 250);
    return () => clearTimeout(t);
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
  const { confirmar, dialogo } = useConfirmar();

  const lista = clientes.data ?? [];
  const exemplos = lista.filter((c) => c.exemplo).length;

  const exportar = () =>
    correr(async () => {
      let r: Response;
      try {
        r = await fetch(`${API}/api/bo/clientes.csv`, {
          headers: { Authorization: `Bearer ${sessao() ?? ''}` },
        });
      } catch {
        throw new ErroDaApi('rede');
      }
      if (!r.ok) throw new ErroDaApi(r.status === 401 ? 'sessao' : 'interno');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clientes.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Clientes</h1>
          <p className="subtitulo">Quem tem cartão.</p>
        </div>
        <button type="button" className="botao secundario" disabled={aCorrer} onClick={exportar}>
          <Icone nome="descarregar" tamanho={18} /> Exportar CSV
        </button>
      </div>

      {exemplos > 0 && (
        <div
          className="caixa-aviso"
          style={{
            marginBottom: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <span>
            {plural(exemplos, 'cliente é de exemplo', 'clientes são de exemplo')}, inventados para a
            demonstração.
          </span>
          <button
            type="button"
            className="botao perigo pequeno"
            onClick={async () => {
              if (
                await confirmar(
                  'Apagar os exemplos?',
                  'Os clientes de exemplo saem com os cartões e os carimbos deles. Não se desfaz.',
                  'Apagar os exemplos',
                )
              )
                await correr(async () => {
                  await pedir<{ apagados: number }>('/api/bo/clientes/exemplos', {
                    metodo: 'DELETE',
                  });
                  await refrescar();
                }, 'Exemplos apagados');
            }}
          >
            Apagar os exemplos
          </button>
        </div>
      )}

      <div className="filtros">
        <Segmentado<Estado>
          rotulo="Estado"
          valor={estado}
          mudar={setEstado}
          opcoes={[
            { valor: 'todos', nome: 'Todos' },
            { valor: 'novos', nome: 'Novos' },
            { valor: 'activos', nome: 'Activos' },
            { valor: 'em-risco', nome: 'Em risco' },
            { valor: 'perdidos', nome: 'Perdidos' },
            { valor: 'sem-app', nome: 'Sem app' },
          ]}
        />
      </div>
      <div className="filtros">
        {(barbearia.data?.lojas.length ?? 0) > 1 && (
          <select
            className="entrada"
            style={{ maxWidth: 280 }}
            aria-label="Casa"
            value={lojaId ?? ''}
            onChange={(e) => setLojaId(Number(e.target.value) || null)}
          >
            <option value="">Todas as casas</option>
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
          placeholder="Nome, email ou código"
          aria-label="Procurar clientes"
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
              estado === 'todos' && !q && !lojaId ? 'Ainda sem clientes' : 'Nenhum cliente aqui'
            }
          />
        </div>
      ) : (
        <div className="cartao">
          <table className="quadro clientes">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Email</th>
                <th scope="col" className="num">
                  Cortes
                </th>
                <th scope="col">Último</th>
                <th scope="col">Cartão</th>
                <th scope="col">Recompensas</th>
                <th scope="col">Entra com</th>
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
                    </a>{' '}
                    {c.exemplo && <Etiqueta semPonto>Exemplo</Etiqueta>}
                  </td>
                  <td className="email">{c.email ?? '—'}</td>
                  <td className="num cortes" data-sufixo={c.cortes === 1 ? 'corte' : 'cortes'}>
                    {c.cortes.toLocaleString('pt-PT')}
                  </td>
                  <td className="ultimo">{c.ultimo ? haQuanto(c.ultimo) : '—'}</td>
                  <td className="carimbos forte">
                    {c.objectivo ? `${c.carimbos} de ${c.objectivo}` : '—'}
                  </td>
                  <td className="por-usar">
                    {c.recompensasPorUsar > 0 && (
                      <Etiqueta tom="bom">{c.recompensasPorUsar} por usar</Etiqueta>
                    )}
                  </td>
                  <td className="formas">
                    <Formas formas={c.formas} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialogo}
    </>
  );
}
