"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { IdType } from "@/lib/constants";
import type { CapturedDocument, ConsentInput, LivenessResult, PersonalInput, SimInput } from "@/lib/schemas";
import type { KycStatus } from "@/lib/types";

/* --------------------------------- Étapes ---------------------------------- */

export type StepId =
  | "identity"
  | "personal"
  | "sim"
  | "number"
  | "document"
  | "liveness"
  | "consent"
  | "review"
  | "done";

/**
 * Ordre du parcours : source unique de vérité (navigation, progression, reprise après rechargement).
 * Les informations personnelles précèdent le choix du numéro : les numéros secondaires saisis
 * sont exclus des numéros proposés.
 */
const ORDER: StepId[] = ["identity", "sim", "personal", "number", "document", "liveness", "consent", "review", "done"];

/** Étapes affichées dans la barre de progression. */
export const PROGRESS_STEPS: { id: StepId; label: string }[] = [
  { id: "identity", label: "Pièce d'identité" },
  { id: "sim", label: "Carte SIM" },
  { id: "personal", label: "Informations personnelles" },
  { id: "number", label: "Choix du numéro" },
  { id: "document", label: "Scan de la pièce" },
  { id: "liveness", label: "Vérification du visage" },
  { id: "consent", label: "Consentement" },
  { id: "review", label: "Récapitulatif" },
];

/* --------------------------------- État ------------------------------------ */

export type IdentityForm = { wantsAirtelMoney: boolean; idType: IdType | ""; idNumber: string };

export interface KycState {
  step: StepId;
  /** Vrai quand l'utilisateur modifie une section depuis le récapitulatif. */
  returnToReview: boolean;
  /** Numéro Airtel choisi (243XXXXXXXXX), vide tant que l'étape « number » n'est pas validée. */
  msisdn: string;
  /** Numéros proposés à l'abonné, conservés pour rester stables (retour arrière, rechargement). */
  numberOptions: string[];
  /** Réservation du numéro choisi : remplace l'ancienne session OTP. */
  reservation: { at: string; expiresAt: number } | null;
  identity: IdentityForm;
  personal: PersonalInput;
  sim: SimInput;
  documents: { front: CapturedDocument | null; back: CapturedDocument | null };
  liveness: LivenessResult | null;
  consent: ConsentInput;
  result: { reference: string; status: KycStatus; createdAt: string } | null;
}

const initialState: KycState = {
  step: "identity",
  returnToReview: false,
  msisdn: "",
  numberOptions: [],
  reservation: null,
  identity: { wantsAirtelMoney: false, idType: "", idNumber: "" },
  personal: {
    lastName: "",
    middleName: "",
    firstName: "",
    birthPlace: "",
    birthDate: "",
    email: "",
    altPhone1: "",
    altPhone2: "",
    district: "",
    city: "",
    village: "",
    address: "",
  },
  sim: { iccid: "", puk: "" },
  documents: { front: null, back: null },
  liveness: null,
  consent: { terms: false, privacy: false, biometrics: false, accuracy: false, airtelMoney: false },
  result: null,
};

type Action =
  | { type: "goto"; step: StepId; returnToReview?: boolean }
  | { type: "numberOptions"; value: string[] }
  | { type: "selectNumber"; msisdn: string; reservedAt: string; expiresAt: number }
  | { type: "releaseNumber" }
  | { type: "identity"; value: IdentityForm }
  | { type: "personal"; value: PersonalInput }
  | { type: "sim"; value: SimInput }
  | { type: "documents"; value: KycState["documents"] }
  | { type: "liveness"; value: LivenessResult | null }
  | { type: "consent"; value: ConsentInput }
  | { type: "result"; value: NonNullable<KycState["result"]> }
  | { type: "hydrate"; value: Partial<KycState> }
  | { type: "reset" };

function reducer(state: KycState, action: Action): KycState {
  switch (action.type) {
    case "goto":
      return { ...state, step: action.step, returnToReview: action.returnToReview ?? state.returnToReview };
    case "numberOptions":
      return { ...state, numberOptions: action.value };
    case "selectNumber":
      // Le numéro est choisi après la saisie du dossier : en changer ne remet rien d'autre à zéro.
      return { ...state, msisdn: action.msisdn, reservation: { at: action.reservedAt, expiresAt: action.expiresAt } };
    case "releaseNumber":
      return { ...state, msisdn: "", reservation: null, numberOptions: [] };
    case "identity": {
      // Le type de pièce conditionne le verso et la photo : on invalide le scan si on change de type.
      const typeChanged = state.identity.idType !== action.value.idType;
      return {
        ...state,
        identity: action.value,
        documents: typeChanged ? { front: null, back: null } : state.documents,
        consent: action.value.wantsAirtelMoney ? state.consent : { ...state.consent, airtelMoney: false },
      };
    }
    case "personal":
      return { ...state, personal: action.value };
    case "sim":
      return { ...state, sim: action.value };
    case "documents":
      return { ...state, documents: action.value };
    case "liveness":
      return { ...state, liveness: action.value };
    case "consent":
      return { ...state, consent: action.value };
    case "result":
      return { ...state, result: action.value, step: "done", returnToReview: false };
    case "hydrate":
      return { ...state, ...action.value };
    case "reset":
      return initialState;
  }
}

