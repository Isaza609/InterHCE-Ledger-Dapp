## Campos RDA de urgencias propuestos para excluir del paquete de remisión A→B

Este documento parte de la visión de **InterHCE Ledger**:

- La Blockchain solo almacena **metadatos no sensibles e identificadores normativos** necesarios para trazabilidad y control de acceso.
- La plataforma se enfoca en **interoperabilidad durante el traslado de pacientes en urgencias entre IPS**, garantizando continuidad asistencial.
- El **paquete mínimo de remisión A→B** debe contener solo la información **clínica y de identificación estrictamente necesaria** para que la IPS B pueda continuar la atención con seguridad.

Bajo estos criterios, se listan los campos del RDA de urgencias que **no serían necesarios en el mensaje de remisión A→B**, bien porque:

- No aportan a la decisión clínica en urgencias de la IPS B.
- Son datos administrativos/estadísticos.
- Son nombres derivados de códigos ya enviados (y pueden reconstruirse con catálogos locales).
- No aplican al flujo típico de remisión (por ejemplo, eventos de muerte).

---

### 1. Datos sociodemográficos y territoriales

- **1.2 Nombre país nacionalidad**  
  - **Motivo de exclusión**: es texto derivado del **código de país (1.1)**. Para la interoperabilidad, basta con el código ISO; el nombre puede resolverse en la IPS B desde su propio catálogo. No agrega valor clínico inmediato. 

- **13.1 Etnia**  
- **13.2 Comunidad étnica**  
  - **Motivo de exclusión**: son campos de **caracterización poblacional y enfoque diferencial**, relevantes para análisis de equidad y salud pública, pero **no cambian la conducta clínica urgente** en la IPS B. Pueden consultarse en la HCE completa off-chain si se requieren.

- **10. Categoría discapacidad**  
  - **Motivo de exclusión**: clasifica al paciente a nivel funcional, pero la **información clínica relevante** para la atención (diagnósticos específicos, ayudas técnicas, antecedentes) se representa en otros campos. No es imprescindible en el paquete mínimo de remisión.

- **7.2 Nombre ocupación**  
  - **Motivo de exclusión**: es nombre derivado del **código de ocupación (7.1)**. Si se considera relevante para contexto social, el código es suficiente; el nombre puede reconstruirse. 

- **11.2 Nombre país residencia**  
- **12.2 Nombre municipio residencia**  
  - **Motivo de exclusión**: ambos son nombres derivados de códigos territoriales (11.1 y 12.1). Para la remisión, los códigos bastan si se necesitan; el texto puede consultarse localmente.

---

### 2. Nombres derivados de códigos clínicos/administrativos

En varios grupos de datos, el RDA define pares *código obligatorio + nombre derivado*. Para la interoperabilidad en la remisión, **es suficiente con el código estandarizado**; el nombre se puede reconstruir con catálogos en la IPS B.

Se proponen para exclusión del paquete mínimo:

- **15.2 Nombre administrador del plan de beneficios**  
  - **Motivo de exclusión**: es derivado del **código administrador del plan de beneficios (15.1)**. La IPS B puede obtener el nombre desde el catálogo ADRES a partir del código.

- **23.2 Nombre diagnóstico principal ingreso CIE‑10**  
  - **Motivo de exclusión**: con el **código CIE‑10 del diagnóstico principal (23.1)** la IPS B puede recuperar el texto. El envío del nombre es redundante.

- **Todos los “Nombre …” de procedimientos/medicamentos/tecnologías de salud** derivados de:
  - **24.2 Código procedimiento (CUPS)**  
  - **24.2 Código medicamento (ATC / INVIMA)**  
  - **24.2 Código tecnología salud (UDI‑DI u otros estándares)**  
  - **Término diagnóstico CIE‑11 asociado a códigos CIE‑11**  
  - **Motivo de exclusión**: una vez se envía el **código estandarizado**, el nombre puede obtenerse del catálogo correspondiente en la IPS B. Mantener solo códigos reduce tamaño del mensaje y evita inconsistencias de texto.

