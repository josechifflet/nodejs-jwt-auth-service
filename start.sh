#!/bin/sh

export DATABASE_URL=postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_DATABASE && prisma migrate deploy && node dist/index.js