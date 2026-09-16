#!/bin/sh
set -eu
cd "${CI_PRIMARY_REPOSITORY_PATH:?Xcode Cloud repository path is required}"
# Build from this checkout only. No assets or code are fetched from the live game.
brew install node@22 php
export PATH="$(brew --prefix node@22)/bin:$(brew --prefix php)/bin:$PATH"
npm ci
npm --prefix apps/mobile ci
npm run mobile:sync
