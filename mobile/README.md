# Groundly-appen (Android och iPhone)

Capacitor-skal runt webbappen i `../site`. Samma kod som webben; data hämtas färskt från webbplatsen.

- `scripts/prepare.js` kopierar `../site` till `www/` och lägger in `app-shim.js`.
- Bygget sker i GitHub Actions (`.github/workflows/android.yml`). Testversionen läggs upp som release `android-test`.
- App-id: `football.groundly.app`.

Kvar innan butikerna: inloggning med Google/Apple via appens egna funktioner, push via FCM/APNs,
ikoner och startbild, signeringsnyckel (som hemlighet) och iOS-bygge.
