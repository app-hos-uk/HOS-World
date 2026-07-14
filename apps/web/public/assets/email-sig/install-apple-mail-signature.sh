#!/bin/bash
# Install HOS email signature into Apple Mail with hosted image URLs.
# Usage: ./install-apple-mail-signature.sh

set -euo pipefail

SIG_ID="2AEA77B2-7E08-4344-83A4-A9DEFBFF07C8"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$SCRIPT_DIR/sam-dean-signature.mailsignature"

if [[ ! -f "$SOURCE" ]]; then
  echo "Error: sam-dean-signature.mailsignature not found next to this script."
  exit 1
fi

echo "=== HOS Apple Mail Signature Installer ==="
echo ""
echo "IMPORTANT: Quit Mail completely before continuing (Cmd+Q)."
read -r -p "Press Enter when Mail is quit..."

# Search common Apple Mail signature locations (newest first)
SEARCH_PATHS=(
  "$HOME/Library/Mobile Documents/com~apple~mail/Data/MailData/Signatures"
  "$HOME/Library/Mail/V10/MailData/Signatures"
  "$HOME/Library/Mail/V9/MailData/Signatures"
  "$HOME/Library/Mail/V8/MailData/Signatures"
  "$HOME/Library/Mail/V7/MailData/Signatures"
)

TARGET_DIR=""
for dir in "${SEARCH_PATHS[@]}"; do
  if [[ -d "$dir" ]]; then
    TARGET_DIR="$dir"
    break
  fi
done

if [[ -z "$TARGET_DIR" ]]; then
  echo ""
  echo "Could not find Mail Signatures folder automatically."
  echo "Create a placeholder signature in Mail → Settings → Signatures, quit Mail, then re-run."
  echo ""
  echo "Manual paths to check:"
  for dir in "${SEARCH_PATHS[@]}"; do
    echo "  $dir"
  done
  exit 1
fi

TARGET="$TARGET_DIR/${SIG_ID}.mailsignature"

# Unlock existing file — Mail or a prior install may have set the immutable flag (uchg).
if [[ -f "$TARGET" ]]; then
  if ls -lO "$TARGET" 2>/dev/null | grep -q ' uchg '; then
    echo "Unlocking existing signature file..."
    chflags nouchg "$TARGET" || {
      echo "Error: Could not unlock $TARGET"
      echo "Unlock manually: Finder → Get Info → uncheck Locked, or run:"
      echo "  chflags nouchg \"$TARGET\""
      exit 1
    }
  fi
  cp "$TARGET" "${TARGET}.backup-$(date +%Y%m%d-%H%M%S)"
  echo "Backed up existing signature."
fi

cp "$SOURCE" "$TARGET"
echo "Installed signature to:"
echo "  $TARGET"

# Lock file so Mail does not overwrite hosted URLs with embedded images
chflags uchg "$TARGET" 2>/dev/null || true
echo "Locked signature file (prevents Mail from reverting to embedded images)."

echo ""
echo "=== Next steps ==="
echo "1. Open Mail → Settings → Privacy"
echo "   - Turn OFF 'Protect Mail Activity'"
echo "   - Turn OFF 'Block All Remote Content' (if shown)"
echo "2. Open Mail → Settings → Viewing"
echo "   - Turn ON 'Load remote content in messages'"
echo "3. Reopen Mail and select this signature for your account."
echo ""
echo "Note: Images may NOT preview in the signature editor — that is normal."
echo "      Send a test email to yourself to verify images load in the received message."
