# Toromana — Especificación funcional

> Sistema operativo de un negocio agrícola real.
> Reemplaza el flujo actual basado en un `.xlsm` de 59 hojas + WhatsApp + macros.

## 1. El problema real

Hoy la operación vive en `Pedidos2.xlsm`. Cada semana Admin clona la hoja `Fijos`,
revisa WhatsApps de Contabilidad y Producción para saber quién entra y quién sale, edita
órdenes de compra a mano en Word, y a fin de mes corre una macro que agrega por
nombre para sacar la cartera.

Fallas medidas sobre el archivo real:

| Falla | Evidencia en el `.xlsm` |
|---|---|
| Clientes duplicados parten la cartera | El mismo cliente escrito con un espacio al final, o con mayúscula distinta, aparece como **dos filas separadas** en la hoja mensual |
| Cartera perdida | ~$580.000 en la columna `Debe` de un solo mes, repartidos en 6 clientes |
| Datos codificados en texto | `"Nombre: 2 huevos"`, `"Nombre c/ 15 dias"` |
| Precios hardcodeados | Fila 39 de cada hoja semanal, se re-teclea cada vez |
| Sin trazabilidad de quién cobró | La macro agrega por nombre; Admin no sabe si Producción ya cobró |
| Órdenes de compra manuales | Cambiar fecha + consecutivo + cantidades en un `.docx`, cada semana |

**El costo del error no es cosmético:** si un cliente se cae de la lista semanal no
recibe producto; si entra de más, se despacha producto que nadie pidió; y si la
cartera se parte en dos filas, se deja de cobrar plata real.

## 2. Actores y roles

| Persona | Rol en el sistema | Permisos |
|---|---|---|
| **Admin** | `admin` | Todo. Facturación, logística, vendedor principal |
| **Contabilidad** | `contabilidad` + vendedora | Cartera completa, confirma pagos en efectivo, sus clientes |
| **Producción** | `produccion` + vendedor | Módulo de gallinas, sus clientes |
| **Reparto** | `reparto` | Vista móvil de la ruta del día. Marca entregas, reporta efectivo |

Los tres vendedores (Admin, Contabilidad, Producción) tienen clientes asignados. Cualquiera
puede recibir un pago de cualquier cliente — por eso **todo pago registra quién lo recibió**.

## 3. Tipos de cliente

Dos ejes independientes (no un solo enum):

**`kind`** — naturaleza del cliente
- `natural` — persona. Paga semanalmente a cualquier vendedor, o mensual a Admin.
- `institucional` — Institucional A, Institucional B, Institucional C. Grandes cantidades, a veces con
  precio descontado, requieren **orden de compra por duplicado** para firmar (una copia
  para ellos, una para el negocio).

**`recurrence`** — cadencia del pedido
- `semanal` — entra automáticamente todas las semanas
- `quincenal` — entra semana de por medio (ej. `Nombre c/ 15 dias`)
- `ocasional` — no se genera solo; el vendedor lo agrega a mano cuando pide

Un cliente institucional es casi siempre `semanal`, pero el modelo no lo asume.

## 4. Productos y precios

Precio de lista (semilla, tomado de la fila 39 del `.xlsm`):

| Producto | Unidad | Precio lista |
|---|---|---|
| Moras | libra | $10.000 |
| Mermelada | unidad | $20.000 |
| Huevos | cubeta de 30 | $20.000 |
| Miel | unidad | $20.000 |
| Mandarinas | libra | $10.000 |
| Limones | unidad | $4.000 |

**Reglas de precio:**
- Las cantidades **admiten fracciones**. En el archivo real hay `0.5` y `0.75` cubetas
  de huevos. La media cubeta es una venta legítima, no un error de digitación.
- El precio de cada línea del pedido **es editable en el momento**. Arranca en el precio
  de lista, salvo que ese cliente tenga un precio distinto en su último pedido — en ese
  caso se sugiere el último precio cobrado y se marca visualmente como distinto de lista.
- Esto cubre a Institucional B ($16.100/cubeta vs $20.000 de lista) sin mantener tabla de tarifas.
- El precio se **congela** en la línea al confirmar el pedido. Cambiar el precio de lista
  después no reescribe la historia.

