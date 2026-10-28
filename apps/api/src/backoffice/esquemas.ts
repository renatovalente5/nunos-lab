import { z } from 'zod';
import {
  ICONES_DAS_CATEGORIAS,
  LIMITES,
  eDiaValido,
  normalizarDestaque,
  normalizarInstagram,
  normalizarLigacao,
  normalizarSite,
  normalizarTelefone,
} from '@nunos-lab/dominio';

/** O que o backoffice pode escrever, validado e arrumado antes de chegar à base. */

const texto = (max: number) => z.string().trim().max(max);
const obrigatorio = (max: number) => z.string().trim().min(1).max(max);
const normalizado = (max: number, f: (s: string) => string | null) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => f(s) !== null)
    .transform((s) => f(s) ?? '');
const idDeImagem = z
  .string()
  .regex(/^[0-9a-f]{32}$/)
  .nullable();
const dia = z
  .string()
  .refine((s) => eDiaValido(s))
  .nullable();

export const Parceiro = z.object({
  nome: obrigatorio(LIMITES.nome),
  categoriaId: z.number().int().positive().nullable(),
  /** A casa do Nuno's Lab de que o parceiro é; vazio: todas. */
  lojaId: z.number().int().positive().nullable(),
  localidade: texto(LIMITES.localidade),
  morada: texto(LIMITES.morada),
  telefone: normalizado(LIMITES.telefone, normalizarTelefone),
  instagram: normalizado(200, normalizarInstagram),
  site: normalizado(LIMITES.site, normalizarSite),
  horario: texto(LIMITES.horario),
  descricao: texto(LIMITES.descricao),
  cor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .transform((s) => s.toUpperCase()),
  logotipo: idDeImagem,
  capa: idDeImagem,
  activo: z.boolean(),
});

/** As colunas de cada campo, para os UPDATE parciais. */
export const COLUNAS_DO_PARCEIRO = {
  nome: 'nome',
  categoriaId: 'categoria_id',
  lojaId: 'loja_id',
  localidade: 'localidade',
  morada: 'morada',
  telefone: 'telefone',
  instagram: 'instagram',
  site: 'site',
  horario: 'horario',
  descricao: 'descricao',
  cor: 'cor',
  logotipo: 'logotipo_id',
  capa: 'capa_id',
  activo: 'activo',
} as const satisfies Record<keyof z.output<typeof Parceiro>, string>;

export const Promocao = z.object({
  parceiroId: z.number().int().positive(),
  destaque: z.string().transform(normalizarDestaque).pipe(z.string().min(1).max(LIMITES.destaque)),
  titulo: obrigatorio(LIMITES.titulo),
  detalhe: texto(LIMITES.detalhe),
  inicio: dia,
  fim: dia,
  emDestaque: z.boolean(),
  activa: z.boolean(),
});

export const COLUNAS_DA_PROMOCAO = {
  parceiroId: 'parceiro_id',
  destaque: 'destaque',
  titulo: 'titulo',
  detalhe: 'detalhe',
  inicio: 'inicio',
  fim: 'fim',
  emDestaque: 'em_destaque',
  activa: 'activa',
} as const satisfies Record<keyof z.output<typeof Promocao>, string>;

export const Categoria = z.object({
  nome: obrigatorio(LIMITES.categoria),
  icone: z.enum(ICONES_DAS_CATEGORIAS),
});

export const Ordem = z.object({ ids: z.array(z.number().int().positive()).max(500) });

export const Barbearia = z.object({
  lojas: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        nome: obrigatorio(LIMITES.loja),
        morada: texto(LIMITES.morada),
        telefone: normalizado(LIMITES.telefone, normalizarTelefone),
        marcar: normalizado(500, normalizarLigacao),
      }),
    )
    .max(20),
  instagram: normalizado(200, normalizarInstagram),
  tiktok: normalizado(200, normalizarLigacao),
  whatsapp: normalizado(200, normalizarLigacao),
  site: normalizado(LIMITES.site, normalizarSite),
  aviso: texto(LIMITES.aviso),
  avisoAte: dia,
});

/** Um booleano da base (0/1) para JavaScript, e de volta. */
export const paraBase = (v: unknown): unknown => (typeof v === 'boolean' ? (v ? 1 : 0) : v);
