# Groundly

*Plan & log your football trips.* Det här är webbversionen av Groundly. Den körs på GitHub Pages, och inloggning och databas sköts av Firebase. Ingen behöver ett Claude-konto.

## Så hänger det ihop

| Del | Var | Kostnad |
|---|---|---|
| Sidan (`site/`) | GitHub Pages | Gratis (publikt repo) |
| Inloggning (Google + e-post) | Firebase Authentication | Gratis |
| Forum, betyg, loggade matcher m.m. | Cloud Firestore | Gratis upp till 50 000 läsningar per dag |
| Bilder | Firebase Storage | Kräver Blaze-planen, men det finns en gratiskvot |
| Nattuppdatering av matcher och tabeller | GitHub Actions | Gratis |
| Matchdata | openfootball (CC0) + API-Football | API-Football enligt din plan |

## Mappar

- `src/` innehåller appens källkod. `template.html` är själva appen, och resten är klubbar, arenor, koordinater, färger och tips.
- `scripts/build-web.js` bygger `site/index.html` från `src/`.
- `site/` är det som publiceras. Mappen innehåller `data/` och `archive/`, som skrivs av nattjobbet, samt `js/`.
- `site/js/runtime.js` kopplar appen till Firebase. Det är också där inloggningen ligger.
- `site/js/firebase-config.js` är Firebase-projektets publika inställningar.
- `site/flytt.html` används för att läsa in data från den gamla versionen på claude.ai.
- `tools/` innehåller nattjobbet (`nightly.js`).
- `firebase/` innehåller säkerhetsreglerna för Firestore och Storage.
- `.github/workflows/deploy.yml` bygger och publicerar sidan, och kör nattuppdateringen varje natt.

## Första gången

1. **Firebase-inställningar:** klistra in värdena från Firebase-konsolen i `site/js/firebase-config.js`. Har du inte Blaze-planen sätter du `photos: false`.
2. **Säkerhetsregler:** i Firebase-konsolen, gå till *Firestore → Rules* och klistra in innehållet i `firebase/firestore.rules`. Klicka *Publish*. Gör likadant med `firebase/storage.rules` under *Storage → Rules*, om du använder bilder.
3. **Godkänd domän:** gå till *Authentication → Settings → Authorized domains* och lägg till `DITTNAMN.github.io`.
4. **GitHub Pages:** gå till *Settings → Pages → Source* och välj **GitHub Actions**.
5. **API-nyckel:** gå till *Settings → Secrets and variables → Actions → New repository secret*. Namnet ska vara `API_FOOTBALL_KEY` och värdet din nyckel. Nyckeln syns aldrig i loggar eller filer.
6. **Gör dig till moderator:**
   1. Logga in på sidan en gång.
   2. Leta upp ditt användar-id under *Authentication → Users* i Firebase.
   3. I *Firestore*, skapa samlingen `config` med dokumentet `admins` och fältet `uids`, av typen *array*, med ditt id.
7. **Flytta gammal data:** öppna `https://DITTNAMN.github.io/groundly/flytt.html`, logga in och läs in filen `groundly-flytt.json`.

## Ändra appen

Be Claude göra ändringen. Claude ändrar i `src/` och pushar till repot, och då byggs och publiceras sidan automatiskt efter någon minut. Större ändringar kan göras på en egen gren först.

## Nattuppdatering

Workflowet *Bygg och publicera* körs varje natt klockan 03:49 svensk sommartid. Det gör tre saker:

- hämtar nya matcher och resultat från openfootball, och från API-Football om nyckeln finns
- sparar dem i `site/data` och `site/archive`
- publicerar sidan

Du kan också köra workflowet manuellt under *Actions → Bygg och publicera → Run workflow*. En sammanfattning av körningen syns under körningen i Actions.
