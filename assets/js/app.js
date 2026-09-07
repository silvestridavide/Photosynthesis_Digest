import {indexItems,selectItems,statistics,sourceOf,safeURL,citation} from './catalog.js';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=new Intl.NumberFormat('it-IT'), date=s=>s?new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z')):'Data non disponibile';
const defaults={view:'all',search:'',category:'',organism:'',source:'',sort:'editorial',unread:false,oa:false};
function loadSet(key,legacy=[]){try{const raw=localStorage.getItem(key)||legacy.map(k=>localStorage.getItem(k)).find(Boolean),v=JSON.parse(raw||'[]');return new Set(Array.isArray(v)?v.filter(x=>typeof x==='string'):[]);}catch{return new Set();}}
class Magazine{
  constructor(){this.items=[];this.byId=new Map();this.state={...defaults};this.saved=loadSet('resonance_saved_ids',['lumen_saved_ids','photosynthesis_saved_ids']);this.read=loadSet('resonance_read_ids');this.limit=12;this.active=null;this.focusOrigin=null;this.bind();this.init();}
  async init(){
    $('load-status').hidden=false;
    try{
      const response=await fetch('assets/data/articles.json',{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const rows=await response.json();
      if(!Array.isArray(rows)||!rows.length||rows.some(a=>!a.id||!a.summary_it||!safeURL(a.url)))throw new Error('Catalogo non valido');
      this.items=indexItems(rows);this.byId=new Map(this.items.map(a=>[a.id,a]));this.stats=statistics(this.items);
      // Keep previous-edition IDs in storage; never silently erase bookmarks.
      this.read=new Set([...this.read]);
      this.edition=this.items.map(a=>a.verified_at).filter(Boolean).sort().at(-1);
      $('edition-date').textContent=`Edizione curata · ${date(this.edition)}`;
      $('paper-count').textContent=this.stats.papers;$('news-count').textContent=this.stats.news;
      $('load-status').hidden=true;$('morning-note').hidden=false;
      this.populateFilters();this.restoreURL();this.syncControls();this.render();this.openHash();
    }catch(e){$('load-status').innerHTML='<p>Il catalogo non è disponibile. Controlla la connessione e riprova.</p><button data-action="retry">Riprova</button>';$('edition-date').textContent='Edizione non caricata';}
  }
  populateFilters(){
    $('theme-filters').innerHTML=['',...[...new Set(this.items.map(a=>a.category))].sort()].map(c=>`<button data-category="${esc(c)}" aria-pressed="false">${esc(c||'Tutti i temi')}</button>`).join('');
    for(const [id,values,label] of [['filter-organism',this.items.map(a=>a.organism),'Tutti'],['filter-source',this.items.map(sourceOf),'Tutte']]){$(id).innerHTML=`<option value="">${label}</option>`+[...new Set(values)].filter(Boolean).sort().map(v=>`<option>${esc(v)}</option>`).join('');}
  }
  bind(){
    document.querySelector("#method details").addEventListener("toggle",e=>{if(e.target.open&&!this.methodLoaded){this.methodLoaded=true;this.loadMethod();}});
    document.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.view){this.state.view=b.dataset.view;this.changed();}
      if('category'in b.dataset){this.state.category=b.dataset.category;this.changed();}
      if(b.dataset.open){this.open(b.dataset.open);}
      if(b.dataset.save){this.toggleSaved(b.dataset.save);}
      if(b.dataset.action==='reset'){this.reset();}
      if(b.dataset.action==='retry'){this.init();}
      if(b.dataset.format){const format=b.dataset.format;this.renderCitation(format);$('reader-citation').querySelector(`[data-format="${format}"]`)?.focus();}
    });
    $('search-toggle').addEventListener('click',()=>{this.setFiltersVisible($('filters').hidden);if(!$('filters').hidden)$('search-input').focus();});
    let searchTimer;
    $('search-input').addEventListener('input',e=>{this.state.search=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>this.changed(),110);});
    for(const [id,key] of [['filter-organism','organism'],['filter-source','source'],['sort-order','sort'],['only-unread','unread'],['only-oa','oa']]){$(id).addEventListener('change',e=>{this.state[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;this.changed();});}
    $('reset-filters').addEventListener('click',()=>{clearTimeout(searchTimer);this.reset();});
    $('load-more').addEventListener('click',()=>{const old=this.limit;this.limit+=12;this.renderResults();$('result-list').children[old]?.querySelector('button')?.focus();});
    $('reader-close').addEventListener('click',()=>$('reader').close());
    $('reader').addEventListener('click',e=>{if(e.target===$('reader')){const r=$('reader').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('reader').close();}});
    $('reader').addEventListener('close',()=>{document.body.classList.remove('reading');this.active=null;if(location.hash.startsWith('#read='))history.replaceState(null,'',location.pathname+location.search);if(this.focusOrigin?.isConnected)this.focusOrigin.focus();else{const opener=[...document.querySelectorAll('#home button[data-open], #result-list button[data-open]')].find(b=>b.dataset.open===this.openerId&&!b.closest('[hidden]'));(opener||$('view-tabs').querySelector('[aria-pressed=true]'))?.focus();}});
    $('reader-save').addEventListener('click',()=>{if(this.active)this.toggleSaved(this.active.id);});
    $('reader-read').addEventListener('click',()=>{if(!this.active)return;const id=this.active.id;this.read.has(id)?this.read.delete(id):this.read.add(id);this.persist('resonance_read_ids',this.read);this.render();this.readerState();});
    $('refresh-news').addEventListener('click',()=>this.refreshNews());
    window.addEventListener('popstate',()=>{if(this.items.length){this.restoreURL();this.syncControls();this.render();this.openHash();}});
    window.addEventListener('hashchange',()=>this.openHash());
    window.addEventListener('storage',e=>{if(['resonance_saved_ids','resonance_read_ids'].includes(e.key)){this.saved=loadSet('resonance_saved_ids');this.read=loadSet('resonance_read_ids');this.render();this.readerState();}});
  }
  setFiltersVisible(show){$('filters').hidden=!show;$('search-toggle').setAttribute('aria-expanded',String(show));}
  changed(){this.limit=12;this.syncControls();this.saveURL();this.render();}
  reset(){this.state={...defaults};this.changed();}
  syncControls(){
    for(const b of $('view-tabs').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.view===this.state.view));
    for(const b of $('theme-filters').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.category===this.state.category));
    for(const [id,k] of [['search-input','search'],['filter-organism','organism'],['filter-source','source'],['sort-order','sort']])$(id).value=this.state[k];
    $('only-unread').checked=this.state.unread;$('only-oa').checked=this.state.oa;
  }
  restoreURL(){const p=new URLSearchParams(location.search);this.state={...defaults};for(const key of Object.keys(defaults))if(p.has(key))this.state[key]=typeof defaults[key]==='boolean'?p.get(key)==='1':p.get(key);if(!['all','news','articles','saved'].includes(this.state.view))this.state.view='all';if(this.hasFilters())this.setFiltersVisible(true);}
  saveURL(){const p=new URLSearchParams();for(const[k,v]of Object.entries(this.state))if(v!==defaults[k])p.set(k,typeof v==='boolean'?'1':v);history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash);}
  hasFilters(){return Object.keys(defaults).some(k=>k!=='view'&&this.state[k]!==defaults[k]);}
  persist(key,set){try{localStorage.setItem(key,JSON.stringify([...set]));}catch{this.toast('Il browser non consente il salvataggio permanente. Lo stato resta disponibile in questa sessione.');}}
  toast(text){$('toast').textContent=text;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$('toast').textContent='',4200);}
  toggleSaved(id){const focused=document.activeElement;this.saved.has(id)?this.saved.delete(id):this.saved.add(id);this.persist('resonance_saved_ids',this.saved);this.render();this.readerState();if(!this.active){const replacement=[...document.querySelectorAll('[data-save]')].find(b=>b.dataset.save===id);(replacement||$('view-tabs').querySelector('[aria-pressed=true]'))?.focus();}else if(focused?.isConnected)focused.focus();}
  render(){
    $('saved-count').textContent=this.items.filter(a=>this.saved.has(a.id)).length;
    const unread=this.items.filter(a=>a.item_type==='news'&&!this.read.has(a.id)).length;
    $('morning-note').innerHTML=`<span>Il tuo briefing · ${unread} notizie da leggere · estratti di circa un minuto</span><a href="#live-title">Controlla le fonti recenti ↗</a>`;
    const home=this.state.view==='all'&&!this.hasFilters();$('home').hidden=!home;$('results').hidden=home;
    if(home)this.renderHome();else this.renderResults();
  }
  actions(a){return `<div class="actions"><button class="read-link" data-open="${esc(a.id)}">Leggi il riassunto →</button><button data-save="${esc(a.id)}" aria-pressed="${this.saved.has(a.id)}" aria-label="${this.saved.has(a.id)?'Rimuovi dai salvati':'Salva'}: ${esc(a.headline_it||a.title)}">${this.saved.has(a.id)?'Salvato ✓':'Salva'}</button>${this.read.has(a.id)?'<span class="story-read">Letto</span>':''}</div>`;}
  meta(a){return `${esc(sourceOf(a))} · <time datetime="${a.publication_date}">${date(a.publication_date)}</time>`;}
  story(a,ranked=false){return `<article class="story ${a.item_type==='news'?'news':'paper'}" data-id="${a.id}">${ranked?`<div class="rank">${a.rank||'·'}<small>${a.rank?'nel corpus':'Notizia'}</small></div>`:''}<div><p class="story-kicker"><strong>${esc(a.category)}</strong><span>· ${esc(a.study_type||a.news_type)}</span></p><h3><button class="headline-button" data-open="${a.id}">${esc(a.headline_it||a.title)}</button></h3><p class="story-meta">${this.meta(a)}${a.citation_count!==undefined?`<br>${fmt.format(a.citation_count)} citazioni · Europe PMC · ${date(a.citation_date)}`:''}</p><p class="story-summary">${esc(a.summary_it)}</p>${this.actions(a)}</div></article>`;}
  renderHome(){
    const news=this.items.filter(a=>a.item_type==='news').sort((a,b)=>b.publication_date.localeCompare(a.publication_date)),papers=this.items.filter(a=>a.item_type==='article').sort((a,b)=>a.rank-b.rank),lead=news[0];
    if(!lead){$('home').innerHTML='';return;}
    $('home').innerHTML=`<section class="cover" aria-label="In apertura"><article class="cover-main"><div class="issue-label"><span>IN APERTURA</span><span>IL MAGAZINE DELLA FOTOSINTESI</span></div><p class="eyebrow">${esc(lead.category)} · Notizia</p><h2><button class="headline-button" data-open="${lead.id}">${esc(lead.title)}</button></h2><p class="cover-summary">${esc(lead.summary_it)}</p><p class="story-meta">${this.meta(lead)}</p>${this.actions(lead)}</article><aside class="cover-aside" aria-label="Tre storie da seguire"><p class="eyebrow">Tre storie da seguire</p>${news.slice(1,4).map(a=>`<article class="brief"><p class="story-meta">${this.meta(a)}</p><h3><button class="headline-button" data-open="${a.id}">${esc(a.title)}</button></h3><p>${esc(a.summary_it.split(/(?<=\.)\s/)[0])}</p><div class="actions"><button class="read-link" data-open="${a.id}">Leggi →</button>${this.read.has(a.id)?'<span class="story-read">Letto</span>':''}</div></article>`).join('')}</aside></section>
    <section aria-labelledby="brief-title"><header class="section-head"><div><p class="eyebrow">Dal mondo della ricerca</p><h2 id="brief-title">Il briefing</h2></div><button data-view="news">Tutte le ${news.length} notizie →</button></header><div class="news-grid">${news.slice(4,7).map(a=>this.story(a)).join('')}</div></section>
    <section aria-labelledby="library-title"><header class="section-head"><div><p class="eyebrow">Le basi per leggere il presente</p><h2 id="library-title">La biblioteca della fotosintesi</h2></div><button data-view="articles">Esplora i ${papers.length} lavori →</button></header><p class="section-note">I più citati nel corpus selezionato, dalla fluorescenza ai fotosistemi. Il numero di citazioni indica diffusione bibliografica, non certezza del risultato.</p><div class="stats-band"><h3>La raccolta<br>in numeri</h3><div class="stat"><strong>${papers.length}</strong><span>lavori selezionati</span></div><div class="stat"><strong>${fmt.format(this.stats.totalCitations)}</strong><span>citazioni sommate · Europe PMC</span></div><div class="stat"><strong>${this.stats.openAccess}</strong><span>paper indicizzati open access</span></div></div><div class="story-list">${papers.slice(0,4).map(a=>this.story(a,true)).join('')}</div></section>`;
  }
  renderResults(){
    this.filtered=selectItems(this.items,this.state,this.saved,this.read);
    $('results-title').textContent={news:'Le notizie',articles:'La biblioteca',saved:'Le tue letture salvate',all:'La raccolta'}[this.state.view];
    $('results-kicker').textContent=this.state.view==='articles'?'Letteratura scientifica':'Il tuo indice di lettura';
    $('result-count').textContent=`${this.filtered.length} risultati · ${Math.min(this.limit,this.filtered.length)} visibili`;
    $('results-note').textContent=this.state.view==='articles'?'Biblioteca del corpus; conteggi Europe PMC aggiornati al '+date(this.edition)+'. Posizione nel corpus indicata a sinistra; l’ordine può essere modificato dai filtri.':this.state.view==='news'?'Notizie e comunicati, con riassunti in italiano. Le date sono quelle delle notizie, non degli studi raccontati.':'';
    if(this.state.view==='saved'){const archived=[...this.saved].filter(id=>!this.byId.has(id)).length;if(archived)$('results-note').textContent=`${archived} salvataggi di edizioni precedenti sono conservati nel browser ma non appartengono alla raccolta corrente.`;}
    const list=$('result-list');list.innerHTML=this.filtered.length?this.filtered.slice(0,this.limit).map(a=>this.story(a,true)).join(''):'<div class="empty"><h3>Nessuna lettura con questi criteri.</h3><p>Prova un altro argomento oppure azzera i filtri. Puoi salvare una scheda con il pulsante «Salva».</p><button data-action="reset">Torna alla prima pagina</button></div>';
    $('load-more').hidden=this.filtered.length<=this.limit;$('load-more').textContent=`Mostra altri ${Math.min(12,Math.max(0,this.filtered.length-this.limit))}`;
  }
  openHash(){if(location.hash.startsWith('#read=')){let id;try{id=decodeURIComponent(location.hash.slice(6));}catch{return;}if(this.byId.has(id))this.open(id,false);}else if($('reader').open)$('reader').close();}
  open(id,updateURL=true){
    const a=this.byId.get(id);if(!a)return;const dialog=$('reader');if(!dialog.open){this.focusOrigin=document.activeElement;this.openerId=id;}this.active=a;
    $('reader-type').textContent=a.study_type||a.news_type;$('reader-source').textContent=sourceOf(a)+' · '+date(a.publication_date);
    $('reader-title').textContent=a.headline_it||a.title;$('reader-original').textContent=a.headline_it?a.title:'';$('reader-original').hidden=!a.headline_it;
    $('reader-authors').textContent=(a.authors||[]).map(x=>x.name).join(', ');$('reader-summary').textContent=a.summary_it;
    $('reader-metrics').innerHTML=`<span>${esc(a.category)}</span><span>${esc(a.organism)}</span>${a.citation_count!==undefined?`<span><strong>${fmt.format(a.citation_count)}</strong> citazioni · ${esc(a.citation_source)} · ${date(a.citation_date)}</span><span>${a.open_access?'Indicizzato open access':'Open access non indicato'}</span>`:''}`;
    const access=a.access||{}, publisherStatus=access.publisher_status;
    $('reader-evidence').innerHTML=`<p><strong>Base del riassunto:</strong> ${esc(a.summary_basis)}.</p><p><strong>Verifica:</strong> ${date(a.verified_at)}. ${a.item_type==='news'?(access.level==='news-full-text'?'Testo della notizia accessibile al controllo.':'Testo consultato tramite browser di ricerca; il controllo automatico diretto è stato limitato.'):(access.level==='abstract'?'Abstract bibliografico disponibile.':'Solo record bibliografico; abstract non disponibile.')}</p>${a.item_type==='article'?`<p><strong>Pagina editore:</strong> ${publisherStatus===200?'HTTP 200; questo non garantisce accesso gratuito al testo integrale.':`Controllo automatico ${publisherStatus?'HTTP '+publisherStatus:'non riuscito'}. È disponibile il record bibliografico alternativo.`}</p><p>${esc(a.integrity_note)}</p>`:''}${a.full_text_url?`<p><a href="${esc(safeURL(a.full_text_url))}" target="_blank" rel="noopener noreferrer">Copia archiviata in PMC ↗</a> · presenza indicizzata, testo integrale non valutato.</p>`:''}`;
    $('reader-link').href=safeURL(a.url);$('reader-link').textContent=a.item_type==='news'?'Apri la notizia ↗':'Apri pagina editore ↗';$('reader-record').hidden=!a.record_url;if(a.record_url)$('reader-record').href=safeURL(a.record_url);
    $('reader-citation').hidden=a.item_type!=='article';if(a.item_type==='article')this.renderCitation();
    const related=this.items.filter(b=>b.id!==id&&b.category===a.category).sort((b,c)=>b.item_type===c.item_type?c.publication_date.localeCompare(b.publication_date):b.item_type==='article'?-1:1).slice(0,3);
    $('reader-related').innerHTML=related.length?`<h3>Continua su questo tema</h3>${related.map(b=>`<button class="related" data-open="${b.id}">${esc(b.headline_it||b.title)} →</button>`).join('')}`:'';
    this.readerState();if(!dialog.open)dialog.showModal();document.body.classList.add('reading');dialog.scrollTop=0;$('reader-close').focus();if(updateURL)history.replaceState(null,'',location.pathname+location.search+'#read='+encodeURIComponent(id));
  }
  readerState(){if(!this.active)return;for(const [id,set,label]of [['reader-save',this.saved,'Salva'],['reader-read',this.read,'Segna come letto']]){const yes=set.has(this.active.id);$(id).setAttribute('aria-pressed',String(yes));$(id).textContent=yes?(id==='reader-save'?'Salvato ✓':'Letto ✓ · annulla'):label;}}
  renderCitation(format='reference'){if(!this.active)return;$('reader-citation').innerHTML=`<details open><summary>Citazione bibliografica</summary><div class="citation-options"><button data-format="reference" aria-pressed="${format==='reference'}">Riferimento</button><button data-format="bibtex" aria-pressed="${format==='bibtex'}">BibTeX</button><button id="copy-citation">Copia citazione</button></div><pre class="citation-text">${esc(citation(this.active,format))}</pre></details>`;$('copy-citation').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(citation(this.active,format));$('copy-citation').textContent='Copiata ✓';}catch{$('copy-citation').textContent='Seleziona e copia il testo qui sotto';}});}
  async loadMethod(){try{const r=await fetch('assets/data/method.json');if(!r.ok)throw new Error();const m=await r.json();$('method-detail').innerHTML=`<p><strong>Ricerca:</strong> ${date(m.searched_at)} · ${fmt.format(m.hits)} risultati nella query · ${m.screened} esaminati · ${m.included} inclusi.</p><code>${esc(m.query)}</code><p>${esc(m.scope)}</p><p>${esc(m.ranking_limit)}</p><p>Mediana delle citazioni: ${fmt.format(this.stats.medianCitations)}. La somma delle citazioni non rappresenta citanti unici. Ricerca esplorativa anche in OpenAlex e Crossref; conteggi del ranking esclusivamente Europe PMC.</p><p><a target="_blank" rel="noopener noreferrer" href="${esc(safeURL(m.query_url))}">Ripeti la query Europe PMC ↗</a></p>`;}catch{$('method-detail').textContent='Dettagli del metodo non disponibili. La raccolta resta consultabile.';}}
  async refreshNews(){const button=$('refresh-news');button.disabled=true;$('live-status').textContent='Controllo dei feed e delle pagine di origine…';try{const r=await fetch('/api/news',{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error();const data=await r.json();if(!Array.isArray(data.items))throw new Error();$('live-list').innerHTML=data.items.map(a=>`<article><p class="story-meta">${esc(a.source)} · ${esc(a.date?.slice(0,10)||'Data non disponibile')}</p><h3><a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.title)} ↗</a></h3><p>${esc(a.excerpt)}</p><p class="quiet">Estratto originale del feed · pagina raggiungibile al controllo · non curato</p></article>`).join('');$('live-status').textContent=`${data.items.length} segnalazioni pertinenti negli ultimi 90 giorni. Controllo: ${new Date(data.checked_at).toLocaleString('it-IT')}. ${data.errors?.length?`${data.errors.length} fonti non disponibili in questo controllo.`:''} ${!data.items.length?'Nessuna nuova segnalazione dalle fonti raggiungibili; consulta il briefing curato.':''}`;}catch{$('live-status').textContent='Aggiornamento non disponibile. Questa funzione richiede la versione online su Vercel e fonti raggiungibili. Il briefing curato resta disponibile.';}finally{button.disabled=false;}}
}
new Magazine();
