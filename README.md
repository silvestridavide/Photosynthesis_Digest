# LUMEN · Rivista Scientifica & Zine sulla Fotosintesi

**LUMEN** è una piattaforma editoriale e rassegna scientifica essenziale per il monitoraggio della letteratura internazionale su **fotosintesi**, biofisica delle membrane tilacoidali, biologia strutturale (Cryo-EM), fotoprotezione (NPQ, LHCSR, PsbS), ingegneria della Rubisco, pirenoide e bioenergie.

Include un generatore dedicato di **ZINE in 1 singola pagina A4** stampabile o salvabile in PDF, con la storia di copertina, le notizie più fresche e i paper di punta.

---

## Caratteristiche Principali

- **Estetica da Rivista Scientifica Autorevole**:
  - Sfondo base in **Bianco Guscio d'Uovo / Avorio Accademico** (`#F7F5F0`), testo in ardesia scura ad alto contrasto (`#141A22`), e palette dai toni sobri e spenti (ardesia accademica, bordeaux attenuato, sabbia naturale, salvia).
  - Eliminazione di colori saturi/sgargianti a favore di un'impaginazione editoriale pulita e leggibile.
- **Link Diretti & 100% Verificati**:
  - Distinzione chiara tra **Articoli Peer-Reviewed** (`↗ Vai all'Articolo (${journal})` con rimando al DOI ufficiale) e **Notizie Scientifiche** (`↗ Leggi Notizia (${fonte})` con rimando diretto alla testata/comunicato stampa).
  - Tutti i 50 record censiti sono verificati con test di connessione live (`tests/test_links_live.py`) per garantire zero link rotti o errori 404/DOI not found.
- **Generatore di ZINE (1 Pagina A4)**:
  - Pulsante in testata: `📰 Scarica ZINE (1 Pagina A4)`.
  - Layout compatto pronto per la stampa o l'esportazione PDF (`@media print` con `@page { size: A4; margin: 0; }`).
  - Riassume su un singolo foglio il lead breakthrough, 3 notizie calde, 4 paper selezionati e la nota editoriale del laboratorio.
- **50 Record Reali e Verificati**:
  - **40 Articoli Peer-Reviewed**: *Nature*, *Science*, *PNAS*, *Nature Plants*, *Nature Communications*, *The Plant Cell*, *Plant Physiology*, *The Plant Journal*, *The New Phytologist*, *Bioresource Technology*, *Nature Energy*.
  - **10 Notizie & Comunicati Ufficiali**: *University of Cambridge Research*, *MIT News*, *Berkeley Lab News Center*, *Osaka Metropolitan University*, *Nature Plants News & Views*, *Boyce Thompson Institute*, *ETH Zurich*, *Imperial College London*, *Max Planck Institute*.

---

## Avvio Locale

```bash
python3 -m http.server 8780 --bind 127.0.0.1
```
Aprire nel browser: `http://127.0.0.1:8780`

---

## Suite di Test e Validazione

1. **Validazione dello schema e integrità dei dati**:
   ```bash
   python3 tests/validate_data.py
   ```

2. **Verifica online di tutti i 50 URL e DOI**:
   ```bash
   python3 tests/test_links_live.py
   ```
