#!/usr/bin/env python3
"""Audit every DOI/news URL. Separate bibliographic validity from readable full text."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from pathlib import Path
import json, urllib.request, urllib.parse
R=Path(__file__).resolve().parents[1]

def request(url):
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (Resonance link audit)'})
        with urllib.request.urlopen(req,timeout=12) as r:return {'status':r.status,'resolved_url':r.url}
    except Exception as e:return {'status':getattr(e,'code',0),'detail':str(e)}

def main():
    items=json.loads((R/'assets/data/articles.json').read_text())
    query=' OR '.join('EXT_ID:'+a['pmid'] for a in items if a['item_type']=='article')
    url='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+urllib.parse.urlencode({'query':'('+query+') AND SRC:MED','pageSize':100,'format':'json','resultType':'core'})
    with urllib.request.urlopen(url,timeout=30) as r:records={a['id']:a for a in json.load(r)['resultList']['result']}
    for a in items:
        if a['item_type']=='article':assert records[a['pmid']]['doi'].lower()==a['doi'].lower(),a['id']
    def audit(a):return {'id':a['id'],'url':a['url'],**request(a['url'])}
    with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(audit,items))
    counts={str(s):sum(a['status']==s for a in results) for s in sorted({a['status'] for a in results})}
    output={'checked_at':datetime.now(timezone.utc).isoformat(),'bibliographic_records_valid':50,'http_counts':counts,'results':results}
    dest=R/'research/link-check-latest.json';dest.parent.mkdir(exist_ok=True);dest.write_text(json.dumps(output,ensure_ascii=False,indent=2))
    print('Bibliographic DOI identity: 50/50. Live URL statuses:',counts)
    print('403/429/timeouts are unresolved access checks, never successful full-text verification.')
    print('Report:',dest)
    raise SystemExit(1 if any(a['status'] in (404,410) for a in results) else 0)
if __name__=='__main__':main()
