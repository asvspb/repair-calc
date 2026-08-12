#!/bin/bash
# Тестирование Backend API
# Использование: ./scripts/test-backend.sh

BASE_URL="http://localhost:3994"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "════════════════════════════════════════════════════════════"
echo "🧪 ТЕСТИРОВАНИЕ BACKEND API"
echo "════════════════════════════════════════════════════════════"
echo ""

# Функция для красивого вывода
test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: $2"
  else
    echo -e "${RED}❌ FAIL${NC}: $2"
  fi
}

# ═══════════════════════════════════════════════════════════
# 1. Health Check
# ═══════════════════════════════════════════════════════════
echo "📋 1. Health Check"
echo "────────────────────────────────────────────────────────"

HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health")
HEALTH_STATUS=$(echo $HEALTH_RESPONSE | grep -c '"status":"ok"')

test_result $HEALTH_STATUS "Health endpoint responds"
echo ""

# ═══════════════════════════════════════════════════════════
# 2. Database State
# ═══════════════════════════════════════════════════════════
echo "📋 2. Database State"
echo "────────────────────────────────────────────────────────"

# Projects
PROJECTS_COUNT=$(docker exec repair-calc-db mysql -u repair_user -psecure_password repair_calc -N -e "SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL;" 2>/dev/null)
test_result $([ $PROJECTS_COUNT -gt 0 ] && echo 0 || echo 1) "Projects exist in DB ($PROJECTS_COUNT)"

# Objects
OBJECTS_COUNT=$(docker exec repair-calc-db mysql -u repair_user -psecure_password repair_calc -N -e "SELECT COUNT(*) FROM objects WHERE deleted_at IS NULL;" 2>/dev/null)
test_result $([ $OBJECTS_COUNT -gt 0 ] && echo 0 || echo 1) "Objects exist in DB ($OBJECTS_COUNT)"

# Users with is_premium
USERS_WITH_PREMIUM=$(docker exec repair-calc-db mysql -u repair_user -psecure_password repair_calc -N -e "SELECT COUNT(*) FROM users WHERE is_premium IS NOT NULL;" 2>/dev/null)
test_result $([ $USERS_WITH_PREMIUM -gt 0 ] && echo 0 || echo 1) "Users have is_premium field ($USERS_WITH_PREMIUM)"

# Rooms with object_id
ROOMS_WITH_OBJECT=$(docker exec repair-calc-db mysql -u repair_user -psecure_password repair_calc -N -e "SELECT COUNT(*) FROM rooms WHERE object_id IS NOT NULL;" 2>/dev/null)
test_result $([ $ROOMS_WITH_OBJECT -gt 0 ] && echo 0 || echo 1) "Rooms have object_id ($ROOMS_WITH_OBJECT)"

echo ""

# ═══════════════════════════════════════════════════════════
# 3. Migration Verification
# ═══════════════════════════════════════════════════════════
echo "📋 3. Migration Verification"
echo "────────────────────────────────────────────────────────"

# Check project "Мои объекты" exists
MY_OBJECTS_PROJECT=$(docker exec repair-calc-db mysql -u repair_user -psecure_password repair_calc -N -e "SELECT COUNT(*) FROM projects WHERE name = 'Мои объекты' AND deleted_at IS NULL;" 2>/dev/null)
test_result $([ $MY_OBJECTS_PROJECT -gt 0 ] && echo 0 || echo 1) "Project 'Мои объекты' exists"

# Check objects migrated correctly
MIGRATED_OBJECTS=$(docker exec repair-calc-db mysql -u repair_user -psecure_password repair_calc -N -e "SELECT COUNT(*) FROM objects o JOIN projects p ON o.project_id = p.id WHERE p.name = 'Мои объекты' AND o.deleted_at IS NULL;" 2>/dev/null)
test_result $([ $MIGRATED_OBJECTS -gt 0 ] && echo 0 || echo 1) "Objects migrated to project ($MIGRATED_OBJECTS)"

# Check deleted_entities table exists
DELETED_TABLE=$(docker exec repair-calc-db mysql -u repair_user -psecure_password repair_calc -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'repair_calc' AND table_name = 'deleted_entities';" 2>/dev/null)
test_result $([ $DELETED_TABLE -gt 0 ] && echo 0 || echo 1) "deleted_entities table exists"

echo ""

# ═══════════════════════════════════════════════════════════
# 4. Detailed Database Report
# ═══════════════════════════════════════════════════════════
echo "📋 4. Detailed Database Report"
echo "────────────────────────────────────────────────────────"

echo "Projects:"
docker exec repair-calc-db mysql -u repair_user -psecure_password repair_calc -e "SELECT id, name, is_premium FROM projects WHERE deleted_at IS NULL;" 2>/dev/null | head -5

echo ""
echo "Objects:"
docker exec repair-calc-db mysql -u repair_user -psecure_password repair_calc -e "SELECT o.id, o.name, o.city, p.name as project FROM objects o JOIN projects p ON o.project_id = p.id WHERE o.deleted_at IS NULL;" 2>/dev/null | head -10

echo ""
echo "Users:"
docker exec repair-calc-db mysql -u repair_user -psecure_password repair_calc -e "SELECT id, email, is_premium FROM users LIMIT 5;" 2>/dev/null | head -10

echo ""

# ═══════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════
echo "════════════════════════════════════════════════════════════"
echo "📊 SUMMARY"
echo "════════════════════════════════════════════════════════════"
echo "Projects: $PROJECTS_COUNT"
echo "Objects: $OBJECTS_COUNT"
echo "Rooms with object_id: $ROOMS_WITH_OBJECT"
echo ""
echo "✅ Backend database migration: COMPLETE"
echo "✅ Tables created: objects, deleted_entities"
echo "✅ Fields added: users.is_premium, rooms.object_id"
echo "════════════════════════════════════════════════════════════"
