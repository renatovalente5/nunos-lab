import { z } from 'zod';
import {
  ICONES_DAS_CATEGORIAS,
  LIMITES,
  LIMITES_DO_AJUSTE,
  limitarAjuste,
  LIMITES_DOS_VALES,
  PERIODOS_DO_LIMITE,
  REDES,
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
  localidade: texto(LIMITES.localidade),
  morada: texto(LIMITES.morada),
  telefone: normalizado(LIMITES.telefone, normalizarTelefone),
  instagram: normalizado(200, normalizarInstagram),
  site: normalizado(LIMITES.site, normalizarSite),
  horario: texto(LIMITES.horario),
  descricao: texto(LIMITES.descricao),
  /** Em inglês (vazio: a app em inglês mostra o português); sem eles, ficam como estão. */
  horarioEn: texto(LIMITES.horario).optional(),
  descricaoEn: texto(LIMITES.descricao).optional(),
  cor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .transform((s) => s.toUpperCase()),
  logotipo: idDeImagem,
  /** O fundo, o tamanho e o sítio do logótipo no círculo (0016): vai para a base em JSON. */
  logotipoAjuste: z
    .object({
      fundo: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      zoom: z.number().min(LIMITES_DO_AJUSTE.zoom.min).max(LIMITES_DO_AJUSTE.zoom.max),
      x: z.number().min(-LIMITES_DO_AJUSTE.desvio).max(LIMITES_DO_AJUSTE.desvio),
      y: z.number().min(-LIMITES_DO_AJUSTE.desvio).max(LIMITES_DO_AJUSTE.desvio),
    })
    .nullable()
    .optional()
    .transform((a) => (a ? JSON.stringify(limitarAjuste(a)) : a)),
  capa: idDeImagem,
  activo: z.boolean(),
});

/** As colunas de cada campo, para os UPDATE parciais. */
export const COLUNAS_DO_PARCEIRO = {
  nome: 'nome',
  categoriaId: 'categoria_id',
  localidade: 'localidade',
  morada: 'morada',
  telefone: 'telefone',
  instagram: 'instagram',
  site: 'site',
  horario: 'horario',
  descricao: 'descricao',
  horarioEn: 'horario_en',
  descricaoEn: 'descricao_en',
  cor: 'cor',
  logotipo: 'logotipo_id',
  logotipoAjuste: 'logotipo_ajuste',
  capa: 'capa_id',
  activo: 'activo',
} as const satisfies Record<keyof z.output<typeof Parceiro>, string>;

export const Promocao = z.object({
  parceiroId: z.number().int().positive(),
  destaque: z.string().transform(normalizarDestaque).pipe(z.string().min(1).max(LIMITES.destaque)),
  titulo: obrigatorio(LIMITES.titulo),
  detalhe: texto(LIMITES.detalhe),
  /** Em inglês (vazio: a app em inglês mostra o português); sem eles, ficam como estão. */
  destaqueEn: z
    .string()
    .transform(normalizarDestaque)
    .pipe(z.string().max(LIMITES.destaque))
    .optional(),
  tituloEn: texto(LIMITES.titulo).optional(),
  detalheEn: texto(LIMITES.detalhe).optional(),
  inicio: dia,
  fim: dia,
  emDestaque: z.boolean(),
  activa: z.boolean(),
  // As regras de quando o parceiro lê o cartão (0005): opcionais; o POST põe as predefinições,
  // e o PATCH só mexe no que vier.
  limitePorCliente: z
    .number()
    .int()
    .min(LIMITES_DOS_VALES.porCliente.min)
    .max(LIMITES_DOS_VALES.porCliente.max)
    .nullable()
    .optional(),
  periodoDoLimite: z.enum(PERIODOS_DO_LIMITE).optional(),
  limiteTotal: z
    .number()
    .int()
    .min(LIMITES_DOS_VALES.total.min)
    .max(LIMITES_DOS_VALES.total.max)
    .nullable()
    .optional(),
});

export const COLUNAS_DA_PROMOCAO = {
  parceiroId: 'parceiro_id',
  destaque: 'destaque',
  titulo: 'titulo',
  detalhe: 'detalhe',
  destaqueEn: 'destaque_en',
  tituloEn: 'titulo_en',
  detalheEn: 'detalhe_en',
  inicio: 'inicio',
  fim: 'fim',
  emDestaque: 'em_destaque',
  activa: 'activa',
  limitePorCliente: 'limite_por_cliente',
  periodoDoLimite: 'periodo_do_limite',
  limiteTotal: 'limite_total',
} as const satisfies Record<keyof z.output<typeof Promocao>, string>;

export const Categoria = z.object({
  nome: obrigatorio(LIMITES.categoria),
  nomeEn: texto(LIMITES.categoria).optional(),
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
        /** Onde fica (mapa e passe da Wallet); ausentes: ficam como estão. */
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
      }),
    )
    .max(20),
  instagram: normalizado(200, normalizarInstagram),
  tiktok: normalizado(200, normalizarLigacao),
  whatsapp: normalizado(200, normalizarLigacao),
  site: normalizado(LIMITES.site, normalizarSite),
  /** A ordem das redes na app: as quatro, sem repetir. Ausente (um backoffice antigo): fica a que está. */
  redes: z
    .array(z.enum(REDES))
    .length(REDES.length)
    .refine((r) => new Set(r).size === r.length)
    .optional(),
  aviso: texto(LIMITES.aviso),
  avisoEn: texto(LIMITES.aviso).optional(),
  avisoAte: dia,
});

/** Um booleano da base (0/1) para JavaScript, e de volta. */
export const paraBase = (v: unknown): unknown => (typeof v === 'boolean' ? (v ? 1 : 0) : v);

/** O botão «Traduzir» do bloco em inglês: os textos em português (com o campo e o parceiro), até 16. */
export const Traduzir = z.object({
  itens: z
    .array(
      z.object({
        texto: texto(1000),
        campo: z
          .enum([
            'categoria',
            'horario',
            'descricao',
            'destaque',
            'titulo',
            'detalhe',
            'aviso',
            'recompensa',
            'aniversario',
          ])
          .optional(),
        onde: texto(120).optional(),
      }),
    )
    .min(1)
    .max(16),
  /** Só no wrangler dev, para comparar modelos. */
  modelo: z.string().max(80).optional(),
});
