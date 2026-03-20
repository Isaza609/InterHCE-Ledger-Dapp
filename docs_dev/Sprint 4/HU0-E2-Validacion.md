## HU0-E2. Otorgar permisos de acceso a episodios clínicos entre IPS

### 1. Objetivo
Permitir que un `admin_ips` otorgue acceso por episodio a una IPS receptora y dejar el cambio trazado como evento verificable.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU0-E2).
- La autorización aplica por episodio, nunca de forma global.
- La IPS propietaria del episodio es la única autorizada para delegar acceso.

### 3. Implementación validada
- Backend:
  - `backend/src/hce/permisosEpisodioService.ts`
  - `backend/src/hce/trazabilidadService.ts`
  - `backend/src/routes/episodes.ts` (`POST /episodes/:id/permissions/grant`)
- Frontend:
  - `frontend/src/pages/PortalClinicoPage.tsx`
  - `frontend/src/shared/services/api.ts`

### 4. Casos funcionales
1. `admin_ips` de IPS propietaria otorga permiso a `IPS-002`.
2. La IPS receptora pasa de no tener acceso a tener acceso al documento del episodio.
3. La respuesta devuelve evidencia de trazabilidad (`traceEvent` + `transactionHash`).

### 5. Casos de validación
1. Rol distinto de `admin_ips` intenta otorgar permiso -> rechazo.
2. IPS no propietaria intenta otorgar permiso -> rechazo.
3. Otorgar un permiso ya activo -> conflicto controlado.

### 6. Resultado
- Permisos específicos por episodio: **CUMPLIDO**.
- Identificación IPS origen / IPS receptora: **CUMPLIDO**.
- Registro trazable del otorgamiento: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint4-hus.test.js`.
- UI: `frontend/src/pages/PortalClinicoPage.tsx`.

