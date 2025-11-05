/*
  Warnings:

  - You are about to alter the column `complements` on the `Mission` table. The data in that column could be lost. The data in that column will be cast from `VarChar(700)` to `VarChar(500)`.

*/
-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "isAuthorized" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "complements" SET DATA TYPE VARCHAR(500);
