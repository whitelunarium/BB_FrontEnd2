#!/usr/bin/env bash
# scripts/test-admin-editor.sh
#
# End-to-end test for the PNEC Live Theme Editor backend.
# Usage:
#   ./scripts/test-admin-editor.sh                                     # hits localhost
#   PNEC_API=https://beasts.opencodingsociety.com ./scripts/test-admin-editor.sh  # prod
#
# Required env:
#   PNEC_ADMIN_KEY   — admin key to send as X-PNEC-Admin-Key
#
# Optional env:
#   PNEC_API         — base URL (default: http://127.0.0.1:8425)
#   PNEC_TEST_PATH   — file path to use for tests (default: index.html)
#
# Exit code: 0 if all checks pass, non-zero otherwise.

set -u
API="${PNEC_API:-http://127.0.0.1:8425}"
KEY="${PNEC_ADMIN_KEY:-}"
TEST_PATH="${PNEC_TEST_PATH:-index.html}"

if [ -z "$KEY" ]; then
  echo "Error: PNEC_ADMIN_KEY env var is required."
  echo "       export PNEC_ADMIN_KEY=<your-admin-key> first."
  exit 2
fi

PASS=0
FAIL=0

# ─── Helpers ───────────────────────────────────────────────────────
echo_pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
echo_fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

req() {
  # req METHOD PATH [BODY] → prints status code to stdout
  local method="$1"; local path="$2"; local body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -o /tmp/pnec-test-resp.json -w "%{http_code}" \
         -X "$method" \
         -H "X-PNEC-Admin-Key: $KEY" \
         -H "Content-Type: application/json" \
         -H "Accept: application/json" \
         -d "$body" \
         "$API$path"
  else
    curl -sS -o /tmp/pnec-test-resp.json -w "%{http_code}" \
         -X "$method" \
         -H "X-PNEC-Admin-Key: $KEY" \
         -H "Accept: application/json" \
         "$API$path"
  fi
}

# ─── 1. Health ─────────────────────────────────────────────────────
echo ""
echo "1. /api/admin/publish/health"
code=$(req GET "/api/admin/publish/health")
if [ "$code" = "200" ]; then
  echo_pass "health GET 200"
  github_ok=$(python3 -c "import json; print(json.load(open('/tmp/pnec-test-resp.json')).get('github',{}).get('ok'))" 2>/dev/null)
  groq_ok=$(python3 -c "import json; print(json.load(open('/tmp/pnec-test-resp.json')).get('groq',{}).get('ok'))" 2>/dev/null)
  if [ "$github_ok" = "True" ]; then echo_pass "GitHub connected"; else echo_fail "GitHub NOT connected (need GITHUB_TOKEN env var)"; fi
  if [ "$groq_ok"   = "True" ]; then echo_pass "Groq connected";   else echo_fail "Groq NOT connected (need GROQ_API_KEY env var; AI generation disabled)"; fi
else
  echo_fail "health returned $code (expected 200). Server may not be deployed with new code yet."
fi

# ─── 2. Auth gate ──────────────────────────────────────────────────
echo ""
echo "2. Auth gate (without admin key)"
no_key=$(curl -sS -o /dev/null -w "%{http_code}" -H "Accept: application/json" "$API/api/admin/publish/health")
if [ "$no_key" = "401" ]; then echo_pass "401 without admin key"; else echo_fail "expected 401, got $no_key"; fi

# ─── 3. GET file from GitHub ──────────────────────────────────────
echo ""
echo "3. GET /api/admin/publish/file?path=$TEST_PATH"
code=$(req GET "/api/admin/publish/file?path=$TEST_PATH")
if [ "$code" = "200" ]; then
  echo_pass "file fetched"
  size=$(python3 -c "import json; print(len(json.load(open('/tmp/pnec-test-resp.json')).get('content','')))" 2>/dev/null)
  echo "    ($size chars)"
  ORIGINAL_CONTENT=$(cat /tmp/pnec-test-resp.json)
else
  echo_fail "file fetch returned $code"
