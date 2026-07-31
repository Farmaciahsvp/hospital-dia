# Fase 0 — Contención, respaldo y reversión

## Estado

Producción incluye una barrera temporal HTTP Basic que se activa
siempre en producción y en Vercel. Esta barrera protege páginas y rutas
`/api/*`.

Si `APP_ACCESS_USER` o `APP_ACCESS_PASSWORD` no están configuradas, producción
falla de forma cerrada con HTTP 503. No se permite que la ausencia de
configuración deje accesibles los datos.

Esta barrera es una medida temporal. No sustituye autenticación institucional,
autorización por rol, sesiones individuales ni auditoría por usuario.

### Pendiente de la fase

La contención, el respaldo y la verificación de recuperación están completos.
Para cerrar la fase organizativa todavía se requiere:

- Aprobar la matriz de roles.

La autenticación HTTP Basic sigue siendo temporal y compartida; la matriz
aprobada será la base de la autenticación individual definitiva.

### Respaldo y restauración verificados — 2026-07-30

- Se instaló Docker Desktop 4.84.0.
- Se habilitaron `Windows Subsystem for Linux` y
  `Virtual Machine Platform`.
- Se instaló WSL 2.7.11 y el motor Docker 29.6.2 quedó operativo.
- Se creó `hospital-dia-restore-test` en la organización `fhsvp2208`.
- Referencia del proyecto temporal: `ivjtrqtlcyvmmhmudibg`.
- Región: AWS `us-east-2` (East US, Ohio).
- Data API quedó desactivada para reducir exposición accidental.
- Se generaron `roles`, `schema` y `data` mediante Supabase CLI.
- Cada SQL se cifró con AES-256-GCM, se verificó antes de borrar su original y
  la clave quedó protegida con DPAPI.
- Carpeta de respaldo:
  `C:\Users\david\Documents\Hospital Día Backups\phase0-20260730-173122`.
- No quedaron archivos `.sql` sin cifrar ni archivos de staging.
- La restauración se ejecutó en una sola transacción y terminó con código 0.
- Las seis tablas coincidieron en conteo y huella de contenido:
  - `medications`: 24
  - `patients`: 195
  - `pharmacists`: 20
  - `prep_request_items`: 2185
  - `prep_requests`: 1794
  - `prescribers`: 22
- Las cinco relaciones verificadas registraron cero filas huérfanas.
- La aplicación local conectada al proyecto restaurado respondió HTTP 200 en
  `/`, `/api/health`, `/api/medications` y `/api/patients`.
- El proyecto temporal `hospital-dia-restore-test` se eliminó de forma
  controlada después de conservar la evidencia; el panel de la organización
  mostró únicamente el proyecto original `hospital-dia`.
- Las sesiones correctas permanecen activas en el navegador:
  - Supabase: organización `fhsvp2208`.
  - Vercel: equipo `Farmaciahsvp's projects`.

### Verificación de Vercel — 2026-07-30

- Proyecto: `farmaciahsvps-projects/hospital-dia`.
- Dominio productivo: `https://hospital-dia.vercel.app`.
- Repositorio conectado: `Farmaciahsvp/hospital-dia`.
- La rama `main` genera deployments de Production.
- Vercel Authentication está activa con `Standard Protection`.
- Standard Protection no cubre el dominio productivo.
- Password Protection está deshabilitada y la interfaz indica un costo de
  USD 150 por mes mediante Advanced Deployment Protection.
- Variables presentes antes de esta fase:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Variables sensibles agregadas para Production y Preview:
  - `APP_ACCESS_USER`
  - `APP_ACCESS_PASSWORD`

No se activó ninguna opción de pago. Las credenciales de la barrera quedaron
protegidas localmente con DPAPI y excluidas de Git. El usuario propietario
puede recuperarlas con `scripts/show-phase0-access.ps1`.

### Publicación productiva — 2026-07-30

