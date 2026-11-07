-- Português e inglês (7 nov 2026, o Renato): os textos que o Nuno escreve no backoffice ganham a
-- versão inglesa; vazia, a app mostra o português. Na «definicoes», as chaves novas são «aviso_en»,
-- «fid.recompensa_en» e «fid.aniversario_en». A conta guarda a língua escolhida na app (o passe da
-- carteira sai nela); sem escolha, NULL.
ALTER TABLE categorias ADD COLUMN nome_en TEXT NOT NULL DEFAULT '';
ALTER TABLE parceiros ADD COLUMN horario_en TEXT NOT NULL DEFAULT '';
ALTER TABLE parceiros ADD COLUMN descricao_en TEXT NOT NULL DEFAULT '';
ALTER TABLE promocoes ADD COLUMN destaque_en TEXT NOT NULL DEFAULT '';
ALTER TABLE promocoes ADD COLUMN titulo_en TEXT NOT NULL DEFAULT '';
ALTER TABLE promocoes ADD COLUMN detalhe_en TEXT NOT NULL DEFAULT '';
ALTER TABLE cartoes ADD COLUMN recompensa_en TEXT NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN lingua TEXT;
