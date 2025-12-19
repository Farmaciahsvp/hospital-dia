# Backups y Restore (Supabase)

## Opción A (Recomendado): Backups automáticos en Dashboard
1. Entra a tu proyecto en Supabase.
2. Ve a `Database` → `Backups`.
3. Verifica que existan backups automáticos.
4. Para restaurar: selecciona un backup → `Restore` (esto reemplaza el estado actual de la base de datos).

## Opción B: Export / Import con Supabase CLI
Requiere instalar Supabase CLI.

### 1) Login y link del proyecto
1. `supabase login`
2. Dentro del repo: `supabase link --project-ref <PROJECT_ID>`

### 2) Backup (dump)
- Dump completo:
  - `supabase db dump --file supabase-backup.sql`

### 3) Restore
- Restaurar desde un dump:
  - `supabase db reset --db-url "<POSTGRES_URL>" --file supabase-backup.sql`

Notas:
- Usa el pooler/URL correcto para tu entorno.
- Haz restore fuera de horario si es un sistema en uso.

## Opción C: SQL Editor (manual)
1. `Database` → `SQL Editor`
2. Para cambios de esquema, ejecuta migraciones `supabase-migration-*.sql`.

## Buenas prácticas
- Ejecuta primero migraciones de índices (`supabase-migration-006-performance-indexes.sql`) para mejorar búsquedas.
- Mantén un backup antes de migraciones grandes.
- Si ves errores en la app, guarda el `requestId` que aparece en el mensaje para rastrear en logs.

