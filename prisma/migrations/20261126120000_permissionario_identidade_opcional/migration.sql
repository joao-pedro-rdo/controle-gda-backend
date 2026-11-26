-- Identidade deixou de ser usada; CPF é o identificador. Coluna mantida
-- (opcional) para não apagar dados antigos.
ALTER TABLE "Permissionario" ALTER COLUMN "idNumber" DROP NOT NULL;
