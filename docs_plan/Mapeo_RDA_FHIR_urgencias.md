## Mapeo de estructura mínima RDA → HL7 FHIR (escenario urgencias InterHCE Ledger)

Este documento define como se mapean los campos del **RDA de urgencias completo** contenidos en `Caracterizacion_RDA_Completa.csv` a recursos **HL7 FHIR** para:

- Implementación clínica off-chain en **HAPI FHIR** (backend).
- Diseño de modelos de datos en el backend (`hceModel.ts`, validaciones).
- Diseño de pantallas y flujos en la DApp (frontend).

La version vigente del modelo tecnico del proyecto toma este documento como referencia canonica y expresa el episodio de urgencias como un agregado FHIR-like compuesto, al menos, por `Patient`, `Coverage`, `Encounter`, `Organization`, `Condition`, `Practitioner`, `Observation`, `Procedure`, `Medication*`, `ServiceRequest` y `DocumentReference`.

Convención en las tablas:

- **Recurso FHIR**: recurso principal donde se modela el dato.
- **Elemento FHIR**: path dentro del recurso.
- **Card.**: cardinalidad aproximada (por episodio de urgencias).
- **On-chain / off-chain**:
  - `on-chain`: se usa en metadatos / identificadores del Smart Contract.
  - `off-chain`: va en recursos FHIR en HAPI.

---

### 1. Identificación de la IPS y administrador del plan de beneficios

**Objetivo**: identificar IPS origen/destino y entidad responsable del plan de beneficios.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 16. Código del prestador de servicios de salud (REPS) | `Organization` (IPS origen) | `identifier` (system = REPS, value = código) | 1..1 | **on-chain + off-chain** | IPS que crea el episodio. Referenciada desde `Encounter.serviceProvider`. |
| 15.1 Código administrador del plan de beneficios (ADRES) | `Coverage` o `Patient` / `Encounter` (vía `coverage`) | `Coverage.payor.identifier` (system = ADRES) | 0..1 | **on-chain + off-chain** | Identificador de EPS / administradora del plan; puede no ser crítico clínicamente pero sí para trazabilidad contractual. |
| 44. Código prestador destino (REPS) | `Organization` (IPS destino) | `identifier` (system = REPS, value = código) | 0..1 | **on-chain + off-chain** | IPS receptora de la remisión; se referencia desde `Encounter.serviceProvider` en el episodio en B o desde un `ServiceRequest`. |

---

### 2. Identificación del paciente

**Objetivo**: paciente seudonimizado pero interoperable.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 2.1 Tipo de documento | `Patient` | `identifier.type` (coding de tipo doc) | 1..1 | **on-chain (tipo)** + off-chain | El valor del tipo (CC, TI, etc.) puede formar parte del seudónimo y metadatos en cadena. |
| 2.2 Número de documento (hash) | `Patient` | `identifier.value` (valor seudonimizado) | 1..1 | **on-chain (hash)** + off-chain | No se guarda el número real en claro. El hash puede ser el identificador técnico usado en la DApp. |
| 3.1 Primer apellido | `Patient` | `name.family` | 1..1 | off-chain | Información personal, solo en FHIR. |
| 3.2 Segundo apellido | `Patient` | `name.family` (segundo valor o extensión) | 0..1 | off-chain | Opcional. |
| 3.3 Primer nombre | `Patient` | `name.given[0]` | 1..1 | off-chain | |
| 3.4 Segundo nombre | `Patient` | `name.given[1]` | 0..1 | off-chain | |
| 4. Fecha y hora de nacimiento | `Patient` | `birthDate` (solo fecha) o extensión con hora | 1..1 | off-chain | FHIR base maneja fecha; la hora puede ir en una extensión si se considera necesario. |
| 1.1 Código país nacionalidad | `Patient` | `extension` (nacionalidad) o `Patient.extension[“nationality”]` | 0..1 | on-chain (código) + off-chain | Se puede modelar con una extensión usando ISO-3166-1. |
| 5. Sexo biológico | `Patient` | `gender` | 1..1 | on-chain + off-chain | Valores típicos `male`/`female`/etc., mapeados desde M/F. |
| 6. Identidad de género | `Patient` | `extension` (gender identity) | 0..1 | off-chain | Usar extensión estándar si se requiere. |
| 7.1 Código ocupación | `Patient` | `occupation` mediante extensión o `Patient.extension` | 0..1 | on-chain (si se requiere) + off-chain | No existe campo directo, se usa extensión con catálogo DANE-CUOC. |
| 11.1 Código país residencia | `Patient` | `address.country` (código ISO) | 1..1 | on-chain + off-chain | |
| 12.1 Código municipio residencia | `Patient` | `address.extension` (código DANE municipio) | 1..1 | on-chain + off-chain | Requiere extensión local. |
| 14. Zona territorial | `Patient` | `address.extension` (zona: urbano/rural/disperso) | 1..1 | on-chain + off-chain | Extensión con código simple. |

