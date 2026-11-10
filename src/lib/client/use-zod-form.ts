"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";
import { flattenIssues } from "@/lib/schemas";

/**
 * Mini gestionnaire de formulaire piloté par un schéma Zod.
 * Les erreurs s'effacent champ par champ dès que l'utilisateur corrige.
 */
export function useZodForm<V extends Record<string, unknown>, Out>(schema: z.ZodType<Out, z.ZodTypeDef, unknown>, initial: V) {
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = useCallback(<K extends keyof V>(key: K, value: V[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const { [key as string]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const validate = useCallback((): Out | null => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    const fieldErrors = flattenIssues(result.error);
    setErrors(fieldErrors);
    // Focus sur le premier champ en erreur pour l'accessibilité.
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    });
    return null;
  }, [schema, values]);

  return { values, errors, set, setErrors, validate };
}
