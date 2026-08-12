#!/usr/bin/env sh
# check-secrets.sh — детерминированный guardrail: блокирует коммит со секретами в staged-файлах
# Подключается в .husky/pre-commit (ДО depcruise/lint-staged).
# Exit 1 = блокировка коммита, exit 0 = пропуск.
#
# Что ловит:
#   - API keys (Google/Gemini AIza..., OpenAI sk-..., Mistral, Anthropic sk-ant-...)
#   - JWT секреты в присваивании (JWT_SECRET=..., JWT_ACCESS_SECRET=...)
#   - Private keys (-----BEGIN ... PRIVATE KEY-----)
#   - Строки подключения с паролем (mongodb/postgres://user:password@)
#
# Подход: сканируем только staged-файлы через git diff --cached, игнорируем .env.example и *.md (документация).

set -eu

# Тихий режим (для特殊情况): переменная SKIP_SECRET_CHECK=1
if [ "${SKIP_SECRET_CHECK:-0}" = "1" ]; then
  echo "⏭️  Проверка секретов пропущена (SKIP_SECRET_CHECK=1)"
  exit 0
fi

# Список staged-файлов, исключая удалённые, .md, .env.example, .example файлы
FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -vE '\.(md|example)$' || true)

if [ -z "$FILES" ]; then
  exit 0
fi

# Паттерны секретов (basic regex для portability)
PATTERNS='
AIza[0-9A-Za-z_-]{35}
sk-ant-[0-9A-Za-z_-]{50,}
sk-proj-[0-9A-Za-z_-]{40,}
sk-[0-9A-Za-z]{40,}
MISTRAL_API_KEY=[\"'"'"']?[0-9A-Za-z_-]{20,}
(JWT_|JWT_ACCESS_|JWT_REFRESH_)?SECRET=[\"'"'"']?[0-9A-Za-z_-]{16,}
-----BEGIN [A-Z ]*PRIVATE KEY-----
(mongodb|postgres|postgresql|redis|amqp)://[^:@/]+:[^@/]+@
xoxb-[0-9]+-[0-9]+-[0-9A-Za-z]+
ghp_[0-9A-Za-z]{36}
'

FOUND=0
for FILE in $FILES; do
  [ ! -f "$FILE" ] && continue
  # Получаем staged-версию содержимого (не рабочую!)
  CONTENT=$(git diff --cached -- "$FILE" 2>/dev/null || true)
  [ -z "$CONTENT" ] && continue

  MATCH=$(printf '%s\n' "$PATTERNS" | while IFS= read -r PATTERN; do
    [ -z "$PATTERN" ] && continue
    # Ищем только в добавленных строках (начинающихся с +, не ++)
    # -e защищает паттерны, начинающиеся с -- (напр. -----BEGIN... PRIVATE KEY)
    echo "$CONTENT" | grep -E '^\+' | grep -vE '^\+\+' | grep -Eqe "$PATTERN" && echo "$PATTERN"
  done)

  if [ -n "$MATCH" ]; then
    echo "🚨 ОБНАРУЖЕН СЕКРЕТ в staged-файле: $FILE" >&2
    echo "   Совпадение с паттерном:" >&2
    echo "$MATCH" | sed 's/^/     - /' >&2
    echo "" >&2
    echo "   Если это ложное срабатывание или секрет в .env.example:" >&2
    echo "     1. Убедись, что секрет в .env (не коммитится)" >&2
    echo "     2. Для пропуска: SKIP_SECRET_CHECK=1 git commit ..." >&2
    echo "" >&2
    FOUND=1
  fi
done

if [ "$FOUND" -ne 0 ]; then
  echo "❌ Коммит заблокирован: в staged-файлах найдены потенциальные секреты." >&2
  exit 1
fi

exit 0
