import {
  LIMITES,
  normalizarEmail,
  type DefinicoesDaBarbearia,
  type PapelDaEquipa,
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
import { haQuanto, nomeDoAparelho, parametro } from '../util';
import { GavetaDosAcessos } from './Acessos';

/**
 * Os papéis que se escolhem na Equipa, pela ordem em que aparecem; os nomes vêm dos textos, na
 * língua de agora. Quem valida num parceiro junta-se na página do parceiro (o Renato, 8 nov).
 */
const PAPEIS: PapelDaEquipa[] = ['dono', 'barbeiro'];

type Formulario = {
  nome: string;
  email: string;
  papel: PapelDaEquipa;
  lojaId: number | null;
  activo: boolean;
};

/** A pessoa aberta na folha; `null` é uma nova. */
type Aberta = { pessoa: PessoaDaEquipaNoBackoffice | null } | null;

export const useEquipa = () =>
  useQuery({
    queryKey: ['equipa'],
    queryFn: () => pedir<PessoaDaEquipaNoBackoffice[]>('/api/bo/equipa'),
  });

/**
 * Quem carimba na app for partners: o dono e os barbeiros de cada casa. Cada um entra com o Google
 * ou a Apple do email que aqui está.
 */
export function Equipa() {
  const t = useTextos();
  const equipa = useEquipa();
  const barbearia = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const [aberta, setAberta] = useState<Aberta>(null);

  const lojas = barbearia.data?.lojas ?? [];
  const pessoas = equipa.data ?? [];

  // Os grupos, pela ordem em que se lê: o dono, cada casa, quem é de todas.
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

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{t.geral.seccoes.equipa}</h1>
          <p className="subtitulo">{t.equipa.subtitulo}</p>
        </div>
        <button type="button" className="botao" onClick={() => setAberta({ pessoa: null })}>
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
              {/* Cada pessoa abre a página dela: os números e tudo o que fez (11 nov 2026). */}
              <ListaDePessoas pessoas={g.pessoas} />
            </Gaveta>
          ))
        )}
        <GavetaDosAcessos />
      </div>

      {aberta && <FolhaDaPessoa pessoa={aberta.pessoa} fechar={() => setAberta(null)} />}
    </>
  );
}

/**
 * Quem valida as promoções de um parceiro na app for partners: junta-se e edita-se na página do
 * parceiro, e não na Equipa (o Renato, 8 nov).
 */
export function GavetaDeQuemValida({ parceiroId }: { parceiroId: number }) {
  const t = useTextos();
  const equipa = useEquipa();
  const [aberta, setAberta] = useState<Aberta>(null);
  const pessoas = (equipa.data ?? []).filter(
    (p) => p.papel === 'parceiro' && p.parceiroId === parceiroId,
  );

  return (
    <>
      <Gaveta
        id="parceiro.pessoas"
        chegarAqui={parametro('abrir') === 'quem-valida'}
        titulo={t.equipa.quemValida}
        resumo={equipa.data && (pessoas.map((p) => p.nome).join(' · ') || t.equipa.aindaNinguem)}
        lista
      >
        {!equipa.data ? (
          <Esqueleto linhas={2} />
        ) : pessoas.length ? (
          <ListaDePessoas pessoas={pessoas} abrir={(pessoa) => setAberta({ pessoa })} />
        ) : (
          <Vazio titulo={t.equipa.aindaNinguem}>{t.equipa.quemValidaAjuda}</Vazio>
        )}
        <div className="pe-gaveta">
          <button
            type="button"
            className="botao secundario"
            onClick={() => setAberta({ pessoa: null })}
          >
            <Icone nome="mais" tamanho={18} /> {t.equipa.adicionarPessoa}
          </button>
        </div>
      </Gaveta>

      {aberta && (
        <FolhaDaPessoa
          pessoa={aberta.pessoa}
          parceiroId={parceiroId}
          fechar={() => setAberta(null)}
        />
      )}
    </>
  );
}

/**
 * As linhas de uma lista de pessoas: o nome, o email (e a casa de um barbeiro). Na Equipa cada linha abre
 * a página da pessoa (com o «Editar» lá dentro); em quem valida num parceiro, o «Editar» está na linha.
 */
