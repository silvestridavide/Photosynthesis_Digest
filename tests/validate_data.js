/**
 * Test di validazione formale del dataset di Photosynthesis Digest
 */

const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'assets', 'data', 'articles.json');
const jsPath = path.join(__dirname, '..', 'assets', 'js', 'articles-data.js');

console.log('=== TEST DI VALIDAZIONE: Photosynthesis Digest ===\n');

// 1. Check articles.json
if (!fs.existsSync(jsonPath)) {
  console.error('[ERRORE] File non trovato:', jsonPath);
  process.exit(1);
}

const rawJson = fs.readFileSync(jsonPath, 'utf-8');
let articles;
try {
  articles = JSON.parse(rawJson);
} catch (e) {
  console.error('[ERRORE] JSON non valido in articles.json:', e.message);
  process.exit(1);
}

console.log(`[+] articles.json caricato correttamente. Articoli trovati: ${articles.length}`);

if (articles.length < 15) {
  console.error(`[ERRORE] Richiesti almeno 15 articoli, trovati solo ${articles.length}`);
  process.exit(1);
}

// 2. Validate fields and check duplicates
const seenDois = new Set();
const seenIds = new Set();
const requiredFields = ['id', 'doi', 'title', 'authors', 'journal', 'publication_date', 'abstract', 'url'];

articles.forEach((art, index) => {
  const prefix = `Articolo #${index + 1} (${art.doi || 'SENZA DOI'}):`;

  requiredFields.forEach(field => {
    if (!art[field]) {
      console.error(`[ERRORE] ${prefix} Manca il campo obbligatorio '${field}'`);
      process.exit(1);
    }
  });

  if (!Array.isArray(art.authors) || art.authors.length === 0) {
    console.error(`[ERRORE] ${prefix} Il campo 'authors' deve essere un array non vuoto`);
    process.exit(1);
  }

  const cleanDoi = art.doi.toLowerCase().trim();
  if (seenDois.has(cleanDoi)) {
    console.error(`[ERRORE] ${prefix} DOI duplicato riscontrato: ${art.doi}`);
    process.exit(1);
  }
  seenDois.add(cleanDoi);

  if (seenIds.has(art.id)) {
    console.error(`[ERRORE] ${prefix} ID duplicato riscontrato: ${art.id}`);
    process.exit(1);
  }
  seenIds.add(art.id);

  // Check date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(art.publication_date)) {
    console.error(`[ERRORE] ${prefix} Formato data non valido: '${art.publication_date}' (richiesto YYYY-MM-DD)`);
    process.exit(1);
  }

  // Check abstract length (must not be empty placeholder)
  if (art.abstract.length < 50) {
    console.error(`[ERRORE] ${prefix} Abstract troppo corto o assente (${art.abstract.length} caratteri)`);
    process.exit(1);
  }
});

console.log(`[+] Tutti i ${articles.length} articoli possiedono tutti i campi obbligatori, date valide e nessun DOI duplicato.`);

// 3. Check JS module file
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
