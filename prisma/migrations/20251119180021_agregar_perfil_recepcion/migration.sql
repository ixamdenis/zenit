-- CreateTable
CREATE TABLE "ReceptionProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "aliasCbu" TEXT,
    "fechaIngreso" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceptionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceptionProfile_userId_key" ON "ReceptionProfile"("userId");

-- AddForeignKey
ALTER TABLE "ReceptionProfile" ADD CONSTRAINT "ReceptionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
