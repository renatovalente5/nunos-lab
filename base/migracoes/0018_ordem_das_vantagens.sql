-- Uma ordem só para as vantagens (o Renato, 10 nov 2026): arrastam-se na página Vantagens do
-- backoffice, e a app segue-a nos destaques, na lista dos parceiros (cada um no lugar da sua primeira
-- vantagem) e na página de cada parceiro. Até aqui contava a ordem dos parceiros e, dentro de cada um,
-- a das vantagens: numera-se tudo por essa, para a app não mudar até alguém arrastar.
UPDATE promocoes SET ordem = (
  SELECT r.n FROM (
    SELECT p.id, ROW_NUMBER() OVER (ORDER BY pa.ordem, pa.nome, p.ordem, p.id) AS n
      FROM promocoes p JOIN parceiros pa ON pa.id = p.parceiro_id
  ) AS r
  WHERE r.id = promocoes.id
);
