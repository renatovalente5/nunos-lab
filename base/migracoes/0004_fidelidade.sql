-- O cartão de carimbos do Nuno's Lab (28 out 2026): clientes com conta, a
-- equipa que carimba, os cartões e os carimbos. As regras do programa vivem em
-- «definicoes» (chaves «fid.*»).

-- ——— Os clientes ———

CREATE TABLE clientes (
  id            INTEGER PRIMARY KEY,
  -- O código do cartão: 8 letras (ver packages/dominio/src/cartao.ts). Muda em
  -- «Perdi o telemóvel»; a versão sobe para os passes da Wallet.
  codigo        TEXT NOT NULL UNIQUE CHECK (length(codigo) = 8),
  codigo_versao INTEGER NOT NULL DEFAULT 1,
  nome          TEXT NOT NULL DEFAULT '' CHECK (length(nome) <= 40),
  -- «MM-DD», para a prenda de anos. Sem o ano: não faz falta.
  aniversario   TEXT CHECK (aniversario IS NULL OR aniversario GLOB '[0-1][0-9]-[0-3][0-9]'),
  loja_id       INTEGER REFERENCES lojas (id) ON DELETE SET NULL,
  -- A morada dos avisos: a 1.ª forma de entrar que trouxe um email a sério.
  email         TEXT,
  exemplo       INTEGER NOT NULL DEFAULT 0 CHECK (exemplo IN (0, 1)),
  criado_em     INTEGER NOT NULL DEFAULT (unixepoch()),
  visto_em      INTEGER NOT NULL DEFAULT (unixepoch()),
  -- Apagou a conta: fica a linha sem nada de pessoal, para as contagens.
  apagado_em    INTEGER
) STRICT;

-- As formas de entrar de cada cliente. «dona» = provou ser dona da caixa de
-- correio (Gmail/iCloud pela Google ou pela Apple, ou o código no email): só
-- entre donas é que duas entradas com o mesmo email caem na mesma conta.
CREATE TABLE identidades (
  id          INTEGER PRIMARY KEY,
  cliente_id  INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('apple', 'google', 'email')),
  -- O «sub» da Apple ou da Google; o email normalizado, no tipo email.
  sujeito     TEXT NOT NULL,
  email       TEXT,
  dona        INTEGER NOT NULL DEFAULT 0 CHECK (dona IN (0, 1)),
  criada_em   INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (tipo, sujeito)
) STRICT;
CREATE INDEX identidades_cliente_ix ON identidades (cliente_id);
CREATE INDEX identidades_email_ix ON identidades (email) WHERE email IS NOT NULL;

-- Os códigos de 6 algarismos por email (quando houver caixa de correio).
CREATE TABLE codigos_de_entrada (
  id          INTEGER PRIMARY KEY,
  email       TEXT NOT NULL,
  resumo      BLOB NOT NULL CHECK (length(resumo) = 32),
  tentativas  INTEGER NOT NULL DEFAULT 0,
  criado_em   INTEGER NOT NULL DEFAULT (unixepoch()),
  expira_em   INTEGER NOT NULL,
  usado_em    INTEGER
) STRICT;
CREATE INDEX codigos_de_entrada_email_ix ON codigos_de_entrada (email);

CREATE TABLE sessoes_de_cliente (
  id             INTEGER PRIMARY KEY,
  resumo         BLOB NOT NULL UNIQUE CHECK (length(resumo) = 32),
  cliente_id     INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  -- A forma de entrar que a abriu: tirar essa forma termina estas sessões.
  identidade_id  INTEGER REFERENCES identidades (id) ON DELETE SET NULL,
  aparelho       TEXT NOT NULL DEFAULT '',
  criada_em      INTEGER NOT NULL DEFAULT (unixepoch()),
  vista_em       INTEGER NOT NULL DEFAULT (unixepoch()),
  expira_em      INTEGER NOT NULL,
  revogada_em    INTEGER
) STRICT;
CREATE INDEX sessoes_de_cliente_cliente_ix ON sessoes_de_cliente (cliente_id);

-- ——— A equipa (a Balcão) ———

CREATE TABLE equipa (
  id           INTEGER PRIMARY KEY,
  nome         TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 40),
  email        TEXT,
  papel        TEXT NOT NULL CHECK (papel IN ('dono', 'barbeiro', 'parceiro')),
  loja_id      INTEGER REFERENCES lojas (id) ON DELETE SET NULL,
  parceiro_id  INTEGER REFERENCES parceiros (id) ON DELETE CASCADE,
  activo       INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  criado_em    INTEGER NOT NULL DEFAULT (unixepoch()),
  removido_em  INTEGER
) STRICT;
CREATE UNIQUE INDEX equipa_email_ux ON equipa (email) WHERE email IS NOT NULL AND removido_em IS NULL;

