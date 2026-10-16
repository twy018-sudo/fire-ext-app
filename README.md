# ตรวจถังดับเพลิง (Fire Extinguisher Inspection PWA)
Static app. Serve over HTTPS (or localhost) for camera + service worker: `python3 -m http.server 8000`.
Host on any HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages). QR codes encode `<app URL>#id=<ID>`, so print labels from the final hosted URL.
## APK
- PWABuilder: host on HTTPS -> https://www.pwabuilder.com -> enter URL -> Android package (TWA) -> signed APK/AAB.
- Capacitor: `npm i @capacitor/core @capacitor/cli @capacitor/android && npx cap init && (webDir=.) npx cap add android && npx cap open android` (add CAMERA permission). QR URLs then point at the in-app origin; scanning still works because it parses `id=`.
