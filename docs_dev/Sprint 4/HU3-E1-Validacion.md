## HU3-E1. Verificar la integridad de un episodio clínico

### 1. Objetivo
Comparar el hash registrado en trazabilidad con el hash del documento off-chain para probar la integridad del episodio.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU3-E1).
- La verificación usa solo hashes y metadatos; no expone contenido clínico en blockchain.

### 3. Implementación validada
- Backend:
  - `backend/src/hce/documentoClinicoService.ts`
  - `backend/src/hce/trazabilidadService.ts`
  - `backend/src/routes/episodes.ts` (`GET /episodes/:id/integrity`)
- Frontend:
  - `frontend/src/pages/TrazabilidadEpisodioPage.tsx`
  - `frontend/src/pages/PortalClinicoPage.tsx`

### 4. Casos funcionales
1. Actor autorizado consulta integridad y obtiene `onChainHash` vs `offChainHash`.
2. El resultado indica si el episodio está íntegro.
3. La verificación genera evidencia reutilizable (`sourceTraceId`, `sourceTransactionHash`).

### 5. Casos de validación
1. Actor sin permisos sobre el episodio intenta verificar -> rechazo.
2. Episodio sin hash trazado -> rechazo controlado.
3. Integridad válida cuando el hash actual coincide con el último hash registrado.

### 6. Resultado
- Verificación en cualquier momento: **CUMPLIDO**.
- Comparación on-chain/off-chain: **CUMPLIDO**.
- Evidencia de integridad sin exposición clínica: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint4-hus.test.js`.
- UI: `frontend/src/pages/TrazabilidadEpisodioPage.tsx`.

