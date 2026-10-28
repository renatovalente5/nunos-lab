import {
  dataCurta,
  diaEmLisboa,
  type DefinicoesDaBarbearia,
  type FichaDoCliente,
} from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { mensagemDe, pedir } from '../api';
import { Esqueleto, Etiqueta, Icone, Vazio } from '../pecas';
import { Formas } from './Clientes';

/** «12 out» de um instante. */
function diaDe(segundos: number, hoje: string): string {
  return dataCurta(diaEmLisboa(segundos * 1000), hoje);
}

/** «15:30» de um instante, em Lisboa. */
function horaDe(segundos: number): string {
  return new Date(segundos * 1000).toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  });
}

/** A ficha de um cliente: quem é, os cartões, e cada carimbo. */
export function Cliente({ id }: { id: string }) {
  const ficha = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => pedir<FichaDoCliente>(`/api/bo/clientes/${id}`),
  });
  const barbearia = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const hoje = diaEmLisboa();
  const voltar = (
    <a className="voltar" href="#/clientes">
      <Icone nome="voltar" tamanho={16} /> Clientes
    </a>
  );
  if (ficha.error)
    return (
      <>
        {voltar}
        <div className="cartao">
          <Vazio titulo={mensagemDe(ficha.error)} />
        </div>
      </>
    );
  const c = ficha.data;
  if (!c)
    return (
      <>
        {voltar}
        <Esqueleto linhas={6} />
      </>
    );
  const casa = barbearia.data?.lojas.find((l) => l.id === c.lojaId)?.nome;
  const aniversario = c.aniversario
    ? `${c.aniversario.slice(3, 5)}/${c.aniversario.slice(0, 2)}`
    : null;

  return (
    <>
      {voltar}
      <div className="cabecalho">
        <div>
          <h1>{c.nome}</h1>
          <p className="subtitulo">
            <code className="codigo">{c.codigo}</code>
            {c.exemplo && (
              <>
                {' '}
                <Etiqueta semPonto>Exemplo</Etiqueta>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="cartao recheado">
        <dl className="detalhes">
          <div className="largo">
            <dt>Email</dt>
            <dd>{c.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Aniversário</dt>
            <dd>{aniversario ?? '—'}</dd>
          </div>
          <div>
            <dt>Casa</dt>
            <dd>{casa ?? (barbearia.data ? 'Sem casa' : '—')}</dd>
          </div>
          <div>
            <dt>Desde</dt>
            <dd>{diaDe(c.criadoEm, hoje)}</dd>
          </div>
          <div>
            <dt>Cortes</dt>
            <dd>{c.cortes.toLocaleString('pt-PT')}</dd>
          </div>
          <div>
            <dt>Entra com</dt>
            <dd>
              <Formas formas={c.formas} />
            </dd>
          </div>
        </dl>
      </div>

      <h2 className="seccao">Cartões</h2>
      <div className="cartao">
        {c.cartoes.length ? (
          <ul className="lista">
            {c.cartoes.map((k) => {
              const usado = k.usadoEm !== null;
              const completo = k.completoEm !== null;
              return (
                <li key={k.id}>
                  <div className="linha">
                    <div className="meio">
                      <div className="titulo-linha">
                        Cartão {k.numero}
                        <span style={{ fontWeight: 600, color: 'var(--tinta-2)' }}>
                          {' '}
                          · {k.carimbos} de {k.objectivo}
                        </span>
                      </div>
                      <div className="detalhe">
                        {k.recompensa} · desde {diaDe(k.iniciadoEm, hoje)}
                        {completo && ` · completo a ${diaDe(k.completoEm!, hoje)}`}
                        {usado &&
                          ` · usado a ${diaDe(k.usadoEm!, hoje)}${k.usadoLoja ? ` em ${k.usadoLoja}` : ''}${k.usadoPor ? ` por ${k.usadoPor}` : ''}`}
                      </div>
                    </div>
                    {usado ? (
                      <Etiqueta>Usado</Etiqueta>
                    ) : completo ? (
                      <Etiqueta tom="bom">Por usar</Etiqueta>
                    ) : (
                      <Etiqueta semPonto>Em curso</Etiqueta>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Vazio titulo="Ainda sem cartão" />
        )}
      </div>

      <h2 className="seccao">Histórico</h2>
      <div className="cartao">
        {c.historico.length ? (
          <ul className="lista">
            {c.historico.map((h) => (
              <li key={h.id}>
                <div className="linha">
                  <div className="meio">
                    <div className="titulo-linha">
                      {diaDe(h.quando, hoje)} · {horaDe(h.quando)}
                    </div>
                    <div className="detalhe">
                      {[h.loja, h.pessoa, h.servico, `Cartão ${h.cartaoNumero}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  {(h.anuladoEm !== null || h.repetido || h.semLeitura) && (
                    <div className="lado">
                      {h.anuladoEm !== null && (
                        <Etiqueta tom="mau">{`Anulado${h.anuladoPor ? ` por ${h.anuladoPor}` : ''}`}</Etiqueta>
                      )}
                      {h.repetido && <Etiqueta tom="atencao">Repetido</Etiqueta>}
                      {h.semLeitura && <Etiqueta>Sem leitura</Etiqueta>}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Vazio titulo="Ainda sem carimbos" />
        )}
      </div>
    </>
  );
}
