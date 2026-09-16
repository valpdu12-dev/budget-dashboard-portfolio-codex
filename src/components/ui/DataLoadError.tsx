import { RotateCcw, TriangleAlert } from "lucide-react";

interface DataLoadErrorProps {
  detail: string | null;
  onRetry: () => void;
}

export function DataLoadError({ detail, onRetry }: DataLoadErrorProps) {
  return (
    <main className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
      <section
        className="card max-w-lg w-full text-center border border-red/40"
        role="alert"
        aria-labelledby="data-load-error-title"
      >
        <TriangleAlert className="mx-auto mb-4 text-red" size={36} aria-hidden="true" />
        <h1 id="data-load-error-title" className="font-title text-xl font-semibold">
          Impossible de charger les données
        </h1>
        <p className="mt-2 text-sm text-text-sec">
          La démonstration n’a pas pu lire ses fichiers locaux. Vérifiez la connexion, puis réessayez.
        </p>
        {detail && (
          <details className="mt-3 text-left text-xs text-text-sec">
            <summary className="cursor-pointer text-center">Afficher le détail technique</summary>
            <p className="mt-2 break-words">{detail}</p>
          </details>
        )}
        <button
          type="button"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-deep px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-text"
          onClick={onRetry}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Réessayer
        </button>
      </section>
    </main>
  );
}
