import type {
  Categoria,
  IconeDaCategoria,
  Loja,
  Parceiro,
  PeriodoDoLimite,
  PromocaoPublica,
} from '@nunos-lab/dominio';
import {
  eIconeDaCategoria,
  lerAjusteDoLogotipo,
  lerHorarioDaSemana,
  naLingua,
  textoDoHorario,
  type Lingua,
} from '@nunos-lab/dominio';

/** As linhas como vêm da base, e a passagem para o contrato da API. */

export type LinhaParceiro = {
  id: number;
  nome: string;
  categoria_id: number | null;
  /** Já não se usa: um parceiro é de todas as barbearias (8 nov 2026). */
  loja_id: number | null;
  localidade: string;
  morada: string;
  telefone: string;
  instagram: string;
  site: string;
  /** O texto livre de antes do horário por dias (vazio depois dele). */
  horario: string;
  horario_en: string;
  /** JSON do horário por dias (0017); NULL: só o texto livre, ou nenhum. */
  horario_semana: string | null;
  descricao: string;
  descricao_en: string;
  cor: string;
  logotipo_id: string | null;
  /** JSON do ajuste do logótipo no círculo (0016); NULL: branco e a 70 %. */
  logotipo_ajuste: string | null;
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
  destaque_en: string;
  titulo: string;
  titulo_en: string;
  detalhe: string;
  detalhe_en: string;
  inicio: string | null;
  fim: string | null;
  em_destaque: number;
  activa: number;
  // As colunas validar, surpresa* e so_clientes_activos (e a tabela cupoes) ficam na base, sem uso,
  // desde 8 nov 2026.
  limite_por_cliente: number | null;
  periodo_do_limite: PeriodoDoLimite;
  limite_total: number | null;
  ordem: number;
  criada_em: number;
  alterada_em: number;
};

export type LinhaCategoria = {
  id: number;
  nome: string;
  nome_en: string;
  icone: string;
  ordem: number;
};
export type LinhaLoja = {
  id: number;
  nome: string;
  morada: string;
  telefone: string;
  marcar: string;
  ordem: number;
  lat: number | null;
  lng: number | null;
};

export function categoria(l: LinhaCategoria, lingua: Lingua = 'pt'): Categoria {
  const icone: IconeDaCategoria = eIconeDaCategoria(l.icone) ? l.icone : 'outro';
  return { id: l.id, nome: naLingua(lingua, l.nome, l.nome_en), icone, ordem: l.ordem };
}

export function loja(l: LinhaLoja): Loja {
  return {
    id: l.id,
    nome: l.nome,
    morada: l.morada,
    telefone: l.telefone,
    marcar: l.marcar,
    ordem: l.ordem,
    lat: l.lat,
    lng: l.lng,
  };
}

export function promocaoPublica(l: LinhaPromocao, lingua: Lingua = 'pt'): PromocaoPublica {
  return {
    id: l.id,
    destaque: naLingua(lingua, l.destaque, l.destaque_en),
    titulo: naLingua(lingua, l.titulo, l.titulo_en),
    detalhe: naLingua(lingua, l.detalhe, l.detalhe_en),
    inicio: l.inicio,
    fim: l.fim,
    emDestaque: l.em_destaque === 1,
    // Qualquer promoção se valida ao ler o cartão, e o saco das surpresas saiu (o Renato, 8 nov):
    // validar e surpresa ficam pelas apps instaladas antes disso, que os lêem.
    validar: true,
    limitePorCliente: l.limite_por_cliente,
    periodoDoLimite: l.periodo_do_limite,
    soClientesActivos: true,
    surpresa: false,
  };
}

export function parceiroBase(l: LinhaParceiro, lingua: Lingua = 'pt') {
  const semana = lerHorarioDaSemana(l.horario_semana);
  return {
    id: l.id,
    nome: l.nome,
    categoriaId: l.categoria_id,
    localidade: l.localidade,
    morada: l.morada,
    telefone: l.telefone,
    instagram: l.instagram,
    site: l.site,
    // Com o horário por dias, o texto escreve-se dele na língua pedida (as apps instaladas antes de
    // 9 nov mostram só este texto); sem ele, o texto livre de antes.
    horario: semana ? textoDoHorario(semana, lingua) : naLingua(lingua, l.horario, l.horario_en),
    horarioSemana: semana,
    descricao: naLingua(lingua, l.descricao, l.descricao_en),
    cor: l.cor,
    logotipo: l.logotipo_id,
    logotipoAjuste: lerAjusteDoLogotipo(l.logotipo_ajuste),
    capa: l.capa_id,
    exemplo: l.exemplo === 1,
  };
}

export function parceiroDoBackoffice(
  l: LinhaParceiro & { na_app: number; total: number },
): Parceiro {
  return {
    ...parceiroBase(l),
    // O texto livre de antes, tal como está: o formulário mostra-o enquanto não houver dias e horas.
    horario: l.horario,
    horarioEn: l.horario_en,
    descricaoEn: l.descricao_en,
    activo: l.activo === 1,
    ordem: l.ordem,
    criadoEm: l.criado_em,
    alteradoEm: l.alterado_em,
    promocoesNaApp: l.na_app,
    promocoesTotal: l.total,
  };
}
