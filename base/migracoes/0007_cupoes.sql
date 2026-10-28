-- O cupão surpresa (28 out 2026): ao carimbar, sai um cupão sorteado de um
-- «saco» de promoções (as marcadas como surpresa), com validade em dias e um
-- peso no sorteio; o parceiro valida-o como um vale.

ALTER TABLE promocoes ADD COLUMN surpresa INTEGER NOT NULL DEFAULT 0 CHECK (surpresa IN (0, 1));
ALTER TABLE promocoes ADD COLUMN surpresa_dias INTEGER NOT NULL DEFAULT 30 CHECK (surpresa_dias BETWEEN 1 AND 365);
ALTER TABLE promocoes ADD COLUMN surpresa_peso INTEGER NOT NULL DEFAULT 1 CHECK (surpresa_peso BETWEEN 1 AND 100);
-- Quantos ainda podem sair (NULL: sem limite).
ALTER TABLE promocoes ADD COLUMN surpresa_restantes INTEGER CHECK (surpresa_restantes IS NULL OR surpresa_restantes >= 0);

CREATE TABLE cupoes (
  id           INTEGER PRIMARY KEY,
  promocao_id  INTEGER NOT NULL REFERENCES promocoes (id) ON DELETE CASCADE,
  parceiro_id  INTEGER NOT NULL REFERENCES parceiros (id) ON DELETE CASCADE,
  cliente_id   INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  carimbo_id   INTEGER REFERENCES carimbos (id) ON DELETE SET NULL,
  emitido_em   INTEGER NOT NULL DEFAULT (unixepoch()),
  -- O último dia em que vale (dia de Lisboa, inteiro).
  valido_ate   TEXT NOT NULL,
  usado_em     INTEGER,
  vale_id      INTEGER REFERENCES vales (id) ON DELETE SET NULL
) STRICT;
CREATE INDEX cupoes_cliente_ix ON cupoes (cliente_id, usado_em);
CREATE INDEX cupoes_promocao_ix ON cupoes (promocao_id);

ALTER TABLE vales ADD COLUMN cupao_id INTEGER REFERENCES cupoes (id) ON DELETE SET NULL;
