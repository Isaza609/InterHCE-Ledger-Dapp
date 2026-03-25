# Arquitectura de la Historia Clínica Electrónica (HCE)

Este documento describe el flujo completo de una HCE en InterHCE Ledger:
creación, cifrado/hashing, almacenamiento on-chain/off-chain, acceso por rol
y verificación de integridad.

---

## 1. Ciclo de vida de un episodio clínico

```mermaid
stateDiagram-v2
    [*] --> Borrador : profesional_salud / admin_ips crea formulario
    Borrador --> Validado : POST /episodes/validate (Zod + modelo HCE)
    Validado --> Creado : POST /episodes
    Creado --> Actualizado : PUT /episodes/:id (nueva versión)
    Actualizado --> Actualizado : nuevas versiones
    Creado --> Accedido : GET /episodes/:id/document (AUDITABLE_ACCESS)
    Actualizado --> Accedido : GET /episodes/:id/document
    Accedido --> Verificado : GET /episodes/:id/integrity (INTEGRITY_CHECK)
    Creado --> PermisoOtorgado : POST /episodes/:id/permissions (PERMISSION_GRANTED)
    PermisoOtorgado --> Accedido : IPS destino consulta con permiso
    PermisoOtorgado --> PermisoRevocado : DELETE /episodes/:id/permissions (PERMISSION_REVOKED)
```

---

## 2. Flujo detallado: creación de episodio

```mermaid
sequenceDiagram
    participant U as Profesional / Admin IPS
    participant FE as Frontend DApp
    participant VAL as validationService (Zod)
    participant DOC as documentoClinicoService
    participant FHIR as HAPI FHIR (off-chain)
    participant TRA as trazabilidadService
    participant BC as InterHCELedger (on-chain)

    U->>FE: Completa formulario HCE (campos RDA-FHIR)
    FE->>VAL: POST /episodes/validate
    VAL-->>FE: {valid: true, data: payload}
    FE->>DOC: POST /episodes
    DOC->>DOC: generarDocumentoClinico(payload)
    DOC->>DOC: calcularHashDocumento(doc) → SHA-256
    DOC->>FHIR: persistEpisodeToFhir(doc, episodeId)
    Note over FHIR: Patient, Encounter, Condition,\nObservation, Procedure, DocumentReference
    DOC-->>TRA: {episodeId, documentHash, patientIdentifierHash}
    TRA->>TRA: registrarEventoTrazabilidad(EPISODE_CREATED)
    TRA->>BC: enviarTransaccion(episodeIdHash, documentHash, eventIdHash)
    BC-->>TRA: {txHash, blockNumber, confirmationMs}
    TRA-->>FE: {episodeId, documentHash, evidence}
```

---

## 3. Almacenamiento on-chain vs. off-chain

| Dato | Dónde se guarda | Por qué |
|---|---|---|
| Documento clínico completo (diagnóstico, medicamentos, signos vitales) | Off-chain — HAPI FHIR / almacén en memoria | Dato sensible, prohibido exponer en blockchain |
| Hash SHA-256 del documento | On-chain — evento `EpisodioRegistrado` | Permite verificar integridad sin exponer el contenido |
| `episodeIdHash` (hash de UUID) | On-chain | Referencia no reversible al episodio |
| `eventIdHash` (hash de UUID del evento) | On-chain | Trazabilidad del evento de urgencias |
| `patientIdentifierHash` (hash del número de documento) | On-chain | Seudonimización; no almacena nombre ni CC en claro |
| Versión del episodio | On-chain | Control de cambios auditable |
| Metadatos FHIR (Patient, Encounter, Condition…) | Off-chain — HAPI FHIR | Estándar HL7 FHIR para interoperabilidad clínica |
| Lifecycle del episodio (versiones, actores) | Off-chain — `backend/data/episodio-lifecycle.json` | Estado operativo; no requiere inmutabilidad blockchain |
| Permisos entre IPS | Off-chain — `backend/data/episodio-permisos.json` + on-chain evento | Estado en JSON + evidencia en contrato |

