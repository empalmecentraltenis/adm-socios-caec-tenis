# Digitalización CAEC Tenis - Documentación Integral

Este documento resume el trabajo realizado para la modernización tecnológica de la sub-comisión de Tenis del club CAEC, cubriendo tanto la infraestructura técnica como las herramientas de gestión administrativa y de socios.

## 1. Resumen Ejecutivo
El objetivo del proyecto ha sido digitalizar la gestión integral del club, eliminando procesos manuales y proporcionando una plataforma segura para la administración y una experiencia fluida para los socios.

### Objetivos Alcanzados:
- **Seguridad**: Implementación de sistema de roles (Administrador y Visualizador).
- **Transparencia**: Dashboard con KPIs en tiempo real sobre recaudación y morosidad.
- **Eficiencia**: Automatización de avisos de deuda y reportes de pago vía WhatsApp.
- **Accesibilidad**: Aplicación móvil para socios accesible sin instalación compleja (PWA).

---

## 2. Herramientas de Administración (Dashboard)
Plataforma centralizada para el control total del club.

### Funciones Principales:
- **Tablero de Control (KPIs)**: Visualización inmediata de socios activos, ingresos mensuales, evolución de cuotas y distribución por categorías (incluyendo socios inactivos para análisis histórico).
- **Gestión de Socios (ABM)**: Alta, baja y edición de perfiles con historial detallado de pagos.
- **Control de Morosidad**: Identificación automática de "Morosos Críticos" (2 meses o más de deuda) con acceso directo a envío de recordatorio vía WhatsApp.
- **Exportación Inteligente**: Sistema de descarga Excel con filtros avanzados (Solo Activos, Solo Inactivos, Solo Morosos, Solo Al Día o Base Completa).

### Seguridad por Roles:
1. **Administrador Total**: Acceso a todas las funciones de carga, edición y configuración.
2. **Visualizador (Modo Solo Lectura)**: Acceso a reportes y listas para auditoría, sin permisos para modificar datos o registrar pagos.

---

## 3. Aplicación para el Socio (ReservasCAEC)
Herramienta de cara al socio para facilitar la comunicación y el cumplimiento.

### Características:
- **Instalación PWA**: Botón de "Instalar Aplicación" integrado en el login para Android/Desktop e instrucciones guiadas para iOS.
- **Acceso Directo**: Login simplificado validado con DNI y últimos 4 dígitos como medida de seguridad básica.
- **Informar Pago**: Interfaz directa para notificar pagos administrativos, que dispara automáticamente un mensaje de WhatsApp formateado a la tesorería del club.
- **Estado de Cuenta**: Los socios pueden ver su situación y categoría actual.

---

## 4. Ficha Técnica
Detalles para mantenimiento y escalabilidad futura.

- **Base de Datos**: Supabase (PostgreSQL) con políticas de seguridad (RLS) configuradas.
- **Frontend Administración**: Next.js 16 con TailwindCSS y NextAuth para la seguridad de sesión.
- **Frontend Socios**: React (Vite) optimizado para dispositivos móviles.
- **Integraciones**: WhatsApp Public API para mensajería y XLSX para reportes financieros.
- **Estado Mercado Pago**: Estructura preparada para integración futura (Actualmente en modo "Próximamente").

---

## 5. Accesos y Credenciales (Uso Interno)

### Acceso Administración:
- **Administrador**: `TenisCAECadmin` / `Tenis.2026`
- **Solo Lectura**: `TenisCAEC` / `1234`

### Acceso Socios:
- **Usuario**: DNI del socio (ej: `28456789`).
- **Clave inicial**: Últimos 4 dígitos del DNI.

---

**Documentación preparada para la Comisión Directiva - Abril 2026**
