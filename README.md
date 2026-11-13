# Styrkeloggen – første versjon

En enkel, mobilvennlig treningslogg for det eksisterende maskinprogrammet.

## Innhold
- 7 maskinøvelser med oppgitte startvekter
- Registrering av kilo og reps per sett, med +/- piler for reps\n- Pågående økt lagres automatisk og kan gjenopptas etter at appen lukkes eller nettleseren lastes på nytt
- Tre sett som standard, justerbart repetisjonsmål
- 3 minutters pauseklokke som standard
- Progresjonsråd ved mer enn målet i siste sett
- Historikk, volumoversikt og progresjonskurve per øvelse\n- Etterregistrering av økter med kalender/dato-felt (fremtidige datoer blokkeres)
- Muskelgruppefilter
- Flytt øvelser i dagens standardrekkefølge ved å trykke «Endre rekkefølge» og dra kortene
- Lokal lagring i nettleseren og eksport av JSON-backup

## Kjør appen
Pakk ut ZIP-filen og åpne `index.html` i nettleseren. Appen er laget med HTML, CSS og JavaScript uten byggeverktøy.

På iPhone kan du åpne appen i Safari. For en app-lignende snarvei: Del → Legg til på Hjem-skjerm.

## Viktig om data
Data lagres lokalt i nettleseren på enheten. Eksporter backup fra Innstillinger før du bytter enhet eller rydder nettleserdata.

## Førsteversjon / kjente avgrensninger
- Data synkroniseres ikke mellom enheter.
- Ingen brukerinnlogging eller skytjeneste.
- Rekkefølgeendring er støttet i nettlesere med drag-and-drop; mobil dra-og-slipp kan variere.
- Dette er en grunnversjon. Vi kan bygge videre på tilpasning av øvelser, redigering av muskelgrupper, grafer og mer detaljert historikk.
\n\n### v1.5\n- Siste økt på oversikten hentes fra nyeste treningsdato, uavhengig av registreringsrekkefølge.\n- Belastning vises og brukes per øvelse ut fra den nyeste gjennomførte økten for den øvelsen. Etterregistrerte eldre økter overskriver ikke nyere belastninger.\n\n\n### v1.6\n- Cache-busting version query strings for stylesheet and JavaScript assets to help Safari/GitHub Pages load the updated code.\n- Latest session and per-exercise load are based on workout date, not entry order.\n\n\n### v1.7\n- Adds a single, conservative next-load recommendation based on completed sets and reps above target.\n- Adds a per-exercise hold-load flag when the movement felt difficult.\n- Recommendation avoids increasing more than one exercise and explicitly treats muscle strength ratios as a cautious heuristic, not a universal medical/fitness standard.\n\n\n### v1.8\n- Adds a muscle-group progression visualization for the latest 10 logged workouts, comparing average working loads in the first and last up-to-three sessions. Values are a rough trend indicator and not direct strength measurements.\n\n\n### v1.8\n- Adds front/back muscle-map visualization with relative color-coded progression across the latest 10 workouts.\n- Shows per-muscle progression estimates based on logged load and reps, with a note that this is not a direct measure of hypertrophy.\n

### v1.9 — Muskelkart correction
- Fixes equal/zero results incorrectly turning all muscle regions green.
- Compares each exercise's first and latest available entries within the latest ten workouts.
- Uses a simple Epley estimated-strength indicator from load and reps, aggregated across exercises assigned to each muscle group.
- Displays an explicit insufficient-data state and progress/regression labels.
- Color thresholds: >0% small, 4%+ good, 8%+ strongest; no change/regression stays neutral.


## v2.0 — 3D anatomy viewer prototype

- Adds a real Three.js / WebGL viewport using the Écorché open anatomy GLB (named anatomical meshes).
- Supports touch/mouse orbit, pinch/scroll zoom, model layer toggle (muscles vs. skeleton), and mesh click name display.
- Model asset is loaded from the upstream project at runtime; this initial prototype therefore requires internet access. Three.js modules are loaded from jsDelivr.
- Écorché model attribution: Écorché (github.com/Charleeh/ecorche), CC BY-SA 4.0. Based on BodyParts3D, © The Database Center for Life Science, CC BY 4.0, and Z-Anatomy by Gauthier Kervyn, CC BY-SA 4.0. Model adaptations/derivatives shared must retain CC BY-SA 4.0.
- This is a viewer prototype. Muscle progression coloring is not yet wired to individual mesh names; that mapping is the next integration stage.