---

## 4. Acceso por rol

```mermaid
flowchart TD
    ACT[Actor autenticado] --> PERM{¿Rol autorizado?}

    PERM -->|profesional_salud / admin_ips de la IPS propietaria| OWNER[Acceso completo\nlectura + escritura]
    PERM -->|admin_ips de IPS con permiso vigente| GRANTED[Acceso de lectura\n+ AUDITABLE_ACCESS registrado]
    PERM -->|auditor| AUDIT[Solo lectura\ntrazabilidad + integridad]
    PERM -->|paciente| PATIENT[Solo sus episodios\nsin documento clínico completo]
    PERM -->|sin autorización| DENY[403 Forbidden]

    OWNER --> DOC[(HAPI FHIR\ndocumento off-chain)]
    GRANTED --> DOC
    AUDIT --> TRACE[(trazabilidad\neventos on-chain)]
    PATIENT --> META[metadatos\ndel episodio]
```

---

## 5. Verificación de integridad

```mermaid
sequenceDiagram
    participant U as Usuario autorizado
    participant API as Backend
    participant DOC as documentoClinicoService
    participant TRA as trazabilidadService

    U->>API: GET /episodes/:id/integrity
    API->>DOC: recuperarDocumentoClinico(episodeId)
    DOC-->>API: documento off-chain
    API->>DOC: calcularHashDocumento(documento) → hashActual
    API->>TRA: obtenerUltimoHashRegistradoOnChain(episodeId) → hashOnChain
    API->>TRA: registrarEventoTrazabilidad(INTEGRITY_CHECK)
    API-->>U: {hashActual, hashOnChain, integro: hashActual === hashOnChain}
```

La verificación compara el hash SHA-256 calculado en tiempo real del documento
off-chain frente al último hash registrado en trazabilidad (on-chain en modo real,
local en modo mock).

---

## 6. Modelo de datos HCE (estructura FHIR-like)

El episodio sigue el mapeo `RDA-FHIR` definido en `docs/modelo-hce/`.

```
EpisodioFhirLikeInput
├── patient          (Patient FHIR)
│   ├── identifier   (CC u otro tipo de documento)
│   ├── name, birthDate, gender
│   └── extension    (nationality, genderIdentity, ethnicity, disability, occupation)
├── cobertura        (Coverage FHIR — EPS/aseguradora)
├── encuentro        (Encounter FHIR)
│   ├── class        (urgencias)
│   ├── period       (inicio/fin de atención)
│   ├── extension    (vía de ingreso, hora de triage)
│   └── reasonCode   (motivo de consulta RDA)
├── condiciones[]    (Condition FHIR — diagnósticos CIE-10)
├── observaciones[]  (Observation FHIR — signos vitales, scores)
├── procedimientos[] (Procedure FHIR — intervenciones)
└── prestadorOrigen  (Organization FHIR — IPS que registra)
```

Validación ejecutada por `hceValidationSchema.ts` (Zod) en `POST /episodes/validate`.

---

## 7. Archivos clave

| Propósito | Archivo |
|---|---|
| Modelo de datos HCE | `backend/src/hce/hceModel.ts` |
| Validación Zod | `backend/src/hce/hceValidationSchema.ts` |
| Generación y hash del documento | `backend/src/hce/documentoClinicoService.ts` |
| Persistencia FHIR | `backend/src/hce/fhirStorageService.ts` |
| Lifecycle y versiones | `backend/src/hce/episodioLifecycleService.ts` |
| Permisos entre IPS | `backend/src/hce/permisosEpisodioService.ts` |
| Trazabilidad y hash on-chain | `backend/src/hce/trazabilidadService.ts` |
| Contrato on-chain | `contracts/contracts/InterHCELedger.sol` |
