-- CreateTable
CREATE TABLE "pessoas_nao_autorizadas" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "imagePath" TEXT,
    "identidade" TEXT,
    "CPF" TEXT NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoas_nao_autorizadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_nao_autorizadas_CPF_key" ON "pessoas_nao_autorizadas"("CPF");
