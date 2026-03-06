import { OpenAPIV3 } from "openapi-types";

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: {
    title: "InterHCE Backend API",
    version: "0.1.0",
    description:
      "API off-chain para validación y manejo de episodios clínicos de urgencias (Épica 0)."
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Desarrollo local"
    }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Estado del servicio",
        description:
          "Permite verificar que el backend de InterHCE Ledger está levantado y respondiendo correctamente.",
        responses: {
          "200": {
            description: "Servicio operativo"
          }
        }
      }
    },
    "/episodes/validate": {
      post: {
        summary: "Validar estructuralmente un episodio clínico de urgencias",
        description:
          "Recibe un episodio clínico de urgencias y lo valida contra el modelo mínimo de HCE definido en la Épica 0. No registra ni modifica datos; solo devuelve si la estructura es válida o cuáles son los errores.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/EpisodioFhirLike"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Episodio válido estructuralmente"
          },
          "400": {
            description: "Errores de validación estructural",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/episodes": {
      post: {
        summary: "Registrar un nuevo episodio clínico (validación incluida)",
        description:
          "Valida la estructura del episodio contra el modelo de HCE, genera el documento clínico off-chain (HU3-E0), lo almacena y devuelve episodeId y documentHash para registro on-chain.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/EpisodioFhirLike"
              }
            }
          }
        },
        responses: {
          "201": {
            description:
              "Episodio válido y aceptado para persistencia off-chain / registro on-chain"
          },
          "400": {
            description: "Errores de validación estructural",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/episodes/{id}": {
      put: {
        summary: "Actualizar un episodio clínico existente (validación incluida)",
        description:
          "Valida la estructura del episodio, actualiza el documento clínico off-chain asociado al episodeId y recalculando el hash (HU3-E0).",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/EpisodioFhirLike"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Episodio actualizado tras pasar validación estructural"
          },
          "400": {
            description: "Errores de validación estructural",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/episodes/{id}/document": {
      get: {
        summary: "Recuperar documento clínico off-chain (HU3-E0)",
        description:
          "Devuelve el documento clínico asociado al episodio, almacenado off-chain. La recuperación debe respetar los permisos establecidos (RF3, RF4); en el prototipo se expone por episodeId.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Identificador único del episodio"
          }
        ],
        responses: {
          "200": {
            description: "Documento clínico off-chain y hash de integridad"
          },
          "404": {
            description: "No existe documento asociado a este episodio"
          }
        }
      }
    }
  },
  components: {
    schemas: {
      EpisodioFhirLike: {
        type: "object",
        properties: {
          patient: {
            $ref: "#/components/schemas/FhirPatient"
          },
          encounter: {
            $ref: "#/components/schemas/FhirEncounter"
          },
          diagnoses: {
            type: "array",
            items: { $ref: "#/components/schemas/FhirCondition" }
          },
          organizations: {
            type: "array",
            items: { $ref: "#/components/schemas/FhirOrganization" }
          }
        },
        required: [
          "patient",
          "encounter",
          "diagnoses"
        ]
      },
      FhirIdentifier: {
        type: "object",
        properties: {
          system: { type: "string", format: "uri" },
          value: { type: "string" }
        },
        required: ["value"]
      },
      FhirCodeableConcept: {
        type: "object",
        properties: {
          coding: {
            type: "array",
            items: {
              type: "object",
              properties: {
                system: { type: "string", format: "uri" },
                code: { type: "string" },
                display: { type: "string" }
              },
              required: ["code"]
            }
          },
          text: { type: "string" }
        }
      },
      FhirReference: {
        type: "object",
        properties: {
          reference: { type: "string" },
          display: { type: "string" }
        }
      },
      FhirPatient: {
        type: "object",
        properties: {
          resourceType: { type: "string", enum: ["Patient"] },
          identifier: {
            type: "array",
            items: { $ref: "#/components/schemas/FhirIdentifier" }
          },
          name: {
            type: "array",
            items: {
              type: "object",
              properties: {
                family: { type: "string" },
                given: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["family", "given"]
            }
          },
          birthDate: { type: "string", format: "date" },
          gender: {
            type: "string",
            enum: ["male", "female", "other", "unknown"]
          }
        },
        required: ["resourceType", "identifier", "name", "birthDate"]
      },
      FhirEncounter: {
        type: "object",
        properties: {
          resourceType: { type: "string", enum: ["Encounter"] },
          status: {
            type: "string",
            enum: ["planned", "in-progress", "finished"]
          },
          class: { $ref: "#/components/schemas/FhirCodeableConcept" },
          type: {
            type: "array",
            items: { $ref: "#/components/schemas/FhirCodeableConcept" }
          },
          subject: { $ref: "#/components/schemas/FhirReference" },
          serviceProvider: { $ref: "#/components/schemas/FhirReference" },
          period: {
            type: "object",
            properties: {
              start: { type: "string", format: "date-time" },
              end: { type: "string", format: "date-time" }
            },
            required: ["start"]
          },
          reasonCode: {
            type: "array",
            items: { $ref: "#/components/schemas/FhirCodeableConcept" }
          }
        },
        required: [
          "resourceType",
          "status",
          "class",
          "subject",
          "serviceProvider",
          "period"
        ]
      },
      FhirCondition: {
        type: "object",
        properties: {
          resourceType: { type: "string", enum: ["Condition"] },
          code: { $ref: "#/components/schemas/FhirCodeableConcept" },
          subject: { $ref: "#/components/schemas/FhirReference" },
          encounter: { $ref: "#/components/schemas/FhirReference" },
          category: {
            type: "array",
            items: { $ref: "#/components/schemas/FhirCodeableConcept" }
          }
        },
        required: ["resourceType", "code", "subject"]
      },
      FhirOrganization: {
        type: "object",
        properties: {
          resourceType: { type: "string", enum: ["Organization"] },
          identifier: {
            type: "array",
            items: { $ref: "#/components/schemas/FhirIdentifier" }
          },
          name: { type: "string" }
        },
        required: ["resourceType", "identifier"]
      },
      ValidationErrorResponse: {
        type: "object",
        properties: {
          code: { type: "string", example: "VALIDATION_ERROR" },
          message: { type: "string" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                issue: { type: "string" }
              }
            }
          }
        },
        required: ["code", "message"]
      }
    }
  }
};

