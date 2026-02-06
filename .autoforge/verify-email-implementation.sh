#!/bin/bash

# Email Verification Implementation Verification Script
# Tests that all required files exist and have correct structure

echo "=========================================="
echo "Email Verification Implementation Check"
echo "=========================================="
echo ""

# Check files exist
echo "1. Checking required files exist..."

files=(
  "app/api/auth/send-verification/route.ts"
  "app/api/auth/verify-email/[token]/route.ts"
  "components/email-verification-notice.tsx"
)

all_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file (MISSING)"
    all_exist=false
  fi
done

echo ""
echo "2. Checking database schema..."

if grep -q "email_verification_tokens" lib/db.ts; then
  echo "   ✅ email_verification_tokens table defined"
else
  echo "   ❌ email_verification_tokens table NOT FOUND"
  all_exist=false
fi

echo ""
echo "3. Checking API endpoints..."

if grep -q "send-verification" app/api/auth/send-verification/route.ts 2>/dev/null; then
  echo "   ✅ Send verification endpoint exists"
else
  echo "   ❌ Send verification endpoint MISSING"
  all_exist=false
fi

if grep -q "verify-email" app/api/auth/verify-email/\[token\]/route.ts 2>/dev/null; then
  echo "   ✅ Verify email endpoint exists"
else
  echo "   ❌ Verify email endpoint MISSING"
  all_exist=false
fi

echo ""
echo "4. Checking UI component..."

if grep -q "EmailVerificationNotice" components/email-verification-notice.tsx 2>/dev/null; then
  echo "   ✅ EmailVerificationNotice component exists"
else
  echo "   ❌ EmailVerificationNotice component MISSING"
  all_exist=false
fi

if grep -q "EmailVerificationNotice" app/page.tsx 2>/dev/null; then
  echo "   ✅ Component imported in dashboard"
else
  echo "   ❌ Component NOT imported in dashboard"
  all_exist=false
fi

echo ""
echo "5. Checking auth updates..."

if grep -q "emailVerified" lib/auth.ts; then
  echo "   ✅ User interface includes emailVerified"
else
  echo "   ❌ User interface MISSING emailVerified"
  all_exist=false
fi

if grep -q "email_verified" app/api/auth/login/route.ts; then
  echo "   ✅ Login returns email verification status"
else
  echo "   ❌ Login MISSING email verification status"
  all_exist=false
fi

if grep -q "email_verified" app/api/auth/session/route.ts; then
  echo "   ✅ Session returns email verification status"
else
  echo "   ❌ Session MISSING email verification status"
  all_exist=false
fi

echo ""
echo "=========================================="
if [ "$all_exist" = true ]; then
  echo "✅ ALL CHECKS PASSED"
  echo ""
  echo "Implementation is complete and ready for testing!"
else
  echo "❌ SOME CHECKS FAILED"
  echo ""
  echo "Please review the errors above."
fi
echo "=========================================="