---

### 3. Datos de la urgencia / encuentro clínico

**Objetivo**: modelar el episodio de urgencias y contexto de atención.

Se usará como recurso principal **`Encounter`** para el episodio de urgencias.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 17. Fecha/hora inicio atención | `Encounter` | `period.start` | 1..1 | on-chain + off-chain | Marca temporal inicial del episodio. |
| 43. Fecha/hora fin atención | `Encounter` | `period.end` | 0..1 (1..1 en RDA) | on-chain + off-chain | Puede ausentarse mientras el episodio está “abierto” pero RDA lo exige al cierre. |
| 18.1 Modalidad tecnología en salud | `Encounter` | `class` o `type` (coding) | 1..1 | on-chain + off-chain | Según catálogo Minsalud (ej. consulta, procedimiento, etc.). |
| 18.2 Grupo de servicios | `Encounter` | `serviceType` (coding) | 1..1 | on-chain + off-chain | Grupo de servicios de urgencias. |
| 19. Entorno atención | `Encounter` | `class` (ej. `IMP`/`AMB`) o extensión | 1..1 | on-chain + off-chain | Intramural / extramural. |
| 20. Vía ingreso usuario | `Encounter` | `extension` o `type` | 1..1 | on-chain + off-chain | Catálogo de vías de ingreso (propio o extensión). |
| 21. Causa que motiva la atención | `Encounter` | `reasonCode` (coding) | 1..1 | on-chain + off-chain | Razón codificada de consulta/urgencia. |
| 22 Triage - Fecha y hora | `Encounter` | `extension` para triage.time o `Encounter.participant`/`Encounter.diagnosis` extension | 1..1 | off-chain (opcional on-chain) | Se puede modelar como extensión específica de triage. |
| 22 Triage - Clasificación | `Encounter` | `priority` (coding) o extensión de triage level | 1..1 | on-chain + off-chain | Niveles I–V. Puede mapearse a `Encounter.priority` con código local. |

---

### 4. Diagnóstico principal de ingreso

**Objetivo**: representar el diagnóstico motivo del ingreso en urgencias.

Se usará **`Condition`** para diagnósticos.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 23.1 Código diagnóstico principal ingreso CIE-10 | `Condition` (diagnóstico ingreso) | `code.coding` (system = CIE-10) | 1..1 | on-chain + off-chain | `Condition.encounter` referencia al `Encounter` de urgencias. |
| 23.3 Tipo diagnóstico principal ingreso CIE-10 | `Condition` | `category` o extensión (principal/relacionado/complicación) | 1..1 | on-chain + off-chain (si se requiere) | Puede usarse un `CodeableConcept` en `category`. |
| Diagnóstico principal ingreso CIE-11 (opcional) | `Condition` | `code.coding` adicional (system = CIE-11) | 0..1 | on-chain + off-chain | Codificación alternativa en CIE-11. |

---

### 5. Antecedentes de salud y factores de riesgo

