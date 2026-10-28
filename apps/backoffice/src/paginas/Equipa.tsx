import {
  LIMITES,
  normalizarEmail,
  type DefinicoesDaBarbearia,
  type PapelDaEquipa,
  type Parceiro,
  type PessoaDaEquipaNoBackoffice,
} from '@nunos-lab/dominio';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ErroDaApi, mensagemDe, pedir, refrescar } from '../api';
import {
  Campo,
  Esqueleto,
  Etiqueta,
  Folha,
  Icone,
  Interruptor,
  Segmentado,
  Seletor,
  useAccao,
  useAvisar,
  useConfirmar,
  Vazio,
} from '../pecas';
import { haQuanto, plural } from '../util';

/** A Balcão, onde quer que esteja publicada. */
const BALCAO = (import.meta.env.VITE_BALCAO as string).replace(/\/$/, '');

function ligacaoDe(codigo: string): string {
  return `${BALCAO}/#acesso=${codigo}`;
}

const PAPEIS: { valor: PapelDaEquipa; nome: string }[] = [
  { valor: 'dono', nome: 'Dono' },
  { valor: 'barbeiro', nome: 'Barbeiro' },
  { valor: 'parceiro', nome: 'Parceiro' },
];

type Formulario = {
  id: number | null;
  nome: string;
  email: string;
  papel: PapelDaEquipa;
  lojaId: number | null;
  parceiroId: number | null;
  activo: boolean;
};

const NOVA: Formulario = {
  id: null,
  nome: '',
  email: '',
  papel: 'barbeiro',
  lojaId: null,
  parceiroId: null,
  activo: true,
};

/**
 * Quem carimba na Balcão: o dono, os barbeiros de cada casa, e os parceiros
 * que validam as vantagens. Cada um entra com o Google ou a Apple do email
 * que aqui está, ou por uma ligação de acesso (uma vez, num aparelho).
 */
