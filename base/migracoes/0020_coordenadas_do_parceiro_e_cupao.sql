-- O sítio exato de um parceiro (o Renato, 10 nov 2026: há parceiros sem perfil no Google, e o «Ir»
-- da app, que procurava pelo nome e pela morada, levava-os a outro sítio). Com coordenadas, o «Ir»
-- vai ao ponto exato no Google Maps, no Waze e nos Mapas da Apple; sem elas, procura como antes.
ALTER TABLE parceiros ADD COLUMN lat REAL CHECK (lat IS NULL OR lat BETWEEN -90 AND 90);
ALTER TABLE parceiros ADD COLUMN lng REAL CHECK (lng IS NULL OR lng BETWEEN -180 AND 180);

-- O código de cupão de uma vantagem (o Renato, 10 nov 2026: parceiros que querem um código, por
-- exemplo para a loja online, que não se pode ver enquanto a vantagem tiver o cadeado). Vazio: sem
-- código. Nunca vai na lista pública da app: só no «eu» de quem tem um corte no último ano.
ALTER TABLE promocoes ADD COLUMN cupao TEXT NOT NULL DEFAULT '' CHECK (length(cupao) <= 40);
