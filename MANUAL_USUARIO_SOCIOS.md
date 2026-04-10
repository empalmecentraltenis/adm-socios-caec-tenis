# Manual de Usuario: Gestión de Socios (Dashboard CAEC Tenis)

Este manual detalla el funcionamiento de la sección de **Socios / Pagos**, la cual es el núcleo administrativo del sistema CAEC Tenis Digital.

---

## 1. Pantalla Principal de Socios
Al ingresar al Dashboard, la pestaña de **Socios / Pagos** es la vista predeterminada para los administradores.

### Componentes de la Vista:
- **Buscador**: Permite filtrar por Nombre, Apellido, DNI o Email en tiempo real.
- **Filtros rápidos**: 
    - **Por Estado**: Ver todos, Solo "Al día" o Solo "Morosos".
    - **Por Categoría**: Filtrar entre Socio, Alumno o Vitalicio.
- **Resumen Estadístico**: Debajo de la tabla se muestra el conteo total de socios activos visualizados.

---

## 2. Gestión de Altas, Bajas y Modificaciones (ABM)

### Crear un Nuevo Socio:
1. Haga clic en el botón naranja **"+ Nuevo"**.
2. Complete los datos obligatorios: Nombre, Apellido, DNI (será su nombre de usuario en la App) y Email.
3. El sistema asignará automáticamente la clave inicial (los últimos 4 dígitos del DNI).

### Editar un Socio:
Haga clic en el ícono del **Lápiz** en la fila del socio correspondiente. Podrá modificar categoría, teléfono, email, etc.

### Baja de Socio (Desactivación):
Haga clic en el ícono del **Tacho de Basura**.
- **Dar de Baja**: El socio pasa a estado "Inactivo". No podrá loguearse en la App ni reservar turnos, pero sus datos e historial de pagos se conservan para auditoría.
- **Eliminar definitivamente**: Borra el registro por completo de la base de datos (Usar con precaución).

---

## 3. Control de Pagos y Morosidad

### Semáforo de Estados:
El sistema calcula automáticamente la deuda basándose en el último pago registrado:
- 🟢 **Badge Verde ("Al día")**: Socio al día o con deuda menor a 2 meses.
- 🟡 **Badge Naranja ("1m")**: Socio con 1 mes de retraso. Se considera "dentro de la tolerancia" para reservar turnos pero con aviso preventivo.
- 🔴 **Badge Rojo ("Xm")**: Socio con **2 o más meses de deuda**. El socio queda **bloqueado automáticamente** para reservar turnos en la App.

### Registrar un Pago Individual:
1. Haga clic en el ícono de **Pesos ($)**.
2. Seleccione el mes a pagar y el método de pago.
3. Al confirmar, el sistema actualiza el estado del socio instantáneamente.

### Pago Masivo:
Si varios socios regularizan su situación en conjunto (ej. en la sede), utilice el botón **"Pago Masivo"** para procesar múltiples pagos sin cerrar la ventana.

### Historial de Pagos:
Haga clic en el ícono de **Reloj** para ver todos los pagos realizados por el socio desde su alta, ordenados del más reciente al más antiguo.

---

## 4. Comunicación y Exportación

### Recordatorio por WhatsApp:
Para los socios con 2 o más meses de deuda, aparecerá el ícono de **WhatsApp**. Al hacer clic:
- Se abrirá WhatsApp con el número del socio.
- Se precargará un mensaje automático indicando: *"Hola [Nombre], recordamos que tenés [X] cuotas pendientes por un total de $[Monto]..."*

### Exportación a Excel:
El botón **"Exportar"** ofrece opciones granulares para reportes rápidos:
- **Todos**: La base de datos completa.
- **Solo Activos / Solo Inactivos**: Listados de padrón.
- **Solo Morosos**: Ideal para tesorería para realizar cobranzas.
- **Solo Al Día**: Útil para beneficios o sorteos internos.

---

## 5. Roles de Seguridad

El sistema distingue entre dos tipos de acceso en el Dashboard:
1. **Administrador**: Puede crear socios, registrar pagos y modificar datos.
2. **Visualizador (Solo Lectura)**: Puede ver las tablas, usar filtros y exportar datos, pero los botones de "Nuevo", "Editar", "Eliminar" y "Registrar Pago" estarán deshabilitados o invisibles.

---
**Manual preparado para la Sub-comisión de Tenis - Abril 2026**
