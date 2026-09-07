/** Pure catalogue logic; shared with browser-independent regression tests. */
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const sourceOf = item => item.journal || item.source_outlet || '';
export function indexItems(items) {
  return items.map(item => ({ ...item, searchText: normalize([item.title,item.headline_it,item.summary_it,item.doi,item.organism,item.category,sourceOf(item),...(item.tags||[]),...(item.authors||[]).map(a=>a.name)].join(' ')) }));
}
export function selectItems(items, state, saved = new Set(), read = new Set()) {
  const words = normalize(state.search).split(/\s+/).filter(Boolean);
  return items.filter(a => (!state.view || state.view === 'all' || (state.view === 'news' ? a.item_type === 'news' : state.view === 'articles' ? a.item_type === 'article' : saved.has(a.id)))
    && (!state.category || a.category === state.category) && (!state.organism || a.organism === state.organism)
    && (!state.source || sourceOf(a) === state.source) && (!state.unread || !read.has(a.id))
    && (!state.oa || (a.item_type === 'article' && a.open_access)) && words.every(w => a.searchText.includes(w)))
    .sort((a,b) => {
      if (state.sort === 'citations') return (b.citation_count ?? -1)-(a.citation_count ?? -1) || a.title.localeCompare(b.title);
      if (state.sort === 'title') return a.title.localeCompare(b.title);
      if (state.sort === 'oldest') return a.publication_date.localeCompare(b.publication_date);
      if (state.sort === 'recent') return b.publication_date.localeCompare(a.publication_date);
      if (a.item_type !== b.item_type) return a.item_type === 'news' ? -1 : 1;
      return a.item_type === 'news' ? b.publication_date.localeCompare(a.publication_date) : a.rank-b.rank;
    });
}
export function statistics(items) {
  const papers=items.filter(a=>a.item_type==='article'), values=papers.map(a=>a.citation_count).sort((a,b)=>a-b);
  const middle=Math.floor(values.length/2);
  return {papers:papers.length,news:items.length-papers.length,sources:new Set(items.map(sourceOf)).size,openAccess:papers.filter(a=>a.open_access).length,totalCitations:values.reduce((a,b)=>a+b,0),medianCitations:values.length?(values.length%2?values[middle]:(values[middle-1]+values[middle])/2):0};
}
export function safeURL(value) { try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
export function citation(item, format='reference') {
  const names=(item.authors||[]).map(a=>a.name), year=item.year||item.publication_date.slice(0,4);
  if(format==='bibtex') {
    const esc=s=>String(s||'').replace(/[{}\\]/g,'').replace(/\n/g,' ');
    return `@article{resonance${esc(item.pmid||item.id)},\n  title = {${esc(item.title)}},\n  author = {${names.map(esc).join(' and ')}},\n  journal = {${esc(item.journal)}},\n  year = {${year}},\n  doi = {${esc(item.doi)}}\n}`;
  }
  return `${names.join(', ')} (${year}). ${item.title} ${item.journal}. https://doi.org/${item.doi}`;
}
