#!/usr/bin/env bash
# Compatibilité pour les habitudes locales : les scripts npm appellent
# désormais Vitest directement, sans dépendre d'un dossier temporaire.
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
exec ./node_modules/.bin/vitest "$@"
