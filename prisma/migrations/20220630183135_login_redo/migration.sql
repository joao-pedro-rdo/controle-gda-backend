/*
  Warnings:

  - You are about to drop the column `user` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[login]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "user",
ALTER COLUMN "login" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");
