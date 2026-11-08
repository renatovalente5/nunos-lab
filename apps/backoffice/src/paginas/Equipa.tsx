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
  Gaveta,
  Icone,
  Interruptor,
  Segmentado,
  Seletor,
  useAccao,
  useAvisar,
  useConfirmar,
  Vazio,
} from '../pecas';
import { useTextos } from '../textos';
import { haQuanto, nomeDoAparelho } from '../util';
import { GavetaDosAcessos } from './Acessos';

/** Os papéis, pela ordem em que aparecem; os nomes vêm dos textos, na língua de agora. */
const PAPEIS: PapelDaEquipa[] = ['dono', 'barbeiro', 'parceiro'];

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
  const t = useTextos();
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
    t.equipa.papeis.dono,
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
    t.equipa.todasAsCasas,
    barbeiros.filter((p) => p.lojaId === null || !lojas.some((l) => l.id === p.lojaId)),
  );
  juntar(
    'parceiros',
    t.equipa.parceiros,
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
    // Sem email não se entra (as ligações de acesso saíram a 8 nov): é obrigatório.
    const email = normalizarEmail(f.email);
    const faltam = [
      !f.nome.trim() && 'nome',
      !email && 'email',
      f.papel === 'parceiro' && !f.parceiroId && 'parceiroId',
    ].filter(Boolean) as string[];
    if (faltam.length) {
      setErros(faltam);
      avisar(
        faltam.includes('parceiroId') ? t.equipa.faltaOParceiro : t.equipa.camposPorCorrigir,
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
      avisar(f.id ? t.equipa.guardado : t.equipa.jaFazParte(corpo.nome));
      setF(null);
    } catch (e) {
      if (e instanceof ErroDaApi && e.codigo === 'repetido') {
        setErros(['email']);
        avisar(t.equipa.emailDeOutraPessoa, true);
      } else {
        if (e instanceof ErroDaApi && e.campos.length) setErros(e.campos);
        avisar(mensagemDe(e), true);
      }
    }
  }

  const remover = async (p: { id: number; nome: string }) => {
    if (
      await confirmar(
        t.equipa.tirarDaEquipaPergunta(p.nome),
        t.equipa.tirarDaEquipaTexto,
        t.equipa.tirarDaEquipa,
      )
    )
      await correr(async () => {
        await pedir(`/api/bo/equipa/${p.id}`, { metodo: 'DELETE' });
        await refrescar();
        setF(null);
      }, t.equipa.saiuDaEquipa(p.nome));
  };

  const ondeDe = (p: PessoaDaEquipaNoBackoffice) =>
    p.papel === 'parceiro'
      ? p.parceiro
      : p.papel === 'barbeiro'
        ? (p.loja ?? t.equipa.todasAsCasas)
        : null;

  // A pessoa aberta no «Editar», para os aparelhos dela.
  const aberta = f?.id ? pessoas.find((p) => p.id === f.id) : undefined;

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.equipa}</h1>
          <p className="subtitulo">{t.equipa.subtitulo}</p>
        </div>
        <button type="button" className="botao" onClick={() => abrir(null)}>
          <Icone nome="mais" tamanho={18} /> {t.equipa.adicionarAEquipa}
        </button>
      </div>

      <div className="gavetas">
        {!equipa.data ? (
          <Esqueleto />
        ) : !grupos.length ? (
          <div className="cartao">
            <Vazio titulo={t.equipa.semEquipa} />
          </div>
        ) : (
          grupos.map((g) => (
            <Gaveta
              key={g.chave}
              id={`equipa.${g.chave}`}
              titulo={g.nome}
              resumo={g.pessoas.map((p) => p.nome).join(' · ')}
              lista
            >
              <ul className="lista">
                {g.pessoas.map((p) => (
                  <li key={p.id}>
                    <div className="linha">
                      <div className="meio">
                        <div className="titulo-linha">
                          {p.nome} {!p.activo && <Etiqueta>{t.equipa.desligado}</Etiqueta>}
                        </div>
                        <div className="detalhe" style={{ overflowWrap: 'anywhere' }}>
                          {[p.email, ondeDe(p)].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="lado">
                        <button
                          type="button"
                          className="botao secundario pequeno"
                          onClick={() => abrir(p)}
                        >
                          {t.equipa.editar}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Gaveta>
          ))
        )}
        <GavetaDosAcessos />
      </div>

      <Folha
        aberta={!!f}
        fechar={() => setF(null)}
        titulo={f?.id ? t.equipa.editarPessoa(f.nome) : t.equipa.adicionarAEquipa}
        pe={
          <button
            type="button"
            className="botao"
            disabled={!f?.nome.trim() || !f?.email.trim() || aCorrer}
            onClick={() => correr(guardar)}
          >
            {f?.id ? t.equipa.guardar : t.equipa.adicionar}
          </button>
        }
      >
        {f && (
          <div className="formulario">
            <Campo
              rotulo={t.equipa.nome}
              valor={f.nome}
              mudar={mudar('nome')}
              max={LIMITES.pessoa}
              erro={erros.includes('nome')}
              placeholder={t.equipa.exemploDeNome}
              obrigatorio
              autoFocus={!f.id}
            />
            <Campo
              rotulo={t.equipa.email}
              valor={f.email}
              mudar={mudar('email')}
              max={254}
              erro={erros.includes('email')}
              placeholder={t.equipa.exemploDeEmail}
              ajuda={t.equipa.ajudaDoEmail}
              obrigatorio
            />
            <div className="campo">
              <span className="rotulo-campo">{t.equipa.papel}</span>
              <Segmentado<PapelDaEquipa>
                rotulo={t.equipa.papel}
                valor={f.papel}
                mudar={mudar('papel')}
                opcoes={PAPEIS.map((valor) => ({ valor, nome: t.equipa.papeis[valor] }))}
              />
            </div>
            {f.papel === 'barbeiro' && (
              <Seletor<number>
                rotulo={t.equipa.casa}
                valor={f.lojaId}
                mudar={mudar('lojaId')}
                vazio={t.equipa.todasAsCasas}
                opcoes={lojas.map((l) => ({ valor: l.id, nome: l.nome }))}
              />
            )}
            {f.papel === 'parceiro' && (
              <Seletor<number>
                rotulo={t.equipa.parceiro}
                valor={f.parceiroId}
                mudar={mudar('parceiroId')}
                vazio={t.equipa.escolheOParceiro}
                erro={erros.includes('parceiroId')}
                opcoes={(parceiros.data ?? []).map((p) => ({ valor: p.id, nome: p.nome }))}
              />
            )}
            {f.id && (
              <>
                <Interruptor
                  ligado={f.activo}
                  mudar={mudar('activo')}
                  rotulo={t.equipa.activo}
                  ajuda={t.equipa.ajudaDoActivo}
                />
                {aberta && (
                  <div className="campo">
                    <span className="rotulo-campo">{t.equipa.aparelhosTitulo}</span>
                    {aberta.sessoes.length ? (
                      <ul className="lista">
                        {aberta.sessoes.map((s) => (
                          <li key={s.id}>
                            <div className="linha" style={{ padding: '10px 0', minHeight: 0 }}>
                              <div className="meio">
                                <div className="titulo-linha">
                                  {nomeDoAparelho(s.aparelho, t.equipa.aparelho)}
                                </div>
                                <div className="detalhe">
                                  {t.equipa.entrouEUsado(haQuanto(s.criadaEm), haQuanto(s.vistaEm))}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="botao secundario pequeno"
                                disabled={aCorrer}
                                onClick={async () => {
                                  if (
                                    await confirmar(
                                      t.equipa.terminarASessao,
                                      t.equipa.saiNesseAparelho(aberta.nome),
                                      t.equipa.terminar,
                                    )
                                  )
                                    await correr(async () => {
                                      await pedir(`/api/bo/equipa/sessoes/${s.id}`, {
                                        metodo: 'DELETE',
                                      });
                                      await refrescar();
                                    }, t.equipa.sessaoTerminada);
                                }}
                              >
                                {t.equipa.terminar}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="ajuda">{t.equipa.semAparelhos}</div>
                    )}
                  </div>
                )}
                <div className="botoes">
                  <button
                    type="button"
                    className="botao perigo pequeno"
                    onClick={() => remover({ id: f.id!, nome: f.nome })}
                  >
                    {t.equipa.tirarDaEquipa}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Folha>

      {dialogo}
    </>
  );
}
