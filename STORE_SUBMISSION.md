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
  - `delivery-hider-store.zip`

## Suggested listing values

### Name

`Delivery Hider`

### Summary

`Hide restaurants and shops on supported delivery platforms that you never want to see again.`

### Category

`Shopping`

### Language

`English`

### Detailed description

`Delivery Hider adds a simple hide button to restaurants and shops on supported delivery platforms so you can remove places you know you will never order from.

Hide a place once and it disappears from supported listing pages wherever it shows up again. You can also hide or unhide the current place from the extension popup, and manage your full hidden list from the options page.

Features:
- Hide restaurants and shops directly from supported delivery cards
- Keep hidden places hidden across supported listing pages
- Hide or unhide the current place from the popup
- Review and remove hidden places from a searchable management page
- See a local-only top blocked list based on your own hide history
- Configure an opt-in telemetry setting that currently queues anonymous events locally only

Supported platforms currently include Wolt, Foody, and Bolt Food web pages where compatible.

Delivery Hider stores your hidden list, local hide/unhide counts, and optional local-only queued telemetry events in Chrome storage and does not send your data to any external server in this release.`

## Privacy tab text

### Single purpose description

`Lets users hide specific restaurants and shops on supported delivery platforms and keep those venues out of listings.`

### Permission justifications

`storage`
Stores the user's hidden-place list, local hide/unhide counts, telemetry consent setting, and optional local-only queued telemetry events so hidden venues stay hidden, the local top-blocked view can work, and the future telemetry consent flow can be tested without any network transmission.

`host permissions`
Runs the content script on supported delivery websites so it can add hide controls and remove hidden venues from listings.

## Privacy policy recommendation

Because this extension does not collect or transmit personal or sensitive user data, a separate privacy policy URL may not be strictly required for a simple first submission. However, using a short public privacy page is still safer for review and clearer for users.

Suggested policy text:

`Delivery Hider does not collect, sell, or transmit personal data to external servers in the current release. The extension stores only the user's hidden venue list, local hide/unhide counts, telemetry consent setting, and optional local-only queued telemetry events in Chrome storage so hidden venues remain hidden across supported delivery pages.`

## Test instructions

`1. Open wolt.com, foody.com.cy, or food.bolt.eu and browse a restaurant or store listing page.
2. Hover a supported card and click Hide.
3. Confirm the place disappears from the page.
4. Open the extension popup while on a supported place page and hide or unhide the current place.
5. Open the options page and confirm the hidden list can be searched and edited.
6. Confirm the local-only top blocked list updates as you hide and unhide places.`
