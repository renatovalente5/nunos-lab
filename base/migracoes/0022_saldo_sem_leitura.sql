-- O uso do saldo sem ler o cartão (o código escrito à mão, ou o cliente procurado pelo nome): fica dito,
-- como nos carimbos, para o Nuno ver no backoffice (revisão do saldo, 11 nov 2026).
ALTER TABLE movimentos_de_saldo ADD COLUMN sem_leitura INTEGER NOT NULL DEFAULT 0 CHECK (sem_leitura IN (0, 1));
