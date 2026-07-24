# Toromana

Sistema operativo de un negocio agrícola real (huevos campesinos, moras, mermelada, miel,
cítricos). Reemplaza un `.xlsm` de 59 hojas + WhatsApp + macros de Excel.

**Documentos de referencia** — leerlos antes de construir:
- [docs/SPEC.md](docs/SPEC.md) — dominio, actores, reglas de negocio
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — módulos, esquema de BD, RLS
- [docs/PLAN.md](docs/PLAN.md) — cronograma de las 9 h y qué se corta si el tiempo aprieta

## ⚠️ Datos sensibles — regla innegociable

Este negocio tiene ~150 clientes reales, con nombre, dirección, teléfono y NIT. **Nada de
eso entra al repositorio**, que es público para juzgamiento del hackathon.

- `example info/` (los archivos fuente) y `local/` están en `.gitignore`
- El contexto real — nombres del equipo, clientes institucionales, datos de la empresa —
  vive solo en `local/CONTEXT.local.md`
- En código, comentarios, docs, mensajes de commit y datos de prueba se usan **alias**:
  `Admin` · `Contabilidad` · `Producción` · `Reparto` para el equipo,
  `Institucional A/B/C` para los clientes grandes
- Los datos de la empresa (razón social, NIT, teléfonos del recibo) van en variables de
  entorno o en una tabla de configuración, **nunca** hardcodeados

Antes de cada push: `git status` no debe mostrar nada de `example info/` ni de `local/`.

## Stack

Next.js 15 (App Router) · TypeScript · Supabase (Postgres + Auth + Realtime) ·
Tailwind + shadcn/ui · `@react-pdf/renderer` · `xlsx` (SheetJS) · deploy en Vercel.

## Comandos

```bash
npm run dev
npm run build          # correr antes de cada push: el deploy es continuo
npx supabase db push   # aplicar migraciones
```

## Reglas de arquitectura

**Monolito modular.** La lógica de negocio vive en `src/modules/<dominio>/`, nunca en
componentes de UI ni en rutas.

Módulos: `clients` · `orders` · `payments` · `production` · `documents` ·
`notifications` · `import`

1. Un módulo se importa **solo** por su `index.ts`. Nunca
   `import { x } from '@/modules/orders/queries'` desde fuera de `orders`.

   **Excepción, y es obligatoria:** un componente `'use client'` **no puede** importar
   el `index.ts` de un módulo. Ese index arrastra `queries.ts` → `lib/supabase/server` →
   `next/headers`, y el bundle del navegador revienta. Los componentes cliente importan
   sus tipos desde `@/modules/<modulo>/types`, y las acciones desde el `actions.ts` de
   su propia carpeta de ruta:

   ```ts
   // ❌ en un componente cliente
   import type { Payment } from '@/modules/payments'

   // ✅
   import type { Payment } from '@/modules/payments/types'
   import { registerPaymentAction } from './actions'
   ```

   Por eso cada módulo mantiene un `types.ts` sin dependencias de servidor.
   `lib/supabase/server.ts` importa `server-only`: si alguien se salta la regla, el
   build falla señalando el archivo culpable.
2. Las rutas en `app/` orquestan y renderizan; no contienen reglas de negocio.
3. Los efectos externos (PDF, WhatsApp, Excel) van detrás de una interfaz del módulo.

La prueba: si mover `modules/production/` a otro repo obliga a tocar otro módulo,
la frontera está mal.

## Convenciones del dominio

- **Dinero**: enteros en pesos colombianos, sin decimales. Nombrar las columnas y
  variables con sufijo `_cop`. Nunca `float` para plata.
- **Cantidades**: `numeric(10,2)`. Las fracciones son reales — media cubeta de huevos
  (`0.5`) es una venta legítima, no un error de digitación.
- **Precios**: se **congelan** en `order_items.unit_price_cop` al confirmar. Cambiar el
  precio de lista jamás reescribe la historia.
- **Saldos**: se **derivan** de las vistas FIFO (`v_customer_debt`), nunca se almacenan.
  Un saldo guardado se desincroniza; uno derivado no puede mentir.
- **Fechas de entrega**: normalmente lunes, martes cuando el lunes es festivo. **Se
  ingresan a mano**, con el próximo lunes pre-llenado. No calcular festivos.
- **Idioma**: la UI va en español (los usuarios son 4 personas de una familia en Bogotá).
  El código, en inglés.

## Cosas que parecen bugs y no lo son

- **Hay clientes duplicados en la base** (`Institucional B` / `institucional_b `,
  `Nombre Apellido` / `Nombre Apellido `). Decisión explícita del negocio: la limpieza se
  hace **a mano**. No escribir deduplicación automática.
- **Los precios varían por cliente sin tabla de tarifas.** Institucional B paga $16.100/cubeta
  contra $20.000 de lista. Se resuelve sugiriendo el último precio cobrado a ese cliente.
- **Los consecutivos de recibo no son una sola secuencia.** `general` (Institucional A + Institucional C)
  e `institucional_b` corren por separado y arrancan en números distintos.

## Usuarios y roles

| Usuario | Rol | Qué hace |
|---|---|---|
| Admin | `admin` | Todo. Facturación, logística, vendedor principal |
| Contabilidad | `contabilidad` | Cartera, confirma los pagos en efectivo, vende |
| Producción | `produccion` | Lotes de gallinas y producción, vende |
| Reparto | `reparto` | Vista móvil: marca entregas, reporta efectivo recibido |

Reparto **nunca** escribe en contabilidad: reporta y Contabilidad confirma.
