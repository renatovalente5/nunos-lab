-- O cartão cheio fica cheio até o prémio ser entregue ou até ao próximo carimbo
-- (29 out 2026). Até aqui o 10.º carimbo abria logo o cartão seguinte, vazio:
-- esses cartões vazios, a seguir a um cheio por entregar, deixam de fazer
-- sentido e saem, para o cliente voltar a ver as dez casas.
DELETE FROM cartoes WHERE id IN (
  SELECT n.id FROM cartoes n
  JOIN cartoes p ON p.cliente_id = n.cliente_id AND p.numero = n.numero - 1
  WHERE p.completo_em IS NOT NULL AND p.usado_em IS NULL
    AND NOT EXISTS (SELECT 1 FROM carimbos x WHERE x.cartao_id = n.id)
    AND NOT EXISTS (SELECT 1 FROM cartoes m WHERE m.cliente_id = n.cliente_id AND m.numero > n.numero)
);
