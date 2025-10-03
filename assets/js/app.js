/* ========= Porte-Clé — core utils ========= */
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const STORE_KEY = "porte-cle:progress:v2";
function getProgress(){ try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; } }
function setProgress(p){ localStorage.setItem(STORE_KEY, JSON.stringify(p)); }
function recordRule(ruleId, status){
  const p = getProgress();
  const prev = p[ruleId] || { attempts:0, success:0, last:null };
  const ok = status === "success";
  p[ruleId] = { attempts: prev.attempts+1, success: prev.success+(ok?1:0), last:new Date().toISOString() };
  setProgress(p);
}
function markActive(){
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  $$(".top a").forEach(a => { const href = (a.getAttribute("href") || "").toLowerCase(); a.classList.toggle("active", href.endsWith(page)); });
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function pick(a,n){ return a.slice(0, Math.min(n, a.length)); }
async function loadDatasets(){
  const roots  = ["./data/","data/","./assets/data/","assets/data/"];
  const files  = ["grammaire.json","orthographe.json","homonymes.json","conjugaison.json","vocabulaire.json"];

  async function fetchJSON(url){
    try{
      const r = await fetch(url, { cache:"no-store" });
      if(!r.ok) return null;
      const txt = await r.text();
      if(!txt || txt.trim().startsWith("<")) return null; // ignore HTML/placeholder
      return JSON.parse(txt);
    }catch{ return null; }
  }

  // utilitaires
  function inferDomainFromFilename(url=""){
    const name = url.split("/").pop()?.replace(".json","").toLowerCase() || "";
    const map = { grammaire:"Grammaire", orthographe:"Orthographe", homonymes:"Homonymes", conjugaison:"Conjugaison", vocabulaire:"Vocabulaire" };
    return map[name] || name || "inconnu";
  }
  function normId(){ return Math.random().toString(36).slice(2); }

  const out = [];

  for(const f of files){
    let json=null, used=null;
    for(const root of roots){
      const url = root+f;
      json = await fetchJSON(url);
      if(json){ used=url; break; }
    }
    if(!json) continue;

    // ----- CAS A : format { axes:[], fiches:[] } (TON format gram.)
    if (Array.isArray(json.fiches) && Array.isArray(json.axes)) {
      // crée un dictionnaire des axes: "grammaire" -> "Grammaire"
      const axisById = Object.fromEntries(
        json.axes.map(ax => [ String(ax.id||"").toLowerCase(), ax.title || ax.titre || ax.label || ""])
      );

      for(const fi of json.fiches){
        // domaine = axelabel si présent, sinon on résout via l'axe
        const axeId   = String(fi.axe || "").toLowerCase();
        const domaine = fi.axelabel || axisById[axeId] || inferDomainFromFilename(used);

        out.push({
          id:    fi.id || fi.code || (fi.title || fi.titre || fi.regle) || normId(),
          titre: fi.title || fi.titre || fi.regle || "Règle",
          domaine,
          description: fi.description || fi.resume || "",
          // si pas d'items, on laisse [] (la page Exos gère un fallback)
          items: fi.items || fi.exercices || fi.examples || []
        });
      }
      continue; // passe au fichier suivant
    }

    // ----- CAS B : tableaux simples / wrappers {data:[]}
    const arr = Array.isArray(json) ? json : (json.data || json.items || json.exercices || json.examples || []);
    if (Array.isArray(arr)) {
      const domainFallback = inferDomainFromFilename(used);
      for(const e of arr){
        out.push({
          id:    e.id || e.code || e.titre || e.title || e.regle || e.nom || normId(),
          titre: e.titre || e.title || e.regle || e.nom || "Règle",
          domaine: e.domaine || e.category || domainFallback,
          description: e.description || e.resume || "",
          items: e.items || e.exercices || e.examples || []
        });
      }
    }
  }

  // tri sympa: par domaine puis par titre
  out.sort((a,b)=> (a.domaine||"").localeCompare(b.domaine||"") || (a.titre||"").localeCompare(b.titre||""));
  return out;
}
