#!/usr/bin/env node
/**
 * Gera base/exemplos-fidelidade.sql: a equipa, os serviços e uns 60 clientes
 * inventados com carimbos espalhados pelos últimos oito meses, para os números
 * do backoffice e o Resumo da Balcão terem conteúdo. Tudo marcado como
 * exemplo; o backoffice apaga-os num botão. Determinístico (semente fixa).
 *
 *   node --experimental-strip-types --no-warnings scripts/gerar-exemplos-fidelidade.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarCodigo } from '../packages/dominio/src/cartao.ts';

let semente = 20261028;
const acaso = () => {
  semente = (semente * 1103515245 + 12345) % 2147483648;
  return semente / 2147483648;
};
const entre = (a, b) => a + Math.floor(acaso() * (b - a + 1));
const escolher = (lista) => lista[Math.floor(acaso() * lista.length)];
const sql = (v) =>
  v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

const DIA = 86400;
const AGORA = Math.floor(Date.now() / 1000);
const formatoDoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Lisbon',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const formatoDaSemana = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Lisbon',
  weekday: 'short',
});
const diaDe = (t) => formatoDoDia.format(new Date(t * 1000));
const semanaDe = (t) => formatoDaSemana.format(new Date(t * 1000));

const EQUIPA = [
  { id: 901, nome: 'Rui (exemplo)', loja: 3 },
  { id: 902, nome: 'Tiago (exemplo)', loja: 3 },
  { id: 903, nome: 'Pedro (exemplo)', loja: 2 },
  { id: 904, nome: 'Miguel (exemplo)', loja: 1 },
];
const SERVICOS = [
  { id: 1, nome: 'Corte', preco: 1500 },
  { id: 2, nome: 'Barba', preco: 1000 },
  { id: 3, nome: 'Corte + Barba', preco: 2200 },
];
const NOMES = [
  'João Ferreira',
  'Diogo Santos',
  'Rafael Costa',
  'André Pinto',
  'Tomás Oliveira',
  'Gonçalo Silva',
  'Bruno Martins',
  'Hugo Almeida',
  'Ricardo Sousa',
  'Fábio Rodrigues',
  'Marco Carvalho',
  'Nuno Pereira',
  'Tiago Lopes',
  'Vasco Mendes',
  'Daniel Ribeiro',
  'Filipe Nunes',
  'Leandro Gomes',
  'Renato Teixeira',
  'Paulo Correia',
  'Sérgio Moreira',
  'Miguel Araújo',
  'Carlos Fonseca',
  'Pedro Azevedo',
  'Rúben Cardoso',
  'Samuel Rocha',
  'Eduardo Vieira',
  'Lucas Machado',
  'Mateus Barbosa',
  'Henrique Leal',
  'Simão Reis',
  'Afonso Neves',
  'Duarte Pires',
  'Gabriel Matos',
  'Martim Baptista',
  'Francisco Lima',
  'Inês Marques',
  'Mariana Cunha',
  'Beatriz Tavares',
  'Joana Freitas',
  'Vítor Esteves',
  'Alexandre Faria',
  'Ivo Monteiro',
  'Cristiano Melo',
  'Jorge Amaral',
  'Luís Coelho',
  'Rodrigo Guerreiro',
  'Bernardo Soares',
  'Xavier Paiva',
  'Kevin Brito',
  'Salvador Antunes',
  'Dinis Castro',
  'Leonardo Abreu',
  'Artur Camacho',
  'Octávio Ramos',
  'Raul Sampaio',
  'Ismael Borges',
  'Caio Pacheco',
  'Valentim Cruz',
  'Guilherme Serra',
  'Emanuel Dias',
];

const linhas = [
  '-- Os exemplos da fidelidade (gerados por scripts/gerar-exemplos-fidelidade.mjs). Uma vez, numa base',
  '-- com os exemplos.sql já postos. Tudo inventado e marcado como exemplo.',
  '',
  'INSERT INTO equipa (id, nome, papel, loja_id) VALUES',
  [
    ...EQUIPA.map((e) => `  (${e.id}, ${sql(e.nome)}, 'barbeiro', ${e.loja})`),
    "  (905, 'Nuno (exemplo)', 'dono', NULL)",
  ].join(',\n') + ';',
  '',
  'INSERT INTO servicos (id, nome, preco, ordem) VALUES',
  SERVICOS.map((s, i) => `  (${s.id}, ${sql(s.nome)}, ${s.preco}, ${i + 1})`).join(',\n') + ';',
  '',
];

const clientes = [];
const identidades = [];
const cartoes = [];
const carimbos = [];
let proximoCartao = 1001;
const usados = new Set();

function horaDaVisita(dia0) {
  // Ter a sáb; a tarde cheia; sábado de manhã.
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const t = dia0 + entre(0, 6) * DIA;
    const semana = semanaDe(t);
    if (semana === 'Sun' || semana === 'Mon') continue;
    const pesos =
      semana === 'Sat'
        ? [9, 10, 10, 11, 11, 12, 12, 13, 14, 15]
        : [10, 11, 12, 14, 15, 16, 17, 17, 18, 18, 18, 19];
    const hora = escolher(pesos);
    const [a, m, d] = diaDe(t).split('-').map(Number);
    // Meia-noite UTC do dia + hora (Lisboa anda a 0 ou +1 do UTC: chega para a demonstração).
    return (
      Date.UTC(a, m - 1, d, hora - (semana === 'Sat' && hora < 12 ? 0 : 1), entre(0, 55)) / 1000
    );
  }
  return dia0 + 12 * 3600;
}

NOMES.forEach((nome, i) => {
  const id = 1001 + i;
  const perfil = acaso();
  const tipo =
    perfil < 0.4 ? 'fiel' : perfil < 0.7 ? 'regular' : perfil < 0.85 ? 'novo' : 'perdido';
  const casa = escolher([3, 3, 3, 2, 2, 1]);
  const barbeiro = escolher(EQUIPA.filter((e) => e.loja === casa));
  const intervalo = tipo === 'fiel' ? [21, 35] : tipo === 'regular' ? [35, 60] : [28, 45];
  const inicio =
    tipo === 'novo'
      ? AGORA - entre(1, 30) * DIA
      : tipo === 'perdido'
        ? AGORA - entre(300, 420) * DIA
        : tipo === 'fiel'
          ? AGORA - entre(240, 420) * DIA
          : AGORA - entre(150, 300) * DIA;
  const fim = tipo === 'perdido' ? AGORA - entre(185, 260) * DIA : AGORA;
  const visitas = [];
  let t = inicio;
  while (t <= fim && visitas.length < 40) {
    visitas.push(horaDaVisita(t));
    t += entre(intervalo[0], intervalo[1]) * DIA;
  }
  if (tipo === 'novo') visitas.splice(2);
  // Nunca hoje nem no futuro: o dia de hoje é o da prova e da demonstração ao vivo.
  const passadas = visitas.filter((v) => v < AGORA - DIA).sort((a, b) => a - b);
  visitas.length = 0;
  visitas.push(...(passadas.length ? passadas : [horaDaVisita(AGORA - 8 * DIA)]));

  const entrada = acaso();
  const email =
    entrada < 0.6
      ? `${nome
          .toLowerCase()
          .normalize('NFD')
          .replace(/[^a-z ]/g, '')
          .replace(/ /g, '.')}@gmail.com`
      : null;
  let codigo;
  do codigo = gerarCodigo(Uint8Array.from({ length: 7 }, () => entre(0, 255)));
  while (usados.has(codigo));
  usados.add(codigo);
  const primeira = visitas[0];
  clientes.push({
    id,
    codigo,
    nome,
    email,
    loja: casa,
    aniversario:
      acaso() < 0.5
        ? `${String(entre(1, 12)).padStart(2, '0')}-${String(entre(1, 28)).padStart(2, '0')}`
        : null,
    criado: primeira - entre(0, 600),
    visto: visitas.at(-1),
  });
  if (entrada < 0.6)
    identidades.push({
      cliente: id,
      tipo: 'google',
      sujeito: `exemplo-google-${id}`,
      email,
      // Nunca «dona»: um Gmail inventado podia ser de uma pessoa real, que cairia nesta conta ao entrar.
      dona: 0,
    });
  else if (entrada < 0.8)
    identidades.push({
      cliente: id,
      tipo: 'apple',
      sujeito: `exemplo-apple-${id}`,
      email: `exemplo${id}@privaterelay.appleid.com`,
      dona: 0,
    });
  else if (entrada < 0.9)
    identidades.push({
      cliente: id,
      tipo: 'email',
      sujeito: `${id}@exemplo.pt`,
      email: `${id}@exemplo.pt`,
      dona: 0,
    });

  // Os cartões, pela ordem das visitas.
  let numero = 1;
  let cartao = {
    id: proximoCartao++,
    cliente: id,
    numero,
    iniciado: clientes.at(-1).criado,
    completo: null,
    usado: null,
    usadoLoja: null,
    usadoPor: null,
    n: 0,
  };
  cartoes.push(cartao);
  let recompensaPorUsar = null;
  visitas.forEach((quando, k) => {
    const loja = acaso() < 0.8 ? casa : escolher([1, 2, 3]);
    const pessoa = loja === casa ? barbeiro : escolher(EQUIPA.filter((e) => e.loja === loja));
    const servico = escolher([1, 1, 1, 3, 3, 2]);
    if (recompensaPorUsar && acaso() < 0.7) {
      recompensaPorUsar.usado = quando - 60;
      recompensaPorUsar.usadoLoja = loja;
      recompensaPorUsar.usadoPor = pessoa.id;
      recompensaPorUsar = null;
    }
    carimbos.push({
      cartao: cartao.id,
      cliente: id,
      loja,
      pessoa: pessoa.id,
      servico,
      chave: `exemplo-${id}-${k}`,
      dia: diaDe(quando),
      quando,
    });
    cartao.n++;
    if (cartao.n >= 10) {
      cartao.completo = quando;
      recompensaPorUsar = cartao;
      numero++;
      cartao = {
        id: proximoCartao++,
        cliente: id,
        numero,
        iniciado: quando,
        completo: null,
        usado: null,
        usadoLoja: null,
        usadoPor: null,
        n: 0,
      };
      cartoes.push(cartao);
    }
  });
});

linhas.push(
  'INSERT INTO clientes (id, codigo, nome, email, loja_id, aniversario, exemplo, criado_em, visto_em) VALUES',
  clientes
    .map(
      (c) =>
        `  (${c.id}, ${sql(c.codigo)}, ${sql(c.nome)}, ${sql(c.email)}, ${c.loja}, ${sql(c.aniversario)}, 1, ${c.criado}, ${c.visto})`,
    )
    .join(',\n') + ';',
  '',
  'INSERT INTO identidades (cliente_id, tipo, sujeito, email, dona) VALUES',
  identidades
    .map((i) => `  (${i.cliente}, ${sql(i.tipo)}, ${sql(i.sujeito)}, ${sql(i.email)}, ${i.dona})`)
    .join(',\n') + ';',
  '',
  'INSERT INTO cartoes (id, cliente_id, numero, objectivo, recompensa, iniciado_em, completo_em, usado_em, usado_loja_id, usado_por) VALUES',
  cartoes
    .map(
      (c) =>
        `  (${c.id}, ${c.cliente}, ${c.numero}, 10, 'Corte grátis', ${c.iniciado}, ${sql(c.completo)}, ${sql(c.usado)}, ${sql(c.usadoLoja)}, ${sql(c.usadoPor)})`,
    )
    .join(',\n') + ';',
  '',
  'INSERT INTO carimbos (cartao_id, cliente_id, loja_id, pessoa_id, servico_id, chave, dia, criado_em) VALUES',
  carimbos
    .map(
      (x) =>
        `  (${x.cartao}, ${x.cliente}, ${x.loja}, ${x.pessoa}, ${x.servico}, ${sql(x.chave)}, ${sql(x.dia)}, ${x.quando})`,
    )
    .join(',\n') + ';',
  '',
);

const destino = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'base',
  'exemplos-fidelidade.sql',
);
writeFileSync(destino, linhas.join('\n'));
console.log(
  `${clientes.length} clientes, ${cartoes.length} cartões, ${carimbos.length} carimbos → ${destino}`,
);
