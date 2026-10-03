#!/usr/bin/env bash
# docs-check.sh — автопроверка документации (ADR-0001, guidelines §7).
# Выход 0 = всё зелёное; ненулевой = список ошибок.
# Проверяет: (1) ссылки карты docs/README.md существуют; (2) у docs/*.md есть
# freshness-заголовок; (3) ADR пронумерованы без дыр и имеют статус; (4) PROGRESS.md жив.

set -u
cd "$(dirname "$0")/.."
ERRORS=0

err() { echo "❌ $1"; ERRORS=$((ERRORS + 1)); }

echo "==> 1/4 Ссылки карты docs/README.md"
while IFS= read -r ref; do
  target="docs/${ref#./}"
  [[ -e "$target" ]] || err "карта ссылается на несуществующий файл: $ref"
done < <(grep -oE '\]\((\./[^)#]+|\.\./[^)#]+)' docs/README.md | sed 's/](//' )
echo "    ссылок проверено: $(grep -cE '\]\((\./|\.\./)' docs/README.md)"

echo "==> 2/4 Freshness-заголовки docs/*.md"
for f in docs/*.md; do
  base="$(basename "$f")"
  [[ "$base" == "README.md" || "$base" == "AI_DOCUMENTATION_GUIDELINES.md" ]] && continue
  grep -q '\*\*Статус:\*\*' "$f" || err "$f: нет заголовка 'Статус:'"
  grep -q '\*\*Проверено:\*\*' "$f" || err "$f: нет заголовка 'Проверено:'"
done

echo "==> 3/4 ADR"
prev=0
for f in docs/adr/[0-9]*.md; do
  [[ -e "$f" ]] || { err "нет ни одного ADR"; break; }
  base="$(basename "$f" .md)"; n="${base%%-*}"
  [[ "$n" =~ ^[0-9]{4}$ ]] || { err "$f: имя не NNNN-slug"; continue; }
  (( n == prev + 1 )) || err "ADR: дыра/повтор в нумерации после $prev (файл $n)"
  prev=$n
  grep -qE 'Статус:\*\* (Proposed|Accepted|Deprecated|Superseded)' "$f" \
    || err "$f: нет валидного статуса ADR"
done

echo "==> 4/4 PROGRESS.md"
[[ -s docs/PROGRESS.md ]] || err "docs/PROGRESS.md отсутствует или пуст"

if (( ERRORS > 0 )); then
  echo "🔴 docs-check: $ERRORS ошибок"
  exit 1
fi
echo "✅ docs-check: зелёный"
