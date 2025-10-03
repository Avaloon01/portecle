/* ========================================================================
   Atelier Français — app.js
   - Domaines: orthographe / conjugaison / homonymes / grammaire
   - Progression par domaine (localStorage séparé)
   - Filtres: axe, recherche, "en cours"
   - Générateur d'exercices: 3 questions aléatoires
   ======================================================================== */

(() => {
  // --------------------------- Config -----------------------------------
  const DATA_FILES = {
    orthographe: 'data/orthographe.json',
    conjugaison: 'data/conjugaison.json',
    homonymes:   'data/homonymes.json',
    grammaire:   'data/grammaire.json',
  };

  const AVAILABLE_DOMAINS = Object.keys(DATA_FILES);
  const DEFAULT_DOMAIN = 'orthographe';
  const QUESTIONS_PER_EXO = 3; // nombre de questions tirées au hasard

  // --------------------------- State ------------------------------------
  const state = {
    domain: getUrlDomain() || DEFAULT_DOMAIN,
    fiches: [],
    progression: {}, // { ficheId: 0|1|2 }
    axeFilter: 'all',
    search: '',
    onlyInProgress: false,
  };

  function progKey() { return `atelier_fr_progression_v1_${state.domain}`; }

  // --------------------------- Init -------------------------------------
  window.addEventListener('DOMContentLoaded', async () => {
    initTabs();       // branche les onglets
    await loadData(); // charge le bon JSON + axes
    initFilters();    // branche les filtres
  });

  // ------------------------ Domain utils --------------------------------
  function getUrlDomain() {
    try {
      const u = new URL(window.location.href);
      const d = (u.searchParams.get('domain') || '').toLowerCase().trim();
      if (AVAILABLE_DOMAINS.includes(d)) return d;
    } catch {}
    return null;
  }

  function setUrlDomain(d) {
    const url = new URL(window.location.href);
    url.searchParams.set('domain', d);
    history.replaceState({}, '', url);
  }

  // --------------------------- Tabs -------------------------------------
  function initTabs() {
    const tabBtns = document.querySelectorAll('.tabs .tab[data-domain]');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.domain === state.domain);

      btn.addEventListener('click', async () => {
        const newDomain = btn.dataset.domain;
        if (!AVAILABLE_DOMAINS.includes(newDomain)) return; // domaine pas encore dispo
        if (newDomain === state.domain) return;

        state.domain = newDomain;
        setUrlDomain(newDomain);

        // reset filtres
        state.axeFilter = 'all';
        state.search = '';
        state.onlyInProgress = false;
        const si = document.getElementById('searchInput');
        if (si) si.value = '';
        const chk = document.getElementById('showOnlyInProgress');
        if (chk) chk.checked = false;

        await loadData();

        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
      });
    });
  }

  // ------------------------ Data loading --------------------------------
  async function loadData() {
    const src = DATA_FILES[state.domain];
    const list = document.getElementById('ficheList');

    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      state.fiches = data.fiches || [];
      buildAxeSelect(data.axes || []);
      restoreProgress();
      render();
    } catch (err) {
      console.error("Erreur de chargement:", err);
      list.innerHTML = `<p class="error">Impossible de charger les données pour <strong>${state.domain}</strong>.</p>`;
    }
  }

  // ------------------------ Filtres -------------------------------------
  function initFilters() {
    const si = document.getElementById('searchInput');
    if (si) si.oninput = (e => { state.search = e.target.value.toLowerCase().trim(); render(); });

    const chk = document.getElementById('showOnlyInProgress');
    if (chk) chk.onchange = (e => { state.onlyInProgress = e.target.checked; render(); });
  }

  function buildAxeSelect(axes) {
    const sel = document.getElementById('axeSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="all">Tous les axes</option>' + axes.map(a => `<option value="${a.id}">${a.title}</option>`).join('');
    sel.value = 'all';
    sel.onchange = (e => { state.axeFilter = e.target.value; render(); });
  }

  // ------------------------ Progression ---------------------------------
  function restoreProgress() {
    try {
      state.progression = JSON.parse(localStorage.getItem(progKey())) || {};
    } catch { state.progression = {}; }
  }
  function saveProgress() { localStorage.setItem(progKey(), JSON.stringify(state.progression)); }

  function cycleProgress(ficheId) {
    const cur = state.progression[ficheId] || 0;
    const next = (cur + 1) % 3; // 0->1->2->0
    state.progression[ficheId] = next;
    saveProgress();
    render();
  }

  // ------------------------ Rendering -----------------------------------
  function render() {
    const list = document.getElementById('ficheList');
    const q = state.search;
    const filtered = state.fiches.filter(f => {
      if (state.axeFilter !== 'all' && f.axe !== state.axeFilter) return false;
      if (q && !(f.title.toLowerCase().includes(q) || (f.keywords||[]).some(k => k.toLowerCase().includes(q)))) return false;
      if (state.onlyInProgress) {
        const s = state.progression[f.id] || 0;
        if (s !== 1) return false;
      }
      return true;
    });
    list.innerHTML = filtered.map(renderCard).join('');
    bindCardEvents();
  }

  function renderCard(f) {
    const prog = state.progression[f.id] || 0;
    const progText = ['—','✓ en cours','✓✓ maîtrisé'][prog];
    return `
    <article class="card" data-id="${f.id}">
      <div class="badges">
        <span class="badge id">${f.id}</span>
        <span class="badge axe">${f.axeLabel || f.axe || state.domain}</span>
      </div>
      <h3>${f.title}</h3>
      <details class="rule">
        <summary>Lire / cacher la règle</summary>
        <div>${f.rule || ''}</div>
        ${f.examples?.length ? `<ul>${f.examples.map(ex=>`<li>${ex}</li>`).join('')}</ul>`:''}
      </details>

      <div class="progress">
        <button class="ghost js-cycle">Changer état</button>
        <span class="state">${progText}</span>
      </div>

      <div class="actions">
        <button class="primary js-generate" data-kind="${f.kind}">Générer des exercices</button>
        <button class="ghost js-reset">Réinitialiser mes réponses</button>
      </div>

      <div class="exercise" id="ex-${f.id}"></div>
    </article>
    `;
  }

  function bindCardEvents() {
    document.querySelectorAll('.js-cycle').forEach(btn => {
      btn.onclick = e => {
        const id = e.target.closest('.card').dataset.id;
        cycleProgress(id);
      };
    });
    document.querySelectorAll('.js-generate').forEach(btn => {
      btn.onclick = e => {
        const card = e.target.closest('.card');
        const id = card.dataset.id;
        const fiche = state.fiches.find(x => x.id === id);
        generateExercises(fiche);
      };
    });
    document.querySelectorAll('.js-reset').forEach(btn => {
      btn.onclick = e => {
        const wrap = e.target.closest('.card').querySelector('.exercise');
        wrap.innerHTML = '';
      };
    });
  }

  // ---------------------- Exercices -------------------------------------
  function shuffle(arr){ return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
  function pick(arr,n){ return shuffle(arr).slice(0,n); }

  function generateExercises(f) {
    const wrap = document.getElementById('ex-'+f.id);
    let html = '';
    let scoreCorrect = 0, total = 0;

    function addQ(qhtml, onCheck){
      const qid = Math.random().toString(36).slice(2,8);
      html += `<div class="q" id="${qid}">${qhtml}</div>`;
      setTimeout(()=> {
        const el = document.getElementById(qid);
        onCheck(el, (ok)=> {
          el.classList.remove('correct','wrong');
          el.classList.add(ok? 'correct':'wrong');
          if(ok) scoreCorrect++;
          total++;
          el.querySelector('.result').textContent = ok ? 'Bravo !' : 'Essaie encore';
          wrap.querySelector('.score').textContent = `Score: ${scoreCorrect} / ${total}`;
        });
      },0);
    }

    wrap.innerHTML = '';

    if(f.kind === 'homophone2'){
      const items = pick(f.items, Math.min(QUESTIONS_PER_EXO, f.items.length));
      items.forEach(it=>{
        const choices = shuffle([it.a, it.b]);
        const sentence = it.sentence.replace('___', '<strong>___</strong>');
        addQ(`
          <div class="prompt">${sentence}</div>
          <div class="choices">
            ${choices.map(c=>`<button>${c}</button>`).join('')}
          </div>
          <div class="result"></div>
        `, (el, done)=>{
          el.querySelectorAll('button').forEach(b=>{
            b.addEventListener('click', ()=>{
              done(b.textContent === it.correct);
            }, {once:true});
          });
        });
      });
    }

    if(f.kind === 'fill-in'){
      const items = pick(f.items, Math.min(QUESTIONS_PER_EXO, f.items.length));
      items.forEach(it=>{
        const prompt = (it.prompt || '').replace('___', '<input type="text" placeholder="réponse">');
        addQ(`
          <div class="prompt">${prompt}</div>
          <div><button class="primary">Valider</button></div>
          <div class="result"></div>
        `, (el, done)=>{
          const btn = el.querySelector('button');
          btn.addEventListener('click', ()=>{
            const user = (el.querySelector('input')?.value || '').trim();
            const normalize = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.!?…\s]+$/,'');
            const exp = it.answer;
            let ok = false;
            if(typeof exp === 'string'){
              ok = it.acceptLoose ? normalize(user) === normalize(exp) : user === exp;
            } else if(Array.isArray(exp)){
              ok = exp.some(ans => it.acceptLoose ? normalize(user) === normalize(ans) : user === ans);
            } else if(typeof exp === 'object' && exp.pattern){
              ok = new RegExp(exp.pattern, 'i').test(user);
            }
            done(ok);
          }, {once:true});
        });
      });
    }

    wrap.innerHTML = html + `<div class="score">Score: 0 / 0</div>`;
  }
})();
