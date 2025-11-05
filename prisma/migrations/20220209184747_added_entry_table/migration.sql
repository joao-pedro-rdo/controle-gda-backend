-- CreateTable
CREATE TABLE "Entry" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "exited" BOOLEAN NOT NULL DEFAULT false,
    "name" VARCHAR(250) NOT NULL,
    "idNumber" VARCHAR(30) NOT NULL,
    "licensePlate" VARCHAR(10) NOT NULL,
    "carModel" VARCHAR(50) NOT NULL,
    "entry" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exit" TIMESTAMP(3),
    "target" VARCHAR(200),
    "contactPerson" VARCHAR(100),

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);
