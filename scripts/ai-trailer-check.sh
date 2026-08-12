#!/usr/bin/env sh
# ai-trailer-check.sh — напоминание о Co-Authored-By trailer для ИИ-коммитов
# Подключается в .husky/commit-msg. Не блокирует (exit 0), только предупреждает.
#
# Конвенция: если коммит создан ИИ-агентом, добавь trailer:
#   Co-Authored-By: Claude <noreply@anthropic.com>
#   Co-Authored-By: Gemini <noreply@google.com>
#   Co-Authored-By: Copilot <noreply@github.com>
#   Co-Authored-By: Cursor <noreply@cursor.sh>
#
# Это даёт атрибуцию и видимость доли ИИ-кода в истории.

MSG_FILE="$1"
[ -z "$MSG_FILE" ] && exit 0
[ ! -f "$MSG_FILE" ] && exit 0

# Тихий режим (для merge/amend без ИИ)
grep -q '^# AI-skip' "$MSG_FILE" 2>/dev/null && exit 0

if ! grep -qi 'Co-Authored-By' "$MSG_FILE" 2>/dev/null; then
  # Проверяем только если это не merge-коммит и не automated
  if ! grep -q '^# Please enter the commit message' "$MSG_FILE" 2>/dev/null; then
    cat >&2 <<'EOF'

💡 Напоминание: если этот коммит создан ИИ-агентом, добавь trailer для атрибуции:
   Co-Authored-By: Claude <noreply@anthropic.com>
   (или Gemini/Copilot/Cursor — выбери свой инструмент)
   Чтобы пропустить проверку, добавь строку "# AI-skip" в сообщение.
EOF
  fi
fi

exit 0
