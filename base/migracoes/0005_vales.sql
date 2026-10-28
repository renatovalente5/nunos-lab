-- Os vales (28 out 2026): uma promoção pode exigir que o parceiro a valide ao
-- ler o cartão do cliente, com limites por cliente (no dia, na semana, no mês
-- ou no total), um limite para toda a gente, e só para clientes activos.

ALTER TABLE promocoes ADD COLUMN validar INTEGER NOT NULL DEFAULT 0 CHECK (validar IN (0, 1));
ALTER TABLE promocoes ADD COLUMN limite_por_cliente INTEGER CHECK (limite_por_cliente IS NULL OR limite_por_cliente BETWEEN 1 AND 100);
ALTER TABLE promocoes ADD COLUMN periodo_do_limite TEXT NOT NULL DEFAULT 'dia' CHECK (periodo_do_limite IN ('dia', 'semana', 'mes', 'sempre'));
ALTER TABLE promocoes ADD COLUMN limite_total INTEGER CHECK (limite_total IS NULL OR limite_total BETWEEN 1 AND 100000);
ALTER TABLE promocoes ADD COLUMN so_clientes_activos INTEGER NOT NULL DEFAULT 1 CHECK (so_clientes_activos IN (0, 1));

-- Cada validação: a promoção, o parceiro, o cliente, quem validou e quando.
CREATE TABLE vales (
  id           INTEGER PRIMARY KEY,
  promocao_id  INTEGER NOT NULL REFERENCES promocoes (id) ON DELETE CASCADE,
  parceiro_id  INTEGER NOT NULL REFERENCES parceiros (id) ON DELETE CASCADE,
  cliente_id   INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  pessoa_id    INTEGER REFERENCES equipa (id) ON DELETE SET NULL,
  chave        TEXT NOT NULL UNIQUE CHECK (length(chave) BETWEEN 8 AND 64),
  dia          TEXT NOT NULL,
  criado_em    INTEGER NOT NULL DEFAULT (unixepoch()),
  anulado_em   INTEGER,
  anulado_por  INTEGER REFERENCES equipa (id) ON DELETE SET NULL
) STRICT;
CREATE INDEX vales_cliente_ix ON vales (cliente_id, criado_em);
CREATE INDEX vales_promocao_ix ON vales (promocao_id, dia);
CREATE INDEX vales_parceiro_ix ON vales (parceiro_id, dia);
