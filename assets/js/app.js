/**
 * Resonance · Application Controller & Scientific Journal Engine
 * Architecture: Vanilla ES Module (Zero Build Step, Local-First)
 */

import { INITIAL_ARTICLES } from './articles-data.js';

class ResonanceApp {
  constructor() {
    this.items = [];
    this.savedIds = new Set();
    this.activeItem = null;
    this.activeView = 'all'; // 'all' | 'articles' | 'news' | 'saved'
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
    this.renderCategoryChips();
    this.applyFiltersAndRender();
  }

  loadSavedState() {
    try {
      const stored = localStorage.getItem('resonance_saved_ids') || localStorage.getItem('lumen_saved_ids') || localStorage.getItem('photosynthesis_saved_ids');
      if (stored) {
        this.savedIds = new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('LocalStorage non disponibile:', e);
    }
  }

  saveSavedState() {
    try {
      localStorage.setItem('resonance_saved_ids', JSON.stringify(Array.from(this.savedIds)));
      this.updateSavedCountDisplay();
    } catch (e) {
      console.warn('Errore salvataggio bookmark:', e);
    }
  }

  async loadDataset() {
    try {
      const res = await fetch('assets/data/articles.json', { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.items = data;
        }
      }
    } catch (e) {
      console.info('Caricamento fallback tramite INITIAL_ARTICLES');
    }

    if (!this.items || this.items.length === 0) {
      this.items = [...INITIAL_ARTICLES];
    }

    this.updateMetrics();
  }

  updateMetrics() {
    const articles = this.items.filter(it => it.item_type === 'article' || !it.item_type);
    const news = this.items.filter(it => it.item_type === 'news');

    const totalEl = document.getElementById('tab-all-count');
    const papersEl = document.getElementById('metric-papers');
    const newsEl = document.getElementById('metric-news');
    const sourcesEl = document.getElementById('metric-sources');
    const tabArtCountEl = document.getElementById('tab-articles-count');
    const tabNewsCountEl = document.getElementById('tab-news-count');

    if (totalEl) totalEl.textContent = this.items.length;
    if (papersEl) papersEl.textContent = articles.length;
    if (newsEl) newsEl.textContent = news.length;
    if (tabArtCountEl) tabArtCountEl.textContent = articles.length;
    if (tabNewsCountEl) tabNewsCountEl.textContent = news.length;

    if (sourcesEl) {
      const sources = new Set(this.items.map(it => it.journal || it.source_outlet).filter(Boolean));
      sourcesEl.textContent = sources.size;
    }

    this.updateSavedCountDisplay();
  }

  updateSavedCountDisplay() {
    const savedCountEl = document.getElementById('saved-count');
    if (savedCountEl) savedCountEl.textContent = this.savedIds.size;
  }

  bindDOM() {
    // Navigation Tabs
    document.querySelectorAll('.tab-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.setActiveView(view);
      });
    });

    // Search Input
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

    // Filter Selects
    document.getElementById('filter-organism')?.addEventListener('change', (e) => {
      this.filters.organism = e.target.value;
      this.applyFiltersAndRender();
    });

    document.getElementById('sort-order')?.addEventListener('change', (e) => {
      this.filters.sort = e.target.value;
      this.applyFiltersAndRender();
    });

    // Reset Buttons
    const resetAllFilters = () => {
      this.filters = {
        search: '',
        category: 'ALL',
        organism: 'ALL',
        sort: 'date-desc'
      };
      if (searchInput) searchInput.value = '';
      searchClear?.classList.add('hidden');
      const orgSelect = document.getElementById('filter-organism');
      if (orgSelect) orgSelect.value = 'ALL';
      const sortSelect = document.getElementById('sort-order');
      if (sortSelect) sortSelect.value = 'date-desc';
      this.updateActiveCategoryChips();
      this.applyFiltersAndRender();
    };

    document.getElementById('btn-reset-filters')?.addEventListener('click', resetAllFilters);
    document.getElementById('btn-banner-reset')?.addEventListener('click', resetAllFilters);
    document.getElementById('btn-empty-reset')?.addEventListener('click', resetAllFilters);

    // Modal Close
    document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('article-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'article-modal') this.closeModal();
    });

    // Modal Copy DOI
    document.getElementById('btn-copy-doi')?.addEventListener('click', () => {
      if (this.activeItem?.doi) {
        this.copyToClipboard(this.activeItem.doi, 'DOI copiato negli appunti!');
      }
    });

    // Modal Bookmark Toggle
    document.getElementById('modal-btn-bookmark')?.addEventListener('click', () => {
      if (this.activeItem) {
        this.toggleBookmark(this.activeItem.id);
        this.updateModalBookmarkState();
      }
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

    // ESC key listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  setActiveView(view) {
    this.activeView = view;
    document.querySelectorAll('.tab-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
      btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
    });
    this.applyFiltersAndRender();
  }

  renderCategoryChips() {
    const container = document.getElementById('quick-category-pills');
    if (!container) return;

    const categories = [
      { id: 'ALL', label: 'Tutti i Temi' },
      { id: 'Structural Biology & Cryo-EM', label: 'Cryo-EM & Strutture' },
      { id: 'Molecular Genetics & Crop Engineering', label: 'Genetica & Rubisco' },
      { id: 'Biophysics & Photoprotection', label: 'NPQ & Biofisica' },
      { id: 'Photoprotection & Algae', label: 'Alghe & LHCSR' },
      { id: 'Carbon Fixation & Pyrenoids', label: 'Pirenoide & CCM' },
      { id: 'Bioenergy & Synthetic Biology', label: 'Bioenergia & Solare' },
      { id: 'News & Perspectives', label: 'News & Divulgazione' }
    ];

    container.innerHTML = categories.map(cat => `
      <button class="chip-quick ${cat.id === this.filters.category ? 'active' : ''}" data-cat="${cat.id}">
        ${cat.label}
      </button>
    `).join('');

    container.querySelectorAll('.chip-quick').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const cat = e.currentTarget.dataset.cat;
        this.filters.category = cat;
        this.updateActiveCategoryChips();
        this.applyFiltersAndRender();
      });
    });
  }

  updateActiveCategoryChips() {
    document.querySelectorAll('.chip-quick').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.cat === this.filters.category);
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
        const filterOrg = this.filters.organism.toLowerCase();
        if (!itemOrg.includes(filterOrg)) return false;
      }

      // Search filter
      if (this.filters.search) {
        const query = this.filters.search;
        const matchTitle = (item.title || '').toLowerCase().includes(query);
        const matchAbstract = (item.abstract || '').toLowerCase().includes(query);
        const matchJournal = (item.journal || item.source_outlet || '').toLowerCase().includes(query);
        const matchDoi = (item.doi || '').toLowerCase().includes(query);
        const matchOrganism = (item.organism || '').toLowerCase().includes(query);
        const matchCategory = (item.category || '').toLowerCase().includes(query);
        const matchTags = (item.tags || []).some(t => t.toLowerCase().includes(query));
        const matchAuthors = Array.isArray(item.authors) && item.authors.some(a => (a.name || '').toLowerCase().includes(query));

        if (!matchTitle && !matchAbstract && !matchJournal && !matchDoi && !matchOrganism && !matchCategory && !matchTags && !matchAuthors) {
          return false;
        }
      }

      return true;
    });
  }

  getSortedItems(items) {
    const list = [...items];
    const sort = this.filters.sort;

    list.sort((a, b) => {
      if (sort === 'date-desc') {
        return new Date(b.publication_date || 0) - new Date(a.publication_date || 0);
      } else if (sort === 'date-asc') {
        return new Date(a.publication_date || 0) - new Date(b.publication_date || 0);
      } else if (sort === 'journal-asc') {
        const jA = (a.journal || a.source_outlet || '').toLowerCase();
        const jB = (b.journal || b.source_outlet || '').toLowerCase();
        return jA.localeCompare(jB);
      } else if (sort === 'title-asc') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });

    return list;
  }

  applyFiltersAndRender() {
    const filtered = this.getFilteredItems();
    const sorted = this.getSortedItems(filtered);

    // Filter status banner
    const isFiltered = this.filters.search || this.filters.category !== 'ALL' || this.filters.organism !== 'ALL' || this.activeView !== 'all';
    const statusBanner = document.getElementById('filter-status-banner');
    const filterCountEl = document.getElementById('filter-active-count');
    
    if (statusBanner && filterCountEl) {
      if (isFiltered) {
        statusBanner.classList.remove('hidden');
        filterCountEl.textContent = sorted.length;
      } else {
        statusBanner.classList.add('hidden');
      }
    }

    const emptyState = document.getElementById('empty-state');
    const spotlightContainer = document.getElementById('hero-spotlight-container');
    const feedContainer = document.getElementById('feed-cards-container');
    const editionContainer = document.getElementById('edition-content');
    const resultsSection = document.getElementById('results-section');

    if (sorted.length === 0) {
      emptyState?.classList.remove('hidden');
      if (spotlightContainer) spotlightContainer.innerHTML = '';
      if (editionContainer) editionContainer.innerHTML = '';
      resultsSection?.classList.add('hidden');
      if (feedContainer) feedContainer.innerHTML = '';
      return;
    }

    emptyState?.classList.add('hidden');

    if (!isFiltered && spotlightContainer) {
      const heroItem = this.items.find(it => it.id === 'li-2026-in-situ-photosystems') || sorted.find(it => it.hero_image) || sorted[0];
      this.renderHeroSpotlight(heroItem, spotlightContainer);
      this.renderMagazineEdition(heroItem, editionContainer);
      resultsSection?.classList.add('hidden');
      if (feedContainer) feedContainer.innerHTML = '';
    } else {
      if (spotlightContainer) spotlightContainer.innerHTML = '';
      if (editionContainer) editionContainer.innerHTML = '';
      resultsSection?.classList.remove('hidden');
      if (feedContainer) {
        feedContainer.classList.add('results-grid');
        feedContainer.innerHTML = sorted.map(item => this.createCardHTML(item)).join('');
        this.bindCardEvents(feedContainer);
      }
    }
  }

  renderMagazineEdition(coverItem, container) {
    if (!container) return;
    const byId = id => this.items.find(item => item.id === id);
    const featureIds = ['ramakers-2026-psii-npq-states', 'yamori-2026-rubisco-base-editing', 'how-2026-rubisco-activase-pyrenoid'];
    const features = featureIds.map(byId).filter(Boolean);
    const structural = this.items.filter(item => item.category === 'Structural Biology & Cryo-EM' && item.id !== coverItem.id).slice(0, 4);
    const news = this.getSortedItems(this.items.filter(item => item.item_type === 'news'));
    const used = new Set([coverItem.id, ...features.map(item => item.id), ...structural.map(item => item.id), ...news.map(item => item.id)]);
    const groups = [...new Set(this.items.filter(item => !used.has(item.id) && item.item_type !== 'news').map(item => item.category))]
      .map(category => ({ category, items: this.getSortedItems(this.items.filter(item => !used.has(item.id) && item.category === category)) }));

    container.innerHTML = `
      <section class="fascicolo"><div class="fascicolo-label">In questo fascicolo</div><div class="feature-notes">${features.map(item => this.createEditorialItemHTML(item, 'feature-note')).join('')}</div></section>
      <section class="dossier dossier-machines"><header class="dossier-heading"><span>Dossier 01</span><h2>Macchine della luce</h2><p>Strutture, pigmenti e architetture osservate alla scala in cui lavorano.</p></header><div class="dossier-spread">${structural.map((item, index) => this.createEditorialItemHTML(item, index === 0 ? 'dossier-lead' : 'dossier-brief')).join('')}</div></section>
      <section class="research-index"><header class="section-heading"><div><span class="section-kicker">Research index</span><h2>Linee di ricerca</h2></div><p>Una lettura per temi, non una sequenza di card.</p></header>${groups.map(group => `<section class="index-section"><h3>${this.escapeHTML(group.category)}</h3><div class="index-list">${group.items.map(item => this.createEditorialItemHTML(item, 'index-item')).join('')}</div></section>`).join('')}</section>
      <section class="briefing"><header class="dossier-heading"><span>Dal campo</span><h2>Briefing</h2><p>Comunicati e prospettive separati dalla letteratura peer-reviewed.</p></header><div class="briefing-list">${news.map(item => this.createEditorialItemHTML(item, 'dispatch')).join('')}</div></section>`;
    this.bindCardEvents(container);
  }

  createEditorialItemHTML(item, treatment) {
    const source = item.journal || item.source_outlet || 'Fonte';
    const summary = this.makeDek(item.abstract, treatment === 'index-item' ? 150 : 190);
    return `<article class="editorial-item editorial-item--${treatment}" data-id="${item.id}"><p class="editorial-meta">${this.escapeHTML(source)} <span>·</span> ${item.publication_date || ''}</p><h3><button type="button" class="card-title" data-id="${item.id}">${this.escapeHTML(item.title)}</button></h3><p class="editorial-dek">${this.escapeHTML(summary)}</p><button class="editorial-detail btn-card-details" data-id="${item.id}">Scheda <span aria-hidden="true">→</span></button></article>`;
  }

  renderHeroSpotlight(item, container) {
    if (!item) return;
    const isSaved = this.savedIds.has(item.id);
    const isNews = item.item_type === 'news';
    const authorsText = Array.isArray(item.authors) 
      ? item.authors.map(a => a.name).join(', ')
      : (item.author_or_editor || item.source_outlet || '');

    const sourceLabel = item.journal || item.source_outlet || (isNews ? 'News' : 'Journal');
    const directActionText = isNews ? `Leggi Notizia (${sourceLabel})` : `Apri Articolo Ufficiale (${sourceLabel})`;
    const dek = this.makeDek(item.abstract, 255);
    // A cover visual belongs to the record that selected it. We deliberately do
    // not substitute a generic scientific image: an image that does not refer
    // to this paper is worse than a typographic cover.
    const coverImage = item.hero_image;
    const coverAlt = item.hero_image_alt || '';
    const coverCaption = item.hero_image_caption || '';
    const coverVisual = coverImage ? `
      <figure class="hero-visual">
        <img src="${this.escapeHTML(coverImage)}" width="1672" height="941" alt="${this.escapeHTML(coverAlt)}" fetchpriority="high">
        ${coverCaption ? `<figcaption>${this.escapeHTML(coverCaption)}</figcaption>` : ''}
      </figure>
    ` : `
      <div class="hero-visual hero-visual-typographic" aria-label="Cover tipografica per ${this.escapeHTML(item.title)}">
        <span>Research<br>cover</span>
      </div>
    `;

    container.innerHTML = `
      <article class="hero-spotlight-card">
        ${coverVisual}
        <div class="hero-copy">
          <div class="hero-kicker-row">
            <span class="hero-lead-label">Cover story</span>
            <span class="hero-meta-date">${item.publication_date || ''}</span>
          </div>
          <p class="hero-source">${this.escapeHTML(sourceLabel)} <span>·</span> ${this.escapeHTML(item.organism || 'Photosynthesis research')} ${item.open_access ? '<span>· Open access</span>' : ''}</p>
          <h2><button type="button" class="hero-title" data-id="${item.id}">${this.escapeHTML(item.title)}</button></h2>
          <p class="hero-dek">${this.escapeHTML(dek)}</p>
          <p class="hero-authors">${isNews ? 'Fonte' : 'By'}: ${this.escapeHTML(authorsText)}</p>
          <p class="hero-why"><strong>Focus editoriale.</strong> ${this.escapeHTML(item.editorial_note || item.category || 'Ricerca sulla fotosintesi')}${item.editorial_note ? '' : (item.organism ? ` · ${this.escapeHTML(item.organism)}` : '')}</p>
          <div class="hero-actions-row">
            <div class="hero-left-actions">
              <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn btn-emerald" title="Apri fonte ufficiale"><span>↗ ${this.escapeHTML(directActionText)}</span></a>
              <button class="editorial-text-link btn-hero-details" data-id="${item.id}">Leggi scheda e citazione <span aria-hidden="true">→</span></button>
            </div>
            <button class="btn-icon-bookmark ${isSaved ? 'bookmarked' : ''}" data-id="${item.id}" title="${isSaved ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>
        </div>
      </article>
    `;

    container.querySelector('.hero-title')?.addEventListener('click', () => this.openModal(item));
    container.querySelector('.btn-hero-details')?.addEventListener('click', () => this.openModal(item));
    container.querySelector('.btn-icon-bookmark')?.addEventListener('click', (e) => {
      this.toggleBookmark(item.id);
      e.currentTarget.classList.toggle('bookmarked', this.savedIds.has(item.id));
      e.currentTarget.querySelector('svg').setAttribute('fill', this.savedIds.has(item.id) ? 'currentColor' : 'none');
    });
  }

  createCardHTML(item) {
    const isNews = item.item_type === 'news';
    const isSaved = this.savedIds.has(item.id);
    const sourceLabel = item.journal || item.source_outlet || (isNews ? 'News Outlet' : 'Journal');
    const buttonText = isNews ? 'Leggi il dispatch' : 'Apri il paper';
    const folioLabel = isNews ? 'Dispatch' : 'Paper';
    const folioDate = item.publication_date ? item.publication_date.slice(0, 4) : '—';

    let authorsPreview = '';
    if (Array.isArray(item.authors) && item.authors.length > 0) {
      if (item.authors.length === 1) {
        authorsPreview = item.authors[0].name;
      } else if (item.authors.length === 2) {
        authorsPreview = `${item.authors[0].name} & ${item.authors[1].name}`;
      } else {
        authorsPreview = `${item.authors[0].name} et al.`;
      }
    } else {
      authorsPreview = item.author_or_editor || item.source_outlet || (isNews ? 'Redazione Scientifica' : '');
    }

    return `
      <article class="article-card ${isNews ? 'card-news' : 'card-paper'}" data-id="${item.id}">
        <div class="card-folio ${isNews ? 'card-folio-news' : ''}" aria-hidden="true">
          <span>${folioLabel}</span>
          <strong>${folioDate}</strong>
          <small>${this.escapeHTML(item.category || 'Photosynthesis')}</small>
        </div>
        <div class="card-content">
        <header class="card-header-meta">
          <div class="card-badges-wrap">
            <span class="badge ${isNews ? 'badge-news-item' : 'badge-paper'}">${isNews ? 'From the field' : 'Research'}</span>
            <span class="badge badge-journal" title="${this.escapeHTML(sourceLabel)}">${this.escapeHTML(sourceLabel)}</span>
          </div>
          <time class="card-date" datetime="${item.publication_date || ''}">${item.publication_date || ''}</time>
        </header>

        <h3><button type="button" class="card-title" data-id="${item.id}" title="${this.escapeHTML(item.title)}">
          ${this.escapeHTML(item.title)}
        </button></h3>

        <div class="card-authors">
          ${this.escapeHTML(authorsPreview)}
        </div>

        <p class="card-abstract-preview">
          ${this.escapeHTML(this.makeDek(item.abstract, 168))}
        </p>

        <div class="card-tags-row">
          ${item.organism ? `<span class="tag-organism">${this.escapeHTML(item.organism)}</span>` : ''}
          <span class="tag-topic">${this.escapeHTML(item.category || '')}</span>
        </div>

        <footer class="card-footer-actions">
          <div class="card-links-left">
            <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn-direct-link" title="Apri link ufficiale">
              <span>${this.escapeHTML(buttonText)} <span aria-hidden="true">↗</span></span>
            </a>
            <button class="btn btn-outline-sm btn-card-details" data-id="${item.id}" aria-label="Apri scheda dell'articolo">
              <span>Dettagli</span>
            </button>
          </div>

          <button class="btn-icon-bookmark ${isSaved ? 'bookmarked' : ''}" data-id="${item.id}" title="${isSaved ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </footer>

        </div>
      </article>
    `;
  }

  makeDek(text, maxLength) {
    const compact = (text || '').replace(/\s+/g, ' ').trim();
    if (compact.length <= maxLength) return compact;
    const cutoff = compact.lastIndexOf(' ', maxLength);
    return `${compact.slice(0, cutoff > 0 ? cutoff : maxLength)}…`;
  }

  bindCardEvents(container) {
    // Title clicks open modal
    container.querySelectorAll('.card-title').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const item = this.items.find(it => it.id === id);
        if (item) this.openModal(item);
      });
    });

    // Details button clicks open modal
    container.querySelectorAll('.btn-card-details').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const item = this.items.find(it => it.id === id);
        if (item) this.openModal(item);
      });
    });

    // Bookmark toggle clicks
    container.querySelectorAll('.btn-icon-bookmark').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        this.toggleBookmark(id);
        const isSaved = this.savedIds.has(id);
        e.currentTarget.classList.toggle('bookmarked', isSaved);
        e.currentTarget.querySelector('svg').setAttribute('fill', isSaved ? 'currentColor' : 'none');
      });
    });
  }

  toggleBookmark(id) {
    if (this.savedIds.has(id)) {
      this.savedIds.delete(id);
      this.showToast('Rimosso dai preferiti');
    } else {
      this.savedIds.add(id);
      this.showToast('Aggiunto ai preferiti ⭐');
    }
    this.saveSavedState();
    if (this.activeView === 'saved') {
      this.applyFiltersAndRender();
    }
  }

  /* =========================================================================
     Reader Modal
     ========================================================================= */

  openModal(item) {
    this.activeItem = item;
    const modal = document.getElementById('article-modal');
    if (!modal) return;

    const isNews = item.item_type === 'news';

    // Badges
    const badgesWrap = document.getElementById('modal-top-badges');
    if (badgesWrap) {
      badgesWrap.innerHTML = `
        <span class="badge ${isNews ? 'badge-news-item' : 'badge-paper'}">${isNews ? 'Notizia' : 'Articolo'}</span>
        <span class="badge badge-journal">${this.escapeHTML(item.journal || item.source_outlet || '')}</span>
        <span class="badge badge-paper">${item.publication_date || ''}</span>
        ${item.open_access ? '<span class="badge badge-oa">Open Access</span>' : ''}
      `;
    }

    // Title
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = item.title;

    // Authors or News Source Section
    const authorsKicker = document.getElementById('modal-authors-kicker');
    const authorsSection = document.getElementById('modal-authors');
    if (authorsKicker) {
      authorsKicker.textContent = isNews ? 'FONTE NOTIZIA & REDAZIONE' : 'AUTORI & AFFILIAZIONI';
    }
    if (authorsSection) {
      if (isNews) {
        authorsSection.innerHTML = `
          <div><strong>${this.escapeHTML(item.source_outlet || item.source_name || 'Ufficio Stampa')}</strong></div>
          <div style="color: var(--text-muted); font-size: 0.82rem; margin-top: 0.2rem;">Rassegna scientifica e monitoraggio per il Laboratorio di Fotosintesi.</div>
        `;
      } else if (Array.isArray(item.authors) && item.authors.length > 0) {
        authorsSection.innerHTML = item.authors.map(a => `
          <div style="margin-bottom: 0.35rem;">
            <strong>${this.escapeHTML(a.name)}</strong>
            ${a.affiliation ? `<span style="color: var(--text-muted); font-size: 0.8rem;"> — ${this.escapeHTML(a.affiliation)}</span>` : ''}
            ${a.orcid ? `<a href="https://orcid.org/${a.orcid}" target="_blank" rel="noopener noreferrer" style="color: var(--wine-700); font-size: 0.72rem; font-family: var(--font-mono); margin-left: 0.3rem;">[ORCID: ${a.orcid}]</a>` : ''}
          </div>
        `).join('');
      } else {
        authorsSection.innerHTML = `<div><strong>${this.escapeHTML(item.author_or_editor || 'Redazione Resonance')}</strong></div>`;
      }
    }

    // Tags
    const tagsEl = document.getElementById('modal-tags');
    if (tagsEl) {
      const tagsHTML = [
        item.organism ? `<span class="tag-organism">🌱 ${this.escapeHTML(item.organism)}</span>` : '',
        `<span class="tag-topic">📚 ${this.escapeHTML(item.category || '')}</span>`,
        ...(item.tags || []).map(t => `<span class="tag-topic">#${this.escapeHTML(t)}</span>`)
      ].filter(Boolean).join('');
      tagsEl.innerHTML = tagsHTML;
    }

    // Abstract / Body
    const abstractEl = document.getElementById('modal-abstract');
    if (abstractEl) abstractEl.textContent = item.abstract;

    // Citation block
    const citSection = document.getElementById('modal-citation-section');
    if (citSection) {
      if (isNews) {
        citSection.classList.add('hidden');
      } else {
        citSection.classList.remove('hidden');
        this.updateModalCitationText();
      }
    }

    // DOI & Footer
    const doiContainer = document.getElementById('modal-doi-container');
    const doiVal = document.getElementById('modal-doi');
    if (item.doi && !isNews) {
      doiContainer?.classList.remove('hidden');
      if (doiVal) doiVal.textContent = item.doi;
    } else {
      doiContainer?.classList.add('hidden');
    }

    // Direct Link Button
    const extLink = document.getElementById('modal-link-external');
    const extLabel = document.getElementById('modal-external-label');
    if (extLink) {
      extLink.href = item.url || (item.doi ? `https://doi.org/${item.doi}` : '#');
      if (extLabel) {
        if (isNews) {
          extLabel.textContent = `Apri Fonte Ufficiale (${item.source_outlet || item.source_name || 'Link'})`;
        } else {
          extLabel.textContent = `Apri Articolo Ufficiale (${item.journal || 'DOI'})`;
        }
      }
    }

    this.updateModalBookmarkState();
    modal.classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('article-modal')?.classList.add('hidden');
    this.activeItem = null;
  }

  updateModalBookmarkState() {
    if (!this.activeItem) return;
    const isSaved = this.savedIds.has(this.activeItem.id);
    const label = document.getElementById('modal-bookmark-label');
    const btn = document.getElementById('modal-btn-bookmark');
    if (label) label.textContent = isSaved ? 'Salvato nei preferiti' : 'Salva';
    if (btn) {
      btn.querySelector('svg')?.setAttribute('fill', isSaved ? 'currentColor' : 'none');
      btn.classList.toggle('btn-emerald', isSaved);
      btn.classList.toggle('btn-outline', !isSaved);
    }
  }

  updateModalCitationText() {
    if (!this.activeItem) return;
    const item = this.activeItem;
    const codeBlock = document.getElementById('modal-citation-text');
    if (!codeBlock) return;

    if (this.citationFormat === 'apa') {
      const authorList = Array.isArray(item.authors)
        ? item.authors.map(a => a.name).join(', ')
        : (item.author_or_editor || 'Redazione');
      const year = item.year || (item.publication_date ? item.publication_date.substring(0, 4) : '2026');
      codeBlock.textContent = `${authorList} (${year}). ${item.title}. ${item.journal || item.source_outlet || ''}. https://doi.org/${item.doi || ''}`;
    } else if (this.citationFormat === 'bibtex') {
      const firstAuthorKey = Array.isArray(item.authors) && item.authors.length > 0
        ? item.authors[0].name.split(' ').pop().toLowerCase()
        : 'resonance';
      const year = item.year || (item.publication_date ? item.publication_date.substring(0, 4) : '2026');
      const authorsBib = Array.isArray(item.authors)
        ? item.authors.map(a => a.name).join(' and ')
        : (item.author_or_editor || 'Resonance Editorial');

      codeBlock.textContent = `@article{${firstAuthorKey}${year}${item.id.substring(0, 6)},
  title = {${item.title}},
  author = {${authorsBib}},
  journal = {${item.journal || item.source_outlet || 'Photosynthesis Research'}},
  year = {${year}},
  doi = {${item.doi || ''}},
  url = {${item.url}}
}`;
    }
  }

  /* =========================================================================
     Utility Helpers
     ========================================================================= */

  copyToClipboard(text, successMsg) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(successMsg);
      }).catch(() => {
        this.fallbackCopy(text, successMsg);
      });
    } else {
      this.fallbackCopy(text, successMsg);
    }
  }

  fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showToast(successMsg);
    } catch (e) {
      this.showToast('Errore durante la copia');
    }
    document.body.removeChild(ta);
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.resonanceApp = new ResonanceApp();
});
