## HU3-E5. Autenticar y autorizar usuarios desde la DApp

### 1. Objetivo
Autenticar usuarios reales del prototipo desde la DApp y condicionar vistas/acciones al rol e IPS resueltos por backend.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU3-E5).
- La DApp ya no acepta rol/IPS arbitrarios declarados por el usuario.

### 3. Implementación validada
- Backend:
  - `backend/src/security/autenticacionService.ts`
  - `backend/src/routes/auth.ts`
  - `backend/src/security/autorizacionService.ts`
- Frontend:
  - `frontend/src/pages/LoginPage.tsx`
  - `frontend/src/app/router.tsx`
  - `frontend/src/shared/auth/sessionStorage.ts`
  - `frontend/src/shared/services/api.ts`

### 4. Casos funcionales
1. Login exitoso devuelve sesión con `token`, `rol`, `ipsId` y usuario.
2. Las rutas protegidas requieren sesión activa.
3. Las páginas sensibles verifican capacidad antes de permitir acceso.
4. Logout invalida la sesión local y backend.

### 5. Casos de validación
1. Credenciales inválidas -> rechazo.
2. Usuario inactivo -> rechazo.
3. Usuario autenticado sin capacidad intenta entrar a una vista protegida -> bloqueo con mensaje claro.

### 6. Resultado
- Solo autenticados acceden a la DApp protegida: **CUMPLIDO**.
- Rol e IPS se resuelven desde backend: **CUMPLIDO**.
- Logout invalida acceso: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint4-hus.test.js`.
- UI: `frontend/src/pages/LoginPage.tsx` y `frontend/src/app/router.tsx`.
