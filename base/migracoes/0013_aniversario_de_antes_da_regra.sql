-- A 0012 pôs «aniversario_desde = agora» em todos os clientes que já tinham a data: quem fazia
-- anos nos 30 dias a seguir ficava sem a prenda deste ano, sem ter mudado nada (achado da
-- revisão de 7 nov 2026). Quem deu a data antes da regra conta desde que nasceu.
-- Só as linhas que a 0012 mexeu: todas ficaram com o mesmo instante, a poucos segundos do
-- registo da própria 0012 em d1_migrations (aqui com uma folga de 2 minutos). Quem deu a data
-- depois, na app, tem outro instante e fica como está. Sem o registo da 0012, não mexe em nada.
UPDATE clientes SET aniversario_desde = criado_em
 WHERE exemplo = 0
   AND aniversario IS NOT NULL
   AND aniversario_desde IS NOT NULL
   AND aniversario_desde BETWEEN
       (SELECT unixepoch(applied_at) - 120 FROM d1_migrations WHERE name LIKE '0012%')
   AND (SELECT unixepoch(applied_at) + 120 FROM d1_migrations WHERE name LIKE '0012%');
