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
