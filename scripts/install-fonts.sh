#!/usr/bin/env bash
# Verifies the committed OFL fonts against the sha256 values in brands/_fonts/LICENSES.md
# and installs the TTFs for the local user (used by ffmpeg drawtext on proof sheets).
set -euo pipefail
cd "$(dirname "$0")/.."
LIC=brands/_fonts/LICENSES.md
fail=0
while IFS='|' read -r _ name _ _ _ _ ttfsum woffsum _; do
  name=$(echo "$name" | xargs); ttfsum=$(echo "$ttfsum" | tr -d ' `'); woffsum=$(echo "$woffsum" | tr -d ' `')
  [[ -z "$name" || "$name" == "Font" || "$name" == ---* ]] && continue
  for pair in "ttf/$name.ttf:$ttfsum" "woff2/$name.woff2:$woffsum"; do
    f="brands/_fonts/${pair%%:*}"; want="${pair##*:}"
    got=$(sha256sum "$f" | cut -d' ' -f1)
    if [[ "$got" != "$want" ]]; then echo "::error::checksum mismatch $f"; fail=1; fi
  done
done < <(grep '^| ' "$LIC")
[[ $fail -eq 0 ]] || exit 1
mkdir -p "$HOME/.local/share/fonts/amf"
cp brands/_fonts/ttf/*.ttf "$HOME/.local/share/fonts/amf/"
command -v fc-cache >/dev/null && fc-cache -f >/dev/null || true
echo "[fonts] verified $(ls brands/_fonts/woff2 | wc -l) OFL fonts and installed TTFs"
