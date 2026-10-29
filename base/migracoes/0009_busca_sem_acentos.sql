-- Procurar um cliente sem acentos («joao» encontra «João»): um nome de busca,
-- sem acentos nem maiúsculas, escrito pela API em cada nome novo. Os que já
-- existem arrumam-se aqui (as letras acentuadas do português; o resto fica como
-- está até ao próximo nome).
ALTER TABLE clientes ADD COLUMN busca TEXT NOT NULL DEFAULT '';
UPDATE clientes SET busca = lower(
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
  nome,
  'á','a'),'à','a'),'â','a'),'ã','a'),'é','e'),'ê','e'),'í','i'),'ó','o'),'ô','o'),'õ','o'),'ú','u'),'ü','u'),'ç','c'),'ñ','n'),
  'Á','A'),'À','A'),'Â','A'),'Ã','A'),'É','E'),'Ê','E'),'Í','I'),'Ó','O'),'Ô','O'),'Õ','O'),'Ú','U'),'Ü','U'),'Ç','C'),'Ñ','N')
);
