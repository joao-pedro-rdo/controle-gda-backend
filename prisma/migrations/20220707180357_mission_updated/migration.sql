/*
  Warnings:

  - Added the required column `complements` to the `Mission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateMission` to the `Mission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "complements" VARCHAR(700) NOT NULL,
ADD COLUMN     "dateMission" TIMESTAMP(3) NOT NULL;
