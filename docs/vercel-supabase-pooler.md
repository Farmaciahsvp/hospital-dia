# Vercel + Supabase: evitar "max clients reached"

Si la app muestra errores `500` con mensajes como:
`MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size`,
significa que Vercel est\u00e1 abriendo demasiadas conexiones a Postgres.

## Soluci\u00f3n recomendada (pooler Transaction)
1) En Supabase: **Project Settings \u2192 Database \u2192 Connection string**
2) Selecciona:
   - **Source:** `Primary Database`
   - **Method:** `Transaction pooler` (o `Pooler` en modo `Transaction`)
3) Copia el URI y ponlo en Vercel como `DATABASE_URL`.

Recomendaci\u00f3n para Prisma (agrega par\u00e1metros):
- `pgbouncer=true`
- `sslmode=require`
- `connection_limit=1`

Ejemplo:
`postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&connection_limit=1`

## Alternativas
- Aumentar `Pool Size` en Supabase (si tu plan lo permite).
- Usar un proxy (Prisma Accelerate / Data Proxy) si se necesita alta concurrencia.
