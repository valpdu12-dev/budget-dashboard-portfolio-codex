import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { applyConfiguration } from "@/services/configurationPersistence";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonPage } from "@/components/ui/Skeleton";
import type { Config, TransactionRole } from "@/types";

const clone = (config: Config) => JSON.parse(JSON.stringify(config)) as Config;
const numeric = (value: string) => value === "" ? NaN : Number(value);
const inputClass = "w-full rounded-md border border-border bg-surface px-3 py-2 text-text min-h-tap";
const numericValue = (value: number) => Number.isFinite(value) ? value : "";
const roleLabels: Record<TransactionRole, string> = { ordinary: "Opération courante", transfer: "Transfert interne", "loan-capital": "Capital du prêt", "loan-interest": "Intérêts du prêt" };

export default function Parametres() {
  const { config, status, dataOrigin, coverage } = useDataStore();
  const [draft, setDraft] = useState<Config | null>(config ? clone(config) : null);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { setDraft(config ? clone(config) : null); setErrors([]); }, [config]);
  if (status !== "success" || !draft?.accounts || !draft.types) return <SkeletonPage />;
  const accounts = draft.accounts;
  const visibleAccounts = accounts.filter(account => account.includeInBalance !== false);
  const types = draft.types;
  const save = (event: FormEvent) => {
    event.preventDefault();
    const result = applyConfiguration(draft);
    setErrors(result.errors);
    setMessage(result.ok ? result.saved ? "Paramètres enregistrés dans ce navigateur." : "Paramètres appliqués pour cette session ; mémorisation indisponible." : "");
  };
  const exportSnapshot = () => {
    const state = useDataStore.getState();
    const blob = new Blob([JSON.stringify({ schemaVersion: 2, transactions: state.transactions,
      salary: state.salary, config: state.config, budgets: state.budgets,
      fileName: state.importFileName, importedAt: state.importedAt, dataOrigin: state.dataOrigin }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "budget-parametres.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <form onSubmit={save} noValidate className="flex flex-col gap-6">
    <PageHeader title="Paramètres" subtitle={dataOrigin === "static" ? "Personnaliser le jeu fictif de démonstration" : "Personnaliser vos comptes et vos règles de calcul"} />
    <p className="text-sm text-text-sec">Les noms peuvent changer sans modifier les identifiants ni les montants. Pour ajouter un compte, un type ou des transactions, importez un classeur complet. Les réglages restent dans ce navigateur.</p>
    <fieldset className="card flex flex-col gap-3">
      <legend className="font-semibold text-text">Vue des montants</legend>
      {draft.compatibility === "legacy-dashboard-v1" ? <p className="text-sm text-text-sec">
        Mode historique actif : l’application reprend les montants calculés et les règles KPI de l’ancien classeur, sans modifier celui-ci.
      </p> : <><label className="text-sm text-text">Montants affichés
        <select className={inputClass} value={draft.perspective ?? "bank"} onChange={e => setDraft({ ...draft, perspective: e.target.value as "bank" | "personal" })}>
          <option value="bank">Montants bancaires</option><option value="personal">Ma quote-part</option>
        </select>
      </label>
      <p className="text-xs text-text-sec">En vue personnelle, chaque mouvement et chaque solde initial sont multipliés une fois par la quote-part du compte. Les objectifs budgétaires sont propres à chaque vue. Salaire et suivi du prêt restent contractuels. Une modification de quote-part s’applique à tout l’historique ; les changements de participation dans le temps ne sont pas pris en charge.</p></>}
    </fieldset>
    <fieldset className="card flex flex-col gap-4">
      <legend className="font-semibold text-text">Comptes</legend>
      <p className="text-xs text-text-sec">Solde initial : solde juste avant le {coverage.dateMin ?? "début de couverture"}. Un solde négatif est accepté. Une quote-part de 0 % exclut le compte des montants personnels.</p>
      {visibleAccounts.map((a, i) => <div key={a.id} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 border-b border-border pb-4 last:border-0">
        <label className="text-sm text-text">Nom du compte {i + 1}<input className={inputClass} value={a.label} maxLength={100} onChange={e => setDraft({ ...draft, accounts: accounts.map(b => b.id === a.id ? { ...b, label: e.target.value } : b) })} /></label>
        <label className="text-sm text-text">Nature du compte {i + 1}<select className={inputClass} value={a.kind} onChange={e => setDraft({ ...draft, accounts: accounts.map(b => b.id === a.id ? { ...b, kind: e.target.value as "Courant" | "Épargne" } : b) })}><option>Courant</option><option>Épargne</option></select></label>
        <label className="text-sm text-text">Solde initial du compte {i + 1} (€)<input className={inputClass} type="number" step="0.01" value={numericValue(a.initialBalance)} onChange={e => setDraft({ ...draft, accounts: accounts.map(b => b.id === a.id ? { ...b, initialBalance: numeric(e.target.value) } : b) })} /></label>
        <label className="text-sm text-text">Ma quote-part du compte {i + 1} (%)<input className={inputClass} type="number" min="0" max="100" step="0.01" value={numericValue(a.share)} onChange={e => setDraft({ ...draft, accounts: accounts.map(b => b.id === a.id ? { ...b, share: numeric(e.target.value) } : b) })} /></label>
      </div>)}
    </fieldset>
    <fieldset className="card flex flex-col gap-4">
      <legend className="font-semibold text-text">Types d’opérations</legend>
      <p className="text-xs text-text-sec">Le rôle définit le calcul ; le nom sert à l’affichage. Un transfert exige deux mouvements liés, de même date et montant, sur des comptes différents. Les remboursements, revenus et achats habituels utilisent « Opération courante » ; leur sens bancaire définit crédit ou débit.</p>
      {types.map((t, i) => <div key={t.id} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm text-text">Nom du type {i + 1}<input className={inputClass} value={t.label} maxLength={100} onChange={e => setDraft({ ...draft, types: types.map(b => b.id === t.id ? { ...b, label: e.target.value } : b) })} /></label>
        <label className="text-sm text-text">Rôle du type {i + 1}<select className={inputClass} value={t.role} onChange={e => setDraft({ ...draft, types: types.map(b => b.id === t.id ? { ...b, role: e.target.value as TransactionRole } : b) })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>)}
    </fieldset>
    <fieldset className="card flex flex-col gap-3">
      <legend className="font-semibold text-text">Suivi du prêt</legend>
      <label className="flex items-center gap-2 text-sm text-text"><input type="checkbox" checked={Boolean(draft.loan)} onChange={e => setDraft({ ...draft, loan: e.target.checked ? { account: visibleAccounts[0].id, principal: 0, payment: 0, terms: 240 } : undefined })} /> Activer le suivi du prêt</label>
      {draft.loan && <>
        <label className="text-sm text-text">Compte du prêt<select className={inputClass} value={draft.loan.account} onChange={e => setDraft({ ...draft, loan: { ...draft.loan!, account: e.target.value } })}>{visibleAccounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-sm text-text">Capital initial (€)<input className={inputClass} type="number" step="0.01" value={numericValue(draft.loan.principal)} onChange={e => setDraft({ ...draft, loan: { ...draft.loan!, principal: numeric(e.target.value) } })} /></label>
          <label className="text-sm text-text">Mensualité hors assurance (€)<input className={inputClass} type="number" step="0.01" value={numericValue(draft.loan.payment)} onChange={e => setDraft({ ...draft, loan: { ...draft.loan!, payment: numeric(e.target.value) } })} /></label>
          <label className="text-sm text-text">Nombre d’échéances<input className={inputClass} type="number" step="1" value={numericValue(draft.loan.terms)} onChange={e => setDraft({ ...draft, loan: { ...draft.loan!, terms: numeric(e.target.value) } })} /></label>
        </div>
        <p className="text-xs text-text-sec">Le contrôle rapproche capital et intérêts de vos transactions de l’échéancier. Le prêt reste masqué lorsque le suivi est désactivé.</p>
      </>}
    </fieldset>
    {errors.length > 0 && <div role="alert" className="card border border-red text-red"><ul className="list-disc pl-5">{errors.map(e => <li key={e}>{e}</li>)}</ul></div>}
    {message && <p role="status" className="text-sm text-indigo-text">{message}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="submit" className="btn-primary min-h-tap px-4 py-2 rounded-md bg-indigo-deep text-white">Enregistrer les paramètres</button>
      <button type="button" className="min-h-tap px-4 py-2 text-text-sec border border-border rounded-md" onClick={() => { setDraft(config ? clone(config) : null); setErrors([]); setMessage(""); }}>Annuler les modifications</button>
      <button type="button" className="min-h-tap px-4 py-2 text-text-sec border border-border rounded-md" onClick={exportSnapshot}>Exporter les données et paramètres enregistrés (JSON)</button>
      <a href={`${import.meta.env.BASE_URL}guides/parametres.html`} target="_blank" rel="noreferrer" className="min-h-tap inline-flex items-center text-indigo-text underline">Lire le guide</a>
    </div>
  </form>;
}
