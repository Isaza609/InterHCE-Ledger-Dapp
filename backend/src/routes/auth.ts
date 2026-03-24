import { Router } from "express";
import {
  extraerTokenBearer,
  iniciarSesion,
  invalidarSesion,
  obtenerSesionPorToken
} from "../security/autenticacionService";
import { cambiarPassword } from "../access/accesoUsuariosService";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const identificador = String(
    req.body?.correo ?? req.body?.usuarioId ?? req.body?.documentoIdentidad ?? ""
  ).trim();
  const password = String(req.body?.password ?? "").trim();

  if (!identificador || !password) {
    return res.status(400).json({
      code: "MISSING_CREDENTIALS",
      message: "Debe enviar correo, usuarioId o documentoIdentidad, junto con password."
    });
  }

  const result = iniciarSesion(identificador, password);
  if (!result.ok) {
    return res.status(result.code === "USER_INACTIVE" ? 403 : 401).json({
      code: result.code,
      message: result.message
    });
  }

  return res.status(200).json({
    code: "AUTHENTICATED",
    message: "Sesión iniciada correctamente.",
    session: result.session,
    requiereCambioPassword: result.requiereCambioPassword ?? false
  });
});

authRouter.get("/me", (req, res) => {
  const token = extraerTokenBearer(req.header("authorization"));
  if (!token) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Debe enviar Authorization: Bearer <token>."
    });
  }

  const session = obtenerSesionPorToken(token);
  if (!session) {
    return res.status(401).json({
      code: "INVALID_SESSION",
      message: "La sesión no existe o expiró."
    });
  }

  return res.status(200).json({
    code: "OK",
    session
  });
});

authRouter.post("/logout", (req, res) => {
  const token = extraerTokenBearer(req.header("authorization"));
  if (!token) {
    return res.status(400).json({
      code: "MISSING_TOKEN",
      message: "Debe enviar Authorization: Bearer <token>."
    });
  }

  invalidarSesion(token);
  return res.status(200).json({
    code: "SESSION_CLOSED",
    message: "La sesión fue invalidada."
  });
});

authRouter.patch("/password", (req, res) => {
  const token = extraerTokenBearer(req.header("authorization"));
  if (!token) {
    return res.status(401).json({
      code: "UNAUTHENTICATED",
      message: "Debe enviar Authorization: Bearer <token>."
    });
  }
  const session = obtenerSesionPorToken(token);
  if (!session) {
    return res.status(401).json({
      code: "INVALID_SESSION",
      message: "La sesión no existe o expiró."
    });
  }
  const passwordActual = String(req.body?.passwordActual ?? "").trim();
  const passwordNueva = String(req.body?.passwordNueva ?? "").trim();
  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({
      code: "MISSING_FIELDS",
      message: "Debe enviar passwordActual y passwordNueva."
    });
  }
  const result = cambiarPassword(session.usuarioId!, passwordActual, passwordNueva);
  if (!result.ok) {
    return res.status(400).json({ code: result.code, message: result.message });
  }
  return res.status(200).json({
    code: "PASSWORD_CHANGED",
    message: "Contraseña actualizada correctamente."
  });
});
