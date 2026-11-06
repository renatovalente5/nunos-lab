-- A recompensa do programa vale também para os cartões em curso (6 nov 2026): o Nuno passou
-- de «Corte grátis» para «50% de desconto» e os cartões abertos, e os passes da Wallet,
-- diziam a antiga. Os cartões completos ficam com a que ganharam. (Daqui em diante é o
-- backoffice que faz isto ao guardar o programa; esta migração acerta os de antes.)
UPDATE cartoes SET recompensa = (SELECT valor FROM definicoes WHERE chave = 'fid.recompensa')
 WHERE completo_em IS NULL
   AND EXISTS (SELECT 1 FROM definicoes WHERE chave = 'fid.recompensa')
   AND recompensa != (SELECT valor FROM definicoes WHERE chave = 'fid.recompensa');
