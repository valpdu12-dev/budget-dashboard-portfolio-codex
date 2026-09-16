import { FlaskConical } from "lucide-react";
import { useDataStore } from "@/stores/useDataStore";

/** Indique sans ambiguïté que le jeu affiché n'appartient à aucune personne. */
export function DemoBanner() {
  const dataOrigin = useDataStore((state) => state.dataOrigin);
  const perspective = useDataStore(state => state.config?.perspective);
  const storageNotice = useDataStore((state) => state.storageNotice);

  if (dataOrigin !== "static" && !storageNotice && perspective !== "personal") return null;

  return (
    <aside
      className="flex items-start gap-2 border-b border-indigo/30 bg-indigo/10 px-3 py-2 text-xs text-text-sec xs:px-6"
      aria-label="Information sur les données de démonstration"
    >
      <FlaskConical size={16} className="mt-0.5 shrink-0 text-indigo-text" />
      <p>
        {dataOrigin === "static" && <><strong className="text-text">Mode démonstration :</strong>{" "}
        revenus, dépenses, comptes, budgets, prêt et indices sont entièrement fictifs.
        Les modifications de budget et de paramètres restent dans ce navigateur.</>}
        {perspective === "personal" && <span className="block"><strong className="text-text">Vue personnelle :</strong> montants selon votre quote-part. Les salaires et le suivi du prêt restent contractuels ; les budgets personnels ont leurs propres objectifs.</span>}
        {storageNotice && <span className="block text-amber-400" role="status">{storageNotice}</span>}
      </p>
    </aside>
  );
}
