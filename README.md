# Smart RTL Fixer for Firefox

A small privacy-first Firefox extension that improves RTL and mixed RTL/LTR rendering on modern web apps.

## Features

- Smart mode for mixed Arabic and English text
- Deep mode for stronger bidi correction
- Per-site enable toggle saved locally only
- Per-site last selected mode saved locally only
- No analytics
- No remote code
- No external libraries

## Install in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on...`
3. Select the `manifest.json` file from this folder

## Notes

- Settings are stored in `browser.storage.local`
- The extension injects CSS into pages to fix direction issues
- Code blocks and form controls remain left to right
