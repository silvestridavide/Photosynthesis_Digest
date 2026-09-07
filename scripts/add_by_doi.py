#!/usr/bin/env python3
"""Retrieve DOI metadata into the editorial inbox, preserving curated summaries."""
import argparse
import re
from daily_fetch import search,save_candidates

def clean_doi(value):
    doi=re.sub(r'^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)','',value.strip(),flags=re.I).lower()
    if not re.fullmatch(r'10\.\d{4,9}/[^\s"<>]+',doi):raise ValueError('Invalid DOI')
    return doi

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('dois',nargs='+');args=parser.parse_args()
    for value in args.dois:
        doi=clean_doi(value);query=f'DOI:"{doi}"';data,url=search(query,5)
        records=[a for a in data['resultList']['result'] if a.get('doi','').lower()==doi]
        if not records:raise SystemExit(f'DOI not found in Europe PMC: {doi}; verify manually before publishing.')
        print(save_candidates(records,query,url))
if __name__=='__main__':main()
