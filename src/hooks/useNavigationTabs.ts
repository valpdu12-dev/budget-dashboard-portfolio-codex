import { NAV_TABS } from "@/config/constants";
import { useAvailableFeatures } from "./useAvailableFeatures";

export function useNavigationTabs() {
  const { hasSavings, hasLoan, loaded } = useAvailableFeatures();
  return NAV_TABS.filter(tab => tab.id !== "patrimoine" || !loaded || hasSavings || hasLoan)
    .map(tab => ({ ...tab, path: tab.id === "patrimoine" && loaded && !hasSavings && hasLoan ? "/patrimoine/pret" : tab.path }));
}
