#!/usr/bin/env python3
"""Offline editorial integrity checks; does not claim to verify live access."""
import json
from pathlib import Path
from datetime import date
from urllib.parse import urlsplit
R=Path(__file__).resolve().parents[1]

def validate():
    items=json.loads((R/'assets/data/articles.json').read_text());papers=[a for a in items if a['item_type']=='article'];news=[a for a in items if a['item_type']=='news']
    assert len(papers)==50 and len(news)==20, 'Edition must contain 50 papers and 20 news stories'
    assert len({a['id'] for a in items})==70
    assert len({a['doi'].lower() for a in papers})==50
    assert len({a['url'] for a in news})==20
    for a in items:
        for key in ['title','summary_it','summary_basis','category','publication_date','verified_at','access']:assert a.get(key), (a['id'],key)
        assert 35<=len(a['summary_it'].split())<=180,(a['id'],'summary length')
        assert date.fromisoformat(a['publication_date'])<=date.fromisoformat(a['verified_at'])
        for key in ['url','record_url','full_text_url']:
            if a.get(key):assert urlsplit(a[key]).scheme=='https' and urlsplit(a[key]).hostname
        assert a['access']['checked_at']==a['verified_at']
    for i,a in enumerate(sorted(papers,key=lambda a:a['rank']),1):
        assert a['rank']==i
        assert isinstance(a['citation_count'],int) and a['citation_count']>=0
        assert a['citation_source']=='Europe PMC' and a['citation_date']=='2026-09-07'
        assert a['study_type'] in ['Studio primario','Review','Meta-analisi']
        assert a['authors'] and all(x['name'] for x in a['authors'])
        assert a['access']['record_status']==200
        if a['access']['level']=='metadata':assert 'metadati' in a['summary_basis']
    ordered=sorted(papers,key=lambda a:a['rank']);assert all(a['citation_count']>=b['citation_count'] for a,b in zip(ordered,ordered[1:]))
    for a in news:
        assert not a.get('citation_count') and not a.get('doi')
        assert a['news_type']=='Notizia istituzionale'
        assert urlsplit(a['url']).hostname not in ['doi.org','www.nature.com','www.pnas.org']
        assert a['access']['status']==200 or a['access'].get('browser_verified')
    method=json.loads((R/'assets/data/method.json').read_text());assert method['included']==50
    assert len([x for x in method['screening'] if x['decision']=='included'])==50
    assert not (R/'assets/js/articles-data.js').exists(),'Remove duplicate runtime dataset'
    print('PASS: 50 papers + 20 news; identifiers, dates, summaries, ranking, access evidence and provenance consistent.')
if __name__=='__main__':validate()