## 5. Flujo central: el pedido semanal

Es el corazón del sistema. Reemplaza el "clonar la hoja `Fijos`".

### 5.1 Fecha de entrega
Se entrega **los lunes**. Si el lunes es festivo colombiano, se entrega el **martes**
(por eso existe la hoja `Abril 20 martes` en el archivo real).

**La fecha se ingresa a mano.** El campo viene pre-llenado con el próximo lunes y se
edita cuando haga falta. No se calculan festivos: quien arma el pedido sabe cuándo hay
festivo, y automatizarlo sería código capaz de equivocarse en silencio para ahorrar
dos clics al mes.

### 5.2 Generación
Al crear el pedido de la semana, el sistema genera automáticamente una orden por cada
cliente que cumpla:
- `recurrence = semanal`, o `quincenal` y le toca esta quincena
- **y** no tiene una pausa activa que cubra la fecha de entrega

Cada orden se pre-llena con el **pedido fijo** del cliente (lo que hoy es la hoja `Fijos`:
sus productos y cantidades habituales).

Los clientes excluidos por pausa **se muestran en gris con el motivo**, no desaparecen.
Que un cliente no esté hoy debe ser una decisión visible, no un silencio.

### 5.3 Edición colaborativa
Los tres vendedores editan el mismo pedido **en tiempo real** (Supabase Realtime).
- Cada uno ve sus clientes destacados, pero puede tocar los de todos.
- Agregar cliente ocasional, quitar cliente, ajustar cantidades, ajustar precio.
- Cada cambio queda con autor y hora.

Esto reemplaza el ida y vuelta de WhatsApp que hoy es la fuente principal de error.

### 5.4 Pausas
Un cliente fijo puede pedir "no me manden del 15 al 30". Se registra como un rango de
fechas con motivo. El generador lo excluye automáticamente mientras dure y lo vuelve a
incluir solo cuando termina — sin que nadie tenga que acordarse.

### 5.5 Confirmación y salidas
Al confirmar el pedido:
1. Se congelan precios y se calculan totales por cliente.
2. Se generan los consecutivos y PDFs de las órdenes de compra de los institucionales.
3. Queda disponible la **ruta de Reparto**: nombre, dirección, productos y cantidades.
   Exportable a PDF y CSV/Excel para imprimir (formato equivalente a `ejemplo lista pdf.pdf`).

## 6. Reparto

Vista móvil, lista del día:
- Marca cada entrega como **entregada**.
- Si recibe efectivo, reporta el monto. **Esto no entra a cartera todavía**: queda como
  *efectivo por confirmar*.
- Contabilidad ve la bandeja de pendientes y **confirma** (o corrige). Ahí sí impacta la cartera.

Reparto nunca escribe en la contabilidad. Pero la plata deja de vivir solo en su memoria
entre la entrega y el registro.

## 7. Cartera y cobros

### 7.1 Pagos
Un pago tiene:
- **Monto** (libre — los abonos parciales son normales)
- **Método**: `efectivo` o `transferencia` (a la cuenta bancaria del negocio)
- **Quién lo recibió** — el vendedor
- **Quién tiene el comprobante** — solo aplica a transferencias; en efectivo no se exige
- Fecha, nota opcional
- **Estado**: `confirmado` o `por_confirmar` (los que reporta Reparto)

### 7.2 Aplicación FIFO
Los pagos se aplican al **saldo más antiguo primero**. No se pide al vendedor que diga a
qué semana corresponde un abono — el sistema lo resuelve.

De ahí sale el dato que importa: **la antigüedad de la deuda más vieja sin cubrir**.

### 7.3 Panel de cobros con urgencia
Reemplaza la macro mensual. Cada vendedor ve **sus** clientes con saldo; Admin y Contabilidad
ven todos. Ordenado por urgencia:

| Nivel | Antigüedad de la deuda más vieja |
|---|---|
| 🟢 Al día | Sin saldo |
| 🟡 Reciente | 1–30 días |
| 🟠 Atención | 31–60 días |
| 🔴 Urgente | 61–90 días |
| ⚫ Crítico | > 90 días |

