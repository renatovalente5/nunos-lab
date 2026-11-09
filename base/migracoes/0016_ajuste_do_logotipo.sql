-- O fundo, o tamanho e o sítio do logótipo no círculo, em JSON: {"fundo":"#RRGGBB","zoom":0.7,"x":0,"y":0}.
-- NULL fica como sempre foi: fundo branco e a imagem a 70 % (o Renato, 9 nov 2026).
ALTER TABLE parceiros ADD COLUMN logotipo_ajuste TEXT;
