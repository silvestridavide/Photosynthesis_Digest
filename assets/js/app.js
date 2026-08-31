/**
 * Photosynthesis Digest - Application Controller & Logic
 * Architecture: Vanilla ES Module (No build step, fully local-first)
 */

import { INITIAL_ARTICLES } from './articles-data.js';

class PhotosynthesisApp {
  constructor() {
    this.allArticles = [];
    this.savedIds = new Set();
    this.activeArticle = null;
    this.currentCitationFormat = 'apa';

    this.filters = {
      search: '',
      category: 'ALL',
      organism: 'ALL',
      sort: 'date-desc',
      savedOnly: false
    };

    this.init();
  }

  async init() {
    this.loadSavedState();
    await this.loadArticlesData();
    this.bindDOM();
    this.renderCategoryPills();
    this.applyFiltersAndRender();
  }

  loadSavedState() {
    try {
      const stored = localStorage.getItem('photosynthesis_saved_ids');
      if (stored) {
        this.savedIds = new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Impossibile accedere al localStorage:', e);
    }
  }

  saveSavedState() {
    try {
      localStorage.setItem('photosynthesis_saved_ids', JSON.stringify(Array.from(this.savedIds)));
      this.updateSavedCountDisplay();
    } catch (e) {
      console.warn('Impossibile salvare nel localStorage:', e);
    }
  }

  async loadArticlesData() {
    // 1. Try to load from assets/data/articles.json
    try {
      const res = await fetch('assets/data/articles.json', { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.allArticles = data;
        }
      }
    } catch (e) {
      console.info('Caricamento fallback tramite modulo JS (INITIAL_ARTICLES)');
    }

    // Fallback to embedded INITIAL_ARTICLES if fetch was blocked (e.g. file://)
    if (!this.allArticles || this.allArticles.length === 0) {
      this.allArticles = [...INITIAL_ARTICLES];
    }

    // Merge any locally added custom articles from localStorage
    try {
      const localCustom = localStorage.getItem('photosynthesis_custom_articles');
      if (localCustom) {
        const customList = JSON.parse(localCustom);
        if (Array.isArray(customList)) {
          customList.forEach(item => {
            if (!this.allArticles.some(a => a.doi.toLowerCase() === item.doi.toLowerCase())) {
              this.allArticles.unshift(item);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Errore lettura custom articles:', e);
    }

    this.updateMastheadMetrics();
  }

  updateMastheadMetrics() {
    const totalEl = document.getElementById('metric-total');
    const journalsEl = document.getElementById('metric-journals');
    const latestEl = document.getElementById('metric-latest-date');

    if (totalEl) totalEl.textContent = this.allArticles.length;

    if (journalsEl) {
      const uniqueJournals = new Set(this.allArticles.map(a => a.journal));
      journalsEl.textContent = uniqueJournals.size;
    }

    if (latestEl && this.allArticles.length > 0) {
      const dates = this.allArticles.map(a => a.publication_date).filter(Boolean).sort().reverse();
      if (dates.length > 0) {
        latestEl.textContent = dates[0];
      }
    }

    this.updateSavedCountDisplay();
  }

  updateSavedCountDisplay() {
    const savedCountEl = document.getElementById('saved-count');
    if (savedCountEl) savedCountEl.textContent = this.savedIds.size;
  }

  bindDOM() {
    // Search input
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');

    searchInput?.addEventListener('input', (e) => {
      this.filters.search = e.target.value.trim().toLowerCase();
      searchClear?.classList.toggle('hidden', !this.filters.search);
      this.applyFiltersAndRender();
    });

    searchClear?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      this.filters.search = '';
      searchClear.classList.add('hidden');
      this.applyFiltersAndRender();
      searchInput?.focus();
    });

    // Select filters
    document.getElementById('filter-category')?.addEventListener('change', (e) => {
      this.filters.category = e.target.value;
      this.updateActiveQuickPills();
      this.applyFiltersAndRender();
    });

    document.getElementById('filter-organism')?.addEventListener('change', (e) => {
      this.filters.organism = e.target.value;
      this.applyFiltersAndRender();
    });

    document.getElementById('sort-order')?.addEventListener('change', (e) => {
      this.filters.sort = e.target.value;
      this.applyFiltersAndRender();
    });

    // Saved toggle
    const savedBtn = document.getElementById('btn-toggle-saved');
    savedBtn?.addEventListener('click', () => {
      this.filters.savedOnly = !this.filters.savedOnly;
      savedBtn.classList.toggle('active', this.filters.savedOnly);
      this.applyFiltersAndRender();
    });

    // Reset filters
    const resetAll = () => {
      this.filters = {
        search: '',
        category: 'ALL',
        organism: 'ALL',
        sort: 'date-desc',
        savedOnly: false
      };
      if (searchInput) searchInput.value = '';
      searchClear?.classList.add('hidden');
      const catSelect = document.getElementById('filter-category');
      if (catSelect) catSelect.value = 'ALL';
      const orgSelect = document.getElementById('filter-organism');
      if (orgSelect) orgSelect.value = 'ALL';
      const sortSelect = document.getElementById('sort-order');
      if (sortSelect) sortSelect.value = 'date-desc';
      savedBtn?.classList.remove('active');
      this.updateActiveQuickPills();
      this.applyFiltersAndRender();
    };

    document.getElementById('btn-reset-filters')?.addEventListener('click', resetAll);
    document.getElementById('btn-empty-reset')?.addEventListener('click', resetAll);

    // Modal Events
    document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('article-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'article-modal') this.closeModal();
    });

    // Citation format toggles
    document.querySelectorAll('.btn-format').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-format').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentCitationFormat = e.currentTarget.dataset.fmt;
        this.updateModalCitation();
      });
    });

