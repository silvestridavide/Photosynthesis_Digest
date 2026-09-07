#!/usr/bin/env python3
"""Find new papers for editorial review; never overwrite the curated edition."""
import argparse
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
TOPIC='(TITLE_ABS:photosynth* OR TITLE_ABS:photosystem OR TITLE_ABS:rubisco OR TITLE_ABS:thylakoid OR TITLE_ABS:pyrenoid OR TITLE_ABS:LHCSR)'

def build_query(days, now=None):
    if not 1<=days<=3650:raise ValueError('days must be between 1 and 3650')
    now=now or datetime.now(timezone.utc)
    return f'{TOPIC} AND FIRST_PDATE:[{(now-timedelta(days=days)).date()} TO {now.date()}] sort_date:y'

def search(query,limit):
    url='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+urllib.parse.urlencode({'query':query,'format':'json','resultType':'core','pageSize':min(limit,200)})
    request=urllib.request.Request(url,headers={'User-Agent':'ResonanceResearch/1.0'})
    with urllib.request.urlopen(request,timeout=30) as response:return json.load(response),url

def save_candidates(records,query,url):
    path=ROOT/'research/candidates.json';path.parent.mkdir(exist_ok=True)
    previous=json.loads(path.read_text()) if path.exists() else {'records':[]}
    by_doi={r.get('doi',r.get('id')):r for r in previous['records']}
    for r in records:by_doi[r.get('doi',r.get('id'))]=r
    payload={'checked_at':datetime.now(timezone.utc).isoformat(),'query':query,'url':url,'status':'Candidates only: verify relevance, access and summary before publishing','records':list(by_doi.values())}
    temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(payload,ensure_ascii=False,indent=2));temporary.replace(path)
    return path

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--days',type=int,default=7);parser.add_argument('--max-results',type=int,default=50);args=parser.parse_args()
    if not 1<=args.max_results<=200:parser.error('--max-results must be 1–200')
    query=build_query(args.days);data,url=search(query,args.max_results)
    existing={a.get('doi','').lower() for a in json.loads((ROOT/'assets/data/articles.json').read_text())}
    rows=[r for r in data['resultList']['result'] if r.get('doi','').lower() not in existing]
    print(f'{len(rows)} candidates saved to {save_candidates(rows,query,url)}. Curated edition unchanged.')
if __name__=='__main__':main()
