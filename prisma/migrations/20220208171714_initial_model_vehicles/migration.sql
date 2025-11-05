-- CreateTable
CREATE TABLE "Vehicles" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completeName" VARCHAR(150) NOT NULL,
    "tagName" VARCHAR(100) NOT NULL,
    "carModel" VARCHAR(50) NOT NULL,
    "licensePlate" VARCHAR(10) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "driverLicense" VARCHAR(30) NOT NULL,
    "idNumber" VARCHAR(30) NOT NULL,
    "company" VARCHAR(10) NOT NULL,
    "section" VARCHAR(50) NOT NULL,
    "qrUrl" VARCHAR(300) NOT NULL,

    CONSTRAINT "Vehicles_pkey" PRIMARY KEY ("id")
);
