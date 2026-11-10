# Airtel RDC · Self KYC

Parcours d'auto-identification des nouvelles SIM Airtel RDC (Next.js 15, App Router, TypeScript, Tailwind v4, Zod).

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis définir KYC_TOKEN_SECRET
npm run dev                  # http://localhost:3000
npm run dev:https            # pour tester la caméra depuis un téléphone sur le réseau local
```

La caméra n'est accessible qu'en contexte sécurisé : `localhost` ou HTTPS.

| URL | Rôle |
| --- | --- |
| `/` | Accueil |
| `/kyc` | Parcours abonné |
| `/statut?msisdn=099…` | Statut public (aucune donnée personnelle) |
| `/backoffice` | Liste, recherche par numéro, vérification (Basic Auth `BACKOFFICE_USER` / `BACKOFFICE_PASSWORD`) |

## Parcours

1. Numéro Airtel (097/098/099) → OTP (code **1234** par défaut, `KYC_OTP_CODE`) avec 5 essais puis blocage de 10 min
2. Option Airtel Money, type et numéro de pièce
3. Nom, postnom (facultatif), prénom, lieu/date de naissance (≥ 18 ans), email (facultatif), 2 autres numéros (facultatifs), district, ville, village/quartier, adresse
4. ICCID et PUK de la SIM
5. Scan de la pièce (recto/verso selon le type) : cadre caméra, analyse netteté/luminosité/reflets, animation d'authentification. **Tous les documents sont acceptés** (démo).
6. Preuve de vie : MediaPipe Face Landmarker exécuté localement (`public/models`, `public/mediapipe`). Selfie puis 3 défis tirés au hasard parmi 5, avec retour à une position neutre entre chaque défi. Un mode guidé prend le relais si le modèle ne se charge pas.
7. Consentements légaux (texte à faire valider par le juridique, versionné par `CONSENT_VERSION`)
8. Récapitulatif modifiable → soumission → statut `PENDING`

Back-office : « Vérifier et approuver » lance les contrôles (`src/lib/server/verification.ts`). Le dossier passe `APPROVED` si aucun contrôle bloquant n'échoue. Un rejet exige un motif.

## Stockage (sans base de données)

```
data/kyc/243991234567.json        dossier complet + historique des statuts
data/kyc/243991234567/            id_front.jpg, id_back.jpg, selfie.jpg
```

- Écritures atomiques et sérialisées par numéro.
- Le PUK n'est jamais stocké en clair (hash SHA-256 et 2 derniers chiffres).
- La soumission exige un jeton HMAC signé, délivré après l'OTP.
- `data/kyc` est exclu de git.

## Avant la production

- Brancher une vraie passerelle SMS/OTP (`src/app/api/otp/send`)
- Remplacer l'authentification documentaire simulée par un fournisseur (OCR/MRZ, face match)
- Ajouter le logo et la police officiels Airtel (`src/components/ui/brand.tsx`)
- Remplacer le stockage fichier par une base de données ou un stockage objet chiffré, et le Basic Auth par le SSO interne
