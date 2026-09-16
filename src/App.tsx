// ── App.tsx V3 — Point d'entrée ──────────────────────────────────────────
// Le chargement statique vit dans `services/loadDashboardData` afin de pouvoir
// être rejoué quand l'utilisateur revient aux données de démonstration.

import { useEffect } from "react";
import { AppRouter } from "./router";
import { DataLoadError } from "@/components/ui/DataLoadError";
import { loadDashboardData } from "@/services/loadDashboardData";
import { useDataStore } from "@/stores/useDataStore";

export default function App() {
  const status = useDataStore((state) => state.status);
  const error = useDataStore((state) => state.error);

  // Chargement initial : jeu de démonstration local, puis éventuel import mémorisé.
  useEffect(() => {
    void loadDashboardData();
  }, []);

  if (status === "error") {
    return <DataLoadError detail={error} onRetry={() => void loadDashboardData()} />;
  }

  return <AppRouter />;
}
