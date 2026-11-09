-- O horário por dias (o Renato, 9 nov 2026): os grupos de dias com as mesmas horas, em JSON
-- ([{"dias":[1,2,3,4,5,6],"horas":[["09:00","12:30"],["14:30","19:00"]]}], 1 = segunda). Com ele,
-- o texto do horário escreve-se sozinho nas duas línguas e a app diz se está aberto; sem ele
-- (NULL), fica o texto livre de antes.
ALTER TABLE parceiros ADD COLUMN horario_semana TEXT;

-- O único horário que havia (o da Ourivesaria Bastos), passado para dias e horas. O texto livre
-- fica, para a API de antes (até a nova ir para o ar); a nova usa os dias e horas, e o backoffice
-- apaga-o ao gravar o parceiro.
UPDATE parceiros
   SET horario_semana = '[{"dias":[1,2,3,4,5,6],"horas":[["09:00","12:30"],["14:30","19:00"]]}]'
 WHERE horario = 'Seg a sab • 9h - 12h30/ 14h30 - 19h' AND horario_semana IS NULL;
