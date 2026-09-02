/**
 * Test di validazione formale del dataset di Resonance (Node.js version)
 */

const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'assets', 'data', 'articles.json');
const jsPath = path.join(__dirname, '..', 'assets', 'js', 'articles-data.js');

console.log('=== TEST DI VALIDAZIONE: RESONANCE ===\n');

// 1. Check articles.json
if (!fs.existsSync(jsonPath)) {
  console.error('[ERRORE] File non trovato:', jsonPath);
  process.exit(1);
}

const rawJson = fs.readFileSync(jsonPath, 'utf-8');
let items;
try {
  items = JSON.parse(rawJson);
} catch (e) {
  console.error('[ERRORE] JSON non valido in articles.json:', e.message);
  process.exit(1);
}

console.log(`[+] articles.json caricato correttamente. Record totali trovati: ${items.length}`);

if (items.length < 50) {
  console.error(`[ERRORE] Richiesti almeno 50 record, trovati ${items.length}`);
  process.exit(1);
}

const seenIds = new Set();
const seenDois = new Set();
let articlesCount = 0;
let newsCount = 0;

items.forEach((item, index) => {
  const itemType = item.item_type || 'article';
  const prefix = `Record #${index + 1} [${itemType}] (${item.id}):`;

  ['id', 'title', 'publication_date', 'abstract', 'url', 'category'].forEach(field => {
    if (!item[field]) {
      console.error(`[ERRORE] ${prefix} Manca il campo obbligatorio '${field}'`);
      process.exit(1);
    }
  });

  if (seenIds.has(item.id)) {
    console.error(`[ERRORE] ${prefix} ID duplicato riscontrato: ${item.id}`);
    process.exit(1);
  }
  seenIds.add(item.id);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.publication_date)) {
    console.error(`[ERRORE] ${prefix} Formato data non valido: '${item.publication_date}' (richiesto YYYY-MM-DD)`);
    process.exit(1);
  }

  if (item.abstract.length < 40) {
    console.error(`[ERRORE] ${prefix} Abstract/sommario troppo corto (${item.abstract.length} caratteri)`);
    process.exit(1);
  }

  if (itemType === 'article') {
    articlesCount++;
    if (!item.doi) {
      console.error(`[ERRORE] ${prefix} Manca il DOI obbligatorio per l'articolo scientifico`);
      process.exit(1);
    }
    const cleanDoi = item.doi.toLowerCase().trim();
    if (seenDois.has(cleanDoi)) {
      console.error(`[ERRORE] ${prefix} DOI duplicato riscontrato: ${item.doi}`);
      process.exit(1);
    }
    seenDois.add(cleanDoi);

    if (!Array.isArray(item.authors) || item.authors.length === 0) {
      console.error(`[ERRORE] ${prefix} Il campo 'authors' deve essere un array non vuoto`);
      process.exit(1);
    }
  } else if (itemType === 'news') {
    newsCount++;
  }
});

console.log(`[+] Validazione record completata con successo: ${articlesCount} articoli scientifici e ${newsCount} notizie.`);

// Check JS module file
if (!fs.existsSync(jsPath)) {
  console.error('[ERRORE] File JS non trovato:', jsPath);
  process.exit(1);
}

const jsContent = fs.readFileSync(jsPath, 'utf-8');
if (!jsContent.includes('export const INITIAL_ARTICLES')) {
  console.error('[ERRORE] Il file JS articles-data.js non esporta INITIAL_ARTICLES');
  process.exit(1);
}

console.log('[+] articles-data.js contiene export INITIAL_ARTICLES valido.');
console.log('\n=== TUTTI I TEST DI VALIDAZIONE SUPERATI CON SUCCESSO! ===');
