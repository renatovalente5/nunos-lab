-- 8 nov 2026 (o Renato): o saco das surpresas sai do projecto todo, e o interruptor «O parceiro
-- valida ao ler o cartão» também: qualquer promoção se valida ao ler o cartão, se o parceiro
-- quiser; senão basta mostrar a app. As colunas validar e surpresa* e a tabela cupoes ficam, sem uso.

-- Uma promoção do saco não aparecia na lista da app: fica desligada, e o Nuno decide se a liga.
UPDATE promocoes SET activa = 0 WHERE surpresa = 1;
UPDATE promocoes SET surpresa = 0 WHERE surpresa = 1;

-- Uma promoção em que bastava mostrar a app não tinha regras: lida ao balcão, continua sem elas.
UPDATE promocoes SET so_clientes_activos = 0, limite_por_cliente = NULL, limite_total = NULL
  WHERE validar = 0;
