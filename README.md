# Resonance · Il magazine della fotosintesi

Una lettura quotidiana per chi studia fotosintesi: notizie separate dalla letteratura, riassunti italiani, provenienza e limiti visibili, collegamenti alle fonti. Edizione curata del 7 settembre 2026.

## La raccolta

- **50 lavori scientifici** selezionati per pertinenza tra i primi 122 risultati esaminati di una query Europe PMC ordinata per citazioni. Include studi, review e meta-analisi. Non è una classifica universale di tutta la letteratura: copertura e conteggi dipendono dall’indice. Ricerca esplorativa anche in OpenAlex e Crossref.
- **20 vere notizie e comunicati del 2026**, ordinate cronologicamente. Nessun paper presentato come notizia e nessuna classifica inventata delle news per citazioni.
- Ogni scheda riporta riassunto, data, fonte, verifica e livello di accesso. Per 46 lavori la sintesi si basa sull’abstract; per quattro record storici manca l’abstract e la scheda dichiara il proprio carattere bibliografico. Non attribuiamo risultati quantitativi a testi non consultati.
- I 50 DOI sono confrontati con i record Europe PMC. Un HTTP 200 sulla pagina dell’editore non implica testo integrale gratuito. Blocchi 403, limiti 429 e timeout rimangono espliciti; l’accesso può cambiare dopo la verifica.

Il metodo completo, la query e le decisioni di screening sono in `assets/data/method.json`; il lettore espone statistiche e limiti. Le citazioni sono quelle Europe PMC alla data indicata, non Google Scholar.

## Esperienza e struttura

Prima pagina tipografica, briefing, biblioteca, salvati; ricerca indicizzata e filtri per tema, organismo, fonte, accesso e lettura. Dodici risultati alla volta, reader accessibile da tastiera e tramite URL, citazioni copiabili, stato letto e salvati nel browser. I salvataggi di edizioni precedenti non vengono cancellati, ma record usciti dal catalogo non sono più consultabili nell’edizione corrente.

Frontend statico HTML/CSS/JavaScript senza framework, font remoti o dipendenze client. Un solo catalogo JSON; la metodologia viene caricata soltanto quando aperta. Nessun upload, download, stampa o esportazione di file. Le vecchie immagini PNG sono conservate nel repository ma escluse dal deploy.

`api/news.py` aggiunge su Vercel il controllo manuale di feed scientifici: seleziona segnalazioni pertinenti degli ultimi 90 giorni e verifica la pagina di origine. Gli estratti RSS sono nella lingua originale, chiaramente distinti dalle 20 sintesi curate. L’assenza di risultati o l’indisponibilità di una fonte è segnalata: non si inventano aggiornamenti. Cache CDN di 30 minuti, richieste limitate a fonti predefinite. Il catalogo editoriale non viene modificato automaticamente.

## Avvio e verifica

```sh
python3 -m http.server 8780 --bind 127.0.0.1
python3 tests/validate_data.py
python3 -m unittest discover -s tests -p 'test_news.py'
node tests/catalog.mjs
node tests/browser.cjs
python3 tests/test_links_live.py
```

Aprire http://127.0.0.1:8780. Il server statico locale non esegue `/api/news`; la funzione è eseguita da Vercel. Il test browser richiede Playwright con Chromium e il server avviato; `BASE_URL` permette di verificare un deployment. Il controllo live richiede rete e produce un report locale ignorato da Git, distinguendo i fallimenti di accesso dai link definitivamente rimossi.

## Aggiornamento editoriale e deploy

Gli script `scripts/daily_fetch.py` e `scripts/add_by_doi.py` raccolgono candidati in `research/candidates.json`, senza sovrascrivere le schede curate. Verificare fonte, data, pertinenza, accesso e abstract prima di aggiungere un riassunto originale; aggiornare insieme catalogo, metodo e vincoli della validazione quando cambia l’edizione.

Repository: https://github.com/silvestridavide/Photosynthesis_Digest. Branch di questa edizione: `agent/resonance-morning-magazine-2026-09-07`. Deploy Vercel come sito statico con una funzione Python standard-library, configurato in `vercel.json`. Nessuna chiave API richiesta dal codice.

Deployment richiesto su Vercel: https://photosynthesis-digest-dordopondo.vercel.app (7 settembre 2026, commit applicativo `4c82e53`). Il servizio ha accettato il deploy production; al controllo la protezione Vercel rimanda al login e il connettore di lettura non consente di ispezionare questo nuovo deployment. Stato finale della build e funzione online da confermare nel dashboard autenticato: https://vercel.com/dordopondo/photosynthesis-digest/7oM6YZ9orZEHL3HW4Vx4R2qzp8Zp. Verifiche locali superate; questo non sostituisce la verifica online.
