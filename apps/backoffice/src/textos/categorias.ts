import { plural } from '../util';

/** As frases desta página: o português é a fonte; o inglês (britânico) tem as mesmas chaves. */
export const pt = {
  subtitulo: 'Os filtros por cima dos parceiros, na app, por esta ordem.',
  nova: 'Nova categoria',
  vazio: 'Ainda sem categorias',
  editarDe: (nome: string) => `Editar ${nome}`,
  parceiros: (n: number) => plural(n, 'parceiro', 'parceiros'),
  editar: 'Editar',
  editarACategoria: 'Editar a categoria',
  guardar: 'Guardar',
  guardado: 'Guardado',
  apagarPergunta: (nome: string) => `Apagar «${nome}»?`,
  ficamSemCategoria: (n: number) =>
    `${plural(n, 'parceiro fica', 'parceiros ficam')} sem categoria (continuam na app).`,
  nenhumParceiro: 'Nenhum parceiro a usa.',
  apagar: 'Apagar',
  apagada: 'Categoria apagada',
  nome: 'Nome',
};

export const en: typeof pt = {
  subtitulo: 'The filters above the partners in the app, in this order.',
  nova: 'New category',
  vazio: 'No categories yet',
  editarDe: (nome) => `Edit ${nome}`,
  parceiros: (n) => plural(n, 'partner', 'partners'),
  editar: 'Edit',
  editarACategoria: 'Edit category',
  guardar: 'Save',
  guardado: 'Saved',
  apagarPergunta: (nome) => `Delete “${nome}”?`,
  ficamSemCategoria: (n) =>
    `${plural(n, 'partner', 'partners')} will have no category (${n === 1 ? 'it stays' : 'they stay'} in the app).`,
  nenhumParceiro: 'No partners use it.',
  apagar: 'Delete',
  apagada: 'Category deleted',
  nome: 'Name',
};
