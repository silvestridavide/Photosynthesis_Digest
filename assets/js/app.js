/**
 * Photosynthesis Digest · Application Controller & Magazine Engine
 * Architecture: Vanilla ES Module (Zero Build Step, Local-First)
 */

import { INITIAL_ARTICLES } from './articles-data.js';

class PhotosynthesisMagazineApp {
  constructor() {
    this.items = [];
    this.savedIds = new Set();
    this.activeItem = null;
    this.activeView = 'magazine'; // 'magazine' | 'articles' | 'news' | 'saved'
    this.citationFormat = 'apa';

    this.filters = {
      search: '',
      category: 'ALL',
      organism: 'ALL',
      sort: 'date-desc'
    };

    this.init();
  }

  async init() {
    this.loadSavedState();
    await this.loadDataset();
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
      console.warn('Accesso al localStorage non disponibile:', e);
    }
  }

  saveSavedState() {
    try {
      localStorage.setItem('photosynthesis_saved_ids', JSON.stringify(Array.from(this.savedIds)));
      this.updateSavedCountDisplay();
    } catch (e) {
      console.warn('Errore salvataggio localStorage:', e);
    }
  }

  async loadDataset() {
    // 1. Fetch from assets/data/articles.json
    try {
      const res = await fetch('assets/data/articles.json', { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.items = data;
        }
      }
    } catch (e) {
      console.info('Caricamento fallback tramite modulo JS INITIAL_ARTICLES');
    }

    // Fallback to embedded module data if fetch fails (e.g., direct file://)
    if (!this.items || this.items.length === 0) {
      this.items = [...INITIAL_ARTICLES];
    }

    // Merge any locally added custom items
    try {
      const localCustom = localStorage.getItem('photosynthesis_custom_articles');
      if (localCustom) {
        const customList = JSON.parse(localCustom);
        if (Array.isArray(customList)) {
          customList.forEach(customItem => {
            const exists = this.items.some(it => (it.doi && customItem.doi && it.doi.toLowerCase() === customItem.doi.toLowerCase()) || it.id === customItem.id);
            if (!exists) {
              this.items.unshift(customItem);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Errore lettura custom articles:', e);
    }

    this.updateMetrics();
  }

  updateMetrics() {
    const articles = this.items.filter(it => it.item_type === 'article' || !it.item_type);
    const news = this.items.filter(it => it.item_type === 'news');

    const papersEl = document.getElementById('metric-papers');
    const newsEl = document.getElementById('metric-news');
    const journalsEl = document.getElementById('metric-journals');
    const tabArtCountEl = document.getElementById('tab-articles-count');
    const tabNewsCountEl = document.getElementById('tab-news-count');

    if (papersEl) papersEl.textContent = articles.length;
    if (newsEl) newsEl.textContent = news.length;
    if (tabArtCountEl) tabArtCountEl.textContent = articles.length;
    if (tabNewsCountEl) tabNewsCountEl.textContent = news.length;

    if (journalsEl) {
      const journals = new Set(this.items.map(it => it.journal).filter(Boolean));
      journalsEl.textContent = journals.size;
    }

    this.updateSavedCountDisplay();
  }

  updateSavedCountDisplay() {
    const savedCountEl = document.getElementById('saved-count');
    if (savedCountEl) savedCountEl.textContent = this.savedIds.size;
  }

  bindDOM() {
    // View Switcher Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.setActiveView(view);
      });
    });

    // Search input & clear
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
      searchClear?.classList.add('hidden');
      this.applyFiltersAndRender();
      searchInput?.focus();
    });

    // Filters Dropdown
    document.getElementById('filter-category')?.addEventListener('change', (e) => {
      this.filters.category = e.target.value;
      this.updateActiveCategoryPills();
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

    // Reset Buttons
    const resetFilters = () => {
      this.filters = {
        search: '',
        category: 'ALL',
        organism: 'ALL',
        sort: 'date-desc'
      };
      if (searchInput) searchInput.value = '';
      searchClear?.classList.add('hidden');
      
      const catSel = document.getElementById('filter-category');
      if (catSel) catSel.value = 'ALL';
      const orgSel = document.getElementById('filter-organism');
      if (orgSel) orgSel.value = 'ALL';
      const sortSel = document.getElementById('sort-order');
      if (sortSel) sortSel.value = 'date-desc';

      this.setActiveView('magazine');
      this.updateActiveCategoryPills();
      this.applyFiltersAndRender();
    };

    document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
    document.getElementById('btn-banner-reset')?.addEventListener('click', resetFilters);
    document.getElementById('btn-empty-reset')?.addEventListener('click', resetFilters);

    // Modal Close
    document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('article-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'article-modal') this.closeModal();
    });

    // Citation Format Switchers
    document.querySelectorAll('.btn-fmt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-fmt').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.citationFormat = e.currentTarget.dataset.fmt;
        this.updateModalCitationText();
      });
    });

    // Copy DOI
    document.getElementById('btn-copy-doi')?.addEventListener('click', () => {
      if (this.activeItem?.doi) {
        this.copyToClipboard(this.activeItem.doi, 'DOI copiato negli appunti!');
      }
    });

    // Bookmark from Modal
    document.getElementById('modal-btn-bookmark')?.addEventListener('click', () => {
      if (this.activeItem) {
        this.toggleBookmark(this.activeItem.id);
        this.updateModalBookmarkState();
      }
    });

    // DOI Drawer
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

    // CLI Copy buttons
    document.querySelectorAll('.btn-copy-cli').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.dataset.code;
        if (code) this.copyToClipboard(code, 'Comando copiato negli appunti!');
      });
    });

    // In-browser DOI fetcher
    document.getElementById('btn-fetch-doi-client')?.addEventListener('click', () => {
      this.handleClientDoiFetch();
    });

    // Export Modal
    const exportModal = document.getElementById('export-modal');
    document.getElementById('btn-export-data')?.addEventListener('click', () => {
      const countLabel = document.getElementById('export-count-label');
      const filtered = this.getFilteredItems();
      if (countLabel) countLabel.textContent = filtered.length;
      exportModal?.classList.remove('hidden');
    });
    document.getElementById('export-modal-close')?.addEventListener('click', () => {
      exportModal?.classList.add('hidden');
    });
    exportModal?.addEventListener('click', (e) => {
      if (e.target.id === 'export-modal') exportModal.classList.add('hidden');
    });

    document.querySelectorAll('.export-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type;
        this.handleExport(type);
        exportModal?.classList.add('hidden');
      });
    });

    // ESC Key listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        drawer?.classList.add('hidden');
        exportModal?.classList.add('hidden');
      }
    });
  }

  setActiveView(view) {
    this.activeView = view;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    this.applyFiltersAndRender();
  }

  renderCategoryPills() {
    const container = document.getElementById('quick-category-pills');
    if (!container) return;

    const categories = [
      { id: 'Structural Biology & Cryo-EM', label: 'Cryo-EM & Strutture' },
      { id: 'Molecular Genetics & Crop Engineering', label: 'Genetica & Rubisco' },
      { id: 'Biophysics & Photoprotection', label: 'NPQ & Biofisica' },
      { id: 'Photoprotection & Algae', label: 'Alghe & LHCSR' },
      { id: 'Carbon Fixation & Pyrenoids', label: 'Pirenoide & CCM' },
      { id: 'Bioenergy & Synthetic Biology', label: 'Bioenergia & Solare' }
    ];

    container.innerHTML = categories.map(cat => `
      <button class="pill-quick" data-cat="${cat.id}">
        ${cat.label}
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
        this.updateActiveCategoryPills();
        this.applyFiltersAndRender();
      });
    });
  }

  updateActiveCategoryPills() {
    document.querySelectorAll('.pill-quick').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.cat === this.filters.category);
    });
  }

  getFilteredItems() {
    return this.items.filter(item => {
      // Tab View Filter
      if (this.activeView === 'articles') {
        if (item.item_type && item.item_type !== 'article') return false;
      } else if (this.activeView === 'news') {
        if (item.item_type !== 'news') return false;
      } else if (this.activeView === 'saved') {
        if (!this.savedIds.has(item.id)) return false;
      }

      // Category filter
      if (this.filters.category !== 'ALL' && item.category !== this.filters.category) {
        return false;
      }

      // Organism filter
      if (this.filters.organism !== 'ALL') {
        const itemOrg = (item.organism || '').toLowerCase();
        const targetOrg = this.filters.organism.toLowerCase();
        if (!itemOrg.includes(targetOrg)) return false;
      }

      // Search Query
      if (this.filters.search) {
        const q = this.filters.search;
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const authorMatch = (item.authors || []).some(a => (a.name || '').toLowerCase().includes(q) || (a.affiliation || '').toLowerCase().includes(q));
        const journalMatch = (item.journal || '').toLowerCase().includes(q);
        const doiMatch = (item.doi || '').toLowerCase().includes(q);
        const abstractMatch = (item.abstract || '').toLowerCase().includes(q);
        const tagMatch = (item.tags || []).some(t => t.toLowerCase().includes(q));
        const orgMatch = (item.organism || '').toLowerCase().includes(q);
        const sourceMatch = (item.source_name || '').toLowerCase().includes(q);

        if (!titleMatch && !authorMatch && !journalMatch && !doiMatch && !abstractMatch && !tagMatch && !orgMatch && !sourceMatch) {
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
    const filtered = this.getFilteredItems();
    const isFilteredOrSpecialView = Boolean(
      this.filters.search ||
      this.filters.category !== 'ALL' ||
      this.filters.organism !== 'ALL' ||
      this.activeView !== 'magazine'
    );

    const emptyState = document.getElementById('empty-state');
    const magazineMainView = document.getElementById('magazine-main-view');
    const flatResultsView = document.getElementById('flat-results-view');
    const filterStatusBanner = document.getElementById('filter-status-banner');
    const filterActiveCount = document.getElementById('filter-active-count');

    if (filtered.length === 0) {
      emptyState?.classList.remove('hidden');
      magazineMainView?.classList.add('hidden');
      flatResultsView?.classList.add('hidden');
      if (filterStatusBanner) filterStatusBanner.classList.add('hidden');
      return;
    }

    emptyState?.classList.add('hidden');

    if (isFilteredOrSpecialView) {
      // Show Flat / Filtered Cards View
      magazineMainView?.classList.add('hidden');
      flatResultsView?.classList.remove('hidden');

      if (filterStatusBanner && filterActiveCount) {
        filterStatusBanner.classList.remove('hidden');
        filterActiveCount.textContent = filtered.length;
      }

      this.renderFlatGrid(filtered);
    } else {
      // Show Complete Magazine Editorial Layout
      magazineMainView?.classList.remove('hidden');
      flatResultsView?.classList.add('hidden');
      filterStatusBanner?.classList.add('hidden');

      this.renderMagazineLayout(filtered);
    }
  }

  renderMagazineLayout(items) {
    const articles = items.filter(it => it.item_type === 'article' || !it.item_type);
    const news = items.filter(it => it.item_type === 'news');

    // 1. Cover Story Spread: Li et al. (Nature 2026) or first featured article
    const coverStory = articles.find(a => a.featured) || articles[0];
    this.renderCoverStory(coverStory);

    // 2. Editorial Secondary Highlights: 2 standout pieces (Hussein et al. Science 2024 & Chlorella ohadii Nat Commun 2026)
    const secondaryHighlights = articles.filter(a => a.id !== coverStory?.id && a.featured).slice(0, 2);
    this.renderEditorialHighlights(secondaryHighlights);

    // 3. News Wire Section
    this.renderNewsSection(news);

    // 4. Research Archive Section (the remaining peer-reviewed articles)
    const researchPapers = articles.filter(a => a.id !== coverStory?.id);
    this.renderResearchSection(researchPapers);
  }

  renderCoverStory(item) {
    const container = document.getElementById('cover-feature-container');
    if (!container || !item) {
      if (container) container.innerHTML = '';
      return;
    }

    const isSaved = this.savedIds.has(item.id);
    const authorsFormatted = this.formatAuthorsShort(item.authors);

    container.innerHTML = `
      <article class="cover-card" id="cover-${item.id}">
        
        <div class="cover-left-panel">
          <div class="cover-badge-row">
            <span class="cover-flag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              In Copertina · Scelta Editoriale
            </span>
            <span class="badge badge-journal">${this.escapeHtml(item.journal)}</span>
            <span class="badge badge-date">${this.escapeHtml(item.publication_date || item.year)}</span>
            ${item.open_access ? '<span class="badge badge-oa">Open Access</span>' : ''}
            <span class="badge badge-organism">${this.escapeHtml(item.organism || '')}</span>
          </div>

          <h2 class="cover-title" data-id="${item.id}">
            ${this.escapeHtml(item.title)}
          </h2>

          <div class="cover-authors-line">
            <span>Autori:</span>
            <strong>${this.escapeHtml(authorsFormatted)}</strong>
          </div>

          <p class="cover-excerpt">
            ${this.escapeHtml(item.abstract || '')}
          </p>

          <div class="cover-left-footer">
            <button class="btn btn-petrol btn-open-modal" data-id="${item.id}">
              <span>Leggi Scheda &amp; Abstract</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button class="btn btn-petrol-ghost btn-bookmark ${isSaved ? 'active' : ''}" data-id="${item.id}" title="${isSaved ? 'Rimuovi dai salvati' : 'Salva nei preferiti'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <span>${isSaved ? 'Salvato' : 'Salva'}</span>
            </button>
            <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn btn-petrol-ghost" title="Apri sul sito dell'editore">
              <span>Sito Editore</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
            </a>
          </div>
        </div>

        <div class="cover-right-panel">
          <div>
            <div class="takeaway-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
              Punti Chiave della Scoperta
            </div>
            <ul class="takeaway-list">
              <li>Risoluzione in situ della struttura nativa C2S2M2L4 di PSII-LHCII all'interno dei tilacoidi di riso (<em>Oryza sativa</em>).</li>
              <li>Identificazione di 4 trimeri d'antenna LHCII addizionali non conservati nelle purificazioni convenzionali in vitro.</li>
              <li>Evidenza del ruolo di PSII come 'scheletro strutturale' trans-lumenale e trans-stromale per l'impilamento dei grana.</li>
              <li>Comprensione molecolare dell'altissima efficienza fotone-elettrone della fotosintesi vegetale.</li>
            </ul>
          </div>

          <div class="cover-right-meta">
            <div><strong>Categoria:</strong> ${this.escapeHtml(item.category)}</div>
            <div><strong>DOI:</strong> <code>${this.escapeHtml(item.doi)}</code></div>
            <div><strong>Tempo di lettura:</strong> ${item.reading_time || '6 min'}</div>
          </div>
        </div>

      </article>
    `;

    // Event listeners
    container.querySelector('.cover-title')?.addEventListener('click', () => this.openModal(item.id));
    container.querySelector('.btn-open-modal')?.addEventListener('click', () => this.openModal(item.id));
    container.querySelector('.btn-bookmark')?.addEventListener('click', () => this.toggleBookmark(item.id));
  }

  renderEditorialHighlights(highlights) {
    const container = document.getElementById('editorial-highlights-container');
    if (!container) return;

    if (!highlights || highlights.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="highlights-grid">
        ${highlights.map(item => {
          const isSaved = this.savedIds.has(item.id);
          const authorsShort = this.formatAuthorsShort(item.authors);
          return `
            <article class="highlight-sub-card" id="highlight-${item.id}">
              <div>
                <div class="card-top-meta">
                  <span class="badge badge-journal">${this.escapeHtml(item.journal)}</span>
                  <span class="badge badge-date">${this.escapeHtml(item.publication_date || item.year)}</span>
                  <span class="badge badge-organism">${this.escapeHtml(item.organism || '')}</span>
                </div>
                <h3 class="highlight-sub-title" data-id="${item.id}">
                  ${this.escapeHtml(item.title)}
                </h3>
                <div class="highlight-sub-authors">${this.escapeHtml(authorsShort)}</div>
                <p class="highlight-sub-abstract">${this.escapeHtml(item.abstract || '')}</p>
              </div>

              <div class="highlight-sub-footer">
                <button class="btn btn-petrol-soft btn-open-modal" data-id="${item.id}">
                  Leggi Scheda
                </button>
                <div class="paper-actions-right">
                  <button class="btn-bookmark ${isSaved ? 'active' : ''}" data-id="${item.id}" title="${isSaved ? 'Rimuovi dai salvati' : 'Salva nei preferiti'}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </button>
                  <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn-ext-link" title="Sito ufficiale">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
                  </a>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.highlight-sub-title').forEach(el => {
      el.addEventListener('click', (e) => this.openModal(e.currentTarget.dataset.id));
    });
    container.querySelectorAll('.btn-open-modal').forEach(el => {
      el.addEventListener('click', (e) => this.openModal(e.currentTarget.dataset.id));
    });
    container.querySelectorAll('.btn-bookmark').forEach(el => {
      el.addEventListener('click', (e) => this.toggleBookmark(e.currentTarget.dataset.id));
    });
  }

  renderNewsSection(newsItems) {
    const container = document.getElementById('news-cards-container');
    if (!container) return;

    if (!newsItems || newsItems.length === 0) {
      container.innerHTML = '<p class="empty-subtext">Nessuna notizia disponibile al momento.</p>';
      return;
    }

    container.innerHTML = newsItems.map(item => {
      const isSaved = this.savedIds.has(item.id);
      return `
        <article class="news-card" id="news-${item.id}">
          <div>
            <div class="news-card-badge-row">
              <span class="news-source-tag">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                ${this.escapeHtml(item.source_name || item.journal)}
              </span>
              <span class="badge badge-date">${this.escapeHtml(item.publication_date)}</span>
            </div>

            <h3 class="news-card-title" data-id="${item.id}">
              ${this.escapeHtml(item.title)}
            </h3>

            <p class="news-card-desc">
              ${this.escapeHtml(item.abstract || '')}
            </p>

            <div class="news-card-tags">
              ${(item.tags || []).slice(0, 3).map(tag => `<span class="badge badge-tag">${this.escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>

          <div class="news-card-footer">
            <button class="btn btn-petrol-soft btn-open-modal" data-id="${item.id}">
              Leggi Notizia
            </button>
            <div class="paper-actions-right">
              <button class="btn-bookmark ${isSaved ? 'active' : ''}" data-id="${item.id}" title="${isSaved ? 'Rimuovi dai salvati' : 'Salva tra i preferiti'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              </button>
              <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn-ext-link" title="Apri fonte verificata">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
              </a>
            </div>
          </div>
        </article>
      `;
    }).join('');

    container.querySelectorAll('.news-card-title').forEach(el => {
      el.addEventListener('click', (e) => this.openModal(e.currentTarget.dataset.id));
    });
    container.querySelectorAll('.btn-open-modal').forEach(el => {
      el.addEventListener('click', (e) => this.openModal(e.currentTarget.dataset.id));
    });
    container.querySelectorAll('.btn-bookmark').forEach(el => {
      el.addEventListener('click', (e) => this.toggleBookmark(e.currentTarget.dataset.id));
    });
  }

  renderResearchSection(papers) {
    const container = document.getElementById('research-cards-container');
    const countTag = document.getElementById('research-count-tag');
    if (countTag) countTag.textContent = `${papers.length} pubblicazioni censite`;

    if (!container) return;

    if (!papers || papers.length === 0) {
      container.innerHTML = '<p class="empty-subtext">Nessun articolo trovato.</p>';
      return;
    }

    container.innerHTML = papers.map(item => this.buildCardHtml(item)).join('');
    this.bindCardEvents(container);
  }

  renderFlatGrid(items) {
    const container = document.getElementById('flat-cards-container');
    if (!container) return;

    container.innerHTML = items.map(item => this.buildCardHtml(item)).join('');
    this.bindCardEvents(container);
  }

  buildCardHtml(item) {
    const isSaved = this.savedIds.has(item.id);
    const isNews = item.item_type === 'news';
    const authorsFormatted = isNews ? (item.source_name || item.journal) : this.formatAuthorsShort(item.authors);

    return `
      <article class="paper-card ${isNews ? 'card-news-style' : ''}" id="card-${item.id}">
        <div>
          <div class="paper-meta-top">
            <div class="paper-badges-left">
              <span class="badge ${isNews ? 'badge-type' : 'badge-journal'}">${this.escapeHtml(item.journal)}</span>
              <span class="badge badge-date">${this.escapeHtml(item.publication_date || item.year)}</span>
              ${item.open_access ? '<span class="badge badge-oa">OA</span>' : ''}
            </div>
            <button class="btn-bookmark ${isSaved ? 'active' : ''}" data-id="${item.id}" title="${isSaved ? 'Rimuovi dai salvati' : 'Salva nei preferiti'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>

          <div class="paper-authors" title="${this.escapeHtml(authorsFormatted)}">
            ${this.escapeHtml(authorsFormatted)}
          </div>

          <h3 class="paper-title" data-id="${item.id}">
            ${this.escapeHtml(item.title)}
          </h3>

          <p class="paper-abstract">
            ${this.escapeHtml(item.abstract || '')}
          </p>

          <div class="paper-tags">
            ${item.organism ? `<span class="badge badge-organism">${this.escapeHtml(item.organism)}</span>` : ''}
            <span class="badge badge-category">${this.escapeHtml(item.category)}</span>
          </div>
        </div>

        <div class="paper-footer">
          <button class="btn btn-petrol-soft btn-open-modal" data-id="${item.id}">
            ${isNews ? 'Leggi Notizia' : 'Leggi Scheda'}
          </button>
          <div class="paper-actions-right">
            <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn-ext-link" title="Apri link editore">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  bindCardEvents(container) {
    container.querySelectorAll('.paper-title').forEach(el => {
      el.addEventListener('click', (e) => this.openModal(e.currentTarget.dataset.id));
    });
    container.querySelectorAll('.btn-open-modal').forEach(el => {
      el.addEventListener('click', (e) => this.openModal(e.currentTarget.dataset.id));
    });
    container.querySelectorAll('.btn-bookmark').forEach(el => {
      el.addEventListener('click', (e) => this.toggleBookmark(e.currentTarget.dataset.id));
    });
  }

  openModal(id) {
    const item = this.items.find(it => it.id === id);
    if (!item) return;

    this.activeItem = item;
    const modal = document.getElementById('article-modal');
    if (!modal) return;

    // Header Badges
    const journalEl = document.getElementById('modal-journal');
    const dateEl = document.getElementById('modal-date');
    const typeEl = document.getElementById('modal-type');
    const oaEl = document.getElementById('modal-oa');

    if (journalEl) journalEl.textContent = item.journal;
    if (dateEl) dateEl.textContent = item.publication_date || item.year;
    if (typeEl) typeEl.textContent = item.article_type || (item.item_type === 'news' ? 'Notizia Scientifica' : 'Research Article');
    if (oaEl) oaEl.classList.toggle('hidden', !item.open_access);

    // Title
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = item.title;

    // Authors / Source
    const kickerEl = document.getElementById('modal-authors-kicker');
    const authorsContainer = document.getElementById('modal-authors');
    if (item.item_type === 'news') {
      if (kickerEl) kickerEl.textContent = 'FONTE VERIFICATA & TESTATA';
      if (authorsContainer) {
        authorsContainer.innerHTML = `
          <div><strong>Testata:</strong> ${this.escapeHtml(item.journal)}</div>
          <div><strong>Ente/Editore:</strong> ${this.escapeHtml(item.source_name || (item.authors?.[0]?.affiliation) || 'Laboratorio / Agenzia Stampa')}</div>
          ${item.authors?.[0]?.name ? `<div><strong>Redazione:</strong> ${this.escapeHtml(item.authors[0].name)}</div>` : ''}
        `;
      }
    } else {
      if (kickerEl) kickerEl.textContent = 'AUTORI & AFFILIAZIONI';
      if (authorsContainer) {
        authorsContainer.innerHTML = (item.authors || []).map(a => `
          <div class="author-chip">
            <strong>${this.escapeHtml(a.name || '')}</strong>
            ${a.affiliation ? `<div class="author-affil">${this.escapeHtml(a.affiliation)}</div>` : ''}
            ${a.orcid ? `<div class="author-affil">ORCID: <code>${this.escapeHtml(a.orcid)}</code></div>` : ''}
          </div>
        `).join('');
      }
    }

    // Tags
    const tagsContainer = document.getElementById('modal-tags');
    if (tagsContainer) {
      const tagsHtml = [];
      if (item.organism) tagsHtml.push(`<span class="badge badge-organism">${this.escapeHtml(item.organism)}</span>`);
      if (item.category) tagsHtml.push(`<span class="badge badge-category">${this.escapeHtml(item.category)}</span>`);
      (item.tags || []).forEach(t => tagsHtml.push(`<span class="badge badge-tag">${this.escapeHtml(t)}</span>`));
      tagsContainer.innerHTML = tagsHtml.join('');
    }

    // Abstract / Body
    const abstractKicker = document.getElementById('modal-body-kicker');
    if (abstractKicker) abstractKicker.textContent = item.item_type === 'news' ? 'TESTO & ESTRATTO INTEGRALE' : 'ABSTRACT UFFICIALE';
    const abstractContainer = document.getElementById('modal-abstract');
    if (abstractContainer) abstractContainer.textContent = item.abstract || '';

    // Citations box (visible only for articles)
    const citationBox = document.getElementById('modal-citation-section');
    if (citationBox) {
      citationBox.classList.toggle('hidden', item.item_type === 'news');
      this.updateModalCitationText();
    }

    // DOI bar & links
    const doiContainer = document.getElementById('modal-doi-container');
    const doiVal = document.getElementById('modal-doi');
    if (doiContainer && doiVal) {
      if (item.doi) {
        doiContainer.classList.remove('hidden');
        doiVal.textContent = item.doi;
      } else {
        doiContainer.classList.add('hidden');
      }
    }

    const extLink = document.getElementById('modal-link-external');
    const extLabel = document.getElementById('modal-external-label');
    if (extLink) {
      extLink.href = item.url || '#';
      if (extLabel) extLabel.textContent = item.item_type === 'news' ? 'Apri Fonte Verificata' : 'Vai all\'Editore Ufficiale';
    }

    this.updateModalBookmarkState();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    const modal = document.getElementById('article-modal');
    modal?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  updateModalCitationText() {
    const box = document.getElementById('modal-citation-text');
    if (!box || !this.activeItem) return;

    const item = this.activeItem;
    if (this.citationFormat === 'apa') {
      const authorsStr = (item.authors || []).map(a => a.name).join(', ');
      box.textContent = `${authorsStr} (${item.year || 2026}). ${item.title}. ${item.journal}. https://doi.org/${item.doi}`;
    } else if (this.citationFormat === 'bibtex') {
      const firstAuthor = item.authors?.[0]?.name?.split(' ')?.pop()?.toLowerCase() || 'author';
      const year = item.year || 2026;
      box.textContent = `@article{${firstAuthor}${year},\n  title={${item.title}},\n  author={${(item.authors || []).map(a => a.name).join(' and ')}},\n  journal={${item.journal}},\n  year={${year}},\n  doi={${item.doi}},\n  url={${item.url}}\n}`;
    } else if (this.citationFormat === 'ris') {
      let ris = `TY  - JOUR\nTI  - ${item.title}\n`;
      (item.authors || []).forEach(a => { ris += `AU  - ${a.name}\n`; });
      ris += `JO  - ${item.journal}\nPY  - ${item.year || 2026}\nDO  - ${item.doi}\nUR  - ${item.url}\nER  - `;
      box.textContent = ris;
    }
  }

  updateModalBookmarkState() {
    if (!this.activeItem) return;
    const isSaved = this.savedIds.has(this.activeItem.id);
    const btn = document.getElementById('modal-btn-bookmark');
    const lbl = document.getElementById('modal-bookmark-label');
    if (btn) btn.classList.toggle('active', isSaved);
    if (lbl) lbl.textContent = isSaved ? 'Salvato tra i preferiti' : 'Salva nei preferiti';
  }

  toggleBookmark(id) {
    if (this.savedIds.has(id)) {
      this.savedIds.delete(id);
      this.showToast('Elemento rimosso dai preferiti');
    } else {
      this.savedIds.add(id);
      this.showToast('Elemento aggiunto ai preferiti');
    }
    this.saveSavedState();
    this.applyFiltersAndRender();
  }

  handleExport(type) {
    const itemsToExport = this.getFilteredItems();
    if (itemsToExport.length === 0) {
      this.showToast('Nessun elemento da esportare');
      return;
    }

    let content = '';
    let mimeType = 'text/plain';
    let filename = `photosynthesis_digest_export_${Date.now()}`;

    if (type === 'json') {
      content = JSON.stringify(itemsToExport, null, 2);
      mimeType = 'application/json';
      filename += '.json';
    } else if (type === 'bibtex') {
      content = itemsToExport.filter(it => it.item_type !== 'news').map(it => {
        const firstAuthor = it.authors?.[0]?.name?.split(' ')?.pop()?.toLowerCase() || 'author';
        const year = it.year || 2026;
        return `@article{${firstAuthor}${year},\n  title={${it.title}},\n  author={${(it.authors || []).map(a => a.name).join(' and ')}},\n  journal={${it.journal}},\n  year={${year}},\n  doi={${it.doi}},\n  url={${it.url}}\n}\n`;
      }).join('\n');
      mimeType = 'application/x-bibtex';
      filename += '.bib';
    } else if (type === 'csv') {
      const headers = ['ID', 'Tipo', 'Titolo', 'Autori/Fonte', 'Rivista', 'Data', 'Organismo', 'Categoria', 'DOI', 'URL'];
      const rows = itemsToExport.map(it => [
        it.id,
        it.item_type || 'article',
        `"${(it.title || '').replace(/"/g, '""')}"`,
        `"${(it.item_type === 'news' ? it.source_name : (it.authors || []).map(a => a.name).join('; ')).replace(/"/g, '""')}"`,
        `"${(it.journal || '').replace(/"/g, '""')}"`,
        it.publication_date || '',
        `"${(it.organism || '').replace(/"/g, '""')}"`,
        `"${(it.category || '').replace(/"/g, '""')}"`,
        it.doi || '',
        it.url || ''
      ].join(','));
      content = [headers.join(','), ...rows].join('\n');
      mimeType = 'text/csv';
      filename += '.csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(`Esportati ${itemsToExport.length} elementi in formato ${type.toUpperCase()}`);
  }

  async handleClientDoiFetch() {
    const input = document.getElementById('input-manual-doi');
    const status = document.getElementById('doi-fetch-status');
    if (!input || !status) return;

    let raw = input.value.trim();
    if (!raw) {
      status.className = 'doi-status';
      status.textContent = 'Inserisci un DOI valido o link doi.org.';
      status.classList.remove('hidden');
      return;
    }

    const cleanDoi = raw.replace(/^https?:\/\/doi\.org\//i, '').trim();
    status.className = 'doi-status';
    status.textContent = `Interrogazione in corso per DOI: ${cleanDoi}...`;
    status.classList.remove('hidden');

    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);
      if (!res.ok) throw new Error(`CrossRef API error (${res.status})`);

      const json = await res.json();
      const msg = json.message;

      const title = Array.isArray(msg.title) ? msg.title[0] : (msg.title || 'Articolo scientifico');
      const authors = (msg.author || []).map(a => ({
        name: `${a.given || ''} ${a.family || ''}`.trim() || 'Ricercatore',
        affiliation: a.affiliation?.[0]?.name || '',
        orcid: a.ORCID || ''
      }));
      const journal = Array.isArray(msg['container-title']) ? msg['container-title'][0] : (msg['container-title'] || 'Rivista Scientifica');
      const dateParts = msg.published?.['date-parts']?.[0] || msg['published-online']?.['date-parts']?.[0] || [2026, 8, 31];
      const pubDate = `${dateParts[0]}-${String(dateParts[1] || 1).padStart(2, '0')}-${String(dateParts[2] || 1).padStart(2, '0')}`;
      const abstract = msg.abstract ? msg.abstract.replace(/<[^>]+>/g, '') : 'Abstract non disponibile direttamente tramite CrossRef.';

      const newArticle = {
        id: `manual-${Date.now()}`,
        item_type: 'article',
        doi: cleanDoi,
        title: title,
        authors: authors.length > 0 ? authors : [{ name: 'Autori dell\'articolo' }],
        journal: journal,
        publication_date: pubDate,
        year: dateParts[0],
        article_type: msg.type || 'Journal Article',
        organism: 'Organismo da specificare',
        category: 'Structural Biology & Cryo-EM',
        tags: ['Fotosintesi', 'Letteratura'],
        abstract: abstract,
        url: `https://doi.org/${cleanDoi}`,
        open_access: false,
        featured: false,
        reading_time: '5 min',
        added_at: new Date().toISOString().split('T')[0]
      };

      // Store in localStorage custom items
      let custom = [];
      try {
        const stored = localStorage.getItem('photosynthesis_custom_articles');
        if (stored) custom = JSON.parse(stored);
      } catch (e) {}
      custom.unshift(newArticle);
      localStorage.setItem('photosynthesis_custom_articles', JSON.stringify(custom));

      this.items.unshift(newArticle);
      this.updateMetrics();
      this.applyFiltersAndRender();

      status.textContent = `Articolo aggiunto con successo: "${title.slice(0, 50)}..."`;
      input.value = '';
      this.showToast('Articolo aggiunto al catalogo');
    } catch (err) {
      status.textContent = `Errore nel recupero DOI: ${err.message}. Puoi inserirlo manualmente con scripts/add_by_doi.py.`;
    }
  }

  copyToClipboard(text, message) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(message);
    }).catch(() => {
      this.showToast('Copiato: ' + text);
    });
  }

  showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  formatAuthorsShort(authors) {
    if (!authors || !Array.isArray(authors) || authors.length === 0) return 'Autori vari';
    if (authors.length === 1) return authors[0].name || 'Autore';
    if (authors.length === 2) return `${authors[0].name} & ${authors[1].name}`;
    return `${authors[0].name} et al.`;
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

// Inizializzazione automatica al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {
  window.photosynthesisApp = new PhotosynthesisMagazineApp();
});
