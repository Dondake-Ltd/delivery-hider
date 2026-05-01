# Delivery Hider

Chrome extension that adds a one-click way to hide restaurants and shops on supported delivery platforms.

## What it does

- Adds a `Hide` button on Wolt, Foody, and Bolt Food cards where supported.
- Persists blocked venues in Chrome storage.
- Hides blocked venues everywhere they reappear in supported listings.
- Lets you unhide venues from the popup or the options page.
- Tracks your own local hide/unhide counts for a private top-blocked view.
- Includes an opt-in telemetry foundation that queues anonymous hide/unhide events locally, but does not send anything to a server in this release.

## Install locally

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `d:\git\wolt-blocker`.

## How to use

- On supported listing pages, hover a restaurant or shop card and click `Hide`.
- On an individual place page, use the inline `Hide this place` button or the extension popup.
- Open the extension options page to search, review, and remove blocked venues.
- The options page also shows a local-only top blocked list based on your own actions.
