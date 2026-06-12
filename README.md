# RAI Taller 360

Sistema integral de gestión para **RAI — Taller de Hojalatería y Pintura (Aguascalientes)**.
Construido a partir del *Formulario de procesos RAI.xlsx* y de los archivos reales de operación
(*Registro de Vehículos.xlsx*, *Vales Control.xlsx*, *Vales de Pintura y TOT.xlsx*).

## Cómo ejecutarlo

```bash
cd rai-system
npm install
npm run dev      # abre http://localhost:5173
npm run build    # build de producción en dist/
```

Los datos de demostración (basados en los registros reales de RAI) se cargan
automáticamente y persisten en el navegador. Se restauran desde
**Catálogos → Sistema → Restaurar datos de demostración**.

## Módulos

| Módulo | Cubre el proceso de… |
| --- | --- |
| **Órdenes de Trabajo** | Recepción (seguro/particular), ODA, asegurado vs tercero, tipo de valuación, datos del propietario, inventario con checklist + 2 firmas + fotos, folio y torre automáticos, presupuesto/valuación con complementos, refacciones con fecha promesa, entrega con finiquito. Sustituye el *Registro de Vehículos* en Excel. |
| **Piso de Taller** | Tablero kanban de etapas (Hojalatería A/B/C, inspecciones, Pintura A/B/C, Mecánica, TOT, Lavado, Inspección final). Asignación de técnicos con carga visible y **log obligatorio de reasignaciones con motivo**. Las inspecciones solo las aprueban Gerente/Subgerente/Jefe de Taller. |
| **Agenda de Citas** | Citas de reingreso/valuación/entrega; sugiere citar por antigüedad de valuación cuando las refacciones están completas. |
| **Vales y Compras** | Vales de pintura (ml, piezas), refacciones, TOT y material de almacén. Folio automático, datos del vehículo tomados del expediente y regla de autorización: **>$2,000 solo Gerente; ≤$2,000 Subgerente/Jefe de Taller en cascada**. Sustituye *Vales Control* y el vale impreso. |
| **Almacén e Inventario** | Existencias, mínimos/máximos, punto de reorden con generación de vale en un clic, salidas por OT autorizadas (Gerente/Valuador/Subgerente/Jefe de Taller), entradas y bitácora de movimientos. |
| **Cuentas por Pagar** | Contrarecibos por proveedor, **cotejo automático factura ↔ vales** (detecta diferencias de monto y proveedor), vencimiento según días de crédito y registro de pago. |
| **Productividad** | **Corte semanal automático (sábado)** desde la bitácora de etapas: Hoj A 9% / B 20% / C 6%, Pint A 13% / B 13% / C 9%, Mec 20% sobre la venta del área. Resumen por técnico con descuento de préstamos, recibo imprimible y filtro por patio. Elimina el reporte manual de los lunes. |
| **Facturación y Cobranza** | La contadora factura desde el expediente digital (ya no se traslada expediente físico), sube al portal de la CIA y registra el pago. |
| **Garantías** | Reapertura con inventario nuevo, diagnóstico de procedencia, reproceso ligado a la orden original con los mismos técnicos. |
| **Reportes y KPIs** | Ciclo de reparación, mezcla de aseguradoras, venta por área, cuellos de botella por etapa y órdenes más antiguas. |
| **Catálogos** | Técnicos (con carga actual), proveedores, aseguradoras (QLTS, ABA, ATLAS, BBVA, SURA, WIBE, CHUBB), préstamos, folios y patios (AQUILES, P26, GPE P). |
| **Administración** *(solo ADMIN/Gerente)* | Alta de personal con su rol y patio, matriz de acceso a módulos por rol, y editor de permisos por campo (Editar / Solo ver / Oculto). |

## Mejoras añadidas sin romper el flujo actual

1. **Folios y registro automáticos** — al levantar la orden en tableta/computadora ya queda registrada (elimina el paso de "registrar en programas").
2. **Corte de productividad automático** — el avance diario de etapas en el tablero genera el corte del sábado solo; RH solo revisa y paga.
3. **Alertas operativas en el homepage** — vales por autorizar, materiales bajo mínimo, refacciones vencidas de promesa, órdenes estancadas (>15 días) y garantías.
4. **Semáforo de antigüedad** en el kanban (azul / amarillo >8 días / rojo >15 días).
5. **Cotejo automático factura-vale** en CxP, como pedía la nota del formulario ("estas tareas se pudieran cotejar más rápido con el programa").
6. **Log de reasignación obligatorio** con motivo, visible en el expediente.
7. **Carga de trabajo del técnico visible** al asignar, conservando al hojalatero que desarmó.
8. **Copia digital para el cliente** (WhatsApp/email) en lugar de fotocopias; firmas en pantalla.
9. **Reglas de autorización aplicadas por el sistema** (montos, roles, anticipos de particulares >$1,000 en refacciones).
10. **KPIs en vivo** sin recapturar nada: todo sale de la operación diaria.

## Arquitectura (modular y escalable)

