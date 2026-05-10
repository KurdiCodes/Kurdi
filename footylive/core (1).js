// ═══════════════════════════════════════════════════════
// FootyLive.ca — core.js
// API config, fetch, cache, shared utilities & renderers
// ═══════════════════════════════════════════════════════

const KEY  = '60486030e3msh3d7501bea3a538ap1aee2bjsn29bce094e3a6';
const HOST = 'sportapi7.p.rapidapi.com';
const BASE = 'https://sportapi7.p.rapidapi.com/api/v1';

// ── Cache (30s TTL) ───────────────────────────────────
const CACHE = new Map();
function fromCache(k){ const v=CACHE.get(k); return v&&Date.now()-v.ts<30000?v.data:null; }
function toCache(k,d){ CACHE.set(k,{data:d,ts:Date.now()}); }

// ── Core fetch wrapper ────────────────────────────────
// Mirrors: xhr.open('GET', BASE+endpoint); xhr.setRequestHeader('x-rapidapi-key', KEY);
async function sa7(endpoint, retries=2){
  const cached=fromCache(endpoint);
  if(cached) return cached;
  for(let i=0;i<=retries;i++){
    const r=await fetch(BASE+endpoint,{
      method:'GET',
      headers:{'x-rapidapi-key':KEY,'x-rapidapi-host':HOST}
    });
    if(r.status===429){ if(i<retries){await wait(2200*(i+1));continue;} throw new Error('Rate limit — please wait a moment.'); }
    if(!r.ok){ const t=await r.text().catch(()=>''); throw new Error(`HTTP ${r.status}${t?' — '+t.slice(0,100):''}`); }
    const d=await r.json(); toCache(endpoint,d); return d;
  }
}

// ── Utilities ─────────────────────────────────────────
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
function today(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function today2(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtTime(ts){
  try{ return new Date(ts*1000).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',timeZone:'America/Toronto'})+' ET'; }catch{ return ''; }
}
function fmtDate(ts){
  try{ return new Date(ts*1000).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}); }catch{ return ''; }
}
function fmtDateShort(ts){
  try{ return new Date(ts*1000).toLocaleDateString('en-CA',{month:'short',day:'numeric'}); }catch{ return ''; }
}

// ── State helpers ─────────────────────────────────────
function spin(){ return '<div class="loading-state"><div class="spinner"></div><div>Loading…</div></div>'; }
function errBox(e,extra=''){
  const m=e?.message||String(e)||'Unknown error';
  let tip='';
  if(m.includes('403')) tip='<br><small>Check your SportAPI7 subscription on RapidAPI.</small>';
  if(m.includes('429')) tip='<br><small>Rate limit hit — please wait a moment.</small>';
  if(extra) tip+=`<br><small>${extra}</small>`;
  return `<div class="error-state">⚠ ${m}${tip}</div>`;
}
function emptyBox(msg='No data available.'){
  return `<div class="empty-state"><div class="empty-icon">📭</div>${msg}</div>`;
}

// ── Event status parser ───────────────────────────────
function parseEventStatus(ev){
  const code=ev.status?.code??0;
  const desc=String(ev.status?.description||'').toLowerCase();
  const isLive=[6,7,8,9,10,11,12,31].includes(code)||desc.includes('progress')||desc.includes('live');
  const isFinished=[100,120].includes(code)||desc.includes('finish')||desc.includes('ended')||desc.includes('after');
  const isHT=code===31||desc.includes('halftime')||desc.includes('half time');
  return {isLive,isFinished,isHT,desc:ev.status?.description||'',code};
}

// ── Match card renderer ───────────────────────────────
// Uses: /sport/{sport}/events/live  /sport/{sport}/scheduled-events/{date}
function matchRowHTML(ev, onclickFn=''){
  const hN =ev.homeTeam?.name||'Home';
  const aN =ev.awayTeam?.name||'Away';
  const hLo=ev.homeTeam?.image||ev.homeTeam?.logo||'';
  const aLo=ev.awayTeam?.image||ev.awayTeam?.logo||'';
  const hG =ev.homeScore?.current??ev.homeScore?.display??'—';
  const aG =ev.awayScore?.current??ev.awayScore?.display??'—';
  const leag=ev.tournament?.name||ev.league?.name||'';
  const {isLive,isFinished,isHT,desc}=parseEventStatus(ev);
  const hWin=isFinished&&typeof hG==='number'&&typeof aG==='number'&&hG>aG;
  const aWin=isFinished&&typeof aG==='number'&&typeof hG==='number'&&aG>hG;

  let statusCol;
  if(isHT)       statusCol=`<div class="s-ht">HT</div>`;
  else if(isLive) statusCol=`<div class="s-live">LIVE</div><div class="s-min">${desc||''}</div>`;
  else if(isFinished) statusCol=`<div class="s-ft">FT</div>`;
  else { const t=ev.startTimestamp?fmtTime(ev.startTimestamp):(desc||'—'); statusCol=`<div class="s-time">${t}</div>`; }

  const crest=(src,alt)=>src
    ?`<img class="t-crest" src="${src}" alt="${alt}" onerror="this.style.display='none'">`
    :`<div class="t-crest-ph">⚽</div>`;

  return `<div class="match-card" onclick="${onclickFn||`openEventModal(${ev.id})`}">
    <div class="match-card-inner">
      <div class="match-status-col">${statusCol}</div>
      <div class="match-teams-col">
        <div class="match-team-row">
          <div class="match-team-info">${crest(hLo,hN)}<span class="t-name${hWin?' winner':''}">${hN}</span></div>
          <span class="t-score${hWin?' winner':''}">${hG}</span>
        </div>
        <div class="match-divider"></div>
        <div class="match-team-row">
          <div class="match-team-info">${crest(aLo,aN)}<span class="t-name${aWin?' winner':''}">${aN}</span></div>
          <span class="t-score${aWin?' winner':''}">${aG}</span>
        </div>
        ${leag?`<div class="match-league">${leag}</div>`:''}
      </div>
      <div class="match-open-btn">
        <span class="ob-icon">→</span>
        <span class="ob-txt">Details</span>
      </div>
    </div>
  </div>`;
}
