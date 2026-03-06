"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.episodesRouter = void 0;
const express_1 = require("express");
const validationService_1 = require("../hce/validationService");
exports.episodesRouter = (0, express_1.Router)();
exports.episodesRouter.post("/validate", (req, res) => {
    const validation = (0, validationService_1.validateEpisodioClinico)(req.body);
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
exports.episodesRouter.post("/", (req, res) => {
    const validation = (0, validationService_1.validateEpisodioClinico)(req.body);
    if (!validation.valid) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "El episodio clínico no cumple el modelo de HCE y no puede registrarse.",
            details: validation.issues ?? []
        });
    }
    return res.status(201).json({
        code: "EPISODE_REGISTERED",
        message: "Episodio clínico válido. Pendiente integración con almacenamiento off-chain, cálculo de hash y registro on-chain.",
        data: validation.data
    });
});
exports.episodesRouter.put("/:id", (req, res) => {
    const validation = (0, validationService_1.validateEpisodioClinico)(req.body);
    if (!validation.valid) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "El episodio clínico no cumple el modelo de HCE y no puede actualizarse.",
            details: validation.issues ?? []
        });
    }
    return res.status(200).json({
        code: "EPISODE_UPDATED",
        message: "Episodio clínico válido. Pendiente integración con actualización off-chain, recálculo de hash y registro on-chain.",
        id: req.params.id,
        data: validation.data
    });
});
