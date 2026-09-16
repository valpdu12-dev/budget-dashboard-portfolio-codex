// -- Router centralise (remplace le switch/case de V1 App.jsx) -----------
// Phase 6.1 -- Lazy loading : chaque page est chargee a la demande.
// Phase 5A -- Routes imbriquées par type de flux + sous-navigation (pills).
// Le fallback <SkeletonPage> s'affiche pendant le chargement du chunk.
import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAvailableFeatures } from "@/hooks/useAvailableFeatures";
import { AppShell } from "@/components/layout/AppShell";
import { SkeletonPage } from "@/components/ui/Skeleton";

const Comptes          = lazy(() => import("@/pages/Comptes"));
const Depenses         = lazy(() => import("@/pages/Depenses"));
const BudgetMensuel    = lazy(() => import("@/pages/BudgetMensuel"));
const Recettes         = lazy(() => import("@/pages/Recettes"));
const Salaire          = lazy(() => import("@/pages/Salaire"));
const SalaireInflation = lazy(() => import("@/pages/SalaireInflation"));
const Epargne          = lazy(() => import("@/pages/Epargne"));
const PretImmobilier   = lazy(() => import("@/pages/PretImmobilier"));
const Parametres       = lazy(() => import("@/pages/Parametres"));
const Insights         = lazy(() => import("@/pages/Insights"));
function OptionalPage({ feature, children }: { feature: "hasSalary" | "hasInflation" | "hasLoan" | "hasSavings"; children: ReactNode }) {
  const features = useAvailableFeatures();
  if (!features.loaded) return <SkeletonPage />;
  return features[feature] ? children : <Navigate to={feature === "hasSavings" && features.hasLoan ? "/patrimoine/pret" : "/"} replace />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Comptes />} />

          {/* Dépenses : sorties + plafonds */}
          <Route path="depenses"        element={<Depenses />} />
          <Route path="depenses/budget" element={<BudgetMensuel />} />

          {/* Revenus : recettes + salaire + pouvoir d'achat */}
          <Route path="revenus"           element={<Recettes />} />
          <Route path="revenus/salaire"   element={<OptionalPage feature="hasSalary"><Salaire /></OptionalPage>} />
          <Route path="revenus/inflation" element={<OptionalPage feature="hasInflation"><SalaireInflation /></OptionalPage>} />

          {/* Patrimoine : épargne + prêt */}
          <Route path="patrimoine"      element={<OptionalPage feature="hasSavings"><Epargne /></OptionalPage>} />
          <Route path="patrimoine/pret" element={<OptionalPage feature="hasLoan"><PretImmobilier /></OptionalPage>} />

          <Route path="parametres" element={<Parametres />} />
          <Route path="insights" element={<Insights />} />
          <Route path="*"        element={<Comptes />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
