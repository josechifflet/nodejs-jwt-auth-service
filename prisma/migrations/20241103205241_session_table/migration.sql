-- CreateTable
CREATE TABLE "Session" (
    "sessionPK" SERIAL NOT NULL,
    "sessionID" TEXT NOT NULL,
    "userPK" INTEGER NOT NULL,
    "lastActive" TIMESTAMP(3) NOT NULL,
    "signedIn" TIMESTAMP(3) NOT NULL,
    "device" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionPK")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionID_key" ON "Session"("sessionID");

-- CreateIndex
CREATE UNIQUE INDEX "Session_userPK_key" ON "Session"("userPK");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userPK_fkey" FOREIGN KEY ("userPK") REFERENCES "User"("userPK") ON DELETE RESTRICT ON UPDATE CASCADE;
