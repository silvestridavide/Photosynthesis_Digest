#!/usr/bin/env python3
"""
Photosynthesis Digest - Script di Ingestion Rapida via DOI
=========================================================
Uso:
  python3 scripts/add_by_doi.py <DOI_1> [<DOI_2> ...]

Descrizione:
  Dato uno o più DOI, interroga le API pubbliche (CrossRef ed Europe PMC),
  estrae e normalizza i metadati (titolo, autori, affiliazioni, rivista, data, abstract),
  determina automaticamente tag ed organismo e aggiorna sia 'assets/data/articles.json'
  che 'assets/js/articles-data.js' senza duplicati.
"""

import sys
import os
import json
import re
import urllib.request
import urllib.parse
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(BASE_DIR, "assets", "data", "articles.json")
JS_PATH = os.path.join(BASE_DIR, "assets", "js", "articles-data.js")

USER_AGENT = "PhotosynthesisDigest/1.0 (mailto:lab-photosynthesis@research.local; Automated Ingestion Tool)"

def clean_doi(raw_doi):
    raw = raw_doi.strip()
    raw = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"^doi:\s*", "", raw, flags=re.IGNORECASE)
    return raw.strip()

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read().decode("utf-8"))

def detect_organism(text):
    text_lower = text.lower()
    if "chlamydomonas" in text_lower:
        return "Chlamydomonas reinhardtii"
    if "arabidopsis" in text_lower:
        return "Arabidopsis thaliana"
    if "chlorella" in text_lower:
        return "Chlorella vulgaris"
    if "synechocystis" in text_lower:
        return "Synechocystis sp. PCC 6803"
    if "anabaena" in text_lower:
        return "Anabaena sp. PCC 7120"
    if "cyanidioschyzon" in text_lower:
        return "Cyanidioschyzon merolae"
    if "oryza" in text_lower or "rice" in text_lower:
        return "Oryza sativa (Rice)"
    if "cyanobacteri" in text_lower:
        return "Cyanobacteria"
    if "diatom" in text_lower:
        return "Diatom (Phaeodactylum / Thalassiosira)"
    if "graphene" in text_lower or "biohybrid" in text_lower or "artificial photosynthesis" in text_lower:
        return "Synthetic Biohybrid"
    return "Higher Plants / Algae"

def detect_category(text):
    text_lower = text.lower()
    if "cryo-em" in text_lower or "cryoelectron" in text_lower or "crystal structure" in text_lower or "supercomplex" in text_lower:
        return "Structural Biology & Cryo-EM"
    if "rubisco" in text_lower or "base edit" in text_lower or "chloroplast genome" in text_lower:
        return "Molecular Genetics & Crop Engineering"
    if "npq" in text_lower or "photoprotection" in text_lower or "lhcsr" in text_lower or "quenching" in text_lower:
        return "Biophysics & Photoprotection"
    if "pyrenoid" in text_lower or "ccm" in text_lower or "carbon-concentrating" in text_lower or "condensate" in text_lower:
        return "Carbon Fixation & Pyrenoids"
    if "hydrogen" in text_lower or "solar fuel" in text_lower or "bioenergy" in text_lower:
        return "Bioenergy & Synthetic Biology"
    if "spectroscopy" in text_lower or "exciton" in text_lower or "energy transfer" in text_lower:
        return "Biophysics & Spectroscopy"
    if "carbon capture" in text_lower or "flue gas" in text_lower:
        return "Environmental Biotechnology & Algae"
    if "dimer" in text_lower or "phylogen" in text_lower or "evolution" in text_lower:
        return "Evolution & Enzymology"
    return "Fotosintesi & Fisiologia Vegetale"

