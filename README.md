# ตรวจถังดับเพลิง (Fire Extinguisher Inspection PWA)
Static app. Serve over HTTPS (or localhost) for camera + service worker: `python3 -m http.server 8000`.
Host on any HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages). QR codes encode `<app URL>#id=<ID>`, so print labels from the final hosted URL.
## APK
- PWABuilder: host on HTTPS -> https://www.pwabuilder.com -> enter URL -> Android package (TWA) -> signed APK/AAB.
- Capacitor: `npm i @capacitor/core @capacitor/cli @capacitor/android && npx cap init && (webDir=.) npx cap add android && npx cap open android` (add CAMERA permission). QR URLs then point at the in-app origin; scanning still works because it parses `id=`.
## Equipment categories (v7)
Items have `category`: `ext` (ถังดับเพลิง, default when empty/missing), `light` (ไฟฉุกเฉิน, EL-), `exit` (ป้ายทางหนีไฟ, EX-), `hose` (ตู้สายฉีดน้ำดับเพลิง, FH-).
Inspections store `category` and `items`; the sheet keeps the old per-key extinguisher columns and appends `category` + `checks` (JSON). Code.gs appends new header columns to existing sheets automatically; old app versions keep syncing.
After updating `apps-script/Code.gs`: put your TEAM_KEY back on line 6, then Deploy > Manage deployments > edit > Version: New version > Deploy (do not create a new deployment).