    // Modal Copy DOI
    document.getElementById('btn-copy-doi')?.addEventListener('click', () => {
      if (this.activeArticle?.doi) {
        this.copyToClipboard(this.activeArticle.doi, 'DOI copiato negli appunti!');
      }
    });

    // Modal Bookmark Toggle
    document.getElementById('modal-btn-bookmark')?.addEventListener('click', () => {
      if (this.activeArticle) {
        this.toggleBookmark(this.activeArticle.id);
        this.updateModalBookmarkState();
      }
    });

    // DOI Ingestion Drawer
    const drawer = document.getElementById('doi-drawer');
    document.getElementById('btn-open-doi-drawer')?.addEventListener('click', () => {
      drawer?.classList.remove('hidden');
    });
    document.getElementById('drawer-close')?.addEventListener('click', () => {
      drawer?.classList.add('hidden');
    });
    drawer?.addEventListener('click', (e) => {
      if (e.target.id === 'doi-drawer') drawer.classList.add('hidden');
    });

    // Copy code block buttons
    document.querySelectorAll('.btn-copy-code').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.dataset.code;
        if (code) this.copyToClipboard(code, 'Comando copiato negli appunti!');
      });
    });

    // Client-side DOI fetcher form
    document.getElementById('btn-fetch-doi-client')?.addEventListener('click', () => {
      this.handleClientDoiFetch();
    });

    // Export Modal
    const exportModal = document.getElementById('export-modal');
    document.getElementById('btn-export-data')?.addEventListener('click', () => {
      const countLabel = document.getElementById('export-count-label');
      const visible = this.getFilteredArticles();
      if (countLabel) countLabel.textContent = visible.length;
      exportModal?.classList.remove('hidden');
    });
    document.getElementById('export-modal-close')?.addEventListener('click', () => {
      exportModal?.classList.add('hidden');
    });
    exportModal?.addEventListener('click', (e) => {
      if (e.target.id === 'export-modal') exportModal.classList.add('hidden');
    });

    document.querySelectorAll('.btn-export-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type;
        this.handleExport(type);
        exportModal?.classList.add('hidden');
      });
    });

    // Keyboard ESC listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        drawer?.classList.add('hidden');
        exportModal?.classList.add('hidden');
      }
    });
  }

  renderCategoryPills() {
    const container = document.getElementById('quick-category-pills');
    if (!container) return;

    const categories = [
      'Structural Biology & Cryo-EM',
      'Molecular Genetics & Crop Engineering',
      'Biophysics & Photoprotection',
      'Carbon Fixation & Pyrenoids',
      'Bioenergy & Synthetic Biology'
    ];

    const shortLabels = {
      'Structural Biology & Cryo-EM': 'Cryo-EM & Strutture',
      'Molecular Genetics & Crop Engineering': 'Genetica & Rubisco',
      'Biophysics & Photoprotection': 'NPQ & Biofisica',
      'Carbon Fixation & Pyrenoids': 'Pirenoide & CCM',
      'Bioenergy & Synthetic Biology': 'Bioenergia & H₂'
    };

    container.innerHTML = categories.map(cat => `
      <button class="pill-quick" data-cat="${cat}">
        ${shortLabels[cat] || cat}
      </button>
    `).join('');

    container.querySelectorAll('.pill-quick').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const cat = e.currentTarget.dataset.cat;
        const select = document.getElementById('filter-category');
        if (this.filters.category === cat) {
          this.filters.category = 'ALL';
          if (select) select.value = 'ALL';
        } else {
          this.filters.category = cat;
          if (select) select.value = cat;
        }
        this.updateActiveQuickPills();
        this.applyFiltersAndRender();
      });
    });
  }

  updateActiveQuickPills() {
    document.querySelectorAll('.pill-quick').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.cat === this.filters.category);
    });
  }

  getFilteredArticles() {
    return this.allArticles.filter(item => {
      // Saved only
      if (this.filters.savedOnly && !this.savedIds.has(item.id)) {
        return false;
      }

      // Category
      if (this.filters.category !== 'ALL' && item.category !== this.filters.category) {
        return false;
      }

      // Organism
      if (this.filters.organism !== 'ALL') {
        const itemOrg = (item.organism || '').toLowerCase();
        const targetOrg = this.filters.organism.toLowerCase();
        if (!itemOrg.includes(targetOrg)) {
          return false;
        }
      }

      // Search Query
      if (this.filters.search) {
        const q = this.filters.search;
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const authorMatch = (item.authors || []).some(a => (a.name || '').toLowerCase().includes(q));
        const journalMatch = (item.journal || '').toLowerCase().includes(q);
        const doiMatch = (item.doi || '').toLowerCase().includes(q);
        const abstractMatch = (item.abstract || '').toLowerCase().includes(q);
        const tagMatch = (item.tags || []).some(t => t.toLowerCase().includes(q));
        const orgMatch = (item.organism || '').toLowerCase().includes(q);

        if (!titleMatch && !authorMatch && !journalMatch && !doiMatch && !abstractMatch && !tagMatch && !orgMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (this.filters.sort === 'date-desc') {
        return (b.publication_date || '').localeCompare(a.publication_date || '');
      }
      if (this.filters.sort === 'date-asc') {
        return (a.publication_date || '').localeCompare(b.publication_date || '');
      }
      if (this.filters.sort === 'title-asc') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (this.filters.sort === 'journal-asc') {
        return (a.journal || '').localeCompare(b.journal || '');
      }
      return 0;
    });
  }

  applyFiltersAndRender() {
    const filtered = this.getFilteredArticles();
    
    // Update count labels
    const visibleCountEl = document.getElementById('visible-count');
    const labelEl = document.getElementById('results-count-label');
    if (visibleCountEl) visibleCountEl.textContent = filtered.length;
    if (labelEl) {
      labelEl.textContent = filtered.length === 1 ? 'articolo scientifico selezionato' : 'articoli scientifici selezionati';
    }

    const emptyState = document.getElementById('empty-state');
    const spotlightContainer = document.getElementById('spotlight-container');
    const articlesContainer = document.getElementById('articles-container');

    if (filtered.length === 0) {
      emptyState?.classList.remove('hidden');
      if (spotlightContainer) spotlightContainer.innerHTML = '';
      if (articlesContainer) articlesContainer.innerHTML = '';
      return;
    }

    emptyState?.classList.add('hidden');

    // Render Spotlight (First featured article when viewing ALL and no search)
    if (!this.filters.search && this.filters.category === 'ALL' && this.filters.organism === 'ALL' && !this.filters.savedOnly) {
      const featured = filtered.find(a => a.featured) || filtered[0];
      this.renderSpotlight(featured);
      // Exclude spotlight item from grid or keep for completeness
      this.renderGrid(filtered);
    } else {
      if (spotlightContainer) spotlightContainer.innerHTML = '';
      this.renderGrid(filtered);
    }
  }

  renderSpotlight(article) {
    const container = document.getElementById('spotlight-container');
    if (!container || !article) {
      if (container) container.innerHTML = '';
      return;
    }

    const isSaved = this.savedIds.has(article.id);
    const authorsFormatted = this.formatAuthorsShort(article.authors);

    container.innerHTML = `
      <div class="spotlight-card">
        <div class="spotlight-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          In Evidenza · Nuova Pubblicazione
        </div>
        <h2 class="spotlight-title" data-id="${article.id}">${this.escapeHtml(article.title)}</h2>
        <div class="spotlight-authors">${this.escapeHtml(authorsFormatted)}</div>
        <p class="spotlight-abstract">${this.escapeHtml(article.abstract || '')}</p>
        <div class="spotlight-footer">
          <div class="meta-badges-left">
            <span class="badge badge-journal">${this.escapeHtml(article.journal)}</span>
            <span class="badge badge-date">${this.escapeHtml(article.publication_date || article.year)}</span>
            <span class="badge badge-organism">${this.escapeHtml(article.organism || '')}</span>
          </div>
          <div class="card-actions-right">
            <button class="btn btn-bookmark ${isSaved ? 'active' : ''}" data-id="${article.id}" title="Salva nei preferiti">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button class="btn btn-primary btn-read-modal" data-id="${article.id}">
              Leggi Scheda & Abstract
            </button>
            <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="btn-external-link" title="Apri sul sito dell'editore">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
            </a>
          </div>
        </div>
      </div>
    `;

    // Bind spotlight clicks
    container.querySelector('.spotlight-title')?.addEventListener('click', () => this.openModal(article.id));
    container.querySelector('.btn-read-modal')?.addEventListener('click', () => this.openModal(article.id));
    container.querySelector('.btn-bookmark')?.addEventListener('click', () => this.toggleBookmark(article.id));
  }

  renderGrid(articles) {
    const container = document.getElementById('articles-container');
    if (!container) return;

    container.innerHTML = articles.map(article => {
      const isSaved = this.savedIds.has(article.id);
      const authorsFormatted = this.formatAuthorsShort(article.authors);

      return `
        <article class="article-card" id="card-${article.id}">
          
          <!-- Top Metadata Bar -->
          <div class="card-meta-top">
            <div class="meta-badges-left">
              <span class="badge badge-journal">${this.escapeHtml(article.journal)}</span>
              <span class="badge badge-date">${this.escapeHtml(article.publication_date || article.year)}</span>
              ${article.open_access ? '<span class="badge badge-oa is-oa">Open Access</span>' : ''}
            </div>
            <button class="btn-bookmark ${isSaved ? 'active' : ''}" data-id="${article.id}" title="${isSaved ? 'Rimuovi dai salvati' : 'Salva nei preferiti'}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>

          <!-- Authors in prima linea -->
          <div class="card-authors" title="${this.escapeHtml(authorsFormatted)}">
            ${this.escapeHtml(authorsFormatted)}
          </div>

          <!-- Title -->
          <h3 class="card-title" data-id="${article.id}">
            ${this.escapeHtml(article.title)}
          </h3>

          <!-- Tags & Organism -->
          <div class="card-tags">
            ${article.organism ? `<span class="badge badge-organism">${this.escapeHtml(article.organism)}</span>` : ''}
            <span class="badge badge-category">${this.escapeHtml(article.category || 'Fotosintesi')}</span>
          </div>

          <!-- Abstract Preview -->
          <p class="card-abstract">
            ${this.escapeHtml(article.abstract || 'Nessun abstract disponibile per questo record.')}
          </p>

          <!-- Bottom Actions -->
          <div class="card-footer">
            <span class="card-doi-pill" title="${this.escapeHtml(article.doi)}">DOI: ${this.escapeHtml(article.doi)}</span>
            <div class="card-actions-right">
              <button class="btn-read-modal" data-id="${article.id}">
                Leggi Abstract
              </button>
              <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="btn-external-link" title="Vai all'Editore ↗">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
              </a>
            </div>
          </div>

        </article>
      `;
    }).join('');

    // Bind event listeners for generated cards
    container.querySelectorAll('.card-title').forEach(el => {
      el.addEventListener('click', (e) => this.openModal(e.currentTarget.dataset.id));
    });

    container.querySelectorAll('.btn-read-modal').forEach(el => {
      el.addEventListener('click', (e) => this.openModal(e.currentTarget.dataset.id));
    });

    container.querySelectorAll('.btn-bookmark').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.toggleBookmark(id);
      });
    });
  }

  formatAuthorsShort(authors) {
    if (!authors || !Array.isArray(authors) || authors.length === 0) return 'Autori non indicati';
    const names = authors.map(a => typeof a === 'string' ? a : a.name);
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    if (names.length <= 3) return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
    return `${names[0]}, ${names[1]} et al.`;
  }

  toggleBookmark(id) {
    if (this.savedIds.has(id)) {
      this.savedIds.delete(id);
      this.showToast('Articolo rimosso dai preferiti');
    } else {
      this.savedIds.add(id);
      this.showToast('Articolo salvato nei preferiti!');
    }
    this.saveSavedState();
    this.applyFiltersAndRender();
  }

  openModal(id) {
    const article = this.allArticles.find(a => a.id === id);
    if (!article) return;

    this.activeArticle = article;
    const modal = document.getElementById('article-modal');

    // Populate Top Metadata
    const journalEl = document.getElementById('modal-journal');
    if (journalEl) journalEl.textContent = article.journal;

    const dateEl = document.getElementById('modal-date');
    if (dateEl) dateEl.textContent = article.publication_date || article.year;

    const typeEl = document.getElementById('modal-type');
    if (typeEl) typeEl.textContent = article.article_type || 'Research Article';

    const oaEl = document.getElementById('modal-oa');
    if (oaEl) {
      oaEl.classList.toggle('hidden', !article.open_access);
    }

    // Title
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = article.title;

    // Authors & Affiliations
    const authorsContainer = document.getElementById('modal-authors');
    if (authorsContainer) {
      const authors = article.authors || [];
      authorsContainer.innerHTML = authors.map(a => {
        const name = typeof a === 'string' ? a : a.name;
        const affil = a.affiliation ? `<span class="author-affil">(${this.escapeHtml(a.affiliation)})</span>` : '';
        const orcid = a.orcid ? `<a href="https://orcid.org/${a.orcid}" target="_blank" rel="noopener noreferrer" class="author-orcid" title="ORCID: ${a.orcid}">[ORCID]</a>` : '';
        return `
          <div class="author-item">
            <span class="author-name">${this.escapeHtml(name)}</span>
            ${affil}
            ${orcid}
          </div>
        `;
      }).join('');
    }

    // Badges & Tags
    const tagsContainer = document.getElementById('modal-tags');
    if (tagsContainer) {
      const tagPills = (article.tags || []).map(t => `<span class="badge badge-category">${this.escapeHtml(t)}</span>`).join('');
      tagsContainer.innerHTML = `
        ${article.organism ? `<span class="badge badge-organism">${this.escapeHtml(article.organism)}</span>` : ''}
        <span class="badge badge-type">${this.escapeHtml(article.category || 'Fotosintesi')}</span>
        ${tagPills}
      `;
    }

    // Full Abstract
    const abstractEl = document.getElementById('modal-abstract');
    if (abstractEl) {
      abstractEl.textContent = article.abstract || 'Nessun abstract disponibile.';
    }

    // DOI & Link
    const doiEl = document.getElementById('modal-doi');
    if (doiEl) doiEl.textContent = article.doi;

    const linkExternal = document.getElementById('modal-link-external');
    if (linkExternal) linkExternal.href = article.url;

    // Bookmark State
    this.updateModalBookmarkState();

    // Citation
    this.updateModalCitation();

    modal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  updateModalBookmarkState() {
    if (!this.activeArticle) return;
    const isSaved = this.savedIds.has(this.activeArticle.id);
    const label = document.getElementById('modal-bookmark-label');
    const btn = document.getElementById('modal-btn-bookmark');
    if (label) label.textContent = isSaved ? 'Salvato nei preferiti' : 'Salva nei preferiti';
    if (btn) btn.classList.toggle('active', isSaved);
  }

  updateModalCitation() {
    if (!this.activeArticle) return;
    const box = document.getElementById('modal-citation-text');
    if (!box) return;

    const a = this.activeArticle;
    const authors = (a.authors || []).map(auth => typeof auth === 'string' ? auth : auth.name);
    const firstAuthorSurname = authors.length > 0 ? authors[0].split(' ').pop().toLowerCase() : 'photosynthesis';
    const year = a.year || (a.publication_date ? a.publication_date.substring(0, 4) : '2026');

    if (this.currentCitationFormat === 'apa') {
      const authorListStr = authors.join(', ');
      box.textContent = `${authorListStr} (${year}). ${a.title}. ${a.journal}. https://doi.org/${a.doi}`;
    } else if (this.currentCitationFormat === 'bibtex') {
      const bibKey = `${firstAuthorSurname}${year}${a.id.split('-')[0] || ''}`;
      box.textContent = `@article{${bibKey},
  author = {${authors.join(' and ')}},
  title = {${a.title}},
  journal = {${a.journal}},
  year = {${year}},
  doi = {${a.doi}},
  url = {${a.url}}
}`;
    } else if (this.currentCitationFormat === 'ris') {
      box.textContent = `TY  - JOUR
TI  - ${a.title}
${authors.map(auth => `AU  - ${auth}`).join('\n')}
JO  - ${a.journal}
PY  - ${year}
DO  - ${a.doi}
UR  - ${a.url}
ER  -`;
    }
  }

  closeModal() {
    const modal = document.getElementById('article-modal');
    modal?.classList.add('hidden');
    document.body.style.overflow = '';
    this.activeArticle = null;
  }

  async handleClientDoiFetch() {
    const input = document.getElementById('input-manual-doi');
    const status = document.getElementById('doi-fetch-status');
    const rawDoi = input?.value.trim();

    if (!rawDoi) {
      if (status) {
        status.className = 'status-msg error';
        status.textContent = 'Inserisci un DOI valido (es. 10.1038/s41477-026-02357-x)';
        status.classList.remove('hidden');
      }
      return;
    }

    const cleanDoi = rawDoi.replace(/^https?:\/\/doi\.org\//i, '').trim();

    if (status) {
      status.className = 'status-msg loading';
      status.textContent = `Interrogazione metadati per DOI: ${cleanDoi}...`;
      status.classList.remove('hidden');
    }

    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);
      if (!res.ok) throw new Error(`Risposta API: HTTP ${res.status}`);
      const data = await res.json();
      const item = data.message;

      const title = Array.isArray(item.title) ? item.title[0] : (item.title || cleanDoi);
      const authors = (item.author || []).map(a => ({
        name: `${a.given || ''} ${a.family || ''}`.trim() || a.name || 'Autore Sconosciuto',
        affiliation: (a.affiliation && a.affiliation[0]) ? (a.affiliation[0].name || '') : '',
        orcid: a.ORCID ? a.ORCID.replace('http://orcid.org/', '').replace('https://orcid.org/', '') : ''
      }));

      const journal = (item['container-title'] && item['container-title'][0]) ? item['container-title'][0] : 'Rivista Scientifica';
      const dateParts = item.created ? item.created['date-parts'][0] : [2026, 1, 1];
      const pubDate = `${dateParts[0]}-${String(dateParts[1]).padStart(2, '0')}-${String(dateParts[2] || 1).padStart(2, '0')}`;

      const newArticle = {
        id: `custom-${Date.now()}`,
        doi: cleanDoi,
        title: title,
        authors: authors.length > 0 ? authors : [{ name: 'Autori da verificare' }],
        journal: journal,
        publication_date: pubDate,
        year: dateParts[0],
        article_type: 'Research Article',
        organism: 'Organismo fotosintetico',
        category: 'Fotosintesi Generale',
        tags: ['Letteratura Scientifica', 'Nuovo Inserimento'],
        abstract: item.abstract ? item.abstract.replace(/<[^>]*>?/gm, '') : 'Abstract originale consultabile sul sito dell\'editore.',
        url: item.URL || `https://doi.org/${cleanDoi}`,
        open_access: false,
        featured: false,
        added_at: new Date().toISOString().split('T')[0]
      };

      // Save locally
      let customList = [];
      try {
        const stored = localStorage.getItem('photosynthesis_custom_articles');
        if (stored) customList = JSON.parse(stored);
      } catch (e) {}

      customList.unshift(newArticle);
      localStorage.setItem('photosynthesis_custom_articles', JSON.stringify(customList));

      this.allArticles.unshift(newArticle);
      this.updateMastheadMetrics();
      this.applyFiltersAndRender();

      if (status) {
        status.className = 'status-msg success';
        status.innerHTML = `<strong>Aggiunto con successo!</strong><br>"${this.escapeHtml(title)}" (${journal})`;
      }
      if (input) input.value = '';
      this.showToast('Nuovo articolo aggiunto al catalogo!');

    } catch (err) {
      if (status) {
        status.className = 'status-msg error';
        status.innerHTML = `Impossibile recuperare online (${err.message}).<br>Per l'inserimento permanente sul server usa il comando CLI:<br><code>python3 scripts/add_by_doi.py ${cleanDoi}</code>`;
      }
    }
  }

  handleExport(type) {
    const list = this.getFilteredArticles();
    if (list.length === 0) {
      this.showToast('Nessun articolo da esportare');
      return;
    }

    let content = '';
    let filename = `photosynthesis_digest_export_${new Date().toISOString().split('T')[0]}`;
    let mimeType = 'text/plain';

    if (type === 'json') {
      content = JSON.stringify(list, null, 2);
      filename += '.json';
      mimeType = 'application/json';
    } else if (type === 'bibtex') {
      content = list.map(a => {
        const authors = (a.authors || []).map(auth => typeof auth === 'string' ? auth : auth.name).join(' and ');
        const year = a.year || (a.publication_date ? a.publication_date.substring(0, 4) : '2026');
        return `@article{${a.id},
  author = {${authors}},
  title = {${a.title}},
  journal = {${a.journal}},
  year = {${year}},
  doi = {${a.doi}},
  url = {${a.url}}
}\n`;
      }).join('\n');
      filename += '.bib';
      mimeType = 'text/x-bibtex';
    } else if (type === 'csv') {
      const headers = ['DOI', 'Titolo', 'Autori', 'Rivista', 'Data', 'Organismo', 'Categoria', 'URL'];
      const rows = list.map(a => {
        const authors = (a.authors || []).map(auth => typeof auth === 'string' ? auth : auth.name).join('; ');
        return [
          `"${a.doi}"`,
          `"${(a.title || '').replace(/"/g, '""')}"`,
          `"${authors.replace(/"/g, '""')}"`,
          `"${(a.journal || '').replace(/"/g, '""')}"`,
          `"${a.publication_date || a.year}"`,
          `"${(a.organism || '').replace(/"/g, '""')}"`,
          `"${(a.category || '').replace(/"/g, '""')}"`,
          `"${a.url}"`
        ].join(',');
      });
      content = [headers.join(','), ...rows].join('\n');
      filename += '.csv';
      mimeType = 'text/csv';
    }

    this.downloadFile(content, filename, mimeType);
    this.showToast(`Esportati ${list.length} articoli in ${type.toUpperCase()}!`);
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  copyToClipboard(text, message) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(message);
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      this.showToast(message);
    });
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(1rem)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new PhotosynthesisApp();
});
