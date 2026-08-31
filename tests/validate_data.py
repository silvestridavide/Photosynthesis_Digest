#!/usr/bin/env python3
"""
Test di validazione formale del dataset di Photosynthesis Digest (Python version)
"""

import sys
import os
import json
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(BASE_DIR, "assets", "data", "articles.json")
JS_PATH = os.path.join(BASE_DIR, "assets", "js", "articles-data.js")

print("=== TEST DI VALIDAZIONE: Photosynthesis Digest ===\n")

if not os.path.exists(JSON_PATH):
    print(f"[ERRORE] File non trovato: {JSON_PATH}")
    sys.exit(1)

with open(JSON_PATH, "r", encoding="utf-8") as f:
    try:
        articles = json.load(f)
    except Exception as e:
        print(f"[ERRORE] JSON non valido in articles.json: {e}")
        sys.exit(1)

print(f"[+] articles.json caricato correttamente. Articoli trovati: {len(articles)}")

if len(articles) < 15:
    print(f"[ERRORE] Richiesti almeno 15 articoli, trovati solo {len(articles)}")
    sys.exit(1)

seen_dois = set()
seen_ids = set()
required_fields = ["id", "doi", "title", "authors", "journal", "publication_date", "abstract", "url"]

for idx, art in enumerate(articles):
    prefix = f"Articolo #{idx + 1} ({art.get('doi', 'SENZA DOI')}):"

    for field in required_fields:
        if not art.get(field):
            print(f"[ERRORE] {prefix} Manca il campo obbligatorio '{field}'")
            sys.exit(1)

    if not isinstance(art["authors"], list) or len(art["authors"]) == 0:
        print(f"[ERRORE] {prefix} Il campo 'authors' deve essere una lista non vuota")
        sys.exit(1)

    clean_doi = art["doi"].strip().lower()
    if clean_doi in seen_dois:
        print(f"[ERRORE] {prefix} DOI duplicato riscontrato: {art['doi']}")
        sys.exit(1)
    seen_dois.add(clean_doi)

    if art["id"] in seen_ids:
        print(f"[ERRORE] {prefix} ID duplicato riscontrato: {art['id']}")
        sys.exit(1)
    seen_ids.add(art["id"])

    if not re.match(r"^\d{4}-\d{2}-\d{2}$", art["publication_date"]):
        print(f"[ERRORE] {prefix} Formato data non valido: '{art['publication_date']}' (richiesto YYYY-MM-DD)")
        sys.exit(1)

    if len(art["abstract"]) < 50:
        print(f"[ERRORE] {prefix} Abstract troppo corto o assente ({len(art['abstract'])} caratteri)")
        sys.exit(1)

print(f"[+] Tutti i {len(articles)} articoli possiedono tutti i campi obbligatori, date valide e nessun DOI duplicato.")

if not os.path.exists(JS_PATH):
    print(f"[ERRORE] File JS non trovato: {JS_PATH}")
    sys.exit(1)

with open(JS_PATH, "r", encoding="utf-8") as f:
    js_content = f.read()

if "export const INITIAL_ARTICLES" not in js_content:
    print("[ERRORE] Il file JS articles-data.js non esporta INITIAL_ARTICLES")
    sys.exit(1)

print("[+] articles-data.js contiene export INITIAL_ARTICLES valido.")
print("\n=== TUTTI I TEST DI VALIDAZIONE SUPERATI CON SUCCESSO! ===")