## Versjon 2.1 – feilhåndtering for 3D
- Viser feilmelding og «Prøv igjen» hvis modellen ikke lastes innen 25 sekunder.
- Viser egen melding hvis selve 3D-modulen ikke kan lastes fra CDN.
- Fortsatt avhengig av internett for eksterne Three.js-moduler og Écorché-modellen.
- Progresjonsfargene på 3D-muskler er ikke ferdig koblet til historikken i denne versjonen.


## Versjon 2.2 – anatomisk illustrasjon og progresjonsfarger
- Fjernet den eksterne interaktive 3D-modellen fra progresjonssiden.
- La inn en lokal front-/bakside anatomisk illustrasjon (JPG), slik at den ikke må lastes fra en ekstern 3D-server.
- Progresjonsrader bruker nå: rød (tilbakegang), grå (stabil), blå (moderat, +3–9,9 %), grønn (stor, +10–19,9 %), lime (svært stor, +20 % eller mer).
- Progresjonstallene er fortsatt estimert styrkeutvikling fra registrerte økter. Illustrasjonsfargene er kun en generell visuell referanse, ikke individuelle muskelmålinger.


## Versjon 2.3 – start treningsøkt
- Startknappen åpner treningsvisningen før forsøket på å lagre pågående økt.
- Feil ved lokal lagring skal ikke lenger blokkere starten; brukeren får en synlig beskjed.
- Startknappens handler fanger uventede feil og viser en melding i stedet for å feile stille.


## Versjon 2.4 – robust lagring på iPhone
- Beholder localStorage som primærlagring.
- Hvis Safari avviser skriving (for eksempel ved full kvote), forsøker appen automatisk IndexedDB.
- Data og pågående økt leses fra IndexedDB dersom localStorage ikke kan brukes.
- Hvis begge lagringsmekanismene feiler, brukes kun midlertidig minne og appen varsler tydelig.


## Versjon 2.5 – navigering under treningsøkt
- Navigasjonsmenyen kan brukes mens en treningsøkt pågår.
- En fast øktlinje vises på andre sider; trykk på den for å gå tilbake til økten.
- Pauseklokken bruker et sluttidspunkt i stedet for å telle ned ett sekund per intervall, slik at den holder riktig tid ved navigering og når Safari legger siden i bakgrunnen.
- Pågående pause gjenopprettes fra lagret økt når appen åpnes igjen.


## Versjon 2.6 – kompakt treningsvisning
- Skjuler den store app-toppbaren mens en økt pågår.
- Reduserer høyde og mellomrom i belastningskort, settliste, pausekort og instruksjon.
- Beholder alle felt og knapper, men gjør kontrollene tettere slik at «Neste øvelse» får plass på iPhone.
- Kompakt modus aktiveres bare på treningssiden og små skjermer.


## Versjon 2.7 – balansert treningsvisning og komplett muskeloversikt
- Justerte treningssiden opp fra den for kompakte v2.6-størrelsen. Topptekst, øvelsesnavn, settfelt, pausekort og knapper er større igjen, samtidig som navigasjonsknappene beholdes synlige.
- Muskeloversikten viser nå alle åtte muskelgruppene fra treningsprogrammet: skuldre, bryst, rygg, biceps, triceps, core, bein og sete.
- Muskelgrupper uten nok historikk skjules ikke lenger; de vises med «Ikke nok data».
- Hver beregnet muskelgruppe viser hvilke øvelser som ligger til grunn, slik at koblingen mellom øvelser og muskelgrupper er etterprøvbar.


## Versjon 2.8 – styrkeprogresjon med e1RM
- Hovedindikator for styrke er nå estimert 1RM (Epley): belastning × (1 + repetisjoner / 30).
- Bare sett markert som fullført og med positiv belastning/repetisjoner inngår.
- Progresjon glattes ved å sammenligne gjennomsnittet av de siste 2–3 øktene med de foregående 2–3 øktene (minst to økter kreves).
- Muskelgrupper får gjennomsnittlig prosentvis e1RM-utvikling på tvers av relevante øvelser, slik at en enkelt øvelse ikke alene definerer gruppen.
- Øvelseskort viser e1RM-kurve, siste belastning, repetisjoner og volum for siste registrerte økt.
- Volum (kg × reps) er sekundær indikator og holdes adskilt fra estimert styrke.