> Nota: estos campos pueden seguir existiendo en la HCE interna de cada IPS y en el documento clínico off‑chain; simplemente **no son necesarios en el paquete mínimo de remisión on‑chain**.

---

### 3. Datos de incapacidad y licencia

- **45.1 Alcance incapacidad**  
- **45.2 Días incapacidad**  
- **46. Días licencia maternidad**  

**Motivo de exclusión**:

- Son datos **administrativos y laborales** (relación paciente–empleador / asegurador), no determinantes para la **toma de decisiones clínicas en urgencias** en la IPS B.
- En el escenario de traslado entre IPS, “la incapacidad no viaja con el paciente”; lo relevante es el **estado clínico actual, los diagnósticos, procedimientos, medicamentos y el plan de manejo**.
- Pueden tramitarse y consultarse en los sistemas administrativos de cada IPS sin que formen parte del mensaje de remisión.

---

### 4. Parámetros muy desglosados de pauta terapéutica

En medicamentos administrados y ordenados al egreso, el RDA define campos muy específicos sobre frecuencia y duración: 

- **30.1 Duración cantidad**  
- **30.2 Duración unidad**  
- **31.1 Frecuencia cantidad**  
- **31.2 Frecuencia unidad tiempo**  
- **35.1 Número dosis aplicadas**  
- **35.2 Unidad tiempo dosis aplicadas**  

**Motivo de exclusión (del mínimo obligatorio)**:

- Para la continuidad asistencial en la IPS B es esencial conocer:
  - Qué **medicamento/tecnología** se utilizó o se ordena (código estándar).
  - **Fecha** de prescripción/administración.
  - **Vía de administración**.
  - Una **descripción clínica de la pauta** (que puede ir en el documento off‑chain).
- Los campos de frecuencia y duración **hiper‑granulares** pueden manejarse como **opcionales**, siempre que la pauta completa quede documentada en el documento clínico off‑chain referenciado por hash.  
  No son estrictamente necesarios en el paquete mínimo on‑chain de remisión.

---

### 5. Otros campos de contexto o aplicables solo a ciertos desenlaces

- **38.1 / 38.2 Diagnóstico relacionado CIE‑10/CIE‑11**  
- **40.1 / 40.2 Diagnóstico complicación CIE‑10/CIE‑11**  
  - **Motivo de exclusión (como obligatorios)**: enriquecen el contexto clínico, pero para la **interoperabilidad mínima** entre IPS es suficiente con que la IPS B conozca el **diagnóstico principal de ingreso y egreso** que motiva la remisión.  
    Los diagnósticos relacionados y complicaciones pueden enviarse como información adicional cuando existan, pero no son imprescindibles en todos los casos.

- **42.1 Código causa básica muerte**  
- **42.2 Nombre causa básica muerte**  
  - **Motivo de exclusión**: aplican solo cuando el desenlace del episodio es la muerte en urgencias. En el **escenario típico de remisión A→B**, si el paciente es trasladado, no hay muerte en ese momento; por lo tanto, estos campos no forman parte del paquete mínimo de remisión.

---

### 6. Resumen

En la plataforma InterHCE Ledger, el mensaje de remisión A→B debe priorizar:

- **Identificación no sensible del paciente y de las IPS** (códigos normativos, hashes).
- **Datos clínicos esenciales del episodio de urgencias**: motivo de consulta, triage, diagnósticos principales, procedimientos relevantes, medicamentos críticos y estado al momento del traslado.

Los campos listados en este documento se consideran candidatos a **exclusión del paquete mínimo de remisión**, porque:

- No modifican la conducta clínica inmediata en la IPS receptora.
- Son redundantes frente a códigos ya enviados.
- O responden a necesidades administrativas, estadísticas o de otros escenarios diferentes al traslado en urgencias.

