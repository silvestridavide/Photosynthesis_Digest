"""Bounded, read-only RSS gateway. Standard library only; no user-supplied URLs."""
from http.server import BaseHTTPRequestHandler
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit
import html
import json
import re
import time
import urllib.request
import xml.etree.ElementTree as ET

FEEDS = (
    ('Phys.org', 'https://phys.org/rss-feed/tags/photosynthesis/'),
    ('ScienceDaily', 'https://www.sciencedaily.com/rss/plants_animals.xml'),
    ('MIT News', 'https://news.mit.edu/rss/research'),
)
HOSTS = {'phys.org', 'www.sciencedaily.com', 'news.mit.edu'}
TOPIC = re.compile(r'photosynth|rubisco|thylakoid|pyrenoid|chlorophyll|chloroplast|photoprotection', re.I)
CACHE = None
CACHE_AT = 0

def allowed(url):
    u = urlsplit(url)
    return u.scheme == 'https' and u.hostname in HOSTS and u.port in (None, 443) and not u.username and not u.password

class Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed(newurl):
            raise ValueError('Redirect outside news sources')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def get(url, limit=1_000_000):
    if not allowed(url):
        raise ValueError('Source not allowed')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; ResonanceNews/1.0)'})
    with urllib.request.build_opener(Redirects()).open(req, timeout=4) as response:
        body = response.read(limit+1)
        if len(body) > limit:
            raise ValueError('Source response too large')
        return body.decode('utf-8', 'replace')

def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', value or ''))).strip()

def parse_feed(xml, source, now):
    if '<!DOCTYPE' in xml.upper() or '<!ENTITY' in xml.upper():
        raise ValueError('Unsupported XML declarations')
    items = []
    for node in ET.fromstring(xml).findall('.//item')[:80]:
        title = plain(node.findtext('title'))
        excerpt = plain(node.findtext('description'))
        url = node.findtext('link', '').strip()
        if not allowed(url) or not TOPIC.search(title+' '+excerpt):
            continue
        try:
            published = parsedate_to_datetime(node.findtext('pubDate', ''))
            if published.tzinfo is None:
                published = published.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            continue
        if not now-timedelta(days=90) <= published <= now+timedelta(hours=1):
            continue
        words = excerpt.split()
        excerpt = ' '.join(words[:70])+('…' if len(words)>70 else '')
        if not title or not excerpt:
            continue
        items.append(dict(title=title, excerpt=excerpt, url=url, source=source, date=published.isoformat()))
    return items

def read_feed(feed):
    source,url=feed
    try:
        return parse_feed(get(url),source,datetime.now(timezone.utc)), None
    except Exception:
        return [], source

def verify_page(item):
    try:
        body=get(item['url'])
        # Do not call a CAPTCHA or generic HTTP-200 error a readable article.
        head=re.search(r'<title[^>]*>(.*?)</title>',body,re.I|re.S)
        title=plain(head.group(1)) if head else ''
        words=set(re.findall(r'[a-z]{5,}',item['title'].lower()))
        matched=words.intersection(re.findall(r'[a-z]{5,}',title.lower()))
        if len(matched)<min(2,len(words)) or not words:
            return None
        return item
    except Exception:
        return None

def collect():
    global CACHE,CACHE_AT
    if CACHE is not None and time.monotonic()-CACHE_AT<300:
        return CACHE
    errors=[]; candidates=[]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for rows,error in pool.map(read_feed,FEEDS):
            candidates.extend(rows)
            if error:errors.append(error)
    candidates.sort(key=lambda x:x['date'],reverse=True)
    unique={}
    for item in candidates:
        unique.setdefault(item['url'],item)
    with ThreadPoolExecutor(max_workers=6) as pool:
        checked=list(pool.map(verify_page,list(unique.values())[:12]))
    result={'checked_at':datetime.now(timezone.utc).isoformat(),'items':[i for i in checked if i], 'errors':errors,'skipped_unavailable':sum(i is None for i in checked),'basis':'Original RSS excerpts; not editorially curated'}
    CACHE=result;CACHE_AT=time.monotonic()
    return result

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        result=collect();body=json.dumps(result,ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','public, max-age=0, s-maxage=1800, stale-while-revalidate=3600')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers();self.wfile.write(body)
