-- A prenda de anos à prova de esperteza (6 nov 2026): a data conta a partir de quando foi
-- dada (a prenda só vale 30 dias depois, senão mudava-se a data na véspera), e cada
-- entrega fica registada, uma por ano.
ALTER TABLE clientes ADD COLUMN aniversario_desde INTEGER;
-- Quem já tinha a data: conta a partir de agora; os exemplos (e a porta da revisão das
-- lojas) desde que nasceram, para a demonstração não mudar.
UPDATE clientes SET aniversario_desde = CASE WHEN exemplo = 1 THEN criado_em ELSE unixepoch() END
 WHERE aniversario IS NOT NULL;

CREATE TABLE prendas (
  id          INTEGER PRIMARY KEY,
  cliente_id  INTEGER NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  -- O ano (de Lisboa) em que foi entregue: uma por cliente por ano.
  ano         INTEGER NOT NULL,
  quando      INTEGER NOT NULL DEFAULT (unixepoch()),
  loja_id     INTEGER REFERENCES lojas (id) ON DELETE SET NULL,
  pessoa_id   INTEGER REFERENCES equipa (id) ON DELETE SET NULL,
  UNIQUE (cliente_id, ano)
) STRICT;
