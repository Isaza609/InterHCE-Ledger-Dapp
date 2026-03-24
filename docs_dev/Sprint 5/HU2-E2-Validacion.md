## HU2-E2. Consultar episodios clínicos autorizados desde una IPS receptora

### 1. Objetivo
Permitir que una IPS receptora consulte únicamente los episodios para los que recibió un permiso válido por episodio.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU2-E2).
- La autorización se resuelve por episodio e IPS, no como acceso global.
- La IPS receptora solo visualiza episodios activos dentro de su alcance.

### 3. Implementación validada
- Backend:
  - `backend/src/hce/permisosEpisodioService.ts`
  - `backend/src/routes/episodes.ts` (`GET /episodes/list`)
- Frontend:
  - `frontend/src/pages/EpisodiosPage.tsx`
  - `frontend/src/pages/PortalClinicoPage.tsx`

### 4. Casos funcionales
1. La IPS receptora no ve el episodio antes del otorgamiento.
2. Tras el permiso, el episodio pasa a ser visible para la IPS receptora.
3. La vista indica el alcance del acceso como caso compartido.

### 5. Casos de validación
1. Sin permiso activo, `listarEpisodiosAccesiblesPorIps` no devuelve el episodio.
2. Con permiso activo, `puedeAccederDocumento` y el listado quedan habilitados de inmediato.
3. La consulta sigue usando documento off-chain y no expone información clínica en blockchain.

### 6. Resultado
- Consulta limitada a permisos válidos: **CUMPLIDO**.
- Identificación del episodio autorizado para la IPS receptora: **CUMPLIDO**.
- Continuidad de acceso off-chain sin exposición on-chain: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint5-hus.test.js`.
- UI: `frontend/src/pages/EpisodiosPage.tsx`.
