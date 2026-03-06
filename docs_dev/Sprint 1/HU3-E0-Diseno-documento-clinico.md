# HU3-E0. Diseño: generación de documentos clínicos off-chain

Este documento describe cómo la implementación de la HU3-E0 se apoya en el modelo de HCE y en el mapeo FHIR.

## Fuentes del modelo

| Origen | Archivo | Uso |
|--------|---------|-----|
| Estructura mínima de HCE (RDA urgencias) | `docs_plan/Caracterizacion HCE_sinmapear.csv` | Define campos, tipos, obligatoriedad y catálogos por dato RDA. |
| Proyección a FHIR | `docs_plan/Mapeo_RDA_FHIR_urgencias.md` | Indica recurso FHIR (Patient, Encounter, Condition, Procedure, Medication, etc.) y elementos por campo RDA. |

## Materialización en el backend

- **Tipos y estructura del documento**: `backend/src/hce/hceModel.ts` define las interfaces FHIR-like (FhirPatient, FhirEncounter, FhirCondition, etc.) alineadas con el mapeo.
- **Validación del payload**: `backend/src/hce/hceValidationSchema.ts` (`episodioFhirLikeSchema`) exige que el payload cumpla la forma del modelo antes de ser aceptado; solo ese payload validado se usa para generar el documento.
- **Documento clínico off-chain**: En `documentoClinicoService.ts`, el documento es el propio payload validado (estructura FHIR-like). No se transforma a otro formato; se serializa de forma **canónica** (claves ordenadas) solo para el cálculo del hash, de modo que la integridad sea verificable frente al valor registrado on-chain.

## Cadena de trazabilidad

```
Caracterizacion HCE_sinmapear.csv  →  Mapeo_RDA_FHIR_urgencias.md
        ↓                                        ↓
   Campos RDA                            Recursos FHIR / elementos
        ↓                                        ↓
   hceValidationSchema.ts  +  hceModel.ts  →  EpisodioFhirLikeInput
        ↓
   documentoClinicoService.ts: generarDocumentoClinico(payload)
        ↓
   DocumentoClinicoOffChain (almacenado)  +  hash (SHA-256 canónico)
```

La HU3-E0 queda cubierta cuando el flujo de registro/actualización usa este documento como único representante off-chain del episodio y expone su hash para el registro on-chain (RF1, RF8).