CREATE TABLE acessos_da_equipa (
  id          INTEGER PRIMARY KEY,
  pessoa_id   INTEGER NOT NULL REFERENCES equipa (id) ON DELETE CASCADE,
  resumo      BLOB NOT NULL UNIQUE CHECK (length(resumo) = 32),
  criado_por  INTEGER REFERENCES admins (id) ON DELETE SET NULL,
  criado_em   INTEGER NOT NULL DEFAULT (unixepoch()),
  expira_em   INTEGER NOT NULL,
  usado_em    INTEGER
) STRICT;
CREATE INDEX acessos_da_equipa_pessoa_ix ON acessos_da_equipa (pessoa_id);

CREATE TABLE sessoes_da_equipa (
  id           INTEGER PRIMARY KEY,
  resumo       BLOB NOT NULL UNIQUE CHECK (length(resumo) = 32),
  pessoa_id    INTEGER NOT NULL REFERENCES equipa (id) ON DELETE CASCADE,
  aparelho     TEXT NOT NULL DEFAULT '',
  criada_em    INTEGER NOT NULL DEFAULT (unixepoch()),
  vista_em     INTEGER NOT NULL DEFAULT (unixepoch()),
  expira_em    INTEGER NOT NULL,
  revogada_em  INTEGER
) STRICT;
CREATE INDEX sessoes_da_equipa_pessoa_ix ON sessoes_da_equipa (pessoa_id);

-- ——— Os cartões e os carimbos ———

CREATE TABLE servicos (
  id      INTEGER PRIMARY KEY,
  nome    TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 30),
  -- Em cêntimos; NULL: sem preço (a receita estimada não o conta).
  preco   INTEGER CHECK (preco IS NULL OR preco BETWEEN 0 AND 100000),
  ordem   INTEGER NOT NULL DEFAULT 0,
  activo  INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
) STRICT;

-- Um cartão por ciclo: guarda o objectivo com que começou (mudar o programa a
-- meio nunca tira um carimbo a ninguém). Completo e por usar = uma recompensa.
CREATE TABLE cartoes (
  id             INTEGER PRIMARY KEY,
  cliente_id     INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  numero         INTEGER NOT NULL,
  objectivo      INTEGER NOT NULL CHECK (objectivo BETWEEN 1 AND 50),
  recompensa     TEXT NOT NULL,
  iniciado_em    INTEGER NOT NULL DEFAULT (unixepoch()),
  completo_em    INTEGER,
  usado_em       INTEGER,
  usado_loja_id  INTEGER REFERENCES lojas (id) ON DELETE SET NULL,
  usado_por      INTEGER REFERENCES equipa (id) ON DELETE SET NULL,
  UNIQUE (cliente_id, numero)
) STRICT;
CREATE INDEX cartoes_por_usar_ix ON cartoes (cliente_id) WHERE completo_em IS NOT NULL AND usado_em IS NULL;

CREATE TABLE carimbos (
  id           INTEGER PRIMARY KEY,
  cartao_id    INTEGER NOT NULL REFERENCES cartoes (id) ON DELETE CASCADE,
  cliente_id   INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  loja_id      INTEGER REFERENCES lojas (id) ON DELETE SET NULL,
  pessoa_id    INTEGER REFERENCES equipa (id) ON DELETE SET NULL,
  servico_id   INTEGER REFERENCES servicos (id) ON DELETE SET NULL,
  -- A chave de idempotência que a Balcão gera: sem rede, o mesmo carimbo pode
  -- chegar duas vezes e só conta uma.
  chave        TEXT NOT NULL UNIQUE CHECK (length(chave) BETWEEN 8 AND 64),
  -- O dia de Lisboa, para o limite por dia e as contagens.
  dia          TEXT NOT NULL,
  criado_em    INTEGER NOT NULL DEFAULT (unixepoch()),
  repetido     INTEGER NOT NULL DEFAULT 0 CHECK (repetido IN (0, 1)),
  sem_leitura  INTEGER NOT NULL DEFAULT 0 CHECK (sem_leitura IN (0, 1)),
  anulado_em   INTEGER,
  anulado_por  INTEGER REFERENCES equipa (id) ON DELETE SET NULL
) STRICT;
CREATE INDEX carimbos_cliente_ix ON carimbos (cliente_id, criado_em);
CREATE INDEX carimbos_cartao_ix ON carimbos (cartao_id);
CREATE INDEX carimbos_dia_ix ON carimbos (dia);

-- O programa, com as predefinições.
INSERT OR IGNORE INTO definicoes (chave, valor) VALUES
  ('fid.objectivo', '10'),
  ('fid.recompensa', 'Corte grátis'),
  ('fid.por_dia', '1'),
  ('fid.servicos', '1'),
  ('fid.aniversario', '');
