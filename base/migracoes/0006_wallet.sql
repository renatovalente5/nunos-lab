-- A Wallet (28 out 2026): o passe de cada cliente (a Apple actualiza-o pelo
-- serviço web; a Google pela API), os aparelhos registados para os avisos da
-- Apple, e os bilhetes de serviço guardados (o da APNs vale 50 minutos).

CREATE TABLE passes (
  cliente_id      INTEGER PRIMARY KEY REFERENCES clientes (id) ON DELETE CASCADE,
  serie           TEXT NOT NULL UNIQUE CHECK (length(serie) BETWEEN 8 AND 64),
  criado_em       INTEGER NOT NULL DEFAULT (unixepoch()),
  -- Em segundos inteiros: é o Last-Modified do passe (as datas de HTTP não têm décimas).
  actualizado_em  INTEGER NOT NULL DEFAULT (unixepoch()),
  google_em       INTEGER
) STRICT;

CREATE TABLE registos_apple (
  aparelho    TEXT NOT NULL,
  serie       TEXT NOT NULL REFERENCES passes (serie) ON DELETE CASCADE,
  push_token  TEXT NOT NULL,
  criado_em   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (aparelho, serie)
) STRICT, WITHOUT ROWID;
CREATE INDEX registos_apple_serie_ix ON registos_apple (serie);

CREATE TABLE bilhetes (
  nome       TEXT PRIMARY KEY,
  valor      TEXT NOT NULL,
  criado_em  INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

-- As coordenadas das casas, para o passe aparecer no ecrã bloqueado ao chegar.
ALTER TABLE lojas ADD COLUMN lat REAL;
ALTER TABLE lojas ADD COLUMN lng REAL;
UPDATE lojas SET lat = 40.8840641, lng = -8.4517073 WHERE nome = 'Nogueira do Cravo' AND lat IS NULL;
UPDATE lojas SET lat = 41.0484371, lng = -8.4890838 WHERE nome = 'Santa Maria da Feira' AND lat IS NULL;
UPDATE lojas SET lat = 40.6457766, lng = -8.6408181 WHERE nome = 'Aveiro' AND lat IS NULL;
