# Autenticación individual y autorización por roles

## Estado

La implementación fue fusionada a `main` mediante el PR #3 y publicada en
Vercel. Al 1 de agosto de 2026, producción opera en modo `individual` y conserva
las variables de la barrera compartida de Fase 0 para reversión.

La migración está aplicada en Supabase productivo: `public.app_users` existe,
tiene RLS habilitado y una política de lectura del perfil propio. La aplicación
cuenta con dos perfiles Administrador activos. Ambos ya completaron el cambio
de contraseña inicial.

La migración fue ejecutada desde SQL Editor y no figura en el historial de
migraciones del panel de Supabase. El archivo versionado
`supabase/migrations/20260731002456_individual_auth_roles.sql` sigue siendo la
fuente de verdad para reconstrucción y ambientes nuevos.

### Evidencia productiva — 2026-08-01

- Commit publicado: `aa10a60`.
- Vercel reportó el deployment del commit como completado.
- `APP_AUTH_MODE`, `APP_ACCESS_USER` y `APP_ACCESS_PASSWORD` están configuradas
  para Production y Preview; las variables de Fase 0 se conservan para
  reversión.
- Comportamiento anónimo observado:
  - `/` responde 307 hacia `/login?next=%2F`;
  - `/login` responde 200;
  - `/api/health` responde 401.
- Supabase productivo `eiiybpovzyszwscqifsq` se observó Healthy.
- Site URL: `https://hospital-dia.vercel.app`.
- Redirect URL permitida:
  `https://hospital-dia.vercel.app/auth/callback`.
- Registro público, vinculación manual e inicio anónimo están deshabilitados.
- Confirmación de correo permanece habilitada.
- Longitud mínima de contraseña en Supabase: 14 caracteres, alineada con la
  validación adicional de complejidad de la API.
- La protección contra contraseñas filtradas no está disponible en el plan
  Free; no se activó ningún costo.

Para completar la verificación funcional de los tres roles todavía se requieren
cuentas de prueba `pharmacist` y `auditor`. No debe asignarse un rol ficticio a
personal real solo para cerrar esta comprobación.

## Arquitectura

- Supabase Auth valida correo, contraseña, sesión y renovación de tokens.
- `@supabase/ssr` conserva la sesión en cookies compatibles con Next.js.
- `proxy.ts` usa `getClaims()`; no confía en `getSession()` ni en cookies sin
  verificar.
- `public.app_users` relaciona el UUID de `auth.users` con nombre, correo, rol
  y estado activo.
- Las cuentas creadas con contraseña temporal quedan bloqueadas en la pantalla
  de cambio de contraseña hasta que el propio usuario establezca una nueva.
- El perfil solo puede leerse por su propio usuario mediante RLS.
- Las tablas clínicas conservan RLS `deny-all` para `anon` y `authenticated`.
- Los datos clínicos siguen pasando exclusivamente por las APIs del servidor
  y Prisma.
- El Proxy elimina cualquier encabezado de identidad enviado por el cliente y
  agrega únicamente identidad verificada.
- Los endpoints que ya registran `createdBy`, `updatedBy` o `finalizadoBy`
  prefieren la identidad individual verificada.

No se usa una clave `service_role` en el navegador ni se toman decisiones de
autorización desde `user_metadata`.

## Roles

| Rol técnico | Nombre visible | Capacidades |
| --- | --- | --- |
| `administrator` | Administrador | Lectura, operación clínica, eliminación, catálogos y usuarios |
| `pharmacist` | Farmacéutico | Lectura y operación clínica; sin eliminación ni mantenimiento de catálogos |
| `auditor` | Consulta / Auditoría | Solo lectura |

Los métodos `GET` y `HEAD` requieren lectura. Los cambios clínicos requieren
rol Administrador o Farmacéutico. Las altas y cambios de medicamentos,
farmacéuticos y prescriptores son exclusivos del Administrador. Toda
eliminación es exclusiva del Administrador.

## Modos de transición

| `APP_AUTH_MODE` | Comportamiento |
| --- | --- |
| `basic` | Mantiene únicamente la barrera compartida actual |
| `hybrid` | Exige primero la barrera compartida y después la cuenta individual |
| `individual` | Exige únicamente la cuenta individual activa |

Un valor ausente conserva `basic`. Un valor desconocido falla de forma cerrada
con HTTP 503.

## Preparación de Supabase

Antes de modificar producción:

1. Probar la migración
   `supabase/migrations/20260731002456_individual_auth_roles.sql` en una base
   aislada.
2. Confirmar que el respaldo cifrado vigente sigue disponible.
3. Configurar en Supabase Auth:
   - Site URL: `https://hospital-dia.vercel.app`.
   - Redirect URL:
     `https://hospital-dia.vercel.app/auth/callback`.
   - Registro público deshabilitado.
   - Política de contraseña institucional.
   - SMTP institucional antes de depender de recuperación por correo.
4. Crear las cuentas desde `Authentication → Users`.
5. Asignar cada cuenta en `public.app_users`. Ejemplo:

```sql
insert into public.app_users (
  "authUserId",
  email,
  "displayName",
  role,
  active
)
select
  id,
  lower(email),
  'NOMBRE COMPLETO',
  'pharmacist'::public."AppRole",
  true
from auth.users
where lower(email) = lower('USUARIO@EJEMPLO.CR')
on conflict ("authUserId") do update
set
  email = excluded.email,
  "displayName" = excluded."displayName",
  role = excluded.role,
  active = excluded.active,
  "mustChangePassword" = true,
  "updatedAt" = now();
```

La consulta debe afectar exactamente una fila. Nunca asignar roles desde un
formulario de auto-registro.

## Publicación controlada

1. Desplegar el código manteniendo `APP_AUTH_MODE=basic`.
2. Crear las cuentas y perfiles autorizados.
3. Cambiar temporalmente a `hybrid`.
4. Verificar con una cuenta de cada rol:
   - sin sesión individual no se accede;
   - Administrador puede administrar;
   - Farmacéutico puede operar pero recibe 403 al eliminar o mantener
     catálogos;
   - Auditor recibe 403 ante toda escritura;
   - cerrar sesión invalida el acceso;
   - los campos de auditoría registran la cuenta autenticada.
5. Cambiar a `individual`.
6. Verificar nuevamente página, APIs y logs.
7. Conservar las variables de la barrera compartida durante la ventana de
   estabilización, sin utilizarlas como acceso ordinario.

## Reversión

Ante una regresión:

1. Cambiar `APP_AUTH_MODE` a `basic`.
2. Redeploy del mismo commit.
3. Confirmar 401 anónimo y 200 con la barrera compartida.

La reversión no requiere borrar usuarios, la tabla `app_users` ni registros
clínicos. La migración solo agrega objetos nuevos.