- Pull request: `Farmaciahsvp/hospital-dia#1`.
- Commit de seguridad: `b493559`.
- Commit de `main`: `1c150f5`.
- Deployment Vercel: `5nehAa4ogeNpL1fcv6BqawRgkQez`.
- Estado observado: `Ready`, `Current`, Production.
- Dominio verificado: `https://hospital-dia.vercel.app`.
- Resultado HTTP:
  - `/` sin credenciales: 401.
  - `/api/health` sin credenciales: 401.
  - `/` con contraseña incorrecta: 401.
  - `/` con credenciales correctas: 200.
  - `/api/health` con credenciales correctas: 200 y `status: ok`.
  - `/api/medications` y `/api/patients` con credenciales correctas: 200.
- Encabezados confirmados: `WWW-Authenticate`, `X-Robots-Tag`,
  `Cache-Control: private, no-store`, y `X-Frame-Options: DENY`.
- Logs del deployment en los últimos 30 minutos: cero warnings, errores o
  eventos fatales.
- No se ejecutaron migraciones, escrituras ni restauraciones sobre el proyecto
  Supabase productivo.

### Verificación de Supabase — 2026-07-30

- Organización: `fhsvp2208`.
- Proyecto: `hospital-dia`.
- Referencia: `eiiybpovzyszwscqifsq`.
- Región: AWS `us-east-2` (East US, Ohio).
- Plan de la organización: Free.
- Estado final observado: Healthy.
- Advisor: sin hallazgos de seguridad o rendimiento.
- Backups programados: ninguno.
- El panel confirma que el plan Free no incluye backups del proyecto.
- El estado mostró brevemente `Unhealthy` durante la carga inicial y se
  normalizó a `Healthy`; no persistió una alerta asociada.

No se modificó el proyecto de base de datos productivo ni se cambió de plan.
Se creó únicamente el proyecto temporal aislado descrito arriba y se demostró
la restauración del respaldo cifrado.

## Activación en Vercel

Procedimiento aplicado:

1. Generar una contraseña aleatoria de al menos 32 caracteres.
2. En el proyecto `hospital-dia`, agregar para Production y Preview:
   - `APP_ACCESS_USER`
   - `APP_ACCESS_PASSWORD`
3. No guardar esos valores en Git, documentación, capturas ni mensajes.
4. Desplegar el commit validado.
5. Verificar desde una sesión privada:
   - `/` devuelve 401 sin credenciales.
   - `/api/health` devuelve JSON 401 sin credenciales.
   - Credenciales incorrectas devuelven 401.
   - Credenciales correctas permiten acceder a `/` y `/api/health`.

Si el plan de Vercel permite **All Deployments**, activar además Vercel
Authentication en `Settings → Deployment Protection`. Standard Protection no
protege el dominio de producción.

## Bloqueo de indexación

- `robots.txt` deniega todo rastreo.
- La metadata declara `noindex`, `nofollow`, `noarchive` y `nosnippet`.
- Las respuestas protegidas incluyen `X-Robots-Tag`.

Estas medidas reducen descubrimiento, pero no son controles de acceso.

## Matriz inicial de roles

| Capacidad | Administrador | Farmacéutico | Consulta/Auditoría |
| --- | --- | --- | --- |
| Ver agenda y calendario | Sí | Sí | Sí |
| Crear y editar registros clínicos | Sí | Sí | No |
| Cambiar estados y finalizar | Sí | Sí | No |
| Eliminar registros | Sí | No, salvo autorización | No |
| Mantener medicamentos y personal | Sí | No | No |
| Consultar estadísticas e histórico | Sí | Sí | Sí |
| Administrar usuarios y roles | Sí | No | No |
| Ver logs técnicos con datos sensibles | Sí, justificado | No | No |

La matriz debe aprobarse antes de implementar la autenticación definitiva.

## Staging seguro

