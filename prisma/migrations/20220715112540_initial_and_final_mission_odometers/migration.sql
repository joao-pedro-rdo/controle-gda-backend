/*
  Warnings:

  - Added the required column `finalOdometer` to the `Mission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `initialOdometer` to the `Mission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "finalOdometer" TEXT NOT NULL,
ADD COLUMN     "initialOdometer" TEXT NOT NULL;