```
src/
  core/            # dominio compartido
    types.ts         # modelo de datos (OT, vales, etapas, % de productividad…)
    store.ts         # estado + persistencia con patrón repositorio (StorageAdapter)
    seed.ts          # datos de demostración basados en los Excel reales
    productividad.ts # motor de cálculo del corte semanal
    registry.ts      # registro de módulos: rutas, navegación y homepage se generan solos
    ui.tsx           # componentes compartidos (iconos SVG, modales, tablas, badges)
    format.ts        # moneda MXN, fechas, semanas de corte, folios
  modules/         # un folder por módulo de negocio, autocontenido
    home/ ordenes/ taller/ citas/ vales/ almacen/ cxp/
    productividad/ facturacion/ garantias/ reportes/ catalogos/
  styles/tokens.css # design system (Redwood + colores RAI, accesibilidad AA)
```

- **Agregar un módulo** = crear su carpeta en `src/modules` y una entrada en
  `core/registry.ts`; la navegación, las rutas y la tarjeta del homepage aparecen solas.
- **Escalar a multiusuario**: la capa de datos usa un `StorageAdapter`
  (hoy localStorage). Para producción se implementa el mismo contrato contra
  **Supabase/PostgreSQL o una API REST** sin tocar los módulos de UI.
- **Roles**: el selector de rol de la barra superior simula la sesión; las reglas
  (autorización de vales, salidas de almacén, inspecciones) ya las aplica el sistema.

## Control de acceso por patio y rol

- **ADMIN y Gerente** ven los 3 patios (AQUILES, P26, GPE P) y todos los módulos;
  pueden filtrar por patio o ver el consolidado.
- **El resto del personal se asigna a un patio y a un rol**: solo ve los datos de su
  patio (órdenes, taller, vales, almacén, citas, productividad, facturas, garantías,
  reportes y alertas del homepage) y solo los módulos de su puesto:

  | Rol | Módulos |
  | --- | --- |
  | Subgerente | Órdenes, Taller, Citas, Vales, Almacén, Productividad, Garantías, Reportes |
  | Jefe de Taller | Órdenes, Taller, Vales, Almacén |
  | Valuador | Órdenes, Taller, Citas, Vales, Garantías |
  | Asesor de Servicio | Órdenes, Taller, Citas, Garantías |
  | Almacenista | Vales, Almacén |
  | Encargado de RH | Productividad |
  | Contadora | Órdenes, CxP, Facturación |
  | Catálogos | solo ADMIN y Gerente |

- La matriz vive en `core/registry.ts` (propiedad `roles` de cada módulo) y el alcance
  por patio en `core/store.ts` (`useScope`): cambiarla no toca las pantallas.
- Además de ocultar la navegación, las **rutas están protegidas** (entrar por URL a un
  módulo ajeno muestra "sin acceso") y el expediente de una orden de otro patio se bloquea.

### Administración: personal, roles editables y permisos por campo

El módulo **Administración** (solo ADMIN/Gerente) centraliza la configuración de acceso, y
lo que se define ahí **aplica en vivo** al resto del sistema:

1. **Personal** — alta/edición de quien entra a trabajar, con su rol y patio. El botón
   "Entrar como" permite ver el sistema tal como lo vería ese usuario.
2. **Roles y módulos** — matriz editable de qué módulos ve cada rol (override de los
   defaults; guardado en `permisos.modulos`).
3. **Permisos por campo** — para cada rol, el acceso a campos sensibles en tres niveles:
   **Editar**, **Solo ver** u **Oculto** (guardado en `permisos.campos`). Campos protegidos
   actuales (en `core/permisos.ts`, ampliable):

   | Campo | Módulo | Default | Ejemplo |
   | --- | --- | --- | --- |
   | Margen de utilidad | Órdenes | Solo ver | **Valuador → Oculto** (no ve el margen) |
   | Costos del presupuesto | Órdenes | Editar | Asesor → Oculto |
   | Editar/autorizar presupuesto | Órdenes | Editar | Asesor → Solo ver |
   | Datos de contacto del cliente | Órdenes | Solo ver | — |
   | Indicadores financieros | Reportes | Solo ver | Valuador/Asesor → Oculto |

   La capa es genérica: agregar un campo nuevo es una línea en `CAMPOS_PROTEGIDOS` y un
   chequeo `useAcceso()('id.campo')` donde se renderice. ADMIN y Gerente ven y editan todo.

## Diseño

Homepage tipo **springboard de Oracle Fusion Redwood** (saludo, KPIs, alertas y
mosaico de módulos) con la identidad RAI: azul `#0B3B8C`, amarillo `#FFC400` y blanco.
Tipografía Public Sans. Lineamientos aplicados (skill UI/UX Pro Max): contraste ≥4.5:1,
objetivos táctiles ≥44px, ritmo de espaciado 4/8px, iconografía SVG (sin emojis),
animaciones 150–300ms solo con transform/opacity, `prefers-reduced-motion`, focus visible
y navegación por teclado.
