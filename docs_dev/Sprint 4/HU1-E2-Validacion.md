## HU1-E2. Revocar permisos de acceso a episodios clínicos entre IPS

### 1. Objetivo
Permitir la revocación inmediata de permisos previamente otorgados, preservando el historial del permiso.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU1-E2).
- La revocación no elimina historial; cambia el estado efectivo del permiso.

### 3. Implementación validada
- Backend:
  - `backend/src/hce/permisosEpisodioService.ts`
  - `backend/src/hce/trazabilidadService.ts`
  - `backend/src/routes/episodes.ts` (`POST /episodes/:id/permissions/revoke`)
- Frontend:
  - `frontend/src/pages/PortalClinicoPage.tsx`

### 4. Casos funcionales
1. `admin_ips` revoca permiso activo de `IPS-002`.
2. La IPS receptora pierde acceso de inmediato al documento del episodio.
3. La respuesta registra un evento `PERMISSION_REVOKED`.

### 5. Casos de validación
1. Revocar permiso inexistente -> conflicto controlado.
2. Revocar permiso de la IPS propietaria -> bloqueo explícito.
3. Tras la revocación, `puedeAccederDocumento` retorna `false`.

### 6. Resultado
- Revocación inmediata por episodio: **CUMPLIDO**.
- Trazabilidad otorgado/revocado preservada: **CUMPLIDO**.
- Acceso removido tras revocación: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint4-hus.test.js`.

