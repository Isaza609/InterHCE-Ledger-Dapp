## HU0-E5. Diseñar la arquitectura on-chain / off-chain del sistema

### 1. Artefactos utilizados para la validación

- **Documento de arquitectura (entregable)**: `docs_plan/Arquitectura-on-chain-off-chain.md`
- **Referencia de requerimientos**: `docs_plan/3. Epicas e HU.md` (Épica 5, HU0-E5)
- **Requerimientos funcionales y no funcionales**: `docs_plan/2. Requerimientos funcionales y no funcionales.md` (RF1, RF2, RF3, RF4, RF5, RF7, RF8, RF9, RF11, RNF1)
- **Documento conceptual**: `docs_plan/1. Documento Conceptual de Funcionamiento.md`
- **Modelo de datos y uso en Blockchain**: `docs_plan/Caracterizacion HCE.csv` (columnas «Uso en Smart Contract», «Estructura en red Blockchain»)

### 2. Verificación de criterios de aceptación

#### 2.1. La arquitectura define claramente qué información se gestiona on-chain y off-chain

- En `Arquitectura-on-chain-off-chain.md`:
  - **Sección 1** establece el principio rector: on-chain solo metadatos no sensibles, identificadores y hashes; off-chain la información clínica completa y estructuras de HCE.
  - **Sección 2** detalla los componentes on-chain (contratos de episodios, permisos, eventos) y explicita que en Blockchain **no** se almacenan nombres, documentos en claro, contenido clínico ni estructuras de HCE.
  - **Sección 6** resume de forma explícita: on-chain (identificadores, códigos normativos, marcas temporales, hash del documento, trazabilidad, permisos); off-chain (datos personales completos, contenido clínico, estructura de HCE).
- La columna **«Estructura en red Blockchain»** de `Caracterizacion HCE.csv` clasifica cada dato como «Metadato on-chain», «Hash on-chain» o «Referencia off-chain», alineado con el documento de arquitectura.

**Conclusión**: La arquitectura define de forma clara qué información se gestiona on-chain y off-chain, cumpliendo este criterio.

#### 2.2. No se almacenan datos clínicos ni estructuras de HCE en la Blockchain

- En `Arquitectura-on-chain-off-chain.md`, **sección 1** y **sección 2.1** indican de manera explícita que **no se almacenan datos clínicos ni estructuras de HCE en la Blockchain**.
- Se especifica que en cadena solo se registran: identificadores, metadatos no sensibles y hashes; el contenido clínico y las estructuras de HCE residen en el backend y en HAPI FHIR (off-chain).
- Los requerimientos **RNF1** y **RF1** establecen que la información clínica completa reside off-chain y que en Ethereum solo se almacenan hashes e identificadores necesarios para la trazabilidad.

**Conclusión**: La arquitectura garantiza que no se almacenan datos clínicos ni estructuras de HCE en la Blockchain, cumpliendo este criterio.

#### 2.3. Los flujos entre DApp, backend, Blockchain y almacenamiento están definidos

- En `Arquitectura-on-chain-off-chain.md`, **sección 4** describe los flujos de interacción:
  - **4.1** Registro de un nuevo episodio: DApp → Backend (validación) → HAPI FHIR (documento off-chain) → cálculo de hash → Blockchain (Smart Contract).
  - **4.2** Actualización de episodio: DApp → Backend → actualización off-chain → nuevo hash → Blockchain.
  - **4.3** Consulta de episodios: DApp → Backend → Smart Contract (metadatos/permisos) + HAPI FHIR (contenido clínico) → DApp.
  - **4.4** Verificación de integridad: hash on-chain vs. hash calculado del documento off-chain.
  - **4.5** Gestión de permisos: DApp → Blockchain (Smart Contract).
- Cada flujo identifica los componentes que intervienen (DApp, Backend, Blockchain, almacenamiento off-chain) y el orden de las interacciones.

**Conclusión**: Los flujos entre DApp, backend, Blockchain y almacenamiento están definidos en el documento de arquitectura, cumpliendo este criterio.

#### 2.4. La arquitectura soporta los flujos funcionales del sistema

- Los flujos documentados en la sección 4 del documento de arquitectura corresponden a los requerimientos funcionales:
  - **RF1** (registro de episodio), **RF2** (actualización), **RF3** y **RF4** (consulta por paciente e IPS), **RF5** (permisos), **RF7** (trazabilidad), **RF8** (verificación de integridad).
- La **sección 5** asigna responsabilidades por capa (DApp, Backend, HAPI FHIR, Smart Contract), de modo que los flujos de las épicas (registro, actualización, consulta, permisos, auditoría) pueden ejecutarse con una separación clara de responsabilidades.
- El documento conceptual y las épicas del proyecto (Épicas 0 a 5) describen los mismos flujos de negocio que la arquitectura implementa a nivel técnico.

**Conclusión**: La arquitectura soporta los flujos funcionales del sistema descritos en los RF y en las épicas, cumpliendo este criterio.

#### 2.5. La arquitectura está documentada y puede ser evaluada

- El entregable **`docs_plan/Arquitectura-on-chain-off-chain.md`** contiene:
  - Principio rector y regla de no almacenar datos clínicos on-chain.
  - Descripción de componentes on-chain (contratos) y off-chain (backend, HAPI FHIR, validación).
  - Flujos de interacción paso a paso.
  - Tabla de responsabilidades por capa.
  - Resumen de qué va on-chain y qué off-chain.
  - Referencias a documentos de planificación (requerimientos, conceptual, CSV, épicas).
- Un revisor puede contrastar cada criterio de aceptación de la HU0-E5 contra las secciones correspondientes del documento y verificar el cumplimiento.

**Conclusión**: La arquitectura está documentada en un único artefacto estructurado y puede ser evaluada frente a los criterios de la HU0-E5, cumpliendo este criterio.

### 3. Resultado de la validación de la HU0-E5

- **Estado de la HU**: **CUMPLIDA** (diseño y documentación).
- **Completitud a nivel desarrollo**: La HU0-E5 tiene como entregable la **documentación de la arquitectura** del sistema on-chain/off-chain. El documento `docs_plan/Arquitectura-on-chain-off-chain.md` define componentes, flujos y responsabilidades, y establece de forma explícita que no se almacenan datos clínicos ni estructuras de HCE en la Blockchain. No requiere implementación en código en esta HU; las HU siguientes (HU1-E5, HU2-E5, etc.) utilizarán esta arquitectura como referencia para el despliegue y la DApp.
- **Evidencia**:
  - `docs_plan/Arquitectura-on-chain-off-chain.md` como entregable principal.
  - Coherencia con `docs_plan/2. Requerimientos funcionales y no funcionales.md`, `docs_plan/1. Documento Conceptual de Funcionamiento.md` y `docs_plan/Caracterizacion HCE.csv` (columnas de uso en Smart Contract y estructura en red Blockchain).

La HU0-E5 queda validada en el contexto de planificación del sistema y sirve como base para las siguientes HU de la Épica 5 (despliegue de infraestructura, implementación de la DApp, etc.).
