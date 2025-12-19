Agenda del día (Hospital de Día – Preparación / Farmacia)

## Requisitos
- Node.js 18+ / 20+
- PostgreSQL

## Configuración rápida
1) Variables de entorno:
- `copy .env.example .env` (Windows) o crear `.env` con `DATABASE_URL`

2) Prisma (crear/actualizar tablas):
- `npm run prisma:generate`
- `npm run prisma:push`

3) Desarrollo:
- `npm run dev`

Abrir `http://localhost:3000`.

## MVP implementado
- Pantalla única: agenda por fecha, búsquedas, chips de estado, contadores y “Última actualización”
- Captura rápida (Enter para guardar) + tabla con edición inline por fila (doble clic / Enter)
- Acciones: duplicar, marcar listo/entregado, cancelar
- Exportar: PDF (agenda) + PDF consolidado por medicamento

## Supabase
- Ejecutar `supabase-init.sql` en Supabase SQL Editor (Primary Database).
- Luego ejecutar migraciones `supabase-migration-*.sql` según se agreguen campos.
- Para índices de rendimiento: ejecutar `supabase-migration-006-performance-indexes.sql`.
- Backups/restore: ver `docs/supabase-backup-restore.md`.

## Notas
- “Usuario/rol” y “Cerrar sesión” son placeholders (sin autenticación aún).
