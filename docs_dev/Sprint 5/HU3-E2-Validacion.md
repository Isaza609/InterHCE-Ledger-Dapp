## HU3-E2. Verificar la integridad de episodios clínicos recibidos por traslado

### 1. Objetivo
Comparar el hash trazado del episodio con el hash del documento off-chain recibido por la IPS receptora para confirmar integridad.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU3-E2).
- La verificación usa solo hashes y evidencia trazable; no publica contenido clínico.
- El auditor puede verificar integridad, pero no consultar el documento clínico completo.

### 3. Implementación validada
- Backend:
  - `backend/src/routes/episodes.ts` (`GET /episodes/:id/integrity`)
  - `backend/src/hce/documentoClinicoService.ts`
  - `backend/src/hce/trazabilidadService.ts`
- Frontend:
  - `frontend/src/pages/TrazabilidadEpisodioPage.tsx`
  - `frontend/src/pages/VerEpisodioPage.tsx`

### 4. Casos funcionales
1. La IPS receptora obtiene `onChainHash` y `offChainHash` del episodio autorizado.
2. El sistema informa si el episodio está íntegro o requiere revisión.
3. La verificación genera evidencia auditada reutilizable.

### 5. Casos de validación
1. Episodio autorizado mantiene igualdad entre hash on-chain y off-chain.
2. Actor sin permiso documental ni rol auditor -> rechazo.
3. La evidencia de verificación conserva `sourceTraceId` y `transactionHash`.

### 6. Resultado
- Comparación hash on-chain / off-chain: **CUMPLIDO**.
- Evidencia de integridad para episodio trasladado: **CUMPLIDO**.
- Separación de contenido clínico y prueba criptográfica: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint5-hus.test.js`.
- UI: `frontend/src/pages/TrazabilidadEpisodioPage.tsx` y `frontend/src/pages/VerEpisodioPage.tsx`.
