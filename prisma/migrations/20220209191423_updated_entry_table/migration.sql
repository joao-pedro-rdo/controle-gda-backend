/*
  Warnings:

  - You are about to drop the column `entry` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `exit` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `exited` on the `Entry` table. All the data in the column will be lost.
  - Added the required column `isVisitor` to the `Entry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "entry",
DROP COLUMN "exit",
DROP COLUMN "exited",
ADD COLUMN     "isVisitor" BOOLEAN NOT NULL,
ADD COLUMN     "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
