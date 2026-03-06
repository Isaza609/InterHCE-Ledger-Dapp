import { randomUUID } from "crypto";
import { Router } from "express";
import {
  almacenarDocumentoClinico,
  buscarEpisodiosPorIdentificadorPaciente,
  generarDocumentoClinico,
  listarTodosLosEpisodios,
  recuperarDocumentoClinico
} from "../hce/documentoClinicoService";
import { validateEpisodioClinico } from "../hce/validationService";

export const episodesRouter = Router();

/** Lista todos los episodios registrados. GET /episodes/list */
episodesRouter.get("/list", async (_req, res) => {
  try {
    const episodios = await listarTodosLosEpisodios();
    return res.status(200).json({
      code: "OK",
      message: `Total: ${episodios.length} episodio(s).`,
      episodes: episodios
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al listar";
    return res.status(502).json({
      code: "LIST_ERROR",
      message: "No se pudieron listar los episodios.",
      details: message
    });
  }
});

/** Busca episodios por identificador del paciente (ej. cédula). GET /episodes?patientIdentifier=123 */
episodesRouter.get("/", async (req, res) => {
  const patientIdentifier = req.query.patientIdentifier;
  if (typeof patientIdentifier !== "string" || !patientIdentifier.trim()) {
    return res.status(400).json({
      code: "MISSING_PARAM",
      message: "Indique el identificador del paciente (cédula/documento) en la query: ?patientIdentifier=valor"
    });
  }
  try {
    const episodios = await buscarEpisodiosPorIdentificadorPaciente(patientIdentifier.trim());
    return res.status(200).json({
      code: "OK",
      message: episodios.length
        ? `Se encontraron ${episodios.length} episodio(s).`
        : "No se encontraron episodios para este paciente.",
      episodes: episodios
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al buscar";
    return res.status(502).json({
      code: "SEARCH_ERROR",
      message: "No se pudo buscar por identificador del paciente.",
      details: message
    });
  }
});

episodesRouter.post("/validate", (req, res) => {
  const validation = validateEpisodioClinico(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "El episodio clínico no cumple el modelo de HCE.",
      details: validation.issues ?? []
    });
  }

  return res.status(200).json({
    code: "OK",
    message: "Episodio clínico válido estructuralmente.",
    data: validation.data
  });
});

episodesRouter.post("/", async (req, res) => {
  const validation = validateEpisodioClinico(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message:
        "El episodio clínico no cumple el modelo de HCE y no puede registrarse.",
      details: validation.issues ?? []
    });
  }

  const episodeId = randomUUID();
  const documento = generarDocumentoClinico(validation.data!);
  try {
    const { hash } = await almacenarDocumentoClinico(episodeId, documento);
    return res.status(201).json({
      code: "EPISODE_REGISTERED",
      message:
        "Episodio clínico registrado. Documento almacenado off-chain; hash disponible para registro on-chain.",
      episodeId,
      documentHash: hash,
      data: validation.data
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al persistir en HAPI FHIR";
    return res.status(502).json({
      code: "FHIR_STORAGE_ERROR",
      message: "No se pudo almacenar el documento en el servidor FHIR.",
      details: message
    });
  }
});

episodesRouter.put("/:id", async (req, res) => {
  const validation = validateEpisodioClinico(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message:
        "El episodio clínico no cumple el modelo de HCE y no puede actualizarse.",
      details: validation.issues ?? []
    });
  }

  const episodeId = req.params.id;
  const documento = generarDocumentoClinico(validation.data!);
  try {
    const { hash } = await almacenarDocumentoClinico(episodeId, documento);
    return res.status(200).json({
      code: "EPISODE_UPDATED",
      message:
        "Episodio clínico actualizado. Documento off-chain y hash recalculados.",
      episodeId,
      documentHash: hash,
      data: validation.data
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar en HAPI FHIR";
    return res.status(502).json({
      code: "FHIR_STORAGE_ERROR",
      message: "No se pudo actualizar el documento en el servidor FHIR.",
      details: message
    });
  }
});

/** Recupera el documento clínico off-chain asociado al episodio (HU3-E0). Respetará permisos cuando exista control de acceso. */
episodesRouter.get("/:id/document", async (req, res) => {
  try {
    const almacenado = await recuperarDocumentoClinico(req.params.id);
    if (!almacenado) {
      return res.status(404).json({
        code: "DOCUMENT_NOT_FOUND",
        message: "No existe documento clínico asociado a este episodio."
      });
    }
    return res.status(200).json({
      episodeId: almacenado.episodeId,
      hash: almacenado.hash,
      createdAt: almacenado.createdAt,
      document: almacenado.document
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al recuperar desde HAPI FHIR";
    return res.status(502).json({
      code: "FHIR_STORAGE_ERROR",
      message: "No se pudo recuperar el documento desde el servidor FHIR.",
      details: message
    });
  }
});

