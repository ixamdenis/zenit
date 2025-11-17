/*
  Warnings:

  - You are about to drop the column `serviceId` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the `Service` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `professionalServiceId` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_serviceId_fkey";

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "serviceId",
ADD COLUMN     "professionalServiceId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Service";

-- CreateTable
CREATE TABLE "ProfessionalService" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracionMin" INTEGER NOT NULL,
    "precioBase" INTEGER NOT NULL,
    "requierePagoPrevio" BOOLEAN NOT NULL DEFAULT false,
    "penalidadPorcentaje" DOUBLE PRECISION DEFAULT 0.5,
    "professionalId" TEXT NOT NULL,

    CONSTRAINT "ProfessionalService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfessionalService_professionalId_idx" ON "ProfessionalService"("professionalId");

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_professionalServiceId_fkey" FOREIGN KEY ("professionalServiceId") REFERENCES "ProfessionalService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
