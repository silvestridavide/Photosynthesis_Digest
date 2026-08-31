#!/usr/bin/env python3
"""
Test di validazione formale del dataset di Photosynthesis Digest (Python version)
Valida la collezione di articoli peer-reviewed e notizie scientifiche verificate.
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
        items = json.load(f)
    except Exception as e:
        print(f"[ERRORE] JSON non valido in articles.json: {e}")
        sys.exit(1)

print(f"[+] articles.json caricato correttamente. Record totali trovati: {len(items)}")

if len(items) < 15:
    print(f"[ERRORE] Richiesti almeno 15 record, trovati solo {len(items)}")
    sys.exit(1)

seen_ids = set()
seen_dois = set()

articles_count = 0
news_count = 0

for idx, item in enumerate(items):
    item_id = item.get("id", f"item-{idx}")
    item_type = item.get("item_type", "article")
    prefix = f"Record #{idx + 1} [{item_type}] ({item_id}):"

    # Required common fields
    for field in ["id", "title", "publication_date", "abstract", "url", "category"]:
        if not item.get(field):
            print(f"[ERRORE] {prefix} Manca il campo obbligatorio '{field}'")
            sys.exit(1)

    if item_id in seen_ids:
        print(f"[ERRORE] {prefix} ID duplicato riscontrato: {item_id}")
        sys.exit(1)
    seen_ids.add(item_id)

    # Date validation YYYY-MM-DD
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", item["publication_date"]):
        print(f"[ERRORE] {prefix} Formato data non valido: '{item['publication_date']}' (richiesto YYYY-MM-DD)")
        sys.exit(1)

    # Abstract length
    if len(item["abstract"]) < 40:
        print(f"[ERRORE] {prefix} Abstract/sommario troppo corto ({len(item['abstract'])} caratteri)")
        sys.exit(1)

    # Specific checks by type
    if item_type == "article":
        articles_count += 1
        if not item.get("doi"):
            print(f"[ERRORE] {prefix} Manca il DOI obbligatorio per l'articolo scientifico")
            sys.exit(1)
        clean_doi = item["doi"].strip().lower()
        if clean_doi in seen_dois:
            print(f"[ERRORE] {prefix} DOI duplicato riscontrato: {item['doi']}")
            sys.exit(1)
        seen_dois.add(clean_doi)

        if not isinstance(item.get("authors"), list) or len(item["authors"]) == 0:
            print(f"[ERRORE] {prefix} Il campo 'authors' deve essere un array non vuoto")
            sys.exit(1)
    elif item_type == "news":
        news_count += 1
    else:
        print(f"[AVVISO] {prefix} Tipo record non standard '{item_type}'")

print(f"[+] Validazione record completata con successo: {articles_count} articoli scientifici peer-reviewed e {news_count} notizie/rassegne stampa.")

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