/* ------------------------------ Persistance -------------------------------- */

// v2 : nouveau parcours (choix du numéro au lieu de la saisie + OTP).
const STORAGE_KEY = "airtel-selfkyc:v2";

export function isReservationValid(r: KycState["reservation"], now = Date.now()): r is NonNullable<KycState["reservation"]> {
  return Boolean(r && r.expiresAt > now);
}

/**
 * On persiste uniquement les données texte en sessionStorage (onglet courant) :
 * les images (plusieurs Mo) restent en mémoire et doivent être recapturées après un rechargement.
 */
function persistable(s: KycState) {
  const { documents: _d, liveness: _l, ...rest } = s;
  return rest;
}

function sanitizeHydrated(saved: Partial<KycState>): Partial<KycState> {
  const out = { ...saved };
  if (!out.step || !ORDER.includes(out.step)) out.step = "identity";
  if (out.step === "done") return out.result ? out : { step: "identity" };

  // Réservation expirée : on conserve le dossier saisi et on refait choisir le numéro.
  if (!isReservationValid(out.reservation ?? null)) {
    out.msisdn = "";
    out.reservation = null;
    out.numberOptions = [];
    if (ORDER.indexOf(out.step) > ORDER.indexOf("number")) out.step = "number";
  }
  // Images non persistées : revenir à la capture si nécessaire.
  if (ORDER.indexOf(out.step) > ORDER.indexOf("document")) out.step = "document";
  return out;
}

/* -------------------------------- Contexte --------------------------------- */

type Ctx = {
  state: KycState;
  dispatch: React.Dispatch<Action>;
  /** Passe à l'étape suivante (ou revient au récapitulatif en mode modification). */
  next: () => void;
  back: () => void;
  goTo: (step: StepId, opts?: { fromReview?: boolean }) => void;
  reset: () => void;
};

const KycContext = createContext<Ctx | null>(null);

export function KycProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", value: sanitizeHydrated(JSON.parse(raw) as Partial<KycState>) });
    } catch {
      /* stockage indisponible : on continue sans */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistable(state)));
    } catch {
      /* quota / mode privé */
    }
  }, [state]);

  // Remonter en haut de page à chaque changement d'étape.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.step]);

  const goTo = useCallback((step: StepId, opts?: { fromReview?: boolean }) => {
    dispatch({ type: "goto", step, returnToReview: opts?.fromReview ?? false });
  }, []);

  const next = useCallback(() => {
    if (state.returnToReview && ORDER.indexOf(state.step) < ORDER.indexOf("review")) {
      // Une modification du type de pièce peut nécessiter une nouvelle capture.
      const needsDocs = !state.documents.front;
      dispatch({ type: "goto", step: needsDocs ? "document" : "review", returnToReview: needsDocs });
      return;
    }
    const i = ORDER.indexOf(state.step);
    dispatch({ type: "goto", step: ORDER[Math.min(i + 1, ORDER.length - 1)]!, returnToReview: false });
  }, [state.step, state.returnToReview, state.documents.front]);

  const back = useCallback(() => {
    if (state.returnToReview) {
      dispatch({ type: "goto", step: "review", returnToReview: false });
      return;
    }
    const i = ORDER.indexOf(state.step);
    dispatch({ type: "goto", step: ORDER[Math.max(i - 1, 0)]! });
  }, [state.step, state.returnToReview]);

  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    dispatch({ type: "reset" });
  }, []);

  const value = useMemo(() => ({ state, dispatch, next, back, goTo, reset }), [state, next, back, goTo, reset]);
  return <KycContext.Provider value={value}>{children}</KycContext.Provider>;
}

export function useKyc() {
  const ctx = useContext(KycContext);
  if (!ctx) throw new Error("useKyc doit être utilisé dans <KycProvider>");
  return ctx;
}
