-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "dni" TEXT,
ADD COLUMN     "fechaNacimiento" TIMESTAMP(3),
ADD COLUMN     "localidad" TEXT,
ADD COLUMN     "obraSocialNombre" TEXT,
ADD COLUMN     "tieneObraSocial" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN     "aliasBancario" TEXT,
ADD COLUMN     "fechaNacimiento" TIMESTAMP(3),
ADD COLUMN     "matriculaNacional" TEXT,
ADD COLUMN     "matriculaProvincial" TEXT;
