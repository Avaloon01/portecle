
// --- Data loading ---
const state = {
  domain: 'orthographe',
  fiches: [],
  progression: {}, // key: fiche.id -> 0/1/2
  axeFilter: 'all',
  search: '',
  onlyInProgress: false,
};

const PROG_KEY = 'atelier_fr_progression_v1';

async function loadData(){
  const res = await fetch('data/orthographe.json');
  const data = await res.json();
  state.fiches = data.fiches;
  buildAxeSelect(data.axes);
  restoreProgress();
  render();
}

function buildAxeSelect(axes){
  const sel = document.getElementById('axeSelect');
  sel.innerHTML = '<option value="all">Tous les axes</option>' + axes.map(a => `<option value="${a.id}">${a.title}</option>`).join('');
  sel.addEventListener('change', e => { state.axeFilter = e.target.value; render(); });
  document.getElementById('searchInput').addEventListener('input', e => { state.search = e.target.value.toLowerCase().trim(); render(); });
  document.getElementById('showOnlyInProgress').addEventListener('change', e => { state.onlyInProgress = e.target.checked; render(); });
}

function restoreProgress(){
  try{
    state.progression = JSON.parse(localStorage.getItem(PROG_KEY)) || {};
  }catch(e){ state.progression = {}; }
}
function saveProgress(){ localStorage.setItem(PROG_KEY, JSON.stringify(state.progression)); }

function cycleProgress(ficheId){
  const cur = state.progression[ficheId] || 0;
  const next = (cur + 1) % 3; // 0->1->2->0
  state.progression[ficheId] = next;
  saveProgress();
  render();
}

function render(){
  const list = document.getElementById('ficheList');
  const q = state.search;
  const filtered = state.fiches.filter(f => {
    if(state.axeFilter !== 'all' && f.axe !== state.axeFilter) return false;
    if(q && !(f.title.toLowerCase().includes(q) || (f.keywords||[]).some(k=>k.toLowerCase().includes(q)))) return false;
    if(state.onlyInProgress){ const s = state.progression[f.id]||0; if(s !== 1) return false; }
    return true;
  });
  list.innerHTML = filtered.map(renderCard).join('');
  bindCardEvents();
}

function renderCard(f){
  const prog = state.progression[f.id] || 0;
  const progText = ['—','✓ en cours','✓✓ maîtrisé'][prog];
  return `
  <article class="card" data-id="${f.id}">
    <div class="badges">
      <span class="badge id">${f.id}</span>
      <span class="badge axe">${f.axeLabel}</span>
    </div>
    <h3>${f.title}</h3>
    <details class="rule">
      <summary>Lire / cacher la règle</summary>
      <div>${f.rule}</div>
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

function bindCardEvents(){
  document.querySelectorAll('.js-cycle').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const id = e.target.closest('.card').dataset.id;
      cycleProgress(id);
    });
  });
  document.querySelectorAll('.js-generate').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const card = e.target.closest('.card');
      const id = card.dataset.id;
      const fiche = state.fiches.find(x=>x.id===id);
      generateExercises(fiche);
    });
  });
  document.querySelectorAll('.js-reset').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const wrap = e.target.closest('.card').querySelector('.exercise');
      wrap.innerHTML = '';
    });
  });
}

// --- Exercise generators ---
function shuffle(arr){ return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function pick(arr,n){ return shuffle(arr).slice(0,n); }

function generateExercises(f){
  const wrap = document.getElementById('ex-'+f.id);
  let html = '';
  let scoreCorrect = 0, total = 0;

  function addQ(qhtml, onCheck){
    const qid = Math.random().toString(36).slice(2,8);
    html += `<div class="q" id="${qid}">${qhtml}</div>`;
    setTimeout(()=>{ // bind after inject
      const el = document.getElementById(qid);
      onCheck(el, (ok)=>{
        el.classList.remove('correct','wrong');
        el.classList.add(ok? 'correct':'wrong');
        if(ok){ scoreCorrect++; }
        total++;
        el.querySelector('.result').textContent = ok? 'Bravo !' : 'Essaie encore';
        wrap.querySelector('.score').textContent = `Score: ${scoreCorrect} / ${total}`;
      });
    },0);
  }

  wrap.innerHTML = ''; // reset

  if(f.kind === 'homophone2'){
    const items = pick(f.items, Math.min(8, f.items.length));
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
            const ok = b.textContent === it.correct;
            done(ok);
          }, {once:true});
        });
      });
    });
  }

  if(f.kind === 'fill-in'){
    const items = pick(f.items, Math.min(6, f.items.length));
    items.forEach(it=>{
      const prompt = it.prompt.replace('___', '<input type="text" placeholder="réponse">');
      addQ(`
        <div class="prompt">${prompt}</div>
        <div><button class="primary">Valider</button></div>
        <div class="result"></div>
      `, (el, done)=>{
        const btn = el.querySelector('button');
        btn.addEventListener('click', ()=>{
          const user = (el.querySelector('input').value||'').trim();
          // accept variants without capital or punctuation if configured
          const normalized = s => s.toLowerCase().replace(/[.!?…]/g,'');
          const ok = (it.acceptLoose ? normalized(user) === normalized(it.answer) : user === it.answer);
          done(ok);
        }, {once:true});
      });
    });
  }

  wrap.innerHTML = html + `<div class="score">Score: 0 / 0</div>`;
}

// Init
window.addEventListener('DOMContentLoaded', loadData);