Esto ataca directamente el problema de las cuentas de 3–4 meses: la deuda vieja
**sube sola** en la lista en vez de esperar a que alguien se acuerde.

### 7.4 Cobro por WhatsApp
Cada cliente con saldo trae un botón que abre WhatsApp con el mensaje ya redactado
(`wa.me/57...?text=...`): saludo, detalle del período, monto, datos de la cuenta.
El vendedor solo revisa y envía. Cero costo, cero aprobaciones, funciona hoy.

La lógica de plantillas queda aislada en su propio módulo, para que cambiar a la
WhatsApp Cloud API después sea reemplazar el emisor, no reescribir los cobros.

### 7.5 Saldos iniciales
Al importar, la columna `Debe` de la última hoja mensual del `.xlsm` entra como
**saldo inicial** del cliente, con su fecha de corte. Así la cartera arranca con la
realidad del negocio y no en ceros.

## 8. Órdenes de compra (recibos de entrega)

Replican el template actual (`RECIBO DE ENTREGA` con los datos de la empresa). Solo cambian 4 cosas: fecha, número de recibo, destinatario y líneas.

**Consecutivos:** contadores independientes y configurables en Ajustes.
- Secuencia `general` — compartida por Institucional A y Institucional C
- Secuencia `institucional_b` — arranca en un número más alto, va de uno en uno

Los números nunca se repiten y son ajustables si se desfasan contra el histórico en papel.

**Copias:** los institucionales se generan **por duplicado** (una firma el cliente, una
se queda el negocio).

Casos particulares ya observados:
- Institucional C no tiene NIT — el campo es opcional
- Un institucional lleva una cláusula de comodato de cubetas plásticas marcadas,
  con cargo por pérdida. Va como **nota al pie del producto**, configurable
  por cliente.

## 9. Producción

Las gallinas son el activo principal del negocio.

- **Lotes**: código, fecha de entrada, cantidad inicial, cantidad actual, raza, notas.
- **Movimientos por lote**: mortalidad, venta, ingreso — cada uno con fecha y cantidad.
  La cantidad actual se deriva de los movimientos, no se teclea suelta.
- **Producción semanal**: huevos por lote (o total) por semana.

### Analítica
- **Tasa de postura** = huevos / gallina / día, por lote y en el tiempo. Es *la* métrica.
- Producción vs. edad del lote (semanas desde el ingreso) → curva de postura, permite
  proyectar cuándo un lote deja de ser rentable.
- **Producido vs. vendido** por semana → merma / excedente.
- Comportamiento de clientes: ticket promedio, frecuencia real vs. declarada, clientes
  que están bajando su consumo (señal temprana de fuga).

## 10. Importación desde Excel

El `.xlsm` real se carga una sola vez:

| Hoja | Destino |
|---|---|
| `CONTACTOS` (149 filas) | `customers` — nombre + dirección |
| `Fijos` (33 filas) | `customers` + `standing_order_items` (el pedido fijo) |
| Última hoja mensual (`Junio`) | `customers.opening_balance` desde la columna `Debe` |

**Sin deduplicación automática** — decisión explícita del negocio: la limpieza de
duplicados se hace a mano después de importar. El importador carga tal cual y reporta
cuántas filas entraron.

## 11. Fuera de alcance (hoy)

Registrado para que quede claro que fue decisión, no olvido:
- Facturación electrónica DIAN
- Envío automático real por WhatsApp Cloud API (queda la interfaz lista detrás)
- Control de inventario de cubetas en comodato
- App nativa (la vista de Reparto es web responsive)
- Costos de producción y P&L

## 12. Pendientes de información

- [ ] Valor actual de los consecutivos `general` e `institucional_b` (se configuran en Ajustes)
- [ ] Teléfonos de los clientes — sin ellos el botón de WhatsApp no aparece
- [ ] Asignación cliente → vendedor (se resuelve en la pantalla de asignación masiva)
- [ ] Base actual de lotes de gallinas
- [ ] Template `.docx` del recibo (los PDFs sirven de referencia visual)
