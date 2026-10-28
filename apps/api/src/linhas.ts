import type {
  Categoria,
  IconeDaCategoria,
  Loja,
  Parceiro,
  PromocaoPublica,
} from '@nunos-lab/dominio';
import { eIconeDaCategoria } from '@nunos-lab/dominio';

/** As linhas como vêm da base, e a passagem para o contrato da API. */

export type LinhaParceiro = {
  id: number;
  nome: string;
  categoria_id: number | null;
  loja_id: number | null;
  localidade: string;
  morada: string;
  telefone: string;
  instagram: string;
  site: string;
  horario: string;
  descricao: string;
  cor: string;
  logotipo_id: string | null;
  capa_id: string | null;
  activo: number;
  exemplo: number;
  ordem: number;
  criado_em: number;
  alterado_em: number;
};

export type LinhaPromocao = {
  id: number;
  parceiro_id: number;
  destaque: string;
  titulo: string;
  detalhe: string;
  inicio: string | null;
  fim: string | null;
  em_destaque: number;
  activa: number;
  ordem: number;
  criada_em: number;
  alterada_em: number;
};

export type LinhaCategoria = { id: number; nome: string; icone: string; ordem: number };
export type LinhaLoja = {
  id: number;
  nome: string;
  morada: string;
  telefone: string;
  marcar: string;
  ordem: number;
};

export function categoria(l: LinhaCategoria): Categoria {
  const icone: IconeDaCategoria = eIconeDaCategoria(l.icone) ? l.icone : 'outro';
  return { id: l.id, nome: l.nome, icone, ordem: l.ordem };
}

export function loja(l: LinhaLoja): Loja {
  return {
    id: l.id,
    nome: l.nome,
    morada: l.morada,
    telefone: l.telefone,
    marcar: l.marcar,
    ordem: l.ordem,
  };
}

export function promocaoPublica(l: LinhaPromocao): PromocaoPublica {
  return {
    id: l.id,
    destaque: l.destaque,
    titulo: l.titulo,
    detalhe: l.detalhe,
    inicio: l.inicio,
    fim: l.fim,
    emDestaque: l.em_destaque === 1,
  };
}

export function parceiroBase(l: LinhaParceiro) {
  return {
    id: l.id,
    nome: l.nome,
    categoriaId: l.categoria_id,
    lojaId: l.loja_id,
    localidade: l.localidade,
    morada: l.morada,
    telefone: l.telefone,
    instagram: l.instagram,
    site: l.site,
    horario: l.horario,
    descricao: l.descricao,
    cor: l.cor,
    logotipo: l.logotipo_id,
    capa: l.capa_id,
    exemplo: l.exemplo === 1,
  };
}

export function parceiroDoBackoffice(
  l: LinhaParceiro & { na_app: number; total: number },
): Parceiro {
  return {
    ...parceiroBase(l),
    activo: l.activo === 1,
    ordem: l.ordem,
    criadoEm: l.criado_em,
    alteradoEm: l.alterado_em,
    promocoesNaApp: l.na_app,
    promocoesTotal: l.total,
  };
}
