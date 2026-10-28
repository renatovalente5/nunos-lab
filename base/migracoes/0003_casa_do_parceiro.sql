-- A casa do Nuno's Lab de que o parceiro é (Nogueira do Cravo, Feira, Aveiro).
-- Vazio: o parceiro aparece para todas as casas. A app filtra por aqui.
ALTER TABLE parceiros ADD COLUMN loja_id INTEGER REFERENCES lojas (id) ON DELETE SET NULL;

-- Os parceiros de exemplo ficam na casa da zona deles (só os de exemplo).
UPDATE parceiros SET loja_id = (SELECT id FROM lojas WHERE nome = 'Nogueira do Cravo' LIMIT 1)
  WHERE exemplo = 1 AND loja_id IS NULL AND localidade IN ('Nogueira do Cravo', 'Oliveira de Azeméis');
UPDATE parceiros SET loja_id = (SELECT id FROM lojas WHERE nome = 'Santa Maria da Feira' LIMIT 1)
  WHERE exemplo = 1 AND loja_id IS NULL AND localidade = 'Santa Maria da Feira';
UPDATE parceiros SET loja_id = (SELECT id FROM lojas WHERE nome = 'Aveiro' LIMIT 1)
  WHERE exemplo = 1 AND loja_id IS NULL AND localidade = 'Aveiro';
