import sys,unittest
from pathlib import Path
from datetime import datetime,timezone
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from api import news
from scripts.daily_fetch import build_query

class NewsTests(unittest.TestCase):
    def test_source_restrictions(self):
        for u in ['http://phys.org/x','https://127.0.0.1/','https://phys.org.evil.test','https://x@phys.org/','https://phys.org:8443/']:
            self.assertFalse(news.allowed(u))
        self.assertTrue(news.allowed('https://phys.org/news/x'))
    def test_date_topic_and_excerpt(self):
        xml='<rss><channel>'+''.join(f'<item><title>{title}</title><link>https://phys.org/{i}</link><pubDate>{date}</pubDate><description>&lt;b&gt;Original description&lt;/b&gt;</description></item>' for i,title,date in [(1,'Photosynthesis discovery','Mon, 07 Sep 2026 08:00:00 GMT'),(2,'Photosynthesis old','Mon, 07 Sep 2020 08:00:00 GMT'),(3,'Unrelated discovery','Mon, 07 Sep 2026 08:00:00 GMT')])+'</channel></rss>'
        rows=news.parse_feed(xml,'Test',datetime(2026,9,7,9,tzinfo=timezone.utc));self.assertEqual(len(rows),1);self.assertEqual(rows[0]['excerpt'],'Original description')
    def test_xml_declarations_rejected(self):
        with self.assertRaises(ValueError):news.parse_feed('<!DOCTYPE rss><rss/>','Test',datetime.now(timezone.utc))
    def test_challenge_page_rejected(self):
        with patch.object(news,'get',return_value='<title>Access denied</title>'):
            self.assertIsNone(news.verify_page({'title':'New photosynthesis research','url':'https://phys.org/test'}))
    def test_feed_failures_reported(self):
        with patch.object(news,'get',side_effect=ValueError('unavailable')):
            rows,error=news.read_feed(('Test','https://phys.org/feed'));self.assertEqual(rows,[]);self.assertEqual(error,'Test')
    def test_date_window_really_in_query(self):
        q=build_query(7,datetime(2026,9,7,tzinfo=timezone.utc));self.assertIn('FIRST_PDATE:[2026-08-31 TO 2026-09-07]',q)
        with self.assertRaises(ValueError):build_query(0)
if __name__=='__main__':unittest.main()
