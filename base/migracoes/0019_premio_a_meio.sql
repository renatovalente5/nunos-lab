-- O prémio a meio do cartão (o Nuno, 10 nov 2026: «uma aos 10 cortes e uma aos 5… um desconto de 10 ou
-- 20% num produto»). Cada cartão guarda o seu, como guarda o objectivo e a recompensa: em que carimbo se
-- ganha (NULL: este cartão não tem), o texto nas duas línguas, quando se ganhou e quando, onde e por quem
-- foi entregue. Ao contrário do prémio do cartão, que é o desconto do próprio corte, este é num produto:
-- ganha-se no carimbo e fica por usar até se entregar ao balcão, nesse dia ou noutro.
ALTER TABLE cartoes ADD COLUMN meio INTEGER CHECK (meio IS NULL OR meio BETWEEN 1 AND 49);
ALTER TABLE cartoes ADD COLUMN meio_recompensa TEXT NOT NULL DEFAULT '';
ALTER TABLE cartoes ADD COLUMN meio_recompensa_en TEXT NOT NULL DEFAULT '';
ALTER TABLE cartoes ADD COLUMN meio_ganho_em INTEGER;
ALTER TABLE cartoes ADD COLUMN meio_usado_em INTEGER;
ALTER TABLE cartoes ADD COLUMN meio_usado_loja_id INTEGER REFERENCES lojas (id) ON DELETE SET NULL;
ALTER TABLE cartoes ADD COLUMN meio_usado_por INTEGER REFERENCES equipa (id) ON DELETE SET NULL;
CREATE INDEX cartoes_meio_por_usar_ix ON cartoes (cliente_id)
  WHERE meio_ganho_em IS NOT NULL AND meio_usado_em IS NULL;
