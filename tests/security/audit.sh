#!/bin/bash
# Security audit script — Undercity
# Run from project root: bash tests/security/audit.sh

set -e

echo "=== Undercity Security Audit ==="
echo ""

# 1. npm audit
echo "--- npm audit (backend) ---"
cd backend
npm audit --audit-level=high || true
cd ..

echo ""
echo "--- npm audit (frontend) ---"
cd frontend
npm audit --audit-level=high || true
cd ..

echo ""
echo "--- Checking for secrets in code ---"
# Check for accidental secrets
grep -rn "sk_live\|pk_live\|SG\." backend/src/ --include="*.ts" --include="*.js" 2>/dev/null && echo "⚠️  WARNING: Possible secrets found!" || echo "✅ No secrets found"

grep -rn "sk_live\|pk_live\|SG\." frontend/src/ --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null && echo "⚠️  WARNING: Possible secrets found!" || echo "✅ No secrets in frontend"

echo ""
echo "--- Checking for TODO/FIXME in locked files ---"
cd ..
grep -rn "TODO\|FIXME\|HACK\|XXX" backend/src/routes/ backend/src/controllers/ backend/src/middleware/ --include="*.ts" 2>/dev/null | grep -v "node_modules" | grep -v ".test." && echo "⚠️  Unresolved TODOs in locked files" || echo "✅ No TODOs in locked files"

echo ""
echo "--- Checking env vars ---"
grep -c "process.env\." backend/src/utils/envValidator.ts 2>/dev/null && echo "✅ Env validation present" || echo "⚠️  Missing env validation"

echo ""
echo "=== Audit Complete ==="
