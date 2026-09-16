#!/bin/sh
set -eu
cd "${CI_PRIMARY_REPOSITORY_PATH:?Xcode Cloud repository path is required}"
export PATH="$(brew --prefix node@22)/bin:$PATH"
MOBILE_VERSION=$(node -p 'require("./apps/mobile/package.json").version')
MOBILE_BUILD=${CI_BUILD_NUMBER:?A unique increasing Xcode Cloud build number is required}
case "$MOBILE_BUILD" in ''|*[!0-9]*) echo "Invalid build number" >&2; exit 1;; esac
cd apps/mobile/ios/App
agvtool new-marketing-version "$MOBILE_VERSION"
agvtool new-version -all "$MOBILE_BUILD"
