# Airtel RDC · Self KYC

Parcours d'auto-identification des nouvelles SIM Airtel RDC (Next.js 15, App Router, TypeScript, Tailwind v4, Zod).

## Démarrage

```bash
npm install
cp .env.example .env.local   # identifiants du back-office
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

1. Numéro Airtel (097/098/099) → OTP vérifié localement (code **1234**, 5 essais)
2. Option Airtel Money, type et numéro de pièce
3. Nom, postnom (facultatif), prénom, lieu/date de naissance (≥ 18 ans), email (facultatif), 2 autres numéros (obligatoires), district, ville, village/quartier, adresse
4. ICCID et PUK de la SIM
5. Scan de la pièce (recto/verso selon le type) : cadre caméra, analyse netteté/luminosité/reflets, animation d'authentification. **Tous les documents sont acceptés** (démo).
6. Preuve de vie : MediaPipe Face Landmarker exécuté localement (`public/models`, `public/mediapipe`). Selfie puis 3 défis tirés au hasard parmi 5, avec retour à une position neutre entre chaque défi. Un mode guidé prend le relais si le modèle ne se charge pas.
7. Consentements légaux (texte à faire valider par le juridique, versionné par `CONSENT_VERSION`)
8. Récapitulatif modifiable → soumission → statut `PENDING`

Back-office : « Vérifier et approuver » lance les contrôles (`src/lib/verification.ts`). Le dossier passe `APPROVED` si aucun contrôle bloquant n'échoue. Un rejet exige un motif.

## Stockage : aucune requête réseau

L'application ne fait **aucun appel API**. L'OTP est comparé localement à `1234` (`OTP_CODE` dans `src/lib/constants.ts`). Les dossiers sont enregistrés dans le navigateur (IndexedDB, un enregistrement par numéro, PUK haché en SHA-256).

- Le back-office lit le stockage **du même navigateur**.
- Chaque dossier s'exporte en fichier `<msisdn>.json` (bouton « JSON » / « Télécharger »). Les fichiers se réimportent sur un autre poste (« Importer des fichiers »).

## Avant la production

- Brancher une vraie passerelle SMS/OTP et un stockage serveur centralisé
- Remplacer l'authentification documentaire simulée par un fournisseur (OCR/MRZ, face match)
- Ajouter le logo et la police officiels Airtel (`src/components/ui/brand.tsx`)
- Remplacer le Basic Auth par le SSO interne
