/*
  Warnings:

  - Added the required column `color` to the `Entry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "color" VARCHAR(20) NOT NULL;
