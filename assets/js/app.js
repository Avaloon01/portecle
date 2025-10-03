
/* Minimal client-side "router" and progress store */
const $ = (sel, ctx=document)=>ctx.querySelector(sel);
const $$ = (sel, ctx=document)=>Array.from(ctx.querySelectorAll(sel));
const storeKey = "porte-cle:progress:v2";

function getProgress(){
  try{ return JSON.parse(localStorage.getItem(storeKey)||"{}"); }catch(e){ return {}; }
}
function setProgress(p){ localStorage.setItem(storeKey, JSON.stringify(p)); }

/* Merge available datasets: expects assets/data/*.json keys: id, titre, domaine, regle, items */
async function loadDatasets(){
  const dataDir = "/data/";
  const files = ["orthographe.json","grammaire.json","homonymes.json","conjugaison.json"];
  async function fetchIfExists(path){
    try{ const r = await fetch(path, {cache:"no-store"}); if(r.ok){ return r.json(); } }catch(e){}
    return null;
  }
  const out = [];
  for(const f of files){
    let json = null;
    for(const root of roots){
      if(json) break;
      json = await fetchIfExists(root+f);
    }
    if(json){
        const arr = Array.isArray(json) ? json : (json.data || []);
        for(const e of arr){
          // normalize
          out.push({
            id: e.id || (e.code || e.titre || e.regle || Math.random().toString(36).slice(2)),
            titre: e.titre || e.regle || e.nom || "Règle",
            domaine: e.domaine || e.category || (f.replace(".json","")),
            description: e.description || e.resume || "",
            items: e.items || e.exercices || e.examples || []
          });
        }
      }
    }
  }
  if(!out.length){ console.warn('Aucune base de données JSON trouvée dans', roots, 'pour', files); }
  return out;
}

/* Attach navbar active state */
function markActive(){
  const path = location.pathname.split("/").pop() || "index.html";
  $$(".top a").forEach(a=>a.classList.toggle("active", a.getAttribute("href").endsWith(path)));
}

/* Record a rule progress */
function recordRule(ruleId, status){
  const p = getProgress();
  const prev = p[ruleId] || { attempts:0, success:0, last:null };
  const ok = status==="success";
  const now = new Date().toISOString();
  p[ruleId] = { attempts: prev.attempts+1, success: prev.success + (ok?1:0), last: now };
  setProgress(p);
}

/* Utilities for exercises */
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function pick(a,n){ return a.slice(0, Math.min(n, a.length)); }

export { $, $$, getProgress, setProgress, loadDatasets, markActive, recordRule, shuffle, pick };
