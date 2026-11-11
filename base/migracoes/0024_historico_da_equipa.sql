-- O histórico de cada pessoa da equipa no backoffice (o Renato, 11 nov 2026): o que carimbou, o saldo que
-- usou, os prémios que entregou e o que anulou. Sem estes índices, cada página lia as tabelas inteiras.
CREATE INDEX carimbos_pessoa_ix ON carimbos (pessoa_id, criado_em);
CREATE INDEX carimbos_anulado_por_ix ON carimbos (anulado_por) WHERE anulado_por IS NOT NULL;
CREATE INDEX movimentos_de_saldo_pessoa_ix ON movimentos_de_saldo (pessoa_id, criado_em)
  WHERE pessoa_id IS NOT NULL;
CREATE INDEX movimentos_de_saldo_anulado_por_ix ON movimentos_de_saldo (anulado_por)
  WHERE anulado_por IS NOT NULL;
CREATE INDEX cartoes_usado_por_ix ON cartoes (usado_por) WHERE usado_por IS NOT NULL;
CREATE INDEX cartoes_meio_usado_por_ix ON cartoes (meio_usado_por) WHERE meio_usado_por IS NOT NULL;