fi

# ─── 4. Diff against same content (should be identical) ───────────
echo ""
echo "4. /api/admin/publish/diff with identical content"
if [ -n "${ORIGINAL_CONTENT:-}" ]; then
  body=$(python3 -c "
import json, sys
data = json.loads(open('/tmp/pnec-test-resp.json').read())
print(json.dumps({'path': '$TEST_PATH', 'content': data.get('content', '')}))
")
  code=$(req POST "/api/admin/publish/diff" "$body")
  if [ "$code" = "200" ]; then
    identical=$(python3 -c "import json; print(json.load(open('/tmp/pnec-test-resp.json')).get('identical'))")
    if [ "$identical" = "True" ]; then echo_pass "diff says identical"; else echo_fail "diff didn't detect identical content"; fi
  else
    echo_fail "diff returned $code"
  fi
else
  echo_fail "skipped — no original content to diff"
fi

# ─── 5. Diff with small change ────────────────────────────────────
echo ""
echo "5. /api/admin/publish/diff with one-char change"
if [ -n "${ORIGINAL_CONTENT:-}" ]; then
  body=$(python3 -c "
import json
data = json.loads(open('/tmp/pnec-test-resp.json').read())
c = data.get('content', '')
print(json.dumps({'path': '$TEST_PATH', 'content': c + '\n<!-- e2e test marker (not committed) -->'}))
")
  code=$(req POST "/api/admin/publish/diff" "$body")
  if [ "$code" = "200" ]; then
    added=$(python3 -c "import json; print(json.load(open('/tmp/pnec-test-resp.json')).get('lines_added'))")
    if [ "$added" -ge "1" ] 2>/dev/null; then echo_pass "diff sees $added added line(s)"; else echo_fail "expected ≥1 added line, got $added"; fi
  else
    echo_fail "diff returned $code"
  fi
fi

# ─── 6. History ───────────────────────────────────────────────────
echo ""
echo "6. /api/admin/publish/history?path=$TEST_PATH"
code=$(req GET "/api/admin/publish/history?path=$TEST_PATH&per_page=3")
if [ "$code" = "200" ]; then
  count=$(python3 -c "import json; print(len(json.load(open('/tmp/pnec-test-resp.json')).get('items',[])))")
  if [ "$count" -gt "0" ] 2>/dev/null; then echo_pass "$count commits in history"; else echo_fail "no commits returned (file has no git history?)"; fi
else
  echo_fail "history returned $code"
fi

# ─── 7. Workflow status ───────────────────────────────────────────
echo ""
echo "7. /api/admin/publish/status (Pages workflow runs)"
code=$(req GET "/api/admin/publish/status?per_page=1")
if [ "$code" = "200" ]; then echo_pass "status endpoint responding"; else echo_fail "status returned $code"; fi

# ─── 8. AI section (only if Groq connected) ───────────────────────
echo ""
echo "8. /api/admin/ai/section (Groq AI)"
body='{"prompt":"Test prompt: say hello in one short sentence.","section_kind":"text","tone":"neighborly"}'
code=$(req POST "/api/admin/ai/section" "$body")
if [ "$code" = "200" ]; then
  html=$(python3 -c "import json; print((json.load(open('/tmp/pnec-test-resp.json')).get('html') or '')[:80])")
  echo_pass "AI returned HTML: $html..."
elif [ "$code" = "503" ]; then
  echo "  − skipped: Groq not configured (GROQ_API_KEY env)"
else
  echo_fail "AI returned $code"
fi

# ─── 9. Path traversal rejected ───────────────────────────────────
echo ""
echo "9. Path traversal rejected (../../etc/passwd)"
code=$(req GET "/api/admin/publish/file?path=../../etc/passwd")
if [ "$code" = "400" ]; then echo_pass "rejected with 400"; else echo_fail "expected 400, got $code"; fi

# ─── Summary ──────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "─────────────────────────────────"
if [ "$FAIL" -gt "0" ]; then exit 1; fi
exit 0