export function Equipa() {
  const equipa = useQuery({
    queryKey: ['equipa'],
    queryFn: () => pedir<PessoaDaEquipaNoBackoffice[]>('/api/bo/equipa'),
  });
  const barbearia = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const parceiros = useQuery({
    queryKey: ['parceiros'],
    queryFn: () => pedir<Parceiro[]>('/api/bo/parceiros'),
  });
  const [f, setF] = useState<Formulario | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [ligacao, setLigacao] = useState<{ para: string; url: string; ate: number } | null>(null);
  const [aparelhosDe, setAparelhosDe] = useState<number | null>(null);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();
  const { confirmar, dialogo } = useConfirmar();

  const lojas = barbearia.data?.lojas ?? [];
  const pessoas = equipa.data ?? [];

  // Os grupos, pela ordem em que se lê: o dono, cada casa, quem é de todas, os parceiros.
  const grupos: { chave: string; nome: string; pessoas: PessoaDaEquipaNoBackoffice[] }[] = [];
  const juntar = (chave: string, nome: string, lista: PessoaDaEquipaNoBackoffice[]) => {
    if (lista.length) grupos.push({ chave, nome, pessoas: lista });
  };
  juntar(
    'dono',
    'Dono',
    pessoas.filter((p) => p.papel === 'dono'),
  );
  const barbeiros = pessoas.filter((p) => p.papel === 'barbeiro');
  for (const l of lojas)
    juntar(
      `loja-${l.id}`,
      l.nome,
      barbeiros.filter((p) => p.lojaId === l.id),
    );
  juntar(
    'todas',
    'Todas as casas',
    barbeiros.filter((p) => p.lojaId === null || !lojas.some((l) => l.id === p.lojaId)),
  );
  juntar(
    'parceiros',
    'Parceiros',
    pessoas.filter((p) => p.papel === 'parceiro'),
  );

  const abrir = (p: PessoaDaEquipaNoBackoffice | null) => {
    setErros([]);
    setF(
      p
        ? {
            id: p.id,
            nome: p.nome,
            email: p.email ?? '',
            papel: p.papel,
            lojaId: p.lojaId,
            parceiroId: p.parceiroId,
            activo: p.activo,
          }
        : NOVA,
    );
  };

  const mudar =
    <K extends keyof Formulario>(k: K) =>
    (v: Formulario[K]) => {
      setF((x) => (x ? { ...x, [k]: v } : x));
      setErros((e) => e.filter((c) => c !== k));
    };

  async function guardar() {
    if (!f) return;
    const email = f.email.trim() ? normalizarEmail(f.email) : null;
    const faltam = [
      !f.nome.trim() && 'nome',
      f.email.trim() && !email && 'email',
      f.papel === 'parceiro' && !f.parceiroId && 'parceiroId',
    ].filter(Boolean) as string[];
    if (faltam.length) {
      setErros(faltam);
      avisar(
        faltam.includes('parceiroId') ? 'Escolhe o parceiro.' : 'Há campos por corrigir.',
        true,
      );
      return;
    }
    const corpo = {
      nome: f.nome.trim(),
      email,
      papel: f.papel,
      lojaId: f.papel === 'barbeiro' ? f.lojaId : null,
      parceiroId: f.papel === 'parceiro' ? f.parceiroId : null,
      ...(f.id ? { activo: f.activo } : {}),
    };
    try {
      if (f.id) await pedir(`/api/bo/equipa/${f.id}`, { metodo: 'PATCH', corpo });
      else await pedir('/api/bo/equipa', { metodo: 'POST', corpo });
      await refrescar();
      avisar(f.id ? 'Guardado' : `${corpo.nome} já faz parte da equipa`);
      setF(null);
    } catch (e) {
      if (e instanceof ErroDaApi && e.codigo === 'repetido') {
        setErros(['email']);
        avisar('Esse email já é de outra pessoa.', true);
      } else {
        if (e instanceof ErroDaApi && e.campos.length) setErros(e.campos);
        avisar(mensagemDe(e), true);
      }
    }
  }

  const criarLigacao = (p: { id: number; nome: string }) =>
    correr(async () => {
      const r = await pedir<{ codigo: string; expiraEm: number }>(`/api/bo/equipa/${p.id}/acesso`, {
        metodo: 'POST',
      });
      await refrescar();
      setLigacao({ para: p.nome, url: ligacaoDe(r.codigo), ate: r.expiraEm });
    });

  const remover = async (p: { id: number; nome: string }) => {
    if (
      await confirmar(
        `Tirar ${p.nome} da equipa?`,
        'Sai já de todos os aparelhos e deixa de carimbar. Os carimbos que deu ficam.',
        'Tirar da equipa',
      )
    )
      await correr(async () => {
        await pedir(`/api/bo/equipa/${p.id}`, { metodo: 'DELETE' });
        await refrescar();
        setF(null);
      }, `${p.nome} saiu da equipa`);
  };

  const ondeDe = (p: PessoaDaEquipaNoBackoffice) =>
    p.papel === 'parceiro'
      ? p.parceiro
      : p.papel === 'barbeiro'
        ? (p.loja ?? 'Todas as casas')
        : null;

  const comAparelhos = aparelhosDe !== null ? pessoas.find((p) => p.id === aparelhosDe) : null;

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Equipa</h1>
          <p className="subtitulo">Quem carimba na Balcão, e os parceiros que validam.</p>
        </div>
        <button type="button" className="botao" onClick={() => abrir(null)}>
          <Icone nome="mais" tamanho={18} /> Adicionar à equipa
        </button>
      </div>

      {!equipa.data ? (
        <Esqueleto />
      ) : !grupos.length ? (
        <div className="cartao">
          <Vazio titulo="Ainda sem equipa" />
        </div>
      ) : (
        grupos.map((g, i) => (
          <section key={g.chave} aria-labelledby={`grupo-${g.chave}`}>
            <h2
              className="seccao"
              id={`grupo-${g.chave}`}
              style={i === 0 ? { marginTop: 0 } : undefined}
            >
              {g.nome}
            </h2>
            <div className="cartao">
              <ul className="lista">
                {g.pessoas.map((p) => (
                  <li key={p.id}>
                    <div className="linha">
                      <div className="meio">
                        <div className="titulo-linha">
                          {p.nome} {!p.activo && <Etiqueta>Desligado</Etiqueta>}{' '}
                          {p.ligacoes.length > 0 && (
                            <Etiqueta tom="atencao">Ligação por usar</Etiqueta>
                          )}
                        </div>
                        <div className="detalhe" style={{ overflowWrap: 'anywhere' }}>
                          {[p.email ?? 'Só por ligação', ondeDe(p)].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="lado">
                        {p.sessoes.length > 0 && (
                          <button
                            type="button"
                            className="botao secundario pequeno"
                            onClick={() => setAparelhosDe(p.id)}
                          >
                            {plural(p.sessoes.length, 'aparelho', 'aparelhos')}
                          </button>
                        )}
                        {p.activo && (
                          <button
                            type="button"
                            className="botao secundario pequeno so-largo"
                            disabled={aCorrer}
                            onClick={() => criarLigacao(p)}
                          >
                            Ligação
                          </button>
                        )}
                        <button
                          type="button"
                          className="botao secundario pequeno"
                          onClick={() => abrir(p)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="botao perigo pequeno so-largo"
                          onClick={() => remover(p)}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))
      )}

      <Folha
        aberta={!!f}
        fechar={() => setF(null)}
        titulo={f?.id ? `Editar ${f.nome}` : 'Adicionar à equipa'}
        pe={
          <button
            type="button"
            className="botao"
            disabled={!f?.nome.trim() || aCorrer}
            onClick={() => correr(guardar)}
          >
            {f?.id ? 'Guardar' : 'Adicionar'}
          </button>
        }
      >
        {f && (
          <div className="formulario">
            <Campo
              rotulo="Nome"
              valor={f.nome}
              mudar={mudar('nome')}
              max={LIMITES.pessoa}
              erro={erros.includes('nome')}
              placeholder="ex.: Nuno"
              obrigatorio
              autoFocus={!f.id}
            />
            <Campo
              rotulo="Email"
              valor={f.email}
              mudar={mudar('email')}
              max={254}
              erro={erros.includes('email')}
              placeholder="nome@gmail.com"
              ajuda="Entra na Balcão com o Google ou a Apple deste email. Vazio: só por ligação."
            />
            <div className="campo">
              <span className="rotulo-campo">Papel</span>
              <Segmentado<PapelDaEquipa>
                rotulo="Papel"
                valor={f.papel}
                mudar={mudar('papel')}
                opcoes={PAPEIS}
              />
            </div>
            {f.papel === 'barbeiro' && (
              <Seletor<number>
                rotulo="Casa"
                valor={f.lojaId}
                mudar={mudar('lojaId')}
                vazio="Todas as casas"
                opcoes={lojas.map((l) => ({ valor: l.id, nome: l.nome }))}
              />
            )}
            {f.papel === 'parceiro' && (
              <Seletor<number>
                rotulo="Parceiro"
                valor={f.parceiroId}
                mudar={mudar('parceiroId')}
                vazio="Escolhe o parceiro"
                erro={erros.includes('parceiroId')}
                opcoes={(parceiros.data ?? []).map((p) => ({ valor: p.id, nome: p.nome }))}
              />
            )}
            {f.id && (
              <>
                <Interruptor
                  ligado={f.activo}
                  mudar={mudar('activo')}
                  rotulo="Activo"
                  ajuda="Desligado, não entra na Balcão."
                />
                <div className="botoes">
                  {f.activo && (
                    <button
                      type="button"
                      className="botao secundario pequeno"
                      disabled={aCorrer}
                      onClick={() => {
                        const { id, nome } = f;
                        setF(null);
                        criarLigacao({ id: id!, nome });
                      }}
                    >
                      Criar ligação de acesso
                    </button>
                  )}
                  <button
                    type="button"
                    className="botao perigo pequeno"
                    onClick={() => remover({ id: f.id!, nome: f.nome })}
                  >
                    Tirar da equipa
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Folha>

      <Folha
        aberta={!!comAparelhos}
        fechar={() => setAparelhosDe(null)}
        titulo={`Aparelhos de ${comAparelhos?.nome ?? ''}`}
      >
        {comAparelhos &&
          (comAparelhos.sessoes.length ? (
            <ul className="lista">
              {comAparelhos.sessoes.map((s) => (
                <li key={s.id}>
                  <div className="linha" style={{ padding: '12px 0' }}>
                    <div className="meio">
                      <div className="titulo-linha">{s.aparelho || 'Aparelho'}</div>
                      <div className="detalhe">
                        Entrou {haQuanto(s.criadaEm)} · usado {haQuanto(s.vistaEm)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="botao secundario pequeno"
                      onClick={async () => {
                        if (
                          await confirmar(
                            'Terminar a sessão?',
                            `${comAparelhos.nome} sai da Balcão nesse aparelho.`,
                            'Terminar',
                          )
                        )
                          await correr(async () => {
                            await pedir(`/api/bo/equipa/sessoes/${s.id}`, { metodo: 'DELETE' });
                            await refrescar();
                          }, 'Sessão terminada');
                      }}
                    >
                      Terminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio titulo="Sem aparelhos" />
          ))}
      </Folha>

      <Folha
        aberta={!!ligacao}
        fechar={() => setLigacao(null)}
        titulo={`A ligação para ${ligacao?.para ?? ''}`}
        pe={
          <>
            <button
              type="button"
              className="botao"
              onClick={async () => {
                if (!ligacao) return;
                try {
                  await navigator.clipboard.writeText(ligacao.url);
                  avisar('Copiada');
                } catch {
                  avisar('Não deu para copiar: selecciona e copia à mão.', true);
                }
              }}
            >
              <Icone nome="copiar" tamanho={17} /> Copiar
            </button>
            {typeof navigator.share === 'function' && (
              <button
                type="button"
                className="botao secundario"
                onClick={() =>
                  ligacao &&
                  navigator
                    .share({ title: "Balcão do Nuno's Lab", url: ligacao.url })
                    .catch(() => {})
                }
              >
                <Icone nome="partilhar" tamanho={17} /> Partilhar
              </button>
            )}
          </>
        }
      >
        {ligacao && (
          <div className="formulario">
            <input
              className="entrada"
              readOnly
              value={ligacao.url}
              onFocus={(e) => e.target.select()}
              aria-label="Ligação de acesso"
            />
            <div className="caixa-aviso">
              Entra uma vez, num aparelho, até{' '}
              {new Date(ligacao.ate * 1000).toLocaleDateString('pt-PT', {
                day: 'numeric',
                month: 'long',
              })}
              . Manda-a só a {ligacao.para}: quem a abrir entra na Balcão.
            </div>
          </div>
        )}
      </Folha>
      {dialogo}
    </>
  );
}
