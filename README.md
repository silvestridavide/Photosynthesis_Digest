# Photosynthesis Digest · Vetrina Scientifica & Rassegna Letteratura

Vetrina scientifica quotidiana e rassegna della letteratura internazionale peer-reviewed sulla **fotosintesi**, concepita come una rivista scientifica online (*Nature / Science / Cell Press* style) per la consultazione rapida, il filtraggio e l'approfondimento dei nuovi articoli scientifici.

---

## Caratteristiche Principali

- **Design Editoriale Accademico**: Interfaccia sobria e densa con tipografia ricercata (*Lora*, *Cinzel*, *Inter*, *JetBrains Mono*), date di pubblicazione ed autori in prima linea, badge per rivista e tipologia editoriale.
- **Ordinamento & Filtri Interattivi**:
  - **Ordinamento**: Data (più recente / meno recente), Titolo (A-Z), Rivista (A-Z).
  - **Filtri per Macro-Area**: Biologia Strutturale & Cryo-EM, Genetica & Ingegneria Cloroplastica (Rubisco), Biofisica & Fotoprotezione (NPQ), Fissazione CO₂ & Pirenoide, Bioenergia & Idrogeno, Biotecnologie Ambientali, Evoluzione.
  - **Filtri per Organismo**: *Arabidopsis thaliana*, *Chlamydomonas reinhardtii*, *Anabaena* / Cianobatteri, *Synechocystis*, *Chlorella vulgaris*, *Cyanidioschyzon merolae* (Alga Rossa), *Oryza sativa* (Riso), Sistemi Bioibridi.
  - **Ricerca in tempo reale**: Ricerca su titoli, autori, affiliazioni, riviste, DOI e testo dell'abstract.
  - **Segnalibri Locali**: Salvataggio dei preferiti memorizzato localmente nel browser.
- **Modal Lettore & Citazioni**:
  - Visualizzazione dell'abstract integrale e dell'elenco completo degli autori con affiliazioni e ORCID.
  - Generatore istantaneo di citazioni in formato **APA**, **BibTeX** e **RIS** con copia in 1 clic.
  - Copia rapida del DOI e collegamento diretto all'editore ufficiale.
- **Esportazione Dataset**: Download istantaneo in formato JSON, BibTeX (.bib) e CSV.

---

## Architettura Dati & Ingestion Semplificata

Il tool è progettato per operare con scheduled task giornalieri senza dover mai modificare l'HTML o la logica di visualizzazione. I dati risiedono esclusivamente in `assets/data/articles.json` e nel modulo sincronizzato `assets/js/articles-data.js`.

### 1. Inserimento di un Articolo tramite DOI

Per aggiungere un nuovo articolo al catalogo, è sufficiente eseguire lo script CLI passando il DOI:

```bash
python3 scripts/add_by_doi.py 10.1038/s41586-026-10847-3
```

Lo script contatta in automatico le API di CrossRef ed Europe PMC, estrae titolo, autori, affiliazioni, data esatta, rivista ed abstract originale, determina la categoria e l'organismo e aggiorna il database prevenendo duplicati.

È possibile passare anche più DOI contemporaneamente:

```bash
python3 scripts/add_by_doi.py 10.1038/s41467-026-73783-w 10.1073/pnas.2530459123
```

### 2. Scheduled Task Giornaliero Automatico

Per eseguire una scansione automatica della letteratura peer-reviewed recente (es. ultimi 30 giorni) e aggiungere in blocco tutti i nuovi articoli non ancora censiti:

```bash
python3 scripts/daily_fetch.py --days 30 --max-results 20
```

Questo comando può essere configurato in un cron job giornaliero, in una GitHub Action o invocato periodicamente con lo slash command `/schedule`.

---

## Avvio Locale

L'applicazione è interamente statica in vanilla HTML5, CSS3 e JavaScript ES Modules. Per avviarla localmente con un server HTTP:

```bash
# Dalla cartella LAVORO/TOOLS/Photosynthesis_Digest
python3 -m http.server 8780 --bind 127.0.0.1
```

Quindi aprire nel browser: `http://127.0.0.1:8780`

> **Nota**: I moduli ES richiedono un server HTTP; l'apertura diretta via `file://` non è supportata dal browser.

---

## Test e Validazione

Per verificare la conformità dello schema, l'integrità dei campi obbligatori, la validità delle date e l'assenza di DOI duplicati:

```bash
node tests/validate_data.js
```

---

## Distribuzione su Vercel

- Framework preset: `Other` (Deploy statico senza build).
- Entry point: `index.html`.
- Configurazione di sicurezza e CSP: `vercel.json`.

---

## Dataset Iniziale (15 Articoli Verificati)

Il catalogo include una prima selezione di 15 articoli e rassegne reali ad alto impatto (2026/2019) tratti da *Nature*, *Science*, *PNAS*, *Nature Communications*, *Nature Plants*, *The New Phytologist*, *Plant, Cell & Environment*, *Bioresource Technology*:
1. **Li et al. (Nature 2026)**: Strutture in situ dei supercomplessi dei fotosistemi e architettura dei grana.
2. **Yamori et al. (Nat Commun 2026)**: Chloroplast base editing della subunità catalitica di Rubisco.
3. **Ramakers et al. (Nat Plants 2026)**: Dinamica di NPQ e centri di reazione PSII aperti vs chiusi.
4. **Bai et al. (New Phytol 2026)**: Ruolo di LHCSR3 e chinasi STT7 nel rimodellamento tilacoidale sotto UV-B in *Chlamydomonas*.
5. **How et al. (Nat Commun 2026)**: Ripartizione di Rubisco attivasi nel condensato pirenoideale via sticker motifs.
6. **Mao et al. (PNAS 2026)**: Struttura Cryo-EM del supercomplesso PSI-CpcL-ficobilisoma nel cianobatterio *Anabaena*.
7. **Cui et al. (PNAS 2026)**: Spettroscopia 2D ultraveloce ed excitonic transfer nel PSI dell'alga rossa *Cyanidioschyzon merolae*.
8. **Paul et al. (Plant Cell Environ 2026)**: Produzione fotosintetica di idrogeno via fusione PSI (PsaF)-idrogenasi in *Synechocystis*.
9. **Kehl et al. (Nat Commun 2026)**: Dimerizzazione ancestrale ed evoluzione della superfamiglia Rubisco.
10. **Reynolds et al. (PNAS 2026)**: Eterogeneità strutturale delle subunità piccole di Rubisco in *Arabidopsis*.
11. **Askey et al. (PNAS 2026)**: Acclimatazione cinetica della Rubisco alle temperature a livello di oloenzima.
12. **Zhu et al. (PNAS 2026)**: Catena bioibrida di trasporto elettronico PSI - Citocromo c Ossidasi su grafene ossido.
13. **Yang et al. (Bioresour Technol 2026)**: Cattura della CO₂ da fumi industriali e termotolleranza in *Chlorella vulgaris*.
14. **Lyu J. (Nat Plants 2026)**: *Boosting Rubisco* (News & Perspectives).
15. **Qin et al. (Nat Plants 2019)**: Struttura del supercomplesso PSI-LHCI a 10 antenne in *Chlamydomonas reinhardtii*.
