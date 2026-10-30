-- As identidades de exemplo (as sementes) têm Gmails inventados mas plausíveis: nunca podem ser
-- «donas» da caixa, senão a pessoa verdadeira com esse Gmail caía na conta de exemplo ao entrar.
UPDATE identidades SET dona = 0 WHERE sujeito LIKE 'exemplo-%';
-- Apagar a conta limpava o nome mas deixava a coluna de procura.
UPDATE clientes SET busca = '' WHERE apagado_em IS NOT NULL;
-- Os serviços saíram da fidelidade (29 out): a definição já não é lida.
DELETE FROM definicoes WHERE chave = 'fid.servicos';