## Versjon 2.9 – dynamisk fargekobling til muskelkart
- Erstatter det flate JPG-bildet med en lokal SVG-anatomisk illustrasjon med separate grupper for skuldre, bryst, rygg, biceps, triceps, core, bein og sete.
- Front- og bakside-elementer for samme muskelgruppe deler samme progresjonsfarge.
- Fargene oppdateres direkte fra e1RM-prosentene i muskeloversikten: rød (< -3 %), grå (-3 til +3 %), blå (+3 til +10 %), grønn (+10 til +20 %), lime (>= +20 %).
- Muskelgrupper uten tilstrekkelig historikk vises i dempet grå.
- SVG-filen ligger lokalt i prosjektet og krever ikke ekstern 3D-tjeneste.


## Versjon 3.0 – realistisk muskelillustrasjon med dynamiske fargelag
- Gjeninnfører den detaljerte anatomiske illustrasjonen fra tidligere versjon som hovedbilde.
- Fjerner den stiliserte piktogramfiguren fra visningen.
- Legger et separat SVG-fargelag over bildet, med gjennomsiktige former for skuldre, bryst, rygg, biceps, triceps, core, bein og sete.
- Fargene følger de samme e1RM-tersklene som progresjonsoversikten, men den anatomiske illustrasjonen og dens detaljer beholdes synlige under fargene.
- Fargelagene er lokale filer og krever ingen eksterne tjenester.


## Versjon 3.1 – anbefalt belastning i neste økt
- Når siste lagrede økt gir én kvalifisert progresjonsanbefaling, starter neste ordinære økt med den anbefalte belastningen på den aktuelle øvelsen.
- Anbefalingen vises tydelig i treningsbildets fokusfelt med forrige og ny belastning.
- Øvrige øvelser starter med sist registrerte belastning.
- Historiske økter som legges inn via kalender får ikke automatisk fremtidig anbefaling.
- Brukeren kan fortsatt justere belastningen manuelt før eller under økten.


## Versjon 3.2 – korrigert anatomivisning
- Fjerner feilplassert SVG-kroppssilhuett og alle generiske fargeflater som overlappet anatomibildet.
- Viser den opprinnelige realistiske anatomiske illustrasjonen rent og uten overlegg.
- Muskelgruppenes progresjon vises fortsatt i fargede målere under illustrasjonen.
- Beholder anbefalt belastning fra forrige økt (v3.1).
- Individuell fargelegging av muskler er satt på pause til vi har anatomisk presise masker som er tilpasset selve bildet.


## Versjon 3.3 – anatomisk referanse fra OpenStax
- Bytter ut den AI-genererte kroppsillustrasjonen med en anatomisk muskelillustrasjon basert på OpenStax Anatomy & Physiology, redrawn by Tomáš Kebert / umimeto.org.
- Kilde: Wikimedia Commons, `Muscles front and back.svg`.
- Lisens: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0); kilde og lisens er oppgitt i appen.
- Illustrasjonen viser muskulaturen forfra og bakfra med faglig anatomisk referanse. Den er en visuell oversikt, ikke et individuelt målekart.
- Dynamisk fargelegging av enkeltmuskler er ikke aktivert. Progresjonstall og fargede målere vises separat, slik at appen ikke hevder å fargelegge anatomiske områder den ikke kan identifisere presist.


## Versjon 3.4 – kobling mellom progresjon og anatomikart
- Legger et transparent, lokalt SVG-lag over OpenStax/Kebert-illustrasjonen.
- De åtte muskelgruppene (Skuldre, Bryst, Rygg, Biceps, Triceps, Core, Bein, Sete) får farge fra nøyaktig samme beregnede prosentverdi og terskler som progresjonsradene.
- Ingen data vises dempet grå; negative utviklingstall røde, stabil grå, moderat blå, stor grønn og svært stor lime.
- Fargelagene er brede anatomiske regioner som er manuelt plassert mot grunnillustrasjonen. De er en pedagogisk oversikt, ikke individuelle muskel-/fibergrenser eller måling av muskelvekst.
- Beholder treningshistorikk, pauseklokke, navigasjon og anbefalt belastning fra forrige økt.