**Objetivo**: antecedentes relevantes para la urgencia.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 47.1 Código alergia | `AllergyIntolerance` | `code.coding` | 0..* | off-chain (posible on-chain código) | Alergias previas relevantes; se asocian al `Patient`. |
| 47.3 Condición salud familiar CIE-10/CIE-11 | `FamilyMemberHistory` | `condition.code.coding` | 0..* | off-chain | Antecedentes familiares. |
| 47.4 Parentesco antecedente familiar | `FamilyMemberHistory` | `relationship` (coding) | 0..1 | off-chain | |
| 48.1 Tipo de factor riesgo | `Observation` o `Condition` | `code` o `category` según modelado | 0..* | off-chain | Factores de riesgo (tabaquismo, etc.) como `Observation` con `Observation.subject = Patient`. |

---

### 6. Procedimientos realizados durante la urgencia

**Objetivo**: registrar procedimientos CUPS realizados en el episodio.

Se usará **`Procedure`**.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 24.1 Tipo tecnología salud | `Procedure` | `category` (coding) | 1..1 por procedimiento | off-chain (posible on-chain tipo) | Tipo según catálogo Minsalud. |
| 24.2 Código procedimiento (CUPS) | `Procedure` | `code.coding` (system = CUPS) | 1..1 | on-chain + off-chain | Identificador principal del procedimiento. |
| 25 Finalidad tecnología | `Procedure` | `reasonCode` o extensión de finalidad | 1..1 | off-chain | Catálogo de finalidades. |
| 33 Fecha realización procedimiento | `Procedure` | `performedDateTime` | 1..1 | off-chain (posible on-chain timestamp) | |
| 36.1 Tipo ID profesional | `Practitioner` | `identifier.type` | 1..1 | on-chain + off-chain | Profesional que realiza el procedimiento. |
| 36.2 Identificación profesional | `Practitioner` | `identifier.value` | 1..1 | off-chain (on-chain solo hash/alias) | Se relaciona a `Procedure.performer.actor`. |
| 39.1 Fecha resultado valoración | `Observation` | `effectiveDateTime` | 0..* | off-chain | Resultado asociado a procedimiento/valoración. |
| 39.2 Instrumento medición | `Observation` | `method` o `device.display` | 0..1 | off-chain | Texto del instrumento. |
| 39.3 Código parámetro resultado | `Observation` | `code.coding` | 0..1 | off-chain | Parámetro medido. |
| 39.4 Valor resultado | `Observation` | `value[x]` (ej. `valueString`/`Quantity`) | 0..1 | off-chain | Resultado numérico o textual. |

---

### 7. Medicamentos administrados durante la urgencia

**Objetivo**: registrar medicamentos efectivamente administrados.

Se usarán principalmente **`Medication`** + **`MedicationAdministration`**.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 24.1 Tipo tecnología salud | `Medication` o `MedicationAdministration` | `Medication.category` o `MedicationAdministration.category` | 1..1 | off-chain | Clasificación del tipo de tecnología (medicamento). |
| 24.2 Código medicamento (ATC / INVIMA) | `Medication` | `code.coding` | 1..1 | on-chain + off-chain | Identificador normalizado del fármaco. |
| 26 Descripción común medicamento | `Medication` | `code.text` o `extension` | 0..1 | off-chain | Descripción textual adicional. |
| 27 Fecha prescripción | `MedicationRequest` | `authoredOn` | 0..* | off-chain | Si se quiere modelar la orden de medicación además de la administración. |
| 28.1 Dosis prescrita | `MedicationRequest.dosageInstruction` | `doseAndRate.dose[x]` | 0..1 | off-chain | Texto o cantidad de la orden. |
| 28.2 Unidad medida dosis | `MedicationRequest.dosageInstruction` | `doseAndRate.doseQuantity.unit` | 0..1 | off-chain | Unidad. |
| 29 Vía administración | `MedicationAdministration` | `route` (coding) | 1..1 | on-chain + off-chain | Catálogo de vías. |
| 32.1 Dosis administrada | `MedicationAdministration.dosage` | `dose` | 0..1 | off-chain | Cantidad administrada real. |
| 32.2 Unidad dosis administrada | `MedicationAdministration.dosage.dose` | `unit` | 0..1 | off-chain | Unidad de la dosis. |
| 33 Fecha administración medicamento | `MedicationAdministration` | `effectiveDateTime` | 1..1 | on-chain + off-chain | Momento de administración. |
| 36.1 Tipo ID administrador | `Practitioner` | `identifier.type` | 1..1 | on-chain + off-chain | Profesional que administra. |
| 36.2 ID administrador | `Practitioner` | `identifier.value` | 1..1 | off-chain | Asociado mediante `MedicationAdministration.performer.actor`. |
| 25 Finalidad tecnología (medicamento) | `MedicationRequest` o `MedicationAdministration` | `reasonCode` o extensión | 1..1 | off-chain | Razón de uso del medicamento (ej. analgesia, profilaxis). |