def detect_tags(text):
    tags = []
    text_lower = text.lower()
    keywords = [
        ("cryo-em", "Cryo-EM"),
        ("photosystem i", "Photosystem I"),
        ("photosystem ii", "Photosystem II"),
        ("rubisco", "Rubisco"),
        ("npq", "NPQ"),
        ("lhcsr", "LHCSR"),
        ("thylakoid", "Thylakoid Architecture"),
        ("pyrenoid", "Pyrenoid"),
        ("hydrogen", "Photosynthetic Hydrogen"),
        ("chloroplast", "Chloroplast Engineering"),
        ("fluorescence", "Fluorescence Lifetime"),
        ("light harvesting", "Light Harvesting"),
        ("phycobilisome", "Phycobilisomes"),
        ("carbon capture", "Carbon Capture"),
        ("evolution", "Evolutionary Biology")
    ]
    for pattern, label in keywords:
        if pattern in text_lower and label not in tags:
            tags.append(label)
    if not tags:
        tags = ["Letteratura Scientifica", "Fotosintesi"]
    return tags

def fetch_doi_metadata(doi):
    print(f"[*] Interrogazione per DOI: {doi} ...")
    clean = clean_doi(doi)
    
    # 1. Fetch from CrossRef
    crossref_url = f"https://api.crossref.org/works/{urllib.parse.quote(clean)}"
    crossref_data = None
    try:
        res = fetch_json(crossref_url)
        if res.get("status") == "ok":
            crossref_data = res.get("message", {})
    except Exception as e:
        print(f"  [!] CrossRef non disponibile o errore: {e}")

    # 2. Fetch from Europe PMC (ottimo per abstract completi e affiliazioni)
    epmc_url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:%22{urllib.parse.quote(clean)}%22&format=json&resultType=core"
    epmc_item = None
    try:
        epmc_res = fetch_json(epmc_url)
        results = epmc_res.get("resultList", {}).get("result", [])
        if results:
            epmc_item = results[0]
    except Exception as e:
        print(f"  [!] Europe PMC non disponibile o errore: {e}")

    if not crossref_data and not epmc_item:
        print(f"  [ERROR] Impossibile recuperare metadati per DOI {doi}")
        return None

    # Title
    title = ""
    if epmc_item and epmc_item.get("title"):
        title = epmc_item["title"].rstrip(".")
    elif crossref_data and crossref_data.get("title"):
        t = crossref_data["title"]
        title = t[0] if isinstance(t, list) else t
    title = re.sub(r"<[^>]*>", "", title).strip()

    # Journal
    journal = ""
    if epmc_item and epmc_item.get("journalInfo", {}).get("journal", {}).get("title"):
        journal = epmc_item["journalInfo"]["journal"]["title"]
    elif crossref_data and crossref_data.get("container-title"):
        ct = crossref_data["container-title"]
        journal = ct[0] if isinstance(ct, list) else ct

    # Date & Year
    pub_date = ""
    year = 2026
    if epmc_item and epmc_item.get("firstPublicationDate"):
        pub_date = epmc_item["firstPublicationDate"]
        year = int(pub_date.split("-")[0])
    elif crossref_data and crossref_data.get("created", {}).get("date-parts"):
        dp = crossref_data["created"]["date-parts"][0]
        year = dp[0]
        m = f"{dp[1]:02d}" if len(dp) > 1 else "01"
        d = f"{dp[2]:02d}" if len(dp) > 2 else "01"
        pub_date = f"{year}-{m}-{d}"

    # Authors
    authors = []
    if epmc_item and epmc_item.get("authorList", {}).get("author"):
        for a in epmc_item["authorList"]["author"]:
            name = a.get("fullName") or f"{a.get('firstName', '')} {a.get('lastName', '')}".strip()
            affils = a.get("authorAffiliationDetailsList", {}).get("authorAffiliation", [])
            affil_str = affils[0].get("affiliation", "") if affils else ""
            orcid = a.get("authorId", {}).get("value", "") if a.get("authorId") else ""
            authors.append({
                "name": name,
                "affiliation": affil_str,
                "orcid": orcid
            })
    elif crossref_data and crossref_data.get("author"):
        for a in crossref_data["author"]:
            name = f"{a.get('given', '')} {a.get('family', '')}".strip() or a.get("name", "Unknown")
            affils = a.get("affiliation", [])
            affil_str = affils[0].get("name", "") if affils and isinstance(affils[0], dict) else ""
            orcid = a.get("ORCID", "").replace("http://orcid.org/", "").replace("https://orcid.org/", "")
            authors.append({
                "name": name,
                "affiliation": affil_str,
                "orcid": orcid
            })

    # Abstract
    abstract = ""
    if epmc_item and epmc_item.get("abstractText"):
        abstract = epmc_item["abstractText"]
    elif crossref_data and crossref_data.get("abstract"):
        abstract = crossref_data["abstract"]
    abstract = re.sub(r"<[^>]*>", "", abstract).strip()

    # Open Access
    open_access = False
    if epmc_item:
        open_access = (epmc_item.get("isOpenAccess") == "Y")
    elif crossref_data and crossref_data.get("license"):
        open_access = True

    # Build ID
    first_author = authors[0]["name"].split()[-1].lower() if authors else "article"
    first_author = re.sub(r"[^a-z0-9]", "", first_author)
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower())[:30].strip("-")
    item_id = f"{first_author}-{year}-{slug}"

    full_text_for_detection = f"{title} {abstract}"
    organism = detect_organism(full_text_for_detection)
    category = detect_category(full_text_for_detection)
    tags = detect_tags(full_text_for_detection)

    return {
        "id": item_id,
        "doi": clean,
        "title": title,
        "authors": authors,
        "journal": journal,
        "publication_date": pub_date,
        "year": year,
        "article_type": "Research Article" if "review" not in title.lower() else "Review",
        "organism": organism,
        "category": category,
        "tags": tags,
        "abstract": abstract,
        "url": f"https://doi.org/{clean}",
        "open_access": open_access,
        "featured": False,
        "added_at": datetime.now().strftime("%Y-%m-%d")
    }

