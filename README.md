# FrictionLayer

A Firefox extension that puts a countdown in front of distracting websites.

- Choose sites in the options page (toolbar button). Subdomains are included.
- Instead of loading, the site shows a countdown (default **15 s**), then opens.
- Optional **escalating timers**: each open of a site during the day adds N seconds (default **3 s**, adjustable, optional cap). Counts are per site and reset at local midnight.
- After a countdown you can browse that site freely in any tab for a grace period (default 5 min; 0 = wait every time).
- When the grace period ends, already-open tabs of that site are sent back to the countdown (optional, on by default).
- The countdown only advances while the tab is visible.

## Build / test

```bash
npm test          # unit tests for matching + timer logic
npm run build     # produces dist/frictionlayer.zip (upload to addons.mozilla.org)
```

For temporary local testing: `about:debugging` → This Firefox → Load Temporary Add-on → pick `src/manifest.json`.
Firefox 140+ (Android 142+) required. The extension needs access to all websites to intercept the pages you choose.
