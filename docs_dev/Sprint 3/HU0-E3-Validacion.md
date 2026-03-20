## HU0-E3. Definir y gestionar los roles del sistema

### 1. Objetivo
Definir roles oficiales y capacidades funcionales asociadas para operar la plataforma.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU0-E3).
- Requisitos: RF6, RF9.
- Roles implementados: `paciente`, `profesional_salud`, `admin_ips`, `auditor`.

### 3. Implementacion validada
- `backend/src/access/accesoUsuariosService.ts` (roles + capacidades).
- `backend/src/routes/access.ts` (`GET /access/roles`, `GET /access/capabilities`).
- `frontend/src/pages/PortalClinicoPage.tsx` (visualizacion de roles/capacidades).

### 4. Casos funcionales
1. Consulta de roles retorna definicion explicita por rol.
2. Consulta de capacidades retorna permisos coherentes con actor autenticado.

### 5. Casos de validacion
1. Rol invalido en cabecera -> rechazo de consulta de capacidades.
2. Actor sin contexto -> no obtiene capacidades operativas.

### 6. Resultado
- Roles claramente diferenciados y con permisos explicitos: **CUMPLIDO**.
- Cambios/uso de rol aplicados de forma consistente: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint3-hus.test.js` (caso HU0-E3).