def save_databases(articles):
    # Sort by date desc
    articles.sort(key=lambda a: a.get("publication_date", "") or str(a.get("year", "2026")), reverse=True)

    # 1. Save JSON
    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(articles, f, indent=2, ensure_ascii=False)
    print(f"[OK] Salvato {JSON_PATH} ({len(articles)} articoli totali)")

    # 2. Save JS Module
    js_content = f"""/**
 * Photosynthesis Digest - Dataset Ufficiale Articoli & News
 * Sincronizzato automaticamente con assets/data/articles.json
 * Data aggiornamento: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
 */

export const INITIAL_ARTICLES = {json.dumps(articles, indent=2, ensure_ascii=False)};
"""
    with open(JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"[OK] Salvato {JS_PATH}")

def main():
    if len(sys.argv) < 2:
        print("Uso: python3 scripts/add_by_doi.py <DOI_1> [<DOI_2> ...]")
        print("Esempio: python3 scripts/add_by_doi.py 10.1038/s41586-026-10847-3")
        sys.exit(1)

    # Load existing database
    existing_articles = []
    if os.path.exists(JSON_PATH):
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                existing_articles = json.load(f)
        except Exception as e:
            print(f"[!] Errore lettura database esistente: {e}")

    doi_map = {clean_doi(a["doi"]).lower(): i for i, a in enumerate(existing_articles)}

    added_count = 0
    updated_count = 0

    for raw_doi in sys.argv[1:]:
        doi_clean = clean_doi(raw_doi)
        if not doi_clean:
            continue

        meta = fetch_doi_metadata(doi_clean)
        if not meta:
            continue

        key = doi_clean.lower()
        if key in doi_map:
            idx = doi_map[key]
            # preserve featured or custom overrides if present
            meta["featured"] = existing_articles[idx].get("featured", False)
            existing_articles[idx] = meta
            print(f"  [+] Aggiornato record esistente: {meta['title']} ({meta['journal']})")
            updated_count += 1
        else:
            existing_articles.insert(0, meta)
            doi_map[key] = 0
            print(f"  [+] Inserito nuovo articolo: {meta['title']} ({meta['journal']})")
            added_count += 1

    save_databases(existing_articles)
    print(f"\n[FINE] Operazione completata: {added_count} nuovi, {updated_count} aggiornati. Totale articoli: {len(existing_articles)}.")

if __name__ == "__main__":
    main()
