## HU1-E0. Formalizar el modelo de HCE como esquema de referencia del sistema

### 1. Artefactos utilizados para la validacion

- **Caracterizacion normativa vigente**: `docs_plan/Caracterizacion_RDA_Completa.csv`.
- **Mapeo RDA -> FHIR**: `docs_plan/Mapeo_RDA_FHIR_urgencias.md`.
- **Modelo tecnico backend**: `backend/src/hce/hceModel.ts`.
- **Esquema ejecutable de validacion**: `backend/src/hce/hceValidationSchema.ts`.
- **Tipos compartidos con frontend**: `frontend/src/shared/types/episodio.ts`.

### 2. Verificacion de criterios de aceptacion

#### 2.1. Esquema formal claramente definido

- El esquema de referencia ya no parte de la caracterizacion reducida, sino del **RDA completo de urgencias** consignado en `Caracterizacion_RDA_Completa.csv`.
- El modelo se formaliza en tres niveles consistentes:
  - estructura tabular normativa;
  - mapeo explicito a recursos y elementos HL7 FHIR;
  - implementacion tipada y ejecutable en backend/frontend.

**Conclusion**: el sistema cuenta con un esquema formal, unico y alineado con la version completa del RDA.

#### 2.2. Campos obligatorios, opcionales y condicionales

- `Caracterizacion_RDA_Completa.csv` define obligatoriedad por dato.
- `Mapeo_RDA_FHIR_urgencias.md` deja trazado el recurso FHIR y la cardinalidad objetivo.
- `hceValidationSchema.ts` materializa esa obligatoriedad en validaciones Zod:
  - obligatorios generales: identificacion del paciente, cobertura, sociodemograficos base, contexto del encuentro y diagnostico de ingreso;
  - obligatorios al cierre: diagnostico de egreso, destino egreso, prestador destino, profesional alta y documento soporte;
  - condicionales: comunidad etnica, causa basica de muerte y demas campos sujetos a contexto clinico.

**Conclusion**: la HU explicita y ejecuta la distincion entre campos obligatorios, opcionales y condicionales.

#### 2.3. Mapeo a FHIR documentado y aplicado en codigo

- La HU incorpora explicitamente que la caracterizacion **se mapeo a FHIR**.
- El agregado `EpisodioClinicoUrgencias` incluye recursos FHIR-like para:
  - `Patient` y extensiones para nacionalidad, ocupacion, identidad de genero, etnia, discapacidad y residencia;
  - `Coverage` para administrador del plan de beneficios;
  - `Encounter` para fechas, contexto de urgencias, triage y destino de egreso;
  - `Condition` para diagnosticos de ingreso/egreso, relacionados, complicaciones y causa basica de muerte;
  - `Practitioner`, `Observation`, `Procedure`, `Medication*`, `ServiceRequest` y `DocumentReference` para el resto de la caracterizacion.

**Conclusion**: la HU no solo describe el mapeo a FHIR, sino que lo deja reflejado en el modelo tecnico y en la validacion ejecutable.

#### 2.4. Tipos de datos y reglas basicas de validacion

- Se validan formatos de fechas, tipos de documento, identificadores, codigos y estructuras FHIR-like.
- Se agregan reglas clinico-funcionales relevantes:
  - fin de atencion posterior al inicio;
  - cierre obligatorio cuando el episodio esta finalizado;
  - comunidad etnica obligatoria cuando la etnia reportada no es "Ninguno".

**Conclusion**: el esquema permite validacion estructural previa al registro y responde a la nueva caracterizacion.

#### 2.5. Disponibilidad para backend y DApp

- El backend usa el esquema como contrato de entrada (`episodioFhirLikeSchema`).
- El frontend usa el mismo contrato compartido (`frontend/src/shared/types/episodio.ts`) y el formulario principal ya captura los campos obligatorios del RDA completo para el flujo base.

**Conclusion**: el esquema actualizado es consumible y compartido por los componentes del sistema.

### 3. Resultado de la validacion de la HU1-E0

- **Estado de la HU**: CUMPLIDA.
- **Alcance actualizado**: la HU queda validada con la caracterizacion completa del RDA de urgencias y con su mapeo explicito a HL7 FHIR.
- **Evidencia principal**:
  - `docs_plan/Caracterizacion_RDA_Completa.csv`
  - `docs_plan/Mapeo_RDA_FHIR_urgencias.md`
  - `backend/src/hce/hceModel.ts`
  - `backend/src/hce/hceValidationSchema.ts`
  - `frontend/src/shared/types/episodio.ts`

### 4. Nota de validacion

La validacion de esta HU debe entenderse desde ahora sobre la **caracterizacion completa** y no sobre la version reducida inicialmente usada en el proyecto. Cualquier referencia anterior a `Caracterizacion HCE.csv` o a una estructura minima debe considerarse reemplazada por `Caracterizacion_RDA_Completa.csv` y por su mapeo FHIR asociado.