## Versjon 3.5 – flytt treningsloggen mellom enheter
- Eksporterer en JSON-sikkerhetskopi med dato i filnavnet.
- Backupen inneholder øvelser, treningshistorikk, innstillinger og eventuell pågående økt med gjeldende øvelsesindeks/pauseinformasjon.
- Import lar brukeren velge en JSON-fil fra enheten.
- Filen valideres før import, og appen viser antall økter/øvelser og ber om bekreftelse før eksisterende data erstattes.
- Importerte data lagres gjennom samme lokale lagringslag som appen ellers bruker (localStorage med IndexedDB-fallback).
- Kompatibel med eldre JSON-backuper som inneholder settings, exercises og history; pågående økt blir da tom.


## Versjon 3.6 – tydelig progresjon og maksvekt
- Maksvekt kan registreres individuelt per øvelse; tomt felt betyr ingen registrert grense.
- Når apparatets maksvekt er nådd og alle sett er fullført med siste sett over repetisjonsmålet, foreslås én ekstra repetisjon per sett i stedet for mer vekt.
- Nytt repetisjonsmål lagres per øvelse etter fullført anbefalt økt.
- Anbefalingen i treningsvisningen er tydelig fremhevet med «ANBEFALT NESTE ØKT».


## Versjon 3.7 – anatomiske muskelmasker koblet til progresjon
- Erstatter de håndtegnede, feilplasserte fargeflatene med `js-rich-body-highlighter` (v0.1.1), et rammeverksuavhengig muskelkart med 14 sporede muskelgrupper og individuelle masker. MIT-lisens.
- Viser separate front- og baksidefigurer. Kartbiblioteket farger de sporede muskelbanene med `mix-blend-mode`, slik at fargen følger muskelkonturene i illustrasjonen.
- Kobler programgruppene til kartets faktiske maskenavn:
  - Skuldre → shoulders
  - Bryst → chest
  - Rygg → upper_back, lats, lower_back
  - Biceps → biceps
  - Triceps → triceps
  - Core → abs, obliques
  - Bein → quads, hamstrings, calves
  - Sete → glutes
- Progresjonslisten og muskelkartet bruker samme e1RM-prosent og samme fargeskala.
- Trykk på en progresjonsrad for å fremheve gruppen i begge figurene; trykk på en muskel i figuren for å velge samme gruppe i listen.
- Hvis CDN/biblioteket ikke kan lastes, vises OpenStax-referanseillustrasjonen uten misvisende fargeoverlegg. Progresjonsradene fungerer fortsatt.
- Kartbiblioteket lastes fra jsDelivr, så den dynamiske muskelvisningen krever internett. Øvrige treningsfunksjoner er uendret.
- Kartet er en visuell treningsoversikt, ikke en medisinsk atlas eller måling av faktisk muskelvekst.


### Teknisk merknad
- Kartet bygges med bibliotekets dokumenterte `MuscleMap`-API: `gender`, `view`, `theme`, `blendMode`, `highlights` og `onMuscleClick`.
- Highlight-oppdateringer bruker `map.update({ highlights })`; gruppenavnene er bibliotekets egne `group`-verdier.
- Kartet har 14 sporede hovedgrupper. Styrkeloggens 8 programgrupper samler disse der det er naturlig (f.eks. Rygg samler øvre rygg, lats og korsrygg).
- Bibliotekets front-/baksidekropper og tilhørende muskelmasker skaleres i samme SVG-visning. Vi legger dermed ikke selvstendige polygoner over OpenStax-figuren.


## Versjon 3.8 – skylagring og synkronisering mellom enheter

### Hva er nytt
- E-post/passord-konto med Supabase Auth.
- Automatisk synkronisering etter lokale endringer (med kort debouncing).
- Automatisk henting av skydata ved innlogging på en ny enhet.
- Bakgrunnskontroll hvert 25. sekund og når appen får fokus, slik at endringer fra en annen enhet kan hentes.
- Hvis begge steder har historikk første gang de kobles sammen, slås loggene sammen. Identiske økter dedupliseres; lokale øvelsesinnstillinger brukes ved konflikt.
- Pågående økt og pauseinformasjon følger også med.
- Lokal lagring beholdes som reserve når nettet er utilgjengelig. Mislykkede synkroniseringer forsøkes på nytt.
- JSON-eksport/import beholdes som ekstra sikkerhetskopi.