function ListaDePessoas({
  pessoas,
  abrir,
}: {
  pessoas: PessoaDaEquipaNoBackoffice[];
  /** O «Editar» na linha; sem ele, a linha abre a página da pessoa. */
  abrir?: (p: PessoaDaEquipaNoBackoffice) => void;
}) {
  const t = useTextos();
  const meio = (p: PessoaDaEquipaNoBackoffice) => (
    <div className="meio">
      <div className="titulo-linha">
        {p.nome} {!p.activo && <Etiqueta>{t.equipa.desligado}</Etiqueta>}
      </div>
      <div className="detalhe" style={{ overflowWrap: 'anywhere' }}>
        {[p.email, p.papel === 'barbeiro' && (p.loja ?? t.equipa.todasAsCasas)]
          .filter(Boolean)
          .join(' · ')}
      </div>
    </div>
  );
  return (
    <ul className="lista">
      {pessoas.map((p) => (
        <li key={p.id}>
          {abrir ? (
            <div className="linha">
              {meio(p)}
              <div className="lado">
                <button type="button" className="botao secundario pequeno" onClick={() => abrir(p)}>
                  {t.equipa.editar}
                </button>
              </div>
            </div>
          ) : (
            <a className="linha" href={`#/equipa/${p.id}`}>
              {meio(p)}
              <Icone nome="seguinte" tamanho={18} />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Juntar ou editar quem entra na app for partners. Sem `parceiroId`, é da equipa (o dono, ou um
 * barbeiro de uma casa ou de todas); com ele, valida as promoções desse parceiro, e não há papel
 * nem casa a escolher.
 */
export function FolhaDaPessoa({
  pessoa,
  parceiroId,
  fechar,
}: {
  pessoa: PessoaDaEquipaNoBackoffice | null;
  parceiroId?: number;
  fechar: () => void;
}) {
  const t = useTextos();
  const equipa = useEquipa();
  const barbearia = useQuery({
    queryKey: ['barbearia'],
    queryFn: () => pedir<DefinicoesDaBarbearia>('/api/bo/barbearia'),
  });
  const [f, setF] = useState<Formulario>(() =>
    pessoa
      ? {
          nome: pessoa.nome,
          email: pessoa.email ?? '',
          papel: pessoa.papel,
          lojaId: pessoa.lojaId,
          activo: pessoa.activo,
        }
      : { nome: '', email: '', papel: 'barbeiro', lojaId: null, activo: true },
  );
  const [erros, setErros] = useState<string[]>([]);
  // Onde já está um email repetido, para o dizer debaixo do campo (o Renato, 8 nov).
  const [emailDeQuem, setEmailDeQuem] = useState<string | null>(null);
  const { correr, aCorrer } = useAccao();
  const avisar = useAvisar();
  const { confirmar, dialogo } = useConfirmar();
  const doParceiro = parceiroId !== undefined;
  const lojas = barbearia.data?.lojas ?? [];
  // A pessoa como está agora, para os aparelhos mudarem ao terminar uma sessão.
  const agora = pessoa && equipa.data?.find((p) => p.id === pessoa.id);

  const mudar =
    <K extends keyof Formulario>(k: K) =>
    (v: Formulario[K]) => {
      setF((x) => ({ ...x, [k]: v }));
      setErros((e) => e.filter((c) => c !== k));
      if (k === 'email') setEmailDeQuem(null);
    };

  // Um email só entra num sítio: noutro parceiro, neste, ou na Equipa.
  const ondeEstaOEmail = (p: PessoaDaEquipaNoBackoffice) =>
    p.papel !== 'parceiro'
      ? t.equipa.emailNaEquipa(p.nome)
      : p.parceiroId === parceiroId
        ? t.equipa.emailJaValidaAqui(p.nome)
        : t.equipa.emailNoutroParceiro(p.parceiro ?? '', p.nome);

  async function guardar() {
    // Sem email não se entra (as ligações de acesso saíram a 8 nov): é obrigatório.
    const email = normalizarEmail(f.email);
    const faltam = [!f.nome.trim() && 'nome', !email && 'email'].filter(Boolean) as string[];
    if (faltam.length) {
      setErros(faltam);
      avisar(t.equipa.camposPorCorrigir, true);
      return;
    }
    const papel = doParceiro ? 'parceiro' : f.papel;
    const corpo = {
      nome: f.nome.trim(),
      email,
      papel,
      lojaId: papel === 'barbeiro' ? f.lojaId : null,
      parceiroId: parceiroId ?? null,
      ...(pessoa ? { activo: f.activo } : {}),
    };
    try {
      if (pessoa) await pedir(`/api/bo/equipa/${pessoa.id}`, { metodo: 'PATCH', corpo });
      else await pedir('/api/bo/equipa', { metodo: 'POST', corpo });
      await refrescar();
      avisar(
        pessoa
          ? t.equipa.guardado
          : doParceiro
            ? t.equipa.jaPodeValidar(corpo.nome)
            : t.equipa.jaFazParte(corpo.nome),
      );
      fechar();
    } catch (e) {
      if (e instanceof ErroDaApi && e.codigo === 'repetido') {
        // A lista de agora diz quem o tem; sem ela (a conta da revisão não se lista), só «outra pessoa».
        const outra = (await equipa.refetch()).data?.find(
          (p) => p.email === email && p.id !== pessoa?.id,
        );
        setErros(['email']);
        setEmailDeQuem(outra ? ondeEstaOEmail(outra) : t.equipa.emailDeOutraPessoa);
        avisar(t.equipa.camposPorCorrigir, true);
      } else {
        if (e instanceof ErroDaApi && e.campos.length) setErros(e.campos);
        avisar(mensagemDe(e), true);
      }
    }
  }

  // Quem valida num parceiro não é da equipa: tira-se-lhe o acesso.
  const remover = async (p: PessoaDaEquipaNoBackoffice) => {
    if (
      await confirmar(
        doParceiro ? t.equipa.tirarOAcessoPergunta(p.nome) : t.equipa.tirarDaEquipaPergunta(p.nome),
        doParceiro ? t.equipa.tirarOAcessoTexto : t.equipa.tirarDaEquipaTexto,
        doParceiro ? t.equipa.tirarOAcesso : t.equipa.tirarDaEquipa,
      )
    )
      await correr(
        async () => {
          await pedir(`/api/bo/equipa/${p.id}`, { metodo: 'DELETE' });
          await refrescar();
          fechar();
        },
        doParceiro ? t.equipa.acessoTirado : t.equipa.saiuDaEquipa(p.nome),
      );
  };

  return (
    <>
      <Folha
        aberta
        fechar={fechar}
        titulo={
          pessoa
            ? t.equipa.editarPessoa(pessoa.nome)
            : doParceiro
              ? t.equipa.adicionarPessoa
              : t.equipa.adicionarAEquipa
        }
        pe={
          <button
            type="button"
            className="botao"
            disabled={!f.nome.trim() || !f.email.trim() || aCorrer}
            onClick={() => correr(guardar)}
          >
            {pessoa ? t.equipa.guardar : t.equipa.adicionar}
          </button>
        }
      >
        <div className="formulario">
          <Campo
            rotulo={t.equipa.nome}
            valor={f.nome}
            mudar={mudar('nome')}
            max={LIMITES.pessoa}
            erro={erros.includes('nome')}
            placeholder={t.equipa.exemploDeNome}
            obrigatorio
            autoFocus={!pessoa}
          />
          <Campo
            rotulo={t.equipa.email}
            valor={f.email}
            mudar={mudar('email')}
            max={254}
            erro={erros.includes('email')}
            erroTexto={emailDeQuem ?? undefined}
            placeholder={t.equipa.exemploDeEmail}
            ajuda={t.equipa.ajudaDoEmail}
            obrigatorio
          />
          {!doParceiro && (
            <div className="campo">
              <span className="rotulo-campo">{t.equipa.papel}</span>
              <Segmentado<PapelDaEquipa>
                cheio
                rotulo={t.equipa.papel}
                valor={f.papel}
                mudar={mudar('papel')}
                opcoes={PAPEIS.map((valor) => ({ valor, nome: t.equipa.papeis[valor] }))}
              />
            </div>
          )}
          {!doParceiro && f.papel === 'barbeiro' && (
            <Seletor<number>
              rotulo={t.equipa.casa}
              valor={f.lojaId}
              mudar={mudar('lojaId')}
              vazio={t.equipa.todasAsCasas}
              opcoes={lojas.map((l) => ({ valor: l.id, nome: l.nome }))}
            />
          )}
          {pessoa && (
            <>
              <Interruptor
                ligado={f.activo}
                mudar={mudar('activo')}
                rotulo={t.equipa.activo}
                ajuda={t.equipa.ajudaDoActivo}
              />
              {agora && (
                <div className="campo">
                  <span className="rotulo-campo">{t.equipa.aparelhosTitulo}</span>
                  {agora.sessoes.length ? (
                    <ul className="lista">
                      {agora.sessoes.map((s) => (
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
                                    t.equipa.saiNesseAparelho(agora.nome),
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
                  onClick={() => remover(pessoa)}
                >
                  {doParceiro ? t.equipa.tirarOAcesso : t.equipa.tirarDaEquipa}
                </button>
              </div>
            </>
          )}
        </div>
      </Folha>

      {dialogo}
    </>
  );
}
