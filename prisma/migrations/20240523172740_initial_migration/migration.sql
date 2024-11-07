-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "Roles" AS ENUM ('admin', 'user');

-- CreateTable
CREATE TABLE "User" (
    "userPK" SERIAL NOT NULL,
    "userID" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "totpSecret" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "confirmationCode" TEXT,
    "forgotPasswordCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "Roles" NOT NULL DEFAULT 'user',

    CONSTRAINT "User_pkey" PRIMARY KEY ("userPK")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "attendancePK" SERIAL NOT NULL,
    "attendanceID" TEXT NOT NULL,
    "timeEnter" TIMESTAMP(3) NOT NULL,
    "ipAddressEnter" TEXT NOT NULL,
    "deviceEnter" TEXT NOT NULL,
    "remarksEnter" TEXT,
    "timeLeave" TIMESTAMP(3),
    "ipAddressLeave" TEXT,
    "deviceLeave" TEXT,
    "remarksLeave" TEXT,
    "userPK" INTEGER NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("attendancePK")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userID_key" ON "User"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_confirmationCode_key" ON "User"("confirmationCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_forgotPasswordCode_key" ON "User"("forgotPasswordCode");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_attendanceID_key" ON "Attendance"("attendanceID");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userPK_fkey" FOREIGN KEY ("userPK") REFERENCES "User"("userPK") ON DELETE RESTRICT ON UPDATE CASCADE;
