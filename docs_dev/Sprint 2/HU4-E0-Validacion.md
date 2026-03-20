## HU4-E0. Asegurar que el modelo de HCE no se almacene en la Blockchain

### 1. Artefactos utilizados para la validacion

- **Definicion de la HU**: `docs_plan/3. Epicas e HU.md` (Epica 0, HU4-E0).
- **Requerimientos asociados**: `docs_plan/2. Requerimientos funcionales y no funcionales.md` (RF1, RF8, RNF1).
- **Arquitectura on-chain/off-chain**: `docs/arquitectura/README.md`.
- **Implementacion backend**:
  - `backend/src/hce/documentoClinicoService.ts` (proyeccion de metadatos on-chain sin estructura clinica).
  - `backend/src/routes/episodes.ts` (endpoint `GET /episodes/:id/onchain-metadata`).
  - `backend/src/docs/openapi.ts` (documentacion del endpoint HU4-E0).
- **Pruebas automatizadas**:
  - `backend/test/hu4-e0.test.js`.
  - Ejecucion: `cd backend && npm test`.

### 2. Verificacion de criterios de aceptacion

#### 2.1. El contrato inteligente no almacena estructuras de HCE ni datos clinicos

- En el estado actual del repositorio no hay contratos implementados en `contracts/contracts/` (solo scaffold).
- La capa backend define explicitamente una proyeccion on-chain (`RegistroOnChainMetadata`) que excluye el documento clinico.

**Conclusion**: El diseno e implementacion actual impiden que la estructura HCE sea tratada como carga on-chain.

#### 2.2. En Blockchain solo se registran hashes y metadatos no sensibles

- `generarRegistroOnChainMetadata` expone solo:
  - `episodeId`
  - `documentHash`
  - `patientIdentifierHash` (hash SHA-256)
  - `prestadorOrigenHash` (hash SHA-256)
  - `createdAt`
- No se retornan `patient`, `encounter`, diagnosticos ni campos clinicos del payload.

**Conclusion**: El payload preparado para on-chain contiene unicamente hash y metadatos no sensibles.

#### 2.3. El modelo de HCE se usa exclusivamente como referencia off-chain

- El modelo HCE/FHIR se valida y persiste en backend off-chain (`hceValidationSchema.ts`, `documentoClinicoService.ts`, HAPI FHIR/memoria).
- El nuevo endpoint HU4-E0 deriva metadatos desde el documento off-chain sin exponer su estructura.

**Conclusion**: El uso del modelo HCE permanece en la capa off-chain.

#### 2.4. Cumplimiento de privacidad (RNF1) y separacion verificable

- RNF1 exige no almacenar informacion clinica en Blockchain y usar solo hashes/metadatos no sensibles.
- La separacion se vuelve verificable con:
  - Tipo `RegistroOnChainMetadata`.
  - Endpoint dedicado `/episodes/:id/onchain-metadata`.
  - Pruebas automatizadas que validan ausencia de estructura clinica.

**Conclusion**: La separacion on-chain/off-chain queda implementada, documentada y verificable.

### 3. Resultado de la validacion de la HU4-E0

- **Estado de la HU**: **CUMPLIDA** (Sprint 2, implementacion backend).
- **Evidencia tecnica**:
  - Se implemento una capa explicita de metadatos on-chain sin datos clinicos.
  - Se agrego endpoint y documentacion OpenAPI para inspeccion funcional.
  - Se agregaron pruebas que validan exclusividad de hashes/metadatos y exclusion de estructura HCE.
- **Evidencia de ejecucion**:
  - Comando: `cd backend && npm test`
  - Resultado: **OK** (suite `test/hu4-e0.test.js` aprobada).

### 4. Flujo implementado (resumen)

1. Se registra/actualiza un episodio y se genera su documento clinico off-chain (HU3-E0).
2. Se calcula `documentHash` sobre serializacion canonica.
3. Para uso on-chain se consulta `GET /episodes/:id/onchain-metadata`.
4. La respuesta contiene solo hashes y metadatos no sensibles, sin estructura clinica.
