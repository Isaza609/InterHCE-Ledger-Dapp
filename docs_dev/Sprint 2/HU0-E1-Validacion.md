## HU0-E1. Crear episodio clinico de urgencias

### 1. Objetivo de la HU

Validar que el sistema permite crear episodios clinicos de urgencias usando el modelo HCE/FHIR del proyecto, generando documento off-chain, hash criptografico y metadatos on-chain sin exponer datos clinicos sensibles.

### 2. Alcance y supuestos (normativa + FHIR)

- Referencia funcional: `docs_plan/3. Epicas e HU.md` (HU0-E1).
- Requisitos asociados: `docs_plan/2. Requerimientos funcionales y no funcionales.md` (RF1, RF11, RNF1).
- Referencias normativas: `docs_plan/5. Referencias Normativas.md` (Resolucion 1888/2025, Resolucion 866/2021, Ley 2015/2020, Resolucion 1995/1999).
- Supuesto tecnico: el backend valida el payload en `episodioFhirLikeSchema` y solo permite crear con rol autorizado (`profesional_salud` o `admin_ips`) y `x-ips-id` coherente con la IPS origen del episodio.

### 3. Implementacion validada

- Backend:
  - `backend/src/routes/episodes.ts` (`POST /episodes` con validacion de rol/IPS, registro, evento y metadatos on-chain).
  - `backend/src/security/autorizacionService.ts` (reglas de autorizacion por rol e IPS).
  - `backend/src/hce/documentoClinicoService.ts` (documento off-chain + hash + metadatos on-chain).
  - `backend/src/hce/episodioLifecycleService.ts` (alta de version inicial y asociacion al evento de urgencias).
- Frontend:
  - `frontend/src/pages/LoginPage.tsx` (contexto de rol/IPS).
  - `frontend/src/pages/CrearEpisodioPage.tsx`.
  - `frontend/src/shared/services/api.ts` (`registrarEpisodio` con cabeceras actor).
- Tests:
  - `backend/test/sprint2-hus.test.js` (caso HU0-E1 de autorizacion y creacion).

### 4. Casos de prueba funcionales

1. Creacion autorizada de episodio
- Precondicion: sesion con rol `profesional_salud`, `x-ips-id=IPS-010`.
- Pasos: enviar payload valido FHIR-like a `POST /episodes`.
- Resultado esperado: `201`, `episodeId` unico, `documentHash`, `event`, `version=1`, `onChainMetadata`.

2. Generacion off-chain + hash/metadatos on-chain
- Precondicion: payload valido segun esquema HCE/FHIR.
- Pasos: registrar episodio y consultar salida.
- Resultado esperado: documento guardado off-chain; metadatos on-chain sin estructura clinica.

### 5. Casos de validacion

1. Rol no autorizado
- Entrada: `x-user-role=paciente`.
- Esperado: `403 FORBIDDEN_ROLE`.

2. IPS no informada
- Entrada: sin `x-ips-id` en creacion.
- Esperado: `403 MISSING_IPS`.

3. IPS actor distinta a IPS origen del payload
- Entrada: `x-ips-id` diferente a `prestadorOrigen.identifier[0].value`.
- Esperado: `403 IPS_MISMATCH`.

### 6. Criterios de aceptacion y resultado

- Solo roles autorizados crean episodios: **CUMPLIDO**.
- Episodio con identificador unico: **CUMPLIDO** (`UUID`).
- Validacion contra modelo HCE antes de crear: **CUMPLIDO**.
- Documento generado y almacenado off-chain: **CUMPLIDO**.
- Hash y metadatos listos para registro on-chain: **CUMPLIDO**.
- Sin datos clinicos en blockchain (RNF1): **CUMPLIDO**.

### 7. Evidencia de ejecucion

- Comando de pruebas: `cd backend && npm test`.
- Resultado esperado: suite verde en `test/sprint2-hus.test.js` (casos HU0-E1).
