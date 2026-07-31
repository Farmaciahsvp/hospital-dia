# Backups y restauración (Supabase)

Consulta el procedimiento controlado y los criterios de evidencia en
[`fase-0-contencion.md`](./fase-0-contencion.md).

## Respaldo administrado

1. Abrir el proyecto correcto en Supabase.
2. Ir a `Database → Backups`.
3. Registrar fecha, tipo y retención del último respaldo.
4. No iniciar una restauración en producción durante una verificación.

Los backups físicos pueden restaurarse desde el Dashboard, pero no siempre
pueden descargarse. Para conservar una copia lógica se usa Supabase CLI.

## Respaldo lógico

Requiere Supabase CLI, Docker Desktop y la URL **Session pooler** del panel
`Connect`.

```powershell
supabase --version
supabase db dump --help

supabase db dump --db-url $env:HOSPITAL_DIA_SOURCE_DB_URL -f roles.sql --role-only
supabase db dump --db-url $env:HOSPITAL_DIA_SOURCE_DB_URL -f schema.sql
supabase db dump --db-url $env:HOSPITAL_DIA_SOURCE_DB_URL -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

No guardar la conexión ni los archivos SQL en Git. Cifrar cada archivo y
eliminar su original únicamente después de verificar el cifrado:

```powershell
.\scripts\phase0-backup-crypto.ps1 `
  -Mode Encrypt `
  -InputPath roles.sql `
  -OutputPath roles.sql.aes `
  -KeyPath backup-key.dpapi `
  -DeleteInput
```

Repetir para `schema.sql` y `data.sql`. La clave queda protegida por DPAPI y
solo puede recuperarla el mismo usuario de Windows. Conservar
`backup-key.dpapi` junto al respaldo cifrado y con acceso restringido.

## Restauración de prueba

Restaurar únicamente en un proyecto temporal:

```powershell
.\scripts\phase0-backup-crypto.ps1 `
  -Mode Decrypt `
  -InputPath roles.sql.aes `
  -OutputPath roles.sql `
  -KeyPath backup-key.dpapi

# Descifrar del mismo modo schema.sql.aes y data.sql.aes.

psql --single-transaction --variable ON_ERROR_STOP=1 `
  --file roles.sql `
  --file schema.sql `
  --command "SET session_replication_role = replica" `
  --file data.sql `
  --dbname $env:HOSPITAL_DIA_TARGET_DB_URL
```

Después:

1. Comparar conteos de tablas y relaciones.
2. Ejecutar la aplicación contra el proyecto temporal.
3. Documentar la prueba.
4. Eliminar archivos sin cifrar.

Las restauraciones físicas o PITR sobre producción requieren ventana de
mantenimiento, aprobación explícita y plan de reversión.

