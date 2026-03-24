## HU3-E3. Autenticar usuarios en la DApp según su rol

### 1. Objetivo
Autenticar usuarios institucionales en la DApp y asociar la sesión a su rol e IPS para controlar las vistas y acciones disponibles.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU3-E3).
- La sesión se resuelve en backend; el frontend no acepta rol o IPS arbitrarios.
- El cierre de sesión invalida el acceso a vistas protegidas.

### 3. Implementación validada
- Backend:
  - `backend/src/routes/auth.ts`
  - `backend/src/security/autenticacionService.ts`
  - `backend/src/access/accesoUsuariosService.ts`
- Frontend:
  - `frontend/src/pages/LoginPage.tsx`
  - `frontend/src/app/router.tsx`
  - `frontend/src/shared/auth/capabilities.ts`

### 4. Casos funcionales
1. Login exitoso devuelve token, rol, IPS y contexto del usuario.
2. El router protege vistas por sesión y capacidad.
3. Logout invalida el acceso a rutas protegidas.

### 5. Casos de validación
1. Credenciales inválidas -> rechazo.
2. Usuario inactivo -> rechazo.
3. Auditor ya no recibe capacidad para consultar documento clínico sensible.

### 6. Resultado
- Autenticación institucional con sesión válida: **CUMPLIDO**.
- Asociación correcta sesión / rol / IPS: **CUMPLIDO**.
- Restricción de vistas por capacidad: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint4-hus.test.js`.
- UI: `frontend/src/pages/LoginPage.tsx` y `frontend/src/app/router.tsx`.