---

### 8. Otras tecnologías administradas (p. ej. dispositivos)

**Objetivo**: registrar administración de dispositivos u otras tecnologías distintas de medicamentos.

Posibles recursos: **`Device`**, **`DeviceUseStatement`** o **`Procedure`** según la naturaleza.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 24.1 Tipo tecnología salud | `Device` / `Procedure` | `type` o `category` | 1..1 | off-chain | Tipo de dispositivo/tecnología. |
| 24.2 Código tecnología salud (UDI-DI) | `Device` | `udiCarrier.deviceIdentifier` o `identifier` | 1..1 | on-chain + off-chain | UDI-DI u otro identificador estándar. |
| 27 Fecha prescripción | `ServiceRequest` o `Procedure` | `authoredOn` o `performedDateTime` | 1..1 | off-chain | |
| 33 Fecha administración | `DeviceUseStatement` o `Procedure` | `timingDateTime` o `performedDateTime` | 1..1 | off-chain | Momento de uso/aplicación. |
| 36.1 Tipo ID aplicador | `Practitioner` | `identifier.type` | 1..1 | on-chain + off-chain | |
| 36.2 ID aplicador | `Practitioner` | `identifier.value` | 1..1 | off-chain | |
| 25 Finalidad tecnología | `Procedure` / `ServiceRequest` | `reasonCode` o extensión | 1..1 | off-chain | Finalidad clínica de la tecnología. |

---

### 9. Diagnósticos de egreso y condición/destino

**Objetivo**: representar diagnóstico de salida y destino del paciente.

Se seguirá usando **`Condition`** + `Encounter`.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 37.1 Código diagnóstico principal egreso CIE-10 | `Condition` (diagnóstico egreso) | `code.coding` (CIE-10) | 1..1 | on-chain + off-chain | Nueva `Condition` asociada al `Encounter`. |
| 37.3 Tipo diagnóstico principal egreso CIE-10 | `Condition` | `category` o extensión | 1..1 | off-chain | Tipo de diagnóstico de egreso. |
| Diagnóstico egreso CIE-11 (opcional) | `Condition` | `code.coding` adicional (CIE-11) | 0..1 | off-chain | Codificación alternativa. |
| 41 Condición y destino egreso | `Encounter` | `status` / `class` / `hospitalization.dischargeDisposition` | 1..1 | on-chain + off-chain | Mapeado al campo de disposición de alta (`dischargeDisposition`). |

---

### 10. Medicamentos ordenados al egreso

**Objetivo**: representar medicación para continuar después de la urgencia.

