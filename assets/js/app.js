/**
 * LUMEN · Application Controller & Scientific Journal Engine
 * Architecture: Vanilla ES Module (Zero Build Step, Local-First)
 */

import { INITIAL_ARTICLES } from './articles-data.js';

class LumenApp {
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
      const stored = localStorage.getItem('lumen_saved_ids') || localStorage.getItem('photosynthesis_saved_ids');
      if (stored) {
        this.savedIds = new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('LocalStorage non disponibile:', e);
    }
  }

  saveSavedState() {
    try {
      localStorage.setItem('lumen_saved_ids', JSON.stringify(Array.from(this.savedIds)));
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

    // ZINE Open Buttons
    const openZine = () => this.openZineModal();
    document.getElementById('btn-open-zine')?.addEventListener('click', openZine);
    document.getElementById('btn-footer-zine')?.addEventListener('click', openZine);

    document.getElementById('zine-modal-close')?.addEventListener('click', () => this.closeZineModal());
    document.getElementById('zine-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'zine-modal') this.closeZineModal();
    });

    // ZINE Print Button
    document.getElementById('btn-print-zine')?.addEventListener('click', () => {
      window.print();
    });

    // ZINE Copy Text Button
    document.getElementById('btn-copy-zine-text')?.addEventListener('click', () => {
      this.copyZineText();
    });

    // ESC key listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        this.closeZineModal();
      }
    });
  }

  setActiveView(view) {
    this.activeView = view;
    document.querySelectorAll('.tab-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
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

    if (sorted.length === 0) {
      emptyState?.classList.remove('hidden');
      if (spotlightContainer) spotlightContainer.innerHTML = '';
      if (feedContainer) feedContainer.innerHTML = '';
      return;
    }

    emptyState?.classList.add('hidden');

    // Hero spotlight (shown only on 'all' view when not searching/filtering specific categories)
    let displayItems = sorted;
    if (!isFiltered && spotlightContainer) {
      const heroItem = sorted.find(it => it.featured && (it.item_type === 'article' || !it.item_type)) || sorted[0];
      this.renderHeroSpotlight(heroItem, spotlightContainer);
      displayItems = sorted.filter(it => it.id !== heroItem.id);
    } else {
      if (spotlightContainer) spotlightContainer.innerHTML = '';
    }

    // Render feed cards
    if (feedContainer) {
      feedContainer.innerHTML = displayItems.map(item => this.createCardHTML(item)).join('');
      this.bindCardEvents(feedContainer);
    }
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

    container.innerHTML = `
      <div class="hero-spotlight-card">
        <div class="hero-kicker-row">
          <div class="hero-badge-group">
            <span class="hero-lead-label">Lead Breakthrough · In Evidenza</span>
            <span class="badge badge-journal">${this.escapeHTML(sourceLabel)}</span>
            ${item.open_access ? '<span class="badge badge-oa">Open Access</span>' : ''}
          </div>
          <span class="hero-meta-date">${item.publication_date || ''}</span>
        </div>

        <h2 class="hero-title" data-id="${item.id}">${this.escapeHTML(item.title)}</h2>
        
        <p class="hero-authors"><strong>${isNews ? 'Fonte:' : 'Autori:'}</strong> ${this.escapeHTML(authorsText)}</p>
        <p class="hero-abstract">${this.escapeHTML(item.abstract)}</p>

        <div class="hero-actions-row">
          <div class="hero-left-actions">
            <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn btn-emerald" title="Apri fonte ufficiale">
              <span>↗ ${this.escapeHTML(directActionText)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
            </a>
            <button class="btn btn-outline btn-hero-details" data-id="${item.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <span>Scheda &amp; Citazione</span>
            </button>
          </div>

          <button class="btn-icon-bookmark ${isSaved ? 'bookmarked' : ''}" data-id="${item.id}" title="${isSaved ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
      </div>
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
    const buttonText = isNews ? `↗ Leggi Notizia (${sourceLabel})` : `↗ Vai all'Articolo (${sourceLabel})`;

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
        
        <header class="card-header-meta">
          <div class="card-badges-wrap">
            <span class="badge ${isNews ? 'badge-news-item' : 'badge-paper'}">${isNews ? 'News' : 'Articolo'}</span>
            <span class="badge badge-journal" title="${this.escapeHTML(sourceLabel)}">${this.escapeHTML(sourceLabel)}</span>
            ${item.open_access ? '<span class="badge badge-oa">OA</span>' : ''}
          </div>
          <time class="card-date" datetime="${item.publication_date || ''}">${item.publication_date || ''}</time>
        </header>

        <h3 class="card-title" data-id="${item.id}" title="${this.escapeHTML(item.title)}">
          ${this.escapeHTML(item.title)}
        </h3>

        <div class="card-authors">
          ${this.escapeHTML(authorsPreview)}
        </div>

        <p class="card-abstract-preview">
          ${this.escapeHTML(item.abstract)}
        </p>

        <div class="card-tags-row">
          ${item.organism ? `<span class="tag-organism">${this.escapeHTML(item.organism)}</span>` : ''}
          <span class="tag-topic">${this.escapeHTML(item.category || '')}</span>
        </div>

        <footer class="card-footer-actions">
          <div class="card-links-left">
            <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn-direct-link" title="Apri link ufficiale">
              <span>${this.escapeHTML(buttonText)}</span>
            </a>
            <button class="btn btn-outline-sm btn-card-details" data-id="${item.id}">
              <span>Scheda</span>
            </button>
          </div>

          <button class="btn-icon-bookmark ${isSaved ? 'bookmarked' : ''}" data-id="${item.id}" title="${isSaved ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </footer>

      </article>
    `;
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
        authorsSection.innerHTML = `<div><strong>${this.escapeHTML(item.author_or_editor || 'Redazione LUMEN')}</strong></div>`;
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
        : 'lumen';
      const year = item.year || (item.publication_date ? item.publication_date.substring(0, 4) : '2026');
      const authorsBib = Array.isArray(item.authors)
        ? item.authors.map(a => a.name).join(' and ')
        : (item.author_or_editor || 'Lumen Editorial');

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
     ZINE ENGINE (1-Page A4 Printable Mini-Magazine)
     ========================================================================= */

  openZineModal() {
    const modal = document.getElementById('zine-modal');
    const container = document.getElementById('zine-sheet-content');
    if (!modal || !container) return;

    // Pick top breakthrough paper
    const leadPaper = this.items.find(it => it.id === 'li-2026-in-situ-photosystems') ||
                      this.items.find(it => it.featured && it.item_type !== 'news') ||
                      this.items[0];

    // Pick 3 top fresh news
    const newsItems = this.items.filter(it => it.item_type === 'news').slice(0, 3);

    // Pick 4 hot research papers across key disciplines
    const researchPapers = this.items
      .filter(it => (it.item_type === 'article' || !it.item_type) && it.id !== leadPaper.id)
      .slice(0, 4);

    const leadAuthors = Array.isArray(leadPaper.authors)
      ? leadPaper.authors.map(a => a.name).join(', ')
      : '';

    container.innerHTML = `
      <div class="zine-masthead">
        <div class="zine-volume-line">
          <span>LUMEN · Research Digest</span>
          <span>Volume IV · Issue 8</span>
          <span>Agosto 2026</span>
        </div>
        <h1 class="zine-title">LUMEN</h1>
        <div class="zine-subtitle">Rassegna Scientifica di Fotosintesi &amp; Bioenergetica · Laboratorio di Ricerca</div>
      </div>

      <div class="zine-layout-body">
        
        <!-- Left Column: Lead Story -->
        <div class="zine-col-lead">
          <div>
            <span class="zine-section-header">Articolo di Copertina · In Evidenza</span>
            <h2 class="zine-lead-title">${this.escapeHTML(leadPaper.title)}</h2>
            <div class="zine-lead-meta">
              <strong>${this.escapeHTML(leadPaper.journal || 'Nature')}</strong> (${leadPaper.publication_date}) · <em>${this.escapeHTML(leadAuthors)}</em>
            </div>
            <p class="zine-lead-text">${this.escapeHTML(leadPaper.abstract)}</p>
          </div>

          <div style="margin-top: 0.6rem; border-top: 1px dashed #9ca3af; padding-top: 0.5rem;">
            <span class="zine-section-header">Articoli di Punta Selezionati</span>
            ${researchPapers.slice(0, 2).map(item => `
              <div style="margin-bottom: 0.45rem;">
                <strong style="font-size: 8.5pt; color: #000;">${this.escapeHTML(item.title)}</strong>
                <div style="font-size: 7.5pt; color: #4b5563;">${this.escapeHTML(item.journal)} (${item.year || '2026'}) · DOI: ${item.doi || ''}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right Column: News & Briefs -->
        <div class="zine-col-side">
          <span class="zine-section-header">Notizie &amp; Comunicati Ufficiali</span>
          ${newsItems.map(item => `
            <div class="zine-news-item">
              <h4>${this.escapeHTML(item.title)}</h4>
              <div style="font-size: 7.2pt; font-family: sans-serif; color: #4b5563; margin-bottom: 0.15rem;">
                <strong>${this.escapeHTML(item.source_outlet || item.journal || 'Fonte')}</strong> · ${item.publication_date || ''}
              </div>
              <p>${this.escapeHTML(item.abstract.substring(0, 160))}...</p>
            </div>
          `).join('')}

          <div style="margin-top: auto; background-color: #f3f4f6; padding: 0.4rem 0.55rem; border-left: 2px solid #111827;">
            <div style="font-size: 7pt; font-weight: bold; text-transform: uppercase;">Nota di Laboratorio</div>
            <div style="font-size: 6.8pt; line-height: 1.35; color: #374151;">
              Tutti i 50 record censiti sono verificati con link diretti alle fonti primarie e DOI ufficiali.
            </div>
          </div>
        </div>

      </div>

      <footer class="zine-footer">
        <span>LUMEN · Edizione Periodica di Laboratorio</span>
        <span>50 Record Verificati (Nature, Science, PNAS, Plant Physiol, Bioresour Technol)</span>
        <span>Stampato tramite Motore Web ZINE A4</span>
      </footer>
    `;

    modal.classList.remove('hidden');
  }

  closeZineModal() {
    document.getElementById('zine-modal')?.classList.add('hidden');
  }

  copyZineText() {
    const leadPaper = this.items.find(it => it.id === 'li-2026-in-situ-photosystems') || this.items[0];
    const newsItems = this.items.filter(it => it.item_type === 'news').slice(0, 3);
    const researchPapers = this.items.filter(it => (it.item_type === 'article' || !it.item_type) && it.id !== leadPaper.id).slice(0, 4);

    let text = `=========================================\n`;
    text += `LUMEN · ZINE (Edizione 1 Pagina)\n`;
    text += `Laboratorio di Fotosintesi & Bioenergetica · Agosto 2026\n`;
    text += `=========================================\n\n`;
    
    text += `[LEAD BREAKTHROUGH]\n`;
    text += `Titolo: ${leadPaper.title}\n`;
    text += `Rivista: ${leadPaper.journal} (${leadPaper.publication_date})\n`;
    text += `DOI: https://doi.org/${leadPaper.doi}\n`;
    text += `Sintesi: ${leadPaper.abstract}\n\n`;

    text += `[NOTIZIE & RASSEGNA STAMPA]\n`;
    newsItems.forEach((n, i) => {
      text += `${i + 1}. ${n.title} (${n.source_outlet || n.journal})\n   ${n.abstract}\n   Link: ${n.url}\n\n`;
    });

    text += `[ARTICOLI CALDI DI RICERCA]\n`;
    researchPapers.forEach((p, i) => {
      text += `${i + 1}. ${p.title} (${p.journal})\n   DOI: https://doi.org/${p.doi}\n\n`;
    });

    this.copyToClipboard(text, 'Sommario Zine copiato negli appunti!');
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
  window.lumenApp = new LumenApp();
});
