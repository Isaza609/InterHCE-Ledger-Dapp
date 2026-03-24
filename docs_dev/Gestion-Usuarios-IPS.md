# Módulo de Gestión de Usuarios e IPS

## 1. Resumen

Este módulo implementa la gestión completa de Instituciones Prestadoras de Salud (IPS) y sus usuarios dentro del sistema InterHCE Ledger. Reemplaza el modelo previo de usuarios estáticos hardcodeados con un sistema dinámico que permite crear, administrar y vincular usuarios a instituciones reales.

## 2. Arquitectura del módulo

### 2.1 Jerarquía de roles

```
super_admin
  └── Crea IPS
  └── Crea admin_ips para cualquier IPS
  └── Gestiona configuración global

admin_ips (por IPS)
  └── Crea profesional_salud dentro de su IPS
  └── Crea paciente dentro de su IPS
  └── Gestiona usuarios de su propia IPS

profesional_salud
  └── Opera clínicamente (episodios)
  └── Al crear episodio se auto-crea usuario paciente

paciente
  └── Consulta sus episodios
  └── Se crea automáticamente al registrar su primer episodio

auditor
  └── Consulta trazabilidad y evaluación
```

### 2.2 Entidad IPS

Modelo: `Ips` en `backend/src/ips/ipsService.ts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ipsId` | string | Identificador único (ej: IPS-001) |
| `nombre` | string | Nombre de la institución |
| `repsCodigo` | string | Código REPS del prestador |
| `direccion` | string | Dirección física |
| `ciudad` | string | Ciudad |
| `departamento` | string | Departamento |
| `telefono` | string | Teléfono de contacto |
| `correoContacto` | string | Correo institucional |
| `activa` | boolean | Estado de la IPS |
| `creadaEn` | string | Fecha ISO de creación |
| `actualizadaEn` | string | Fecha ISO de última actualización |

### 2.3 Modelo de usuario mejorado

Modelo: `UsuarioIps` en `backend/src/access/accesoUsuariosService.ts`

Campos nuevos respecto al modelo anterior:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `documentoIdentidad` | string (opcional) | Cédula o documento del usuario |
| `requiereCambioPassword` | boolean | Si debe cambiar contraseña al siguiente login |

## 3. Nuevo rol: super_admin

### 3.1 Capacidades

- `ips.crear` — Crear nuevas IPS
- `ips.actualizar` — Modificar datos de IPS existentes
- `ips.listar` — Ver todas las IPS (incluyendo inactivas)
- `ips.usuarios.gestionar` — Gestionar usuarios de cualquier IPS
- `sistema.configurar` — Configuración global del sistema
- `trazabilidad.consultar` — Consultar trazabilidad

### 3.2 Usuario seed

| Campo | Valor |
|-------|-------|
| ID | `super-admin-001` |
| Correo | `superadmin@interhce.local` |
| Contraseña | `SuperAdmin001!` |
| IPS | `SISTEMA` |

## 4. API — Endpoints nuevos

### 4.1 IPS (`/ips`)

| Método | Ruta | Rol requerido | Descripción |
|--------|------|---------------|-------------|
| GET | `/ips` | Público (activas) / super_admin (todas) | Listar IPS |
| GET | `/ips/:id` | Público | Detalle de una IPS |
| POST | `/ips` | super_admin | Crear nueva IPS |
| PATCH | `/ips/:id` | super_admin | Actualizar IPS |

### 4.2 Usuarios — endpoints mejorados (`/access`)

| Método | Ruta | Rol requerido | Descripción |
|--------|------|---------------|-------------|
| GET | `/access/users` | admin_ips / super_admin | Listar usuarios (super_admin puede filtrar por `?ipsId=`) |
| GET | `/access/users/:id` | admin_ips / super_admin | Detalle de un usuario |
| POST | `/access/users` | admin_ips / super_admin | Crear usuario (con restricciones de rol) |
| PATCH | `/access/users/:id` | admin_ips / super_admin | Actualizar usuario |
| POST | `/access/users/:id/reset-password` | admin_ips / super_admin | Resetear contraseña |
| GET | `/access/roles-creables` | Autenticado | Roles que el actor actual puede crear |

### 4.3 Autenticación — mejoras (`/auth`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/login` | Ahora acepta `documentoIdentidad` además de `correo`/`usuarioId` |
| PATCH | `/auth/password` | Cambiar contraseña propia (requiere token Bearer) |

## 5. Restricciones de creación de usuarios

El sistema aplica una **matriz de permisos para creación** según el rol del creador:

| Rol del creador | Puede crear |
|-----------------|-------------|
| `super_admin` | `admin_ips`, `profesional_salud`, `paciente`, `auditor` |
| `admin_ips` | `profesional_salud`, `paciente` |
| `profesional_salud` | (ninguno) |
| `paciente` | (ninguno) |
| `auditor` | (ninguno) |

Además:
- `admin_ips` solo puede crear usuarios dentro de su propia IPS
- `super_admin` puede asignar cualquier IPS existente al nuevo usuario
- La IPS destino debe existir en el store de IPS (excepto IPS especiales: SISTEMA, AUDITORIA, PACIENTE)
- No se puede duplicar `documentoIdentidad`

## 6. Auto-creación de pacientes

Cuando un profesional de salud crea un episodio clínico (`POST /episodes`), el sistema:

