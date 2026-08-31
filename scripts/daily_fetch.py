#!/usr/bin/env python3
"""
Photosynthesis Digest - Scheduled Daily Literature Fetcher
==========================================================
Uso:
  python3 scripts/daily_fetch.py [--days 7] [--max-results 20]

Descrizione:
  Interroga Europe PMC per le ultime pubblicazioni peer-reviewed aventi come oggetto
  la fotosintesi (qualsiasi organismo: piante superiori, Chlamydomonas, Chlorella,
  cianobatteri, alghe rosse, diatomee o sistemi sintetici).
  Estrae i DOI, filtra i duplicati già presenti nel catalogo, recupera i metadati completi
  e aggiorna automaticamente sia 'articles.json' che 'articles-data.js'.
"""

import sys
import os
import json
import re
import argparse
import urllib.request
import urllib.parse
from datetime import datetime, timedelta

# Import utilities from add_by_doi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from add_by_doi import clean_doi, fetch_doi_metadata, save_databases, JSON_PATH, USER_AGENT

TOP_JOURNALS = [
    "Nature",
    "Science",
    "Proc Natl Acad Sci U S A",
    "Nat Plants",
    "Nat Commun",
    "Plant Cell",
    "Plant Physiol",
    "New Phytol",
    "Plant Cell Environ",
    "Biochim Biophys Acta Bioenerg",
    "J Biol Chem",
    "Photosynth Res",
    "Bioresour Technol"
]

def search_recent_photosynthesis(days=30, max_results=20):
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    end_date = datetime.now().strftime("%Y-%m-%d")

    journal_query = " OR ".join([f'JOURNAL:"{j}"' for j in TOP_JOURNALS])
    topic_query = '(TITLE:"photosynthesis" OR TITLE:"photosystem" OR TITLE:"photoprotection" OR TITLE:"Rubisco" OR TITLE:"thylakoid" OR TITLE:"LHCSR" OR TITLE:"phycobilisome" OR TITLE:"chloroplast" OR ABSTRACT:"photosystem" OR ABSTRACT:"non-photochemical quenching")'
    
    # Query Europe PMC REST API
    query_str = f'{topic_query} AND ({journal_query})'
    
    url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={urllib.parse.quote(query_str)}&format=json&pageSize={max_results}&resultType=core&sort=P_PDATE_D%20desc"
    
    print(f"[*] Esecuzione ricerca letteratura recente su Europe PMC (ultimi {days} giorni)...")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            data = json.loads(res.read().decode("utf-8"))
            results = data.get("resultList", {}).get("result", [])
            print(f"[+] Trovati {len(results)} articoli corrispondenti ai criteri scientifici.")
            return results
    except Exception as e:
        print(f"[!] Errore durante la ricerca su Europe PMC: {e}")
        return []

def main():
    parser = argparse.ArgumentParser(description="Scansione giornaliera automatica della letteratura sulla fotosintesi")
    parser.add_argument("--days", type=int, default=30, help="Giorni di retrospezione (default: 30)")
    parser.add_argument("--max-results", type=int, default=20, help="Numero massimo di articoli da esaminare (default: 20)")
    args = parser.parse_args()

    # Load existing database
    existing_articles = []
    if os.path.exists(JSON_PATH):
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                existing_articles = json.load(f)
        except Exception as e:
            print(f"[!] Errore lettura database: {e}")

    existing_dois = {clean_doi(a["doi"]).lower() for a in existing_articles if a.get("doi")}

    found_results = search_recent_photosynthesis(days=args.days, max_results=args.max_results)
    if not found_results:
        print("[*] Nessun nuovo articolo trovato o servizio temporaneamente non disponibile.")
        return

    new_articles_count = 0
    for item in found_results:
        doi = item.get("doi")
        if not doi:
            continue
        doi_clean = clean_doi(doi)
        if doi_clean.lower() in existing_dois:
            continue

        print(f"\n[+] Nuovo articolo rilevato: {item.get('title')} ({item.get('journalTitle')})")
        meta = fetch_doi_metadata(doi_clean)
        if meta:
            existing_articles.insert(0, meta)
            existing_dois.add(doi_clean.lower())
            new_articles_count += 1

    if new_articles_count > 0:
        save_databases(existing_articles)
        print(f"\n[SUCCESSO] Inseriti {new_articles_count} nuovi articoli nel database. Totale attuale: {len(existing_articles)}")
    else:
        print("\n[OK] Tutti gli articoli trovati sono già presenti nel catalogo. Nessun aggiornamento necessario.")

if __name__ == "__main__":
    main()
