# Persistencia y backend

## Hoy: IndexedDB (local)
`js/data/db.js` guarda cada colección en un *object store* de IndexedDB (base `nexora`). Es persistencia **real** pero **local al navegador y dispositivo**: borrar los datos del sitio o cambiar de dispositivo la pierde. Por eso existen las **copias JSON** (Configuración → *Descargar copia*) y la advertencia de copia antigua en el inicio.
La capa `store.js` solo usa `apply(changes)`, `loadAll()` y `replaceAll()`; para pasar a un backend se reimplementa esa interfaz.

## Migrar a Supabase/PostgreSQL (preparado, no activado)
Los importes ya son enteros en **centavos** (`bigint`). Esquema sugerido con RLS (todas las tablas por usuario):

```sql
create table public.accounts (
  id text primary key, user_id uuid not null default auth.uid() references auth.users on delete cascade,
  data jsonb not null, updated_at timestamptz not null default now());
-- Repetir para: categories, transactions, pendings, debts, budgets, goals, recurrings
-- Tabla meta(user_id, key text, value jsonb, primary key(user_id, key)) para settings y revisiones diarias.

alter table public.accounts enable row level security;
create policy "own rows select" on public.accounts for select using (user_id = auth.uid());
create policy "own rows insert" on public.accounts for insert with check (user_id = auth.uid());
create policy "own rows update" on public.accounts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.accounts for delete using (user_id = auth.uid());
```
Para consultas SQL directas (informes en servidor) conviene normalizar `transactions` con columnas: `id, user_id, type, amount_cents bigint check (amount_cents > 0), date, time, account_id, to_account_id, category_id, fee_cents, interest_cents, status, ...` y replicar en el servidor las validaciones de `js/core/engine.js` (importes enteros > 0, cuentas distintas en transferencias, motivo obligatorio en ajustes, etc.) mediante `check` constraints y triggers, porque la validación del cliente nunca es suficiente.

## Autenticación
La versión local no tiene login (no hay servidor que lo respalde y fingirlo sería engañoso). Con Supabase: `supabase.auth` (correo/OTP o Google), proteger rutas comprobando la sesión en `app.js` antes de `render()`, y aplicar las políticas RLS anteriores. Nunca almacenar contraseñas, PIN ni CVV bancarios.