1. Extrae `patient.identifier[0].value` del payload (documento de identidad del paciente)
2. Busca si ya existe un usuario con ese `documentoIdentidad`
3. Si **no existe**, crea automáticamente un usuario con:
   - `usuarioId`: `paciente-<documento>`
   - `nombre`: extraído de `patient.name` del episodio
   - `password`: `Paciente-<documento>!`
   - `rol`: `paciente`
   - `ipsId`: la IPS del profesional que creó el episodio
   - `requiereCambioPassword`: `true`
4. La respuesta del episodio incluye `pacienteAutoCreado: true/false`

El paciente puede entonces iniciar sesión usando su **documento de identidad** como identificador y la contraseña generada.

### 6.1 Flujo de cambio de contraseña obligatorio

Cuando un usuario con `requiereCambioPassword: true` inicia sesión:

1. El backend devuelve `requiereCambioPassword: true` junto con la sesión
2. El frontend intercepta el login y en lugar de redirigir al portal, muestra un formulario de cambio de contraseña obligatorio
3. El usuario debe ingresar y confirmar su nueva contraseña (mínimo 6 caracteres)
4. Al confirmar, se llama a `PATCH /auth/password` con la contraseña temporal y la nueva
5. El backend actualiza la contraseña y pone `requiereCambioPassword: false`
6. El usuario puede continuar al portal con su sesión activa

Este flujo aplica tanto para pacientes auto-creados como para cualquier usuario cuya contraseña haya sido reseteada por un administrador.

## 7. Login flexible

El endpoint `POST /auth/login` ahora acepta tres tipos de identificador:

1. **Correo institucional** — campo `correo` del body
2. **ID de usuario** — campo `usuarioId` del body
3. **Documento de identidad** — campo `documentoIdentidad` del body

La búsqueda se realiza en ese orden de prioridad en `buscarUsuarioPorIdentificador()`.

## 8. Frontend — Páginas nuevas

### 8.1 Gestión de IPS (`/gestion/ips`)

- **Acceso**: solo `super_admin` (capability `ips.crear`)
- **Funcionalidades**:
  - Tabla con todas las IPS del sistema
  - Formulario para crear nueva IPS (código, nombre, REPS, ciudad, etc.)
  - Editar IPS existente
  - Activar/desactivar IPS

### 8.2 Gestión de usuarios (`/gestion/usuarios`)

- **Acceso**: `admin_ips` y `super_admin` (capability `ips.usuarios.gestionar`)
- **Funcionalidades**:
  - Tabla de usuarios con filtro por IPS (super_admin)
  - Formulario para crear usuario con campos: ID, nombre, correo, contraseña, documento, rol, IPS
  - Selector de rol filtrado por lo que el actor puede crear
  - Activar/desactivar usuarios
  - Resetear contraseña (muestra la contraseña temporal generada)

### 8.3 Login mejorado

- Campo unificado "Correo, usuario o documento" en lugar de campos separados
- Tarjeta de demo adicional para el Super Administrador
- Hints actualizados explicando los tres tipos de identificación

### 8.4 Navegación

Sección "Administración" en el sidebar con:
- **Gestión IPS** (icono 🏥) — visible solo para `super_admin`
- **Usuarios** (icono 👥) — visible para `admin_ips` y `super_admin`

## 9. Compatibilidad

### 9.1 Usuarios seed preservados

Los 6 usuarios originales siguen funcionando con las mismas credenciales. Se agregó el usuario `super-admin-001`.

### 9.2 IPS seed

Se crean automáticamente IPS-001 (Bogotá) e IPS-002 (Medellín) como entidades completas en el store de IPS, alineadas con los usuarios seed existentes.

### 9.3 Cabeceras de compatibilidad

Las cabeceras `x-user-role`, `x-ips-id`, `x-user-id` siguen funcionando como fallback cuando no hay token Bearer.

### 9.4 Almacenamiento

Consistente con el resto del proyecto: `Map` en memoria. Los datos se pierden al reiniciar el servidor (prototipo).

## 10. Archivos modificados y creados

### Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `backend/src/ips/ipsService.ts` | Servicio CRUD de IPS con store en memoria |
| `backend/src/routes/ips.ts` | Rutas REST para gestión de IPS |
| `frontend/src/pages/GestionIpsPage.tsx` | UI para gestión de IPS |
| `frontend/src/pages/GestionUsuariosPage.tsx` | UI para gestión de usuarios |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/src/hce/episodioLifecycleService.ts` | Agregado `super_admin` a `RolUsuario` |
| `backend/src/access/accesoUsuariosService.ts` | Nuevos campos, restricciones, cambio/reset password, seed super_admin |
| `backend/src/routes/access.ts` | Nuevos endpoints, soporte super_admin, reset password |
| `backend/src/routes/auth.ts` | Login por documento, cambio de contraseña |
| `backend/src/routes/episodes.ts` | Auto-creación de usuario paciente |
| `backend/src/security/autorizacionService.ts` | super_admin en ROLES_VALIDOS |
| `backend/src/security/autenticacionService.ts` | Expone `requiereCambioPassword` |
| `backend/src/server.ts` | Monta `/ips` router |
| `frontend/src/shared/auth/sessionStorage.ts` | Agregado `super_admin` a `RolSesion` |
| `frontend/src/shared/auth/capabilities.ts` | Capacidades de `super_admin` |
| `frontend/src/shared/services/api.ts` | Funciones para IPS, reset password, roles creables |
| `frontend/src/pages/LoginPage.tsx` | Login unificado, demo super_admin |
| `frontend/src/components/layout/Layout.tsx` | Sección "Administración" en sidebar |
| `frontend/src/app/router.tsx` | Rutas `/gestion/ips` y `/gestion/usuarios` |
