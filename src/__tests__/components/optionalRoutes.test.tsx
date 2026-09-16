import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRouter } from "@/router";
import { useDataStore } from "@/stores/useDataStore";
import { importDataset } from "../helpers/importFixture";

vi.mock("@/components/layout/AppShell", async () => {
  const { Outlet, useLocation } = await import("react-router-dom");
  const { SubNav } = await import("@/components/layout/SubNav");
  return { AppShell: () => <><SubNav /><Outlet /><p data-testid="path">{useLocation().pathname}</p></> };
});
vi.mock("@/pages/Comptes", () => ({ default: () => <h1>Vue Comptes</h1> }));
vi.mock("@/pages/Recettes", () => ({ default: () => <h1>Vue Recettes</h1> }));
vi.mock("@/pages/Salaire", () => ({ default: () => <h1>Vue Salaire</h1> }));
vi.mock("@/pages/SalaireInflation", () => ({ default: () => <h1>Vue Inflation</h1> }));
vi.mock("@/pages/Epargne", () => ({ default: () => <h1>Vue Épargne</h1> }));
vi.mock("@/pages/PretImmobilier", () => ({ default: () => <h1>Vue Prêt</h1> }));
beforeEach(() => useDataStore.getState().reset());
function open(path: string, salary: boolean, loan: boolean) {
  useDataStore.getState().setImportedDataset(importDataset(salary, loan), "test.xlsx", "2026-09-15T12:00:00Z");
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppRouter /></MemoryRouter>);
}
describe("Navigation facultative", () => {
  it("redirige l'épargne vers Comptes lorsqu'aucun compte d'épargne ni prêt n'est disponible", async () => {
    const data = importDataset(false, false); data.config.accountKinds!["Mon livret"] = "Courant";
    useDataStore.getState().setImportedDataset(data, "test.xlsx", "2026-09-15T12:00:00Z");
    render(<MemoryRouter initialEntries={["/patrimoine"]}><AppRouter /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Vue Comptes" });
    expect(screen.getByTestId("path")).toHaveTextContent("/");
  });
  it("redirige l'épargne vers le prêt lorsque seul le prêt est disponible", async () => {
    const data = importDataset(false, true); data.config.accountKinds!["Mon livret"] = "Courant";
    useDataStore.getState().setImportedDataset(data, "test.xlsx", "2026-09-15T12:00:00Z");
    render(<MemoryRouter initialEntries={["/patrimoine"]}><AppRouter /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Vue Prêt" });
    expect(screen.queryByRole("link", { name: "Épargne" })).toBeNull();
    expect(screen.getByTestId("path")).toHaveTextContent("/patrimoine/pret");
  });
  it.each([[true, true], [true, false], [false, true], [false, false]])("adapte le sous-menu revenus, salaire=%s prêt=%s", async (salary, loan) => {
    open("/revenus", salary, loan); await screen.findByRole("heading", { name: "Vue Recettes" });
    expect(Boolean(screen.queryByRole("link", { name: "Salaire", exact: true }))).toBe(salary);
    expect(screen.queryByRole("link", { name: /Inflation/ })).toBeNull();
  });
  it.each([[true, true], [true, false], [false, true], [false, false]])("adapte le sous-menu patrimoine, salaire=%s prêt=%s", async (salary, loan) => {
    open("/patrimoine", salary, loan); await screen.findByRole("heading", { name: "Vue Épargne" });
    expect(Boolean(screen.queryByRole("link", { name: "Prêt Immo." }))).toBe(loan);
  });
  it.each([
    ["/revenus/salaire", false, false, "/"], ["/revenus/salaire", true, false, "/revenus/salaire"],
    ["/patrimoine/pret", false, false, "/"], ["/patrimoine/pret", false, true, "/patrimoine/pret"],
    ["/revenus/inflation", true, true, "/"],
  ] as const)("contrôle l'accès direct à %s", async (path, salary, loan, expected) => {
    open(path, salary, loan);
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent(expected));
    if (expected === "/") await screen.findByRole("heading", { name: "Vue Comptes" });
    else await screen.findByRole("heading", { name: expected.includes("salaire") ? "Vue Salaire" : "Vue Prêt" });
  });
});