### Første gangs oppsett – Supabase
1. Opprett et prosjekt på https://supabase.com/ .
2. Åpne prosjektets **SQL Editor**, lim inn hele innholdet fra `supabase-schema.sql`, og kjør det.
3. Gå til **Project Settings → API** (eller API Keys). Kopier **Project URL** og **publishable key**.
4. Åpne `supabase-config.js`. Bytt ut `https://DITT-PROSJEKT.supabase.co` med Project URL og `sb_publishable_DIN_OFFENTLIGE_NOKKEL` med publishable key.
5. Publiser alle filene i ZIP-arkivet til GitHub Pages.
6. I Supabase **Authentication → URL Configuration**, sett Site URL til den nøyaktige adressen til Styrkeloggen, og legg samme adresse til som Redirect URL.
7. Opprett konto under Innstillinger i Styrkeloggen. Hvis e-postbekreftelse er aktivert, bekreft e-posten før du logger inn.
8. Logg inn med samme konto på de andre enhetene.

### Viktig sikkerhet
- `supabase-config.js` skal bare inneholde Project URL og **publishable key**. Den offentlige nøkkelen er ment for klientbruk; Row Level Security (RLS) begrenser hver rad til eieren.
- Legg aldri `service_role`, `secret` eller databasepassord i GitHub Pages eller i denne appen.
- SQL-oppsettet aktiverer RLS, fjerner tilgang for `anon` og gir innloggede brukere kun tilgang til raden der `user_id = auth.uid()`.
- Ikke del passordet ditt i chat eller i GitHub.
- Supabase-prosjektet er en separat tjeneste og kan ha egne kvoter/prisvilkår. Sjekk gjeldende vilkår i Supabase før du lagrer store datamengder.

### Synkroniseringsadferd og begrensninger
- Lokal lagring skjer først; deretter sendes en oppdatert sikkerhetskopi til skyen.
- På en ny enhet hentes skyloggen automatisk etter innlogging.
- Hvis begge enheter har data når kontoen kobles til første gang, kombineres historikkene. Ved samtidige redigeringer av samme økt kan siste komplette øktversjon fortsatt vinne; unngå å endre samme pågående økt på to enheter samtidig.
- Hvis en annen enhet oppdaterer skyloggen mens du har en aktiv lokal treningsøkt, venter appen med å overskrive økten. Avslutt økten eller bruk synkronisering etterpå.
- Automatisk polling skjer hvert 25. sekund og når appen kommer tilbake i fokus. Det er ikke en sanntidsstrøm.
- Cloud sync er ikke aktiv før Supabase-prosjektet er opprettet, SQL-en er kjørt og `supabase-config.js` er fylt inn.


## Oppsett når Styrkeloggen deler Supabase-prosjekt med Familiemat

**Ikke opprett et nytt Supabase-prosjekt.** Bruk prosjektet som Familiemat allerede bruker.

1. Finn `Project URL` og `publishable key` i Supabase Dashboard for Familiemat-prosjektet. Hvis Familiemat fortsatt bruker den eldre `anon`-nøkkelen, kan den også brukes midlertidig i konfigurasjonen.
2. Åpne `supabase-config.js` og lim inn den samme Project URL og nøkkelen.
3. Åpne SQL Editor i det eksisterende prosjektet og kjør `supabase-schema.sql`.
4. SQL-en oppretter bare tabellen `public.training_logs`, aktiverer RLS på den tabellen og gir brukere tilgang til sin egen rad. Den endrer ikke `families`, `family_members`, `recipes`, `week_plans` eller `pantry`.
5. Publiser filene på GitHub Pages.
6. I Styrkeloggen logger du inn med den samme e-postadressen og passordet som du bruker i Familiemat. Ikke velg «Opprett konto» dersom du allerede har Familiemat-konto.
7. Legg den publiserte Styrkeloggen-adressen til under Supabase Authentication → URL Configuration → Redirect URLs dersom Supabase ber om det.

### Kontoer og data
- Supabase Auth er felles for alle apper i samme prosjekt. Samme innlogging gir samme `auth.uid()` i Familiemat og Styrkeloggen.
- Familiemat fortsetter å lagre familiens data via sine egne familietabeller og medlemsregler.
- Styrkeloggen lagrer én privat JSON-logg per innlogget Supabase-bruker i `training_logs`.
- De to appene deler innlogging, ikke treningsdata eller familiematdata.
- Frontend-konfigurasjonen skal bruke publishable key (eller eldre anon key). Aldri legg `service_role` eller `sb_secret` i GitHub Pages.
