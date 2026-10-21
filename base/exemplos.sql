-- Os dados da demonstração (22 out 2026). Corre-se UMA vez numa base vazia:
--   npx wrangler d1 execute nunos-lab --local  --file ../../base/exemplos.sql
--   npx wrangler d1 execute nunos-lab --remote --file ../../base/exemplos.sql
--
-- As lojas, as moradas e as ligações de marcação são as verdadeiras, do site
-- do Nuno's Lab (nunoslab.com). Os PARCEIROS são inventados: ficam marcados
-- com exemplo = 1, a app mostra-os com a etiqueta «Exemplo», e o backoffice
-- apaga-os todos num botão. Sem telefones, Instagram nem sites inventados:
-- podiam ser de alguém.

INSERT INTO categorias (id, nome, icone, ordem) VALUES
  (1, 'Comer', 'comer', 1),
  (2, 'Café', 'cafe', 2),
  (3, 'Carros', 'carro', 3),
  (4, 'Treino', 'treino', 4),
  (5, 'Saúde', 'saude', 5),
  (6, 'Beleza', 'beleza', 6);

INSERT INTO lojas (id, nome, morada, telefone, marcar, ordem) VALUES
  (1, 'Nogueira do Cravo', 'Avenida dos Descobrimentos, 912, 3700-766 Nogueira do Cravo', '',
   'https://www.fresha.com/pt/a/nunos-lab-nogueira-do-cravo-nogueira-do-cravo-avenida-dos-descobrimentos-n912-3700-766-j20blx7u/all-offer?multi=true&menu=true', 1),
  (2, 'Santa Maria da Feira', 'Avenida 25 de Abril, Santa Maria da Feira', '',
   'https://www.fresha.com/pt/a/nunos-lab-santa-maria-da-feira-santa-maria-da-feira-avenida-25-de-abril-eeyb97nf/all-offer?multi=true&menu=true', 2),
  (3, 'Aveiro', 'Rua de Viseu, 128, Aveiro', '',
   'https://www.fresha.com/pt/a/nunos-lab-aveiro-aveiro-rua-de-viseu-128-nxl4odg8/all-offer?multi=true&menu=true', 3);

INSERT INTO definicoes (chave, valor) VALUES
  ('instagram', 'nunoslab'),
  ('tiktok', ''),
  ('whatsapp', 'https://wa.link/mntowu'),
  ('site', 'https://nunoslab.com/'),
  ('aviso', ''),
  ('aviso_ate', '');

INSERT INTO parceiros (id, nome, categoria_id, localidade, morada, horario, descricao, cor, exemplo, ordem) VALUES
  (1, 'Tasca Velha do Cravo', 1, 'Nogueira do Cravo', 'Nogueira do Cravo, Oliveira de Azeméis',
   'Seg a sáb · 12:00–15:00 · 19:00–22:30', 'Cozinha portuguesa, ao almoço e ao jantar.', '#B4532A', 1, 1),
  (2, 'Azeméis Motor', 3, 'Oliveira de Azeméis', 'Oliveira de Azeméis',
   'Seg a sex · 9:00–19:00 · Sáb · 9:00–13:00', 'Usados com garantia e oficina própria.', '#26303D', 1, 2),
  (3, 'Forno Lento', 1, 'Oliveira de Azeméis', 'Oliveira de Azeméis',
   'Ter a dom · 19:00–23:00', 'Pizza de massa lenta, em forno a lenha.', '#9A6A12', 1, 3),
  (4, 'Ginásio Pulso', 4, 'Santa Maria da Feira', 'Santa Maria da Feira',
   'Todos os dias · 7:00–22:00', 'Musculação, aulas de grupo e treino personalizado.', '#2456B8', 1, 4),
  (5, 'Café Grão Fino', 2, 'Nogueira do Cravo', 'Nogueira do Cravo, Oliveira de Azeméis',
   'Todos os dias · 7:00–20:00', 'Café de especialidade e pastelaria da casa.', '#5C544C', 1, 5),
  (6, 'Lavagem Onda Azul', 3, 'Aveiro', 'Aveiro',
   'Seg a sáb · 8:30–19:30', 'Lavagem à mão, por dentro e por fora.', '#0F6E80', 1, 6),
  (7, 'Ótica Lume', 5, 'Aveiro', 'Aveiro',
   'Seg a sáb · 10:00–19:00', 'Exames de visão, óculos e lentes de contacto.', '#6D3FC0', 1, 7),
  (8, 'Gelataria Neve Doce', 1, 'Santa Maria da Feira', 'Santa Maria da Feira',
   'Todos os dias · 13:00–23:00', 'Gelado artesanal feito todos os dias.', '#9D2B6B', 1, 8);

INSERT INTO promocoes (parceiro_id, destaque, titulo, detalhe, inicio, fim, em_destaque, activa, ordem) VALUES
  (1, '−10%', 'Na refeição', 'Ao almoço e ao jantar, de segunda a sexta. Não junta com outras promoções.', NULL, NULL, 1, 1, 1),
  (1, 'Grátis', 'Sobremesa da casa', 'Com qualquer prato do dia.', NULL, NULL, 0, 1, 2),
  (2, '−300 €', 'Na compra de um usado', 'Mostra a app antes de fechar negócio. Um desconto por carro.', NULL, date('now', '+60 days'), 1, 1, 1),
  (2, '−15%', 'Na revisão', 'Na mão de obra, em qualquer marca.', NULL, NULL, 0, 1, 2),
  (2, 'Grátis', 'Lavagem na entrega', 'Em todas as revisões.', NULL, NULL, 0, 1, 3),
  (3, '2×1', 'Pizzas às terças', 'Na sala ou para levar. Paga-se a mais cara.', NULL, NULL, 1, 1, 1),
  (3, 'Grátis', 'Bebida com a pizza', 'Refrigerante ou imperial, uma por pizza.', NULL, NULL, 0, 1, 2),
  (4, '−50%', 'Na 1.ª mensalidade', 'Na inscrição, em qualquer plano.', NULL, NULL, 1, 1, 1),
  (4, 'Grátis', 'Uma semana a experimentar', 'Sete dias seguidos, com acesso a todas as aulas.', NULL, NULL, 0, 1, 2),
  (5, 'Oferta', 'Um café por semana', 'Ao balcão, uma vez por semana.', NULL, NULL, 0, 1, 1),
  (6, '−20%', 'Na limpeza interior', 'Aspiração, estofos e tablier.', NULL, date('now', '+4 days'), 1, 1, 1),
  (7, '−25%', 'Em óculos de sol', 'Em todas as marcas da loja.', NULL, NULL, 0, 1, 1),
  (7, '−30%', 'Em lentes progressivas', 'Com o exame de visão incluído.', date('now', '+20 days'), date('now', '+80 days'), 0, 1, 2),
  (8, '−10%', 'Em todos os gelados', 'No copo, no cone ou para levar.', NULL, NULL, 0, 1, 1),
  (8, '2×1', 'Ao domingo', 'Na segunda bola.', NULL, NULL, 0, 0, 2);
