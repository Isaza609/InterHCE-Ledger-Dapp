## HU2-E3. Gestionar usuarios dentro de una IPS

### 1. Objetivo
Permitir que `admin_ips` gestione usuarios de su institucion (crear, activar/desactivar y ajustar rol).

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU2-E3).
- Requisitos: RF6, RF9.
- Cada usuario se asocia a una unica IPS.

### 3. Implementacion validada
- Backend:
  - `backend/src/access/accesoUsuariosService.ts`
  - `backend/src/routes/access.ts` (`GET/POST /access/users`, `PATCH /access/users/:id`)
- Frontend:
  - `frontend/src/pages/PortalClinicoPage.tsx` (modulo gestion de usuarios).
  - `frontend/src/shared/services/api.ts` (clientes de gestion de usuarios).

### 4. Casos funcionales
1. Admin de IPS crea usuario de su IPS.
2. Admin activa/desactiva usuario.
3. Cambios se reflejan de forma inmediata en listados.

### 5. Casos de validacion
1. Rol no admin intenta crear/editar usuarios -> `403 FORBIDDEN_ROLE`.
2. Usuario duplicado (`usuarioId`) -> error de creacion.
3. Usuario inactivo no puede operar endpoints clinicos.

### 6. Resultado
- Solo admin IPS gestiona usuarios de su institucion: **CUMPLIDO**.
- Usuario vinculado a IPS unica y estado activo/inactivo aplicado: **CUMPLIDO**.
- La gestion no altera trazabilidad historica de episodios: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint3-hus.test.js` (caso HU2-E3).
