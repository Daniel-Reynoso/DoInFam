# Supabase de DoInFam

Esta carpeta contiene la base local versionada de la Etapa 5A.

## Decisiones de seguridad

- Una cuenta de Supabase Auth identifica a una familia.
- Los integrantes viven en `public.family_members`; no existen roles.
- El PIN nunca se almacena en texto plano. Su hash y los intentos se guardan en
  el esquema `private`.
- La sesión del integrante se enlaza al claim JWT `session_id`, vence tras 45
  minutos sin actividad y nunca dura más de 12 horas.
- Cinco PIN incorrectos producen un bloqueo de 2 minutos.
- El creador de la familia solo puede autorizar durante 30 minutos que un
  integrante reemplace un PIN olvidado. El integrante crea el PIN en privado en
  el mismo dispositivo; el responsable nunca lo escribe ni puede consultarlo.
- Al completar el reemplazo se eliminan los intentos fallidos y se cierran todas
  las sesiones activas anteriores de ese integrante.
- Las tablas públicas solo admiten lectura familiar mediante RLS. Las escrituras
  de negocio se realizan con RPC explícitas.
- `public.complete_task(task_id)` deriva el integrante en el servidor y bloquea
  la fila de la tarea mientras verifica el cupo compartido.
- `public.complete_past_task(task_id, completion_date)` solo acepta días
  anteriores de la semana abierta y aplica los mismos cupos familiares usando
  la fecha elegida.
- `public.task_completions` es la única fuente de verdad de los puntos. Si una
  tarea se marcó por error, se corrige con `public.delete_task_completion(id)`,
  que solo permite borrar físicamente completions propias de la semana actual.

## Archivos

- `migrations/20260903020618_create_doinfam_core.sql`: esquema, índices, RLS,
  sesiones privadas, RPC y vista de historial.
- `migrations/20260903020758_add_foreign_key_indexes.sql`: índices compuestos
  recomendados por el asesor de rendimiento para las claves foráneas familiares.
- `tests/core_security_test.sql`: pruebas pgTAP de estructura, permisos e
  invariantes críticas.
- `tests/pin_recovery_security_test.sql`: permisos e invariantes del flujo de
  recuperación administrado.
- `tests/past_task_completion_test.sql`: permisos e invariantes de las RPC para
  registrar tareas olvidadas.

## Validación local

Requiere Docker Desktop en ejecución:

```powershell
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase db lint --local --level warning
```

No se debe usar `db push` hasta enlazar esta carpeta al proyecto Supabase de
DoInFam correcto.
