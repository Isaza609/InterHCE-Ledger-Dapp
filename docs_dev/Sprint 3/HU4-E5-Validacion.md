## HU4-E5. Integrar la DApp con el almacenamiento off-chain de documentos clinicos

### 1. Objetivo
Permitir consulta y gestion segura de documentos clinicos off-chain desde la DApp, condicionada por permisos validos entre IPS.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU4-E5).
- Requisitos: RF3, RF4, RF5, RNF1.
- En blockchain solo se registran trazas/metadatos, nunca contenido clinico.

### 3. Implementacion validada
- Backend:
  - `backend/src/hce/permisosEpisodioService.ts`
  - `backend/src/routes/episodes.ts`:
    - `GET /episodes/:id/document` (con control de acceso por IPS/rol)
    - `GET /episodes/:id/permissions`
    - `POST /episodes/:id/permissions/grant`
    - `POST /episodes/:id/permissions/revoke`
- Frontend:
  - `frontend/src/pages/PortalClinicoPage.tsx` (consulta documento + permisos).
  - `frontend/src/shared/services/api.ts` (clientes permisos/documentos).

### 4. Casos funcionales
1. IPS propietaria consulta documento del episodio.
2. Admin IPS otorga permiso a IPS receptora.
3. IPS receptora consulta documento tras permiso valido.
4. Admin revoca permiso y la IPS receptora pierde acceso.

### 5. Casos de validacion
1. Solicitud de documento sin permisos -> `403 DOCUMENT_ACCESS_FORBIDDEN`.
2. Rol no admin intenta otorgar/revocar -> `403 FORBIDDEN_ROLE`.
3. Revocar permiso de IPS propietaria -> bloqueo.

### 6. Resultado
- Documento permanece exclusivamente off-chain: **CUMPLIDO**.
- Acceso condicionado por permisos validos: **CUMPLIDO**.
- Asociacion documento-episodio y confidencialidad preservadas: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint3-hus.test.js` (caso HU4-E5).
- Flujo UI: `frontend/src/pages/PortalClinicoPage.tsx`.
