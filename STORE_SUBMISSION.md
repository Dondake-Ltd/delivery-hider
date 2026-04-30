# Chrome Web Store Submission Pack

This repo now includes the minimum assets and copy needed for a first Chrome Web Store submission.

## Included assets

- Extension package icons:
  - `store-assets/icon16.png`
  - `store-assets/icon32.png`
  - `store-assets/icon48.png`
  - `store-assets/icon128.png`
- Store listing assets:
  - `store-assets/promo-tile-440x280.png`
  - `store-assets/screenshot-1-1280x800.png`
  - `store-assets/screenshot-2-1280x800.png`
- Upload package:
  - `wolt-blocker-store.zip`

## Suggested listing values

### Name

`Wolt Blocker`

### Summary

`Hide restaurants and shops on Wolt that you never want to see again.`

### Category

`Shopping`

### Language

`English`

### Detailed description

`Wolt Blocker adds a simple hide button to restaurants and shops on wolt.com so you can remove places you know you will never order from.

Block a venue once and it disappears from Wolt listing pages wherever it shows up again. You can also block or unblock the current venue from the extension popup, and manage your full blocked list from the options page.

Features:
- Hide restaurants and shops directly from Wolt cards
- Keep blocked venues hidden across Wolt listing pages
- Block or unblock the current venue from the popup
- Review and remove blocked venues from a searchable management page

Wolt Blocker stores your blocked list in Chrome storage and does not send your data to any external server.`

## Privacy tab text

### Single purpose description

`Lets users hide specific restaurants and shops on wolt.com and keep those venues out of Wolt listings.`

### Permission justifications

`storage`
Stores the user's blocked-venue list locally in Chrome sync storage so hidden venues stay hidden.

`tabs`
Reads the active tab URL and title in the popup so the extension can block or unblock the currently open Wolt venue.

`host permission: https://wolt.com/*`
Runs the content script on wolt.com pages so it can add hide controls and remove blocked venues from the page.

## Privacy policy recommendation

Because this extension does not collect or transmit personal or sensitive user data, a separate privacy policy URL may not be strictly required for a simple first submission. However, using a short public privacy page is still safer for review and clearer for users.

Suggested policy text:

`Wolt Blocker does not collect, sell, or transmit personal data to external servers. The extension stores only the user's blocked venue list in Chrome storage so hidden venues remain hidden across Wolt pages.`

## Test instructions

`1. Open wolt.com and browse any city discovery or restaurant listing page.
2. Hover a restaurant or shop card and click Hide.
3. Confirm the venue disappears from the page.
4. Open the extension popup while on a venue page and block or unblock the current venue.
5. Open the options page and confirm the blocked list can be searched and edited.`
