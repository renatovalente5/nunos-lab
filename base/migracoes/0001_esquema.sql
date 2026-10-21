-- O esquema do Nuno's Lab (22 out 2026). A base é D1, criada com
-- --jurisdiction=eu. Um ficheiro já aplicado em produção nunca se edita:
-- cada mudança é um ficheiro novo.

-- ——— O que a app mostra ———

CREATE TABLE categorias (
  id      INTEGER PRIMARY KEY,
  nome    TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 30),
  icone   TEXT NOT NULL DEFAULT 'outro',
  ordem   INTEGER NOT NULL DEFAULT 0
) STRICT;

-- As imagens (logótipos e capas) já chegam reduzidas pelo browser. O id é o
-- resumo SHA-256 dos bytes: a mesma imagem duas vezes é uma linha só, e a
-- morada nunca muda de conteúdo (pode ficar em cache um ano).
CREATE TABLE imagens (
  id         TEXT PRIMARY KEY CHECK (length(id) = 32),
  tipo       TEXT NOT NULL CHECK (tipo IN ('image/webp', 'image/jpeg', 'image/png')),
  bytes      BLOB NOT NULL,
  largura    INTEGER NOT NULL CHECK (largura BETWEEN 1 AND 4000),
  altura     INTEGER NOT NULL CHECK (altura BETWEEN 1 AND 4000),
  criada_em  INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;

CREATE TABLE parceiros (
  id            INTEGER PRIMARY KEY,
  nome          TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 60),
  categoria_id  INTEGER REFERENCES categorias (id) ON DELETE SET NULL,
  localidade    TEXT NOT NULL DEFAULT '',
  morada        TEXT NOT NULL DEFAULT '',
  telefone      TEXT NOT NULL DEFAULT '',
  instagram     TEXT NOT NULL DEFAULT '',
  site          TEXT NOT NULL DEFAULT '',
  horario       TEXT NOT NULL DEFAULT '',
  descricao     TEXT NOT NULL DEFAULT '',
  cor           TEXT NOT NULL DEFAULT '#5C544C' CHECK (cor GLOB '#[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]'),
  logotipo_id   TEXT REFERENCES imagens (id),
  capa_id       TEXT REFERENCES imagens (id),
  activo        INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  -- Inventado para a demonstração: a app marca-o como «Exemplo», e o
  -- backoffice apaga-os todos de uma vez.
  exemplo       INTEGER NOT NULL DEFAULT 0 CHECK (exemplo IN (0, 1)),
  ordem         INTEGER NOT NULL DEFAULT 0,
  criado_em     INTEGER NOT NULL DEFAULT (unixepoch()),
  alterado_em   INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;
CREATE INDEX parceiros_categoria_ix ON parceiros (categoria_id);

-- Uma promoção vale do dia «inicio» ao dia «fim», os dois inteiros, em dias
-- de Lisboa («AAAA-MM-DD»). Sem início começa já; sem fim não acaba.
CREATE TABLE promocoes (
  id           INTEGER PRIMARY KEY,
  parceiro_id  INTEGER NOT NULL REFERENCES parceiros (id) ON DELETE CASCADE,
  destaque     TEXT NOT NULL CHECK (length(destaque) BETWEEN 1 AND 12),
  titulo       TEXT NOT NULL CHECK (length(titulo) BETWEEN 1 AND 70),
  detalhe      TEXT NOT NULL DEFAULT '',
  inicio       TEXT CHECK (inicio IS NULL OR inicio GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  fim          TEXT CHECK (fim IS NULL OR fim GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  em_destaque  INTEGER NOT NULL DEFAULT 0 CHECK (em_destaque IN (0, 1)),
  activa       INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  ordem        INTEGER NOT NULL DEFAULT 0,
  criada_em    INTEGER NOT NULL DEFAULT (unixepoch()),
  alterada_em  INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (inicio IS NULL OR fim IS NULL OR inicio <= fim)
) STRICT;
CREATE INDEX promocoes_parceiro_ix ON promocoes (parceiro_id);

-- As lojas do Nuno's Lab, com a ligação de marcação de cada uma.
CREATE TABLE lojas (
  id        INTEGER PRIMARY KEY,
  nome      TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 50),
  morada    TEXT NOT NULL DEFAULT '',
  telefone  TEXT NOT NULL DEFAULT '',
  marcar    TEXT NOT NULL DEFAULT '',
  ordem     INTEGER NOT NULL DEFAULT 0
) STRICT;

-- Uma linha por definição (instagram, tiktok, whatsapp, site, aviso).
CREATE TABLE definicoes (
  chave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL
) STRICT;

-- Quantas vezes, por dia, a app foi aberta e cada parceiro visto ou
-- contactado. Sem pessoa nenhuma: só a contagem.
CREATE TABLE contagens (
  dia   TEXT NOT NULL,
  tipo  TEXT NOT NULL,
  ref   INTEGER NOT NULL DEFAULT 0,
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, tipo, ref)
) STRICT, WITHOUT ROWID;

-- ——— O backoffice ———

CREATE TABLE admins (
  id           INTEGER PRIMARY KEY,
  nome         TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 40),
  criado_em    INTEGER NOT NULL DEFAULT (unixepoch()),
  removido_em  INTEGER
) STRICT;

-- Ligações de acesso: valem uma vez e por 7 dias. Só o resumo SHA-256 do
-- código vive aqui; o código só existe na ligação que se manda à pessoa.
CREATE TABLE acessos (
  id          INTEGER PRIMARY KEY,
  admin_id    INTEGER NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  resumo      BLOB NOT NULL UNIQUE CHECK (length(resumo) = 32),
  criado_por  INTEGER REFERENCES admins (id) ON DELETE SET NULL,
  criado_em   INTEGER NOT NULL DEFAULT (unixepoch()),
  expira_em   INTEGER NOT NULL,
  usado_em    INTEGER
) STRICT;
CREATE INDEX acessos_admin_ix ON acessos (admin_id);

-- Uma sessão por aparelho. O testemunho fica no aparelho; aqui, o resumo.
CREATE TABLE sessoes (
  id           INTEGER PRIMARY KEY,
  resumo       BLOB NOT NULL UNIQUE CHECK (length(resumo) = 32),
  admin_id     INTEGER NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  aparelho     TEXT NOT NULL DEFAULT '',
  criada_em    INTEGER NOT NULL DEFAULT (unixepoch()),
  vista_em     INTEGER NOT NULL DEFAULT (unixepoch()),
  expira_em    INTEGER NOT NULL,
  revogada_em  INTEGER
) STRICT;
CREATE INDEX sessoes_admin_ix ON sessoes (admin_id);

-- Quem mudou o quê, e quando.
CREATE TABLE registo (
  id        INTEGER PRIMARY KEY,
  quando    INTEGER NOT NULL DEFAULT (unixepoch()),
  admin_id  INTEGER REFERENCES admins (id) ON DELETE SET NULL,
  accao     TEXT NOT NULL,
  alvo      TEXT NOT NULL DEFAULT ''
) STRICT;
CREATE INDEX registo_quando_ix ON registo (quando);
