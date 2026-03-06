import { useState, useCallback } from "react";
import { validarEpisodio, registrarEpisodio } from "@/shared/services/api";
import type { EpisodioPayload, ValidationResult } from "@/shared/types/episodio";

export function useValidarEpisodio() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validar = useCallback(async (payload: EpisodioPayload) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await validarEpisodio(payload);
      setResult(r);
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de conexión";
      setError(msg);
      setResult({ valid: false, message: msg });
      return { valid: false, message: msg } as ValidationResult;
    } finally {
      setLoading(false);
    }
  }, []);

  const registrar = useCallback(async (payload: EpisodioPayload) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await registrarEpisodio(payload);
      setResult(r);
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de conexión";
      setError(msg);
      setResult({ valid: false, message: msg });
      return { valid: false, message: msg } as ValidationResult;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, validar, registrar };
}