Staging debe usar un proyecto de base de datos separado o una Supabase Branch.
No se copiarán pacientes reales. Se cargarán fixtures ficticios que cubran:

- Pacientes con una y varias aplicaciones.
- Todos los estados del flujo.
- Medicamentos almacenables y de compra local.
- Registros finalizados y cancelados.
- Fechas de cierre de mes y cambio de año.

La única excepción fue la prueba puntual de recuperación del 2026-07-30. El
proyecto `hospital-dia-restore-test` contuvo una copia real únicamente para
demostrar recuperabilidad, con Data API desactivada y acceso limitado a la
organización propietaria. Se eliminó después de completar las verificaciones y
no se utilizó como staging funcional.

## Respaldo obligatorio

No modificar producción hasta completar ambos controles:

1. Confirmar en Supabase `Database → Backups` la disponibilidad del respaldo
   automático. En la revisión del 2026-07-30 se confirmó que no existe ninguno
   porque el proyecto está en plan Free.
2. Generar un respaldo lógico cifrado fuera del repositorio.

Usar la conexión **Session pooler** del panel `Connect`:

```powershell
supabase db dump --db-url $env:HOSPITAL_DIA_SOURCE_DB_URL -f roles.sql --role-only
supabase db dump --db-url $env:HOSPITAL_DIA_SOURCE_DB_URL -f schema.sql
supabase db dump --db-url $env:HOSPITAL_DIA_SOURCE_DB_URL -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

Los tres archivos contienen información sensible. Deben almacenarse cifrados,
con acceso restringido y nunca dentro del repositorio.

Resultado del 2026-07-30:

- `roles.sql.aes`:
  `548DEEBBFEE1827BE1899F80C6063274E3E8648B05CF25AC977A9D8978B15600`
- `schema.sql.aes`:
  `E5810EEDAE5620C2E6C744B853A6FD2A4A5EC37F238CF26DEFCFF8408313C6C8`
- `data.sql.aes`:
  `7CB2A07A6CF0D622D395D53844EE8E68338F74A45424755447F9CAB51645BBDE`

Los hashes y metadatos también están en `manifest.json`, fuera del
repositorio.

## Verificación del respaldo

La existencia de archivos no demuestra que el respaldo sea recuperable:

1. Crear un proyecto Supabase temporal y privado.
2. Restaurar roles, esquema y datos en una sola transacción con `psql`.
3. Comparar conteos de las seis tablas del dominio.
4. Ejecutar consultas de integridad referencial.
5. Probar que la aplicación de staging puede leer los datos restaurados.
6. Eliminar de forma controlada el proyecto temporal y los archivos sin cifrar.

No restaurar sobre producción para realizar esta prueba.

Resultado del 2026-07-30:

1. Proyecto temporal creado con Data API desactivada.
2. Roles, esquema y datos restaurados en una sola transacción.
3. Conteos y huellas de las seis tablas idénticos al origen.
4. Cinco verificaciones de integridad referencial con cero huérfanos.
5. Aplicación local y APIs principales con HTTP 200.
6. Proyecto temporal, SQL, conexiones y logs temporales eliminados.

La evidencia estructurada se conserva en `integrity.json`, junto al respaldo
cifrado.

## Reversión de la aplicación

1. Registrar el deployment de producción anterior.
2. Desplegar la barrera y ejecutar smoke tests.
3. Ante una regresión funcional, restaurar el deployment anterior únicamente
   si conserva una protección de acceso equivalente.
4. Si el deployment anterior es público, mantener el nuevo deployment cerrado
   y corregir hacia adelante.

## Evidencia requerida para cerrar la fase

- Captura o registro del estado de Deployment Protection.
- Resultado HTTP anónimo y autorizado para página y API.
- Fecha del último backup automático.
- Hash SHA-256 de cada archivo lógico cifrado.
- Acta de restauración en un proyecto separado.
- Matriz de roles aprobada.
- Deployment y procedimiento de rollback documentados.