Principal recurso: **`MedicationRequest`**.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 24.1 Tipo tecnología salud | `MedicationRequest` / `Medication` | `category` | 1..1 | off-chain | Medicamento. |
| 24.2 Código medicamento | `Medication` | `code.coding` | 1..1 | on-chain + off-chain | ATC/INVIMA. |
| 26 Descripción medicamento | `Medication` | `code.text` | 0..1 | off-chain | texto común. |
| 27 Fecha prescripción | `MedicationRequest` | `authoredOn` | 1..1 | off-chain | |
| 28.1 Dosis ordenada | `MedicationRequest.dosageInstruction` | `doseAndRate.dose[x]` | 0..1 | off-chain | |
| 28.2 Unidad dosis | `MedicationRequest.dosageInstruction.doseAndRate.doseQuantity` | `unit` | 0..1 | off-chain | |
| 29 Vía administración | `MedicationRequest.dosageInstruction` | `route` | 1..1 | off-chain | |
| 25 Finalidad | `MedicationRequest` | `reasonCode` | 1..1 | off-chain | Finalidad de la orden. |

---

### 11. Procedimientos y otras tecnologías ordenadas al egreso

**Objetivo**: representar órdenes de procedimientos y tecnologías posteriores a la urgencia.

Recursos clave: **`ServiceRequest`**, `Procedure`, `Device`.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 24.1 Tipo tecnología salud | `ServiceRequest` | `category` | 1..1 | off-chain | |
| 24.2 Código procedimiento (CUPS) | `ServiceRequest` | `code.coding` (CUPS) | 1..1 | on-chain + off-chain | Orden futura. |
| 25 Finalidad | `ServiceRequest` | `reasonCode` | 1..1 | off-chain | |
| 27 Fecha prescripción | `ServiceRequest` | `authoredOn` | 1..1 | off-chain | |
| (Otras tecnologías ordenadas) 24.2 Código tecnología salud | `ServiceRequest` / `DeviceRequest` | `code.coding` o `code` | 1..1 | on-chain + off-chain | Para dispositivos/otras tecnologías. |
| 27 Fecha prescripción | `ServiceRequest` / `DeviceRequest` | `authoredOn` | 1..1 | off-chain | |
| 25 Finalidad (otras tecnologías) | `ServiceRequest` / `DeviceRequest` | `reasonCode` | 1..1 | off-chain | |

---

### 12. Profesional que da el alta y documento soporte

**Objetivo**: identificar al profesional responsable del alta y el documento clínico firmado.

| Campo RDA | Recurso FHIR | Elemento FHIR | Card. | On-chain / off-chain | Nota |
| --- | --- | --- | --- | --- | --- |
| 49.1 Tipo documento THS | `Practitioner` | `identifier.type` | 1..1 | on-chain + off-chain | Profesional que da el alta. |
| 49.2 Número documento THS | `Practitioner` | `identifier.value` | 1..1 | off-chain (on-chain solo alias/hash) | Se referencia desde `Encounter.participant.individual`. |
| Nombre documento PDF | `DocumentReference` | `content.attachment.title` / `content.attachment.url` | 1..1 | off-chain (hash en on-chain) | El hash del binario se registra on-chain como parte del episodio; el PDF se almacena off-chain. |

---

### 13. Resumen para implementación

- **Recurso eje del episodio de urgencias**: `Encounter` (con `Patient`, `Organization` origen/destino, fechas, triage, motivo, condición/destino egreso).
- **Diagnósticos**: `Condition` (ingreso y egreso, CIE-10/11).
- **Procedimientos y tecnologías**: `Procedure`, `Observation`, `Device`/`DeviceUseStatement`, `ServiceRequest`.
- **Medicamentos**:
  - En urgencias: `Medication` + `MedicationAdministration` (+ opcional `MedicationRequest` para la orden).
  - Al egreso: `Medication` + `MedicationRequest`.
- **Profesionales e IPS**: `Practitioner`, `Organization`, enlazados a `Encounter`, `Procedure`, `MedicationAdministration`, etc.
- **Documento soporte completo**: `DocumentReference` apuntando al PDF off-chain; su **hash** y metadatos se registran on-chain según el modelo de InterHCE Ledger.

Este mapeo debe servir como base para:

- Definir los **perfiles FHIR** concretos (constraints y extensiones).
- Diseñar el **modelo de dominio del backend** (`hceModel`) alineado con estos recursos.
- Guiar las **pantallas y formularios de la DApp** basados en recursos/relaciones FHIR.
