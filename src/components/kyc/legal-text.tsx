/**
 * Textes légaux du parcours self-KYC.
 * ⚠️ Rédaction indicative : à faire valider par la Direction Juridique & Conformité
 * d'Airtel RDC avant toute mise en production (CONSENT_VERSION à incrémenter à chaque révision).
 */
export function LegalText({ wantsAirtelMoney }: { wantsAirtelMoney: boolean }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-ink/90">
      <section>
        <h4 className="font-extrabold text-ink">1. Objet de l&apos;identification</h4>
        <p>
          Conformément à la réglementation congolaise en matière de télécommunications, notamment la loi n° 20/017 du
          25 novembre 2020 relative aux télécommunications et aux technologies de l&apos;information et de la communication,
          ainsi qu&apos;aux mesures de l&apos;Autorité de Régulation de la Poste et des Télécommunications du Congo (ARPTC),
          toute carte SIM active doit être rattachée à un abonné dûment identifié. À défaut d&apos;identification, la ligne
          peut être suspendue.
        </p>
      </section>
      <section>
        <h4 className="font-extrabold text-ink">2. Données collectées</h4>
        <p>
          Airtel Congo RDC collecte : vos nom, postnom, prénom, lieu et date de naissance, coordonnées, adresse, le type et le
          numéro de votre pièce d&apos;identité ainsi que son image, les identifiants de votre carte SIM (ICCID, PUK sous forme
          chiffrée), une photographie de votre visage et le résultat de la vérification de présence (preuve de vie).
        </p>
      </section>
      <section>
        <h4 className="font-extrabold text-ink">3. Finalités</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>Identifier le titulaire de la ligne et activer les services associés ;</li>
          <li>Prévenir la fraude, l&apos;usurpation d&apos;identité et l&apos;usage illicite des services ;</li>
          <li>Répondre aux obligations légales et aux réquisitions des autorités compétentes.</li>
        </ul>
      </section>
      <section>
        <h4 className="font-extrabold text-ink">4. Données biométriques</h4>
        <p>
          L&apos;analyse de votre visage est réalisée sur votre appareil pour vérifier qu&apos;une personne réelle est présente.
          Seule une photographie de votre visage est transmise afin d&apos;être comparée à la photo de votre pièce
          d&apos;identité. Ces données ne sont utilisées à aucune autre fin.
        </p>
      </section>
      <section>
        <h4 className="font-extrabold text-ink">5. Conservation et destinataires</h4>
        <p>
          Vos données sont conservées pendant toute la durée de votre abonnement puis pendant la durée légale de conservation
          applicable. Elles sont accessibles aux seuls services habilités d&apos;Airtel, à ses sous-traitants techniques liés par
          une obligation de confidentialité et aux autorités légalement autorisées.
        </p>
      </section>
      <section>
        <h4 className="font-extrabold text-ink">6. Vos droits</h4>
        <p>
          Vous pouvez demander l&apos;accès et la rectification de vos données en vous présentant dans une boutique Airtel muni
          de votre pièce d&apos;identité ou en contactant le service client.
        </p>
      </section>
      {wantsAirtelMoney && (
        <section className="rounded-xl bg-airtel-50 p-3">
          <h4 className="font-extrabold text-airtel-dark">7. Ouverture du compte Airtel Money</h4>
          <p>
            Le compte Airtel Money est un compte de monnaie électronique soumis à la réglementation de la Banque Centrale du
            Congo, notamment en matière de lutte contre le blanchiment de capitaux et le financement du terrorisme. Les
            plafonds de transaction dépendent du niveau de vérification de votre identité. Les conditions générales
            d&apos;utilisation et la grille tarifaire Airtel Money sont disponibles en boutique et sur demande au service client.
          </p>
        </section>
      )}
    </div>
  );
}
