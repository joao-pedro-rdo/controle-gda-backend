-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "isPermissionario" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "Permissionario" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completeName" VARCHAR(150) NOT NULL,
    "idNumber" VARCHAR(30) NOT NULL,
    "CPF" VARCHAR(11) NOT NULL,

    CONSTRAINT "Permissionario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permissionario_CPF_key" ON "Permissionario"("CPF");
