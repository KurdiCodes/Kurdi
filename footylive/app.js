// ═══════════════════════════════════════════════════════
// FootyLive.ca — app.js
// All page logic, modals (Team/Ref/Mgr/Tourn), Search
// ═══════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────
let CURRENT_PAGE   = 'home';
let HOME_SPORT     = 'football';
let SCORES_SPORT   = 'football';
let SCHED_SPORT    = 'football';
let SCHED_MODE     = 'scheduled';
let SCHED_DATE     = today();
let ALL_TRANSFERS  = [];
let TRANSFER_FILTER= 'all';
let CAL_SPORT      = 'tennis';
let CAL_DATE       = new Date();
let SEARCH_RESULTS_DATA = {};
let SEARCH_TYPE    = 'all';
let TEAM_ID=null, TEAM_DATA=null, TEAM_LOADED={};
let REF_ID=null,  REF_LOADED={};
let MGR_ID=null,  MGR_LOADED={};
let TOURN_ID=null, TOURN_DATA=null, TOURN_LOADED={};

// ── Boot ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded',()=>{
  updateDateDisplay();
  updateCalDisplay();
  bootHome();
  loadTransfers();
  loadTV();
  setInterval(()=>{ if(['home','scores'].includes(CURRENT_PAGE)) refreshLive(); },30000);
});

// ── Navigation ────────────────────────────────────────
function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  document.getElementById('nav-'+page)?.classList.add('active');
  CURRENT_PAGE=page;
  window.scrollTo({top:0,behavior:'smooth'});
  if(page==='home')      bootHome();
  if(page==='scores')    bootScores();
  if(page==='schedule')  bootSchedule();
  if(page==='transfers') bootTransfers();
  if(page==='standings') bootStandings();
  if(page==='rankings')  bootRankings();
  if(page==='calendar')  bootCalendar();
  if(page==='highlights') bootHighlights();
}

// ── Modal helpers ─────────────────────────────────────
function openModal(id){ document.getElementById(id).classList.add('open'); document.body.style.overflow='hidden'; }
function closeModal2(id){ document.getElementById(id).classList.remove('open'); document.body.style.overflow=''; }
function tabSwitch(panelPrefix,panelId,btn,lazyFn){
  document.querySelectorAll(`[id^="${panelPrefix}"]`).forEach(p=>p.classList.remove('active'));
  btn.closest('.modal-tabs').querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
  document.getElementById(panelId).classList.add('active');
  btn.classList.add('active');
  if(lazyFn&&!window[`_loaded_${panelId}`]){ window[`_loaded_${panelId}`]=true; lazyFn(); }
}
function resetModal(modalId){
  document.querySelectorAll(`#${modalId} .modal-panel`).forEach(p=>{ p.innerHTML=spin(); p.classList.remove('active'); });
  document.querySelectorAll(`#${modalId} .mtab`).forEach(t=>t.classList.remove('active'));
  document.querySelector(`#${modalId} .mtab`)?.classList.add('active');
  document.querySelectorAll(`#${modalId} .modal-panel`)[0]?.classList.add('active');
}

// ══════════════════════════════════════════════════════
// HOME PAGE
// Endpoints: /sport/{sport}/events/live
// ══════════════════════════════════════════════════════
function bootHome(){
  loadHomeLive();
  // Stagger sidebar widgets so the added match filters do not cause a large API burst on page load.
  // This prevents EPL standings/top scorers from showing "Unavailable" when the API rate-limits parallel calls.
  setTimeout(loadHomeStandings, 1600);
  setTimeout(loadHomeScorers, 2400);
}

function setHomeSport(el,s){
  document.querySelectorAll('#homeSportFilter .sport-pill').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); HOME_SPORT=s; loadHomeLive();
}

async function loadHomeLive(){
  const box=document.getElementById('homeLiveBox');
  if(!box) return;
  box.innerHTML=spin();
  try{
    // Load live first, then today's scheduled games. Sequential loading avoids a big API burst.
    const liveD=await sa7(`/sport/${HOME_SPORT}/events/live`);
    const liveEvents=liveD.events||[];
    let scheduledEvents=[];
    try{
      await wait(250);
      const schedD=await sa7(`/sport/${HOME_SPORT}/scheduled-events/${today()}`);
      scheduledEvents=schedD.events||[];
    }catch(scheduleErr){ console.warn('Scheduled games unavailable:', scheduleErr); }

    const seen=new Set();
    const evs=[...liveEvents, ...scheduledEvents]
      .filter(ev=>{
        if(!ev || seen.has(ev.id)) return false;
        seen.add(ev.id);
        const st=parseEventStatus(ev);
        return st.isLive || (!st.isFinished && !st.isHT);
      })
      .sort((a,b)=>(a.startTimestamp||0)-(b.startTimestamp||0));

    const badge=document.getElementById('homeLiveBadge');
    if(badge) badge.innerHTML=liveEvents.length
      ?`<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);color:var(--red);font-size:.62rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:3px"><span style="width:5px;height:5px;border-radius:50%;background:var(--red);display:inline-block;animation:pulse-r 1.2s infinite"></span>${liveEvents.length} LIVE</div>`:'' ;
    const livePill=document.getElementById('livePill');
    if(livePill) livePill.textContent=liveEvents.length?`● ${liveEvents.length} LIVE`:'● LIVE';
    updateTicker(liveEvents);
    if(!evs.length){ box.innerHTML=emptyBox(`No ${HOME_SPORT} games found for today.`); return; }
    box.innerHTML=groupMatchesHTML(evs);
  }catch(e){ box.innerHTML=errBox(e); }
}

function refreshLive(){
  CACHE.delete(`/sport/${HOME_SPORT}/events/live`);
  CACHE.delete(`/sport/${HOME_SPORT}/scheduled-events/${today()}`);
  CACHE.delete(`/sport/${SCORES_SPORT}/events/live`);
  CACHE.delete(`/sport/${SCORES_SPORT}/scheduled-events/${today()}`);
  if(CURRENT_PAGE==='home')   loadHomeLive();
  if(CURRENT_PAGE==='scores') loadScores();
}

// Sidebar: EPL standings using /tournament/17/standings/total
async function loadHomeStandings(){
  const box=document.getElementById('homeStandBox');
  if(!box) return;
  box.innerHTML=spin();
  try{
    let d;
    try { d = await sa7('/tournament/17/standings/total'); }
    catch(firstErr) { await wait(1200); d = await sa7('/tournament/17/standings/total'); }
    box.innerHTML=renderMiniStandings(d,10);
  }catch(e){
    console.warn('Home standings unavailable:', e);
    box.innerHTML=emptyBox('Standings temporarily unavailable.');
  }
}

// Sidebar: EPL top scorers using /tournament/17/top-players/scorers
async function loadHomeScorers(){
  const box=document.getElementById('homeScorersBox');
  if(!box) return;
  box.innerHTML=spin();
  try{
    let d;
    try { d = await sa7('/tournament/17/top-players/scorers'); }
    catch(firstErr) { await wait(1400); d = await sa7('/tournament/17/top-players/scorers'); }
    box.innerHTML=renderMiniScorers(d,8);
  }catch(e){
    console.warn('Home top scorers unavailable:', e);
    box.innerHTML=emptyBox('Top scorers temporarily unavailable.');
  }
}

// ══════════════════════════════════════════════════════
// SCORES PAGE
// Endpoints: /sport/{sport}/events/live
// ══════════════════════════════════════════════════════
function bootScores(){ loadScores(); }

function filterScoresSport(el,s){
  document.querySelectorAll('#scoresSportFilter .sport-pill').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); SCORES_SPORT=s; loadScores();
}

async function loadScores(){
  const box=document.getElementById('scoresBox');
  if(!box) return;
  box.innerHTML=spin();
  try{
    const liveD=await sa7(`/sport/${SCORES_SPORT}/events/live`);
    const liveEvents=liveD.events||[];
    let scheduledEvents=[];
    try{
      await wait(250);
      const schedD=await sa7(`/sport/${SCORES_SPORT}/scheduled-events/${today()}`);
      scheduledEvents=schedD.events||[];
    }catch(scheduleErr){ console.warn('Scheduled score games unavailable:', scheduleErr); }

    const seen=new Set();
    const evs=[...liveEvents, ...scheduledEvents]
      .filter(ev=>{
        if(!ev || seen.has(ev.id)) return false;
        seen.add(ev.id);
        const st=parseEventStatus(ev);
        return st.isLive || (!st.isFinished && !st.isHT);
      })
      .sort((a,b)=>(a.startTimestamp||0)-(b.startTimestamp||0));

    const badge=document.getElementById('scoresLiveBadge');
    if(badge) badge.innerHTML=liveEvents.length?`<div style="color:var(--red);font-size:.8rem;font-weight:700">● ${liveEvents.length} Live</div>`:'';
    if(!evs.length){ box.innerHTML=emptyBox(`No ${SCORES_SPORT} games found for today.`); return; }
    box.innerHTML=groupMatchesHTML(evs);
  }catch(e){ box.innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// SCHEDULE PAGE
// Endpoints:
//   /sport/{sport}/scheduled-events/{date}
//   /sport/{sport}/scheduled-events/{date}/inverse  (results)
// ══════════════════════════════════════════════════════
function bootSchedule(){ updateDateDisplay(); loadSchedule(); }

function filterSchedSport(el,s){
  document.querySelectorAll('#schedSportFilter .sport-pill').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); SCHED_SPORT=s; loadSchedule();
}

function setSchedMode(el,mode){
  document.getElementById('btnUpcoming')?.classList.toggle('active',mode==='scheduled');
  document.getElementById('btnResults')?.classList.toggle('active',mode==='results');
  SCHED_MODE=mode; loadSchedule();
}

function shiftDate(delta){
  const d=new Date(SCHED_DATE+'T00:00:00'); d.setDate(d.getDate()+delta);
  SCHED_DATE=today2(d); updateDateDisplay(); loadSchedule();
}

function goToday(){ SCHED_DATE=today(); updateDateDisplay(); loadSchedule(); }

function updateDateDisplay(){
  const el=document.getElementById('dateDisplay');
  if(el) el.textContent=new Date(SCHED_DATE+'T00:00:00').toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'});
  document.getElementById('todayBtn')?.classList.toggle('active',SCHED_DATE===today());
}

async function loadSchedule(){
  const box=document.getElementById('schedBox');
  if(!box) return;
  box.innerHTML=spin();
  // Results = inverse endpoint  |  Upcoming = normal endpoint
  const ep=SCHED_MODE==='results'
    ?`/sport/${SCHED_SPORT}/scheduled-events/${SCHED_DATE}/inverse`
    :`/sport/${SCHED_SPORT}/scheduled-events/${SCHED_DATE}`;
  const sub=document.getElementById('schedSubTitle');
  if(sub) sub.textContent=`${new Date(SCHED_DATE+'T00:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric'})} — ${SCHED_SPORT} ${SCHED_MODE==='results'?'Results':'Fixtures'}`;
  try{
    const d=await sa7(ep);
    const evs=d.events||[];
    if(!evs.length){ box.innerHTML=emptyBox(`No ${SCHED_SPORT} fixtures on ${SCHED_DATE}.`); return; }
    box.innerHTML=groupMatchesHTML(evs);
  }catch(e){ box.innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// TRANSFERS PAGE
// Endpoint: GET /transfer
// ══════════════════════════════════════════════════════
function bootTransfers(){ if(ALL_TRANSFERS.length){ renderTransfers(); return; } loadTransfers(); }

async function loadTransfers(){
  const box=document.getElementById('transferBox');
  if(box) box.innerHTML=spin();
  try{
    // GET /api/v1/transfer
    const d=await sa7('/transfer');
    // Response shape: { transferNews: [...] } or { transfers: [...] } or array
    let list=[];
    if(Array.isArray(d))                               list=d;
    else if(d.transferNews&&Array.isArray(d.transferNews)) list=d.transferNews;
    else if(d.transfers&&Array.isArray(d.transfers))   list=d.transfers;
    else if(d.data&&Array.isArray(d.data))             list=d.data;
    else { const found=Object.values(d).find(v=>Array.isArray(v)&&v.length>0); list=found||[]; }
    ALL_TRANSFERS=list;
    const b=document.getElementById('transferCountBadge');
    if(b) b.textContent=list.length?list.length+' deals':'';
    renderTransfers();
  }catch(e){ if(box) box.innerHTML=errBox(e); }
}

function filterTransfers(el,f){
  document.querySelectorAll('#transferFilter .filter-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); TRANSFER_FILTER=f; renderTransfers();
}

function getTransferType(t){
  const raw=String(t.transferType??t.type??t.transfer_type??t.transferTypeId??t.transferNewsType??t.newsType??'').toLowerCase();
  if(raw.includes('loan')||raw==='2') return 'loan';
  if(raw.includes('end')||raw.includes('free')||raw.includes('contract')||raw==='3') return 'free';
  return 'permanent';
}

function renderTransfers(){
  const box=document.getElementById('transferBox');
  if(!box) return;
  let list=ALL_TRANSFERS;
  if(TRANSFER_FILTER!=='all') list=ALL_TRANSFERS.filter(t=>getTransferType(t)===TRANSFER_FILTER);
  if(!list.length){ box.innerHTML=emptyBox('No transfers to display.'); return; }
  let h='';
  list.slice(0,60).forEach(t=>{
    const type=getTransferType(t);
    const player=t.player||t.athlete||{};
    const pName=player.name||player.shortName||player.fullName||t.playerName||t.name||'Unknown';
    const pPhoto=player.photo||player.image||t.playerImage||'';
    const fromTeam=t.fromTeam||t.from||t.fromClub||{};
    const toTeam=t.toTeam||t.to||t.toClub||{};
    const fromName=fromTeam.name||fromTeam.shortName||'—';
    const toName=toTeam.name||toTeam.shortName||'—';
    const fromLogo=fromTeam.image||fromTeam.logo||'';
    const toLogo=toTeam.image||toTeam.logo||'';
    const fee=t.fee||t.transferFee||t.value||'';
    const feeStr=fee&&fee!=='0'?(typeof fee==='number'?'€'+Number(fee).toLocaleString():fee):(type==='free'?'Free':'');
    const dateDisp=fmtDate(t.date||t.transferDate||t.timestamp||0);
    const chip=(logo,name)=>`<div class="club-chip">${logo?`<img class="club-chip-logo" src="${logo}" alt="" onerror="this.style.display='none'">`:''}
      <span class="club-chip-name">${name}</span></div>`;
    const pPhotoEl=pPhoto
      ?`<img class="tr-photo" src="${pPhoto}" alt="${pName}" onerror="this.outerHTML='<div class=\\"tr-photo\\" style=\\"display:flex;align-items:center;justify-content:center;font-size:1.2rem\\">👤</div>'">`
      :`<div class="tr-photo" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem">👤</div>`;
    h+=`<div class="transfer-card">
      <div class="tr-bar ${type}"></div>
      <div class="tr-body">
        <div class="tr-player">${pPhotoEl}<span class="tr-pname">${pName}</span></div>
        <div class="tr-clubs">${chip(fromLogo,fromName)}<span class="tr-arrow">→</span>${chip(toLogo,toName)}</div>
        <div class="tr-meta">
          <span class="tr-badge ${type}">${type==='permanent'?'✅ Transfer':type==='loan'?'🔄 Loan':'📋 Free'}</span>
          ${feeStr?`<span class="tr-fee">💰 ${feeStr}</span>`:''}
          ${dateDisp?`<span class="tr-date">🗓 ${dateDisp}</span>`:''}
        </div>
      </div>
    </div>`;
  });
  box.innerHTML=h||emptyBox('No transfers found.');
}

// ══════════════════════════════════════════════════════
// STANDINGS PAGE
// Endpoints: /tournament/{id}/standings/total
//            /tournament/17/top-players/scorers
// ══════════════════════════════════════════════════════
function bootStandings(){
  // Directly load EPL standings (default active pill) — .click() won't fire onclick on a <div>
  const activePill = document.querySelector('#standingsLeagueFilter .sport-pill.active');
  if(activePill){
    // Parse id and name from the onclick attribute
    const onclickAttr = activePill.getAttribute('onclick') || '';
    const match = onclickAttr.match(/loadStandings\(this,(\d+),'([^']+)'\)/);
    if(match) loadStandings(activePill, parseInt(match[1]), match[2]);
  } else {
    loadStandings(document.querySelector('#standingsLeagueFilter .sport-pill'), 17, 'Premier League');
  }
  loadStandScorers();
}

async function loadStandings(el,tid,name){
  document.querySelectorAll('#standingsLeagueFilter .sport-pill').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const box=document.getElementById('standingsBox');
  if(!box) return;
  box.innerHTML=spin();
  try{
    const d=await sa7(`/tournament/${tid}/standings/total`);
    const rows=d.standings?.[0]?.rows||d.standings||[];
    if(!rows.length) throw new Error('No standings data');
    let h=`<h3 style="font-family:var(--fd);font-size:1.4rem;font-weight:800;color:var(--white);margin-bottom:1rem;letter-spacing:-0.5px">${name} <span style="color:var(--amber)">Table</span></h3>`;
    h+=renderFullStandings(rows);
    box.innerHTML=h;
  }catch(e){ box.innerHTML=errBox(e); }
}

async function loadStandScorers(){
  const box=document.getElementById('standScorersBox');
  if(!box) return;
  box.innerHTML=spin();
  try{
    const d=await sa7('/tournament/17/top-players/scorers');
    box.innerHTML=renderMiniScorers(d,8);
  }catch(e){ box.innerHTML=`<div style="font-size:.75rem;color:#fca5a5;padding:.5rem;text-align:center">Unavailable</div>`; }
}

// ══════════════════════════════════════════════════════
// RANKINGS PAGE
// Endpoints:
//   /rankings/sport/{sport}/summary  — get ranking types
//   /rankings/{id}                   — get entries for a type
//   /rankings/{id}/{year}            — historical
//   /rankings/type/{id}              — by type id
//   /rankings/team/{id}              — team ranking
//   /rankings/unique-tournament/{id}/summary
// ══════════════════════════════════════════════════════
function bootRankings(){
  const activePill = document.querySelector('#rankingsCatFilter .sport-pill.active');
  if(activePill){
    const onclickAttr = activePill.getAttribute('onclick') || '';
    const match = onclickAttr.match(/loadRankings\(this,'([^']+)'\)/);
    if(match) loadRankings(activePill, match[1]);
  } else {
    loadRankings(document.querySelector('#rankingsCatFilter .sport-pill'), 'football');
  }
}

async function loadRankings(el,sport,gender=1){
  document.querySelectorAll('#rankingsCatFilter .sport-pill').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const box=document.getElementById('rankingsBox');
  if(!box) return;
  box.innerHTML=spin();
  try{
    // GET /rankings/sport/{sport}/summary — lists all ranking types for the sport
    const d=await sa7(`/rankings/sport/${sport}/summary`);
    const types=d.rankingTypes||d.rankings||[];
    if(!types.length){ box.innerHTML=emptyBox('No ranking data for this sport.'); return; }
    // Build type selector
    let h=`<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem" id="rankTypeBar">`;
    types.slice(0,8).forEach((rt,i)=>{
      const rid=rt.id||rt.rankingTypeId||0;
      h+=`<button class="filter-btn${i===0?' active':''}" onclick="loadRankingById(${rid},this)">${rt.name||rt.title||'Ranking'}</button>`;
    });
    h+=`</div><div id="rankingTableWrap">${spin()}</div>`;
    box.innerHTML=h;
    // Load first type automatically
    const firstId=types[0]?.id||types[0]?.rankingTypeId||0;
    if(firstId) loadRankingById(firstId,box.querySelector('.filter-btn'));
  }catch(e){ box.innerHTML=errBox(e); }
}

async function loadRankingById(rid,btn){
  const wrap=document.getElementById('rankingTableWrap');
  if(!wrap) return;
  if(btn){
    btn.closest('#rankTypeBar,#rankingsBox')?.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
  wrap.innerHTML=spin();
  try{
    // GET /rankings/{id} — entries for this ranking type
    const d=await sa7(`/rankings/${rid}`);
    wrap.innerHTML=renderRankingTable(d.rankings||d.rows||d.entries||[]);
  }catch(e){ wrap.innerHTML=errBox(e); }
}

function renderRankingTable(entries){
  if(!entries.length) return emptyBox('No ranking entries available.');
  let h=`<div class="rk-table">
    <div class="rk-head">
      <span style="min-width:34px">#</span>
      <span style="flex:1">Name</span>
      <span style="min-width:80px">Country</span>
      <span style="min-width:60px;text-align:right">Points</span>
    </div>`;
  entries.slice(0,50).forEach(e=>{
    const pos=e.ranking||e.position||e.rank||'';
    const name=e.player?.name||e.team?.name||e.name||'—';
    const country=e.player?.country?.name||e.country?.name||'';
    const pts=e.points||e.value||'—';
    const photo=e.player?.image||e.team?.image||'';
    const id=e.player?.id||e.team?.id||0;
    const clickFn=e.player?.id?`openPlayerModal(${id})`:`openTeamModal(${id})`;
    h+=`<div class="rk-row" onclick="${clickFn}">
      <span class="rk-pos${pos<=3?' top3':''}">${pos}</span>
      ${photo?`<img class="rk-photo" src="${photo}" alt="" onerror="this.style.display='none'">` : ''}
      <span class="rk-name">${name}</span>
      <span class="rk-country">${country}</span>
      <span class="rk-pts">${pts}</span>
    </div>`;
  });
  return h+'</div>';
}

// ══════════════════════════════════════════════════════
// CALENDAR PAGE
// Endpoints:
//   /calendar/{year-month}/0/{sport}/unique-tournaments
//   /sport/{sport}/scheduled-events/{date}
//   /sport/{sport}/categories
//   /category/{id}/unique-tournaments
// ══════════════════════════════════════════════════════
function bootCalendar(){ renderCalendar(); loadTV(); }

function filterCalSport(el,s){
  document.querySelectorAll('#calSportFilter .sport-pill').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); CAL_SPORT=s; renderCalendar();
}

function shiftCal(delta){
  CAL_DATE=new Date(CAL_DATE.getFullYear(),CAL_DATE.getMonth()+delta,1);
  updateCalDisplay(); renderCalendar();
}

function updateCalDisplay(){
  const el=document.getElementById('calMonthDisplay');
  if(el) el.textContent=CAL_DATE.toLocaleDateString('en-CA',{month:'long',year:'numeric'});
}

async function renderCalendar(){
  const grid=document.getElementById('calGrid');
  if(!grid) return;
  const yr=CAL_DATE.getFullYear();
  const mo=String(CAL_DATE.getMonth()+1).padStart(2,'0');
  const monthStr=`${yr}-${mo}`;
  grid.innerHTML=spin();
  try{
    // GET /calendar/{year-month}/0/{sport}/unique-tournaments
    const d=await sa7(`/calendar/${monthStr}/0/${CAL_SPORT}/unique-tournaments`);
    const tournaments=d.uniqueTournaments||d.tournaments||[];
    // Build day → tournaments map
    const dayMap={};
    tournaments.forEach(t=>{
      (t.dates||[]).forEach(dateStr=>{
        if(!dayMap[dateStr]) dayMap[dateStr]=[];
        dayMap[dateStr].push(t);
      });
    });
    const firstDay=new Date(yr,CAL_DATE.getMonth(),1).getDay();
    const daysInMonth=new Date(yr,CAL_DATE.getMonth()+1,0).getDate();
    const todayStr=today();
    let h='<div class="cal-grid">';
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(day=>{ h+=`<div class="cal-day-hd">${day}</div>`; });
    for(let i=0;i<firstDay;i++) h+=`<div class="cal-day other"></div>`;
    for(let day=1;day<=daysInMonth;day++){
      const dk=`${yr}-${mo}-${String(day).padStart(2,'0')}`;
      const evs=dayMap[dk]||[];
      const isToday=dk===todayStr;
      const dots=evs.slice(0,4).map(()=>`<span class="cal-dot"></span>`).join('');
      h+=`<div class="cal-day${evs.length?' has-ev':''}${isToday?' today':''}" id="calDay-${dk}" onclick="selectCalDay('${dk}')">
        <div class="cal-dnum">${day}</div>
        <div class="cal-dots">${dots}</div>
      </div>`;
    }
    h+='</div>';
    grid.innerHTML=h;
    showCalDay(todayStr);
  }catch(e){ grid.innerHTML=errBox(e); }
}

function selectCalDay(dk){
  document.querySelectorAll('.cal-day.selected').forEach(d=>d.classList.remove('selected'));
  document.getElementById('calDay-'+dk)?.classList.add('selected');
  showCalDay(dk);
}

async function showCalDay(dateKey){
  const evBox=document.getElementById('calEvents');
  if(!evBox) return;
  evBox.innerHTML=spin();
  try{
    // GET /sport/{sport}/scheduled-events/{date}
    const d=await sa7(`/sport/${CAL_SPORT}/scheduled-events/${dateKey}`);
    const evs=d.events||[];
    if(!evs.length){ evBox.innerHTML=emptyBox(`No ${CAL_SPORT} events on ${dateKey}.`); return; }
    evBox.innerHTML=`<div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--amber);margin-bottom:.7rem">${dateKey} — ${evs.length} events</div>`+groupMatchesHTML(evs);
  }catch(e){ evBox.innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// TV LISTINGS
// Endpoints:
//   /tv/country/CA/channels          — Canadian channels (default)
//   /tv/event/{id}/country-channels  — channels for a specific event
//   /tv/channel/{channelId}/event/{eventId}/votes
// ══════════════════════════════════════════════════════
async function loadTV(){
  const box=document.getElementById('tvBox');
  if(!box) return;
  box.innerHTML=spin();
  try{
    // GET /tv/country/CA/channels
    const d=await sa7('/tv/country/CA/channels');
    const channels=d.channels||d.tvChannels||[];
    if(!channels.length){ box.innerHTML=emptyBox('No TV listings.'); return; }
    let h='';
    channels.slice(0,20).forEach(ch=>{
      const name=ch.name||ch.channelName||'Channel';
      const logo=ch.logo||ch.image||'';
      const country=ch.country?.name||'';
      h+=`<div class="tv-row">
        ${logo?`<img class="tv-logo" src="${logo}" alt="${name}" onerror="this.outerHTML='<div class=\\"tv-logo-ph\\">📺</div>'">`:`<div class="tv-logo-ph">📺</div>`}
        <div><div class="tv-name">${name}</div>${country?`<div class="tv-country">${country}</div>`:''}</div>
      </div>`;
    });
    box.innerHTML=h;
  }catch(e){ box.innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// GLOBAL SEARCH
// Endpoints:
//   /search/suggest/{query}          — typeahead dropdown
//   /search/{query}/{page}           — full search results
//   /search/players/{query}/more
//   /search/teams/{query}/more
//   /search/referees/{query}/{more}
//   /search/managers/{query}/{more}
//   /search/unique-tournaments/{query}/{more}
// ══════════════════════════════════════════════════════
let _searchTimer=null;

function onSearchInput(val){
  clearTimeout(_searchTimer);
  if(val.length<2){ closeSearch(); return; }
  _searchTimer=setTimeout(()=>doSearch(val),300);
}
function openSearch(){ document.getElementById('searchDropdown')?.classList.add('open'); }
function closeSearch(){ document.getElementById('searchDropdown')?.classList.remove('open'); }

async function doSearch(query){
  const box=document.getElementById('searchDropdown');
  box.innerHTML='<div class="sd-empty">Searching…</div>';
  openSearch();
  try{
    // GET /search/suggest/{query} — fast typeahead
    const d=await sa7(`/search/suggest/${encodeURIComponent(query)}`);
    const r=d.results||d.suggestions||d||{};
    const players=(r.players||[]).slice(0,4);
    const teams=(r.teams||[]).slice(0,4);
    const leagues=(r.uniqueTournaments||r.tournaments||[]).slice(0,3);
    const refs=(r.referees||[]).slice(0,2);
    const mgrs=(r.managers||[]).slice(0,2);
    if(!players.length&&!teams.length&&!leagues.length&&!refs.length&&!mgrs.length){
      box.innerHTML='<div class="sd-empty">No results found.</div>'; return;
    }
    let h='';
    const sdSection=(label)=>`<div class="sd-section">${label}</div>`;
    const sdItem=(img,name,sub,onclick)=>`<div class="sd-item" onclick="${onclick};closeSearch()">
      <div class="sd-item-img">${img}</div>
      <div><div class="sd-item-name">${name}</div><div class="sd-item-sub">${sub}</div></div>
    </div>`;
    if(players.length){
      h+=sdSection('Players');
      players.forEach(p=>{ h+=sdItem(p.image?`<img class="sd-item-img" src="${p.image}" alt="" onerror="this.style.display='none'">`:'👤', p.name||'—', `${p.team?.name||''} · ${p.position||''}`, `openPlayerModal(${p.id||0})`); });
    }
    if(teams.length){
      h+=sdSection('Teams');
      teams.forEach(t=>{ h+=sdItem(t.image?`<img class="sd-item-img" src="${t.image}" alt="" onerror="this.style.display='none'">`:'🏟', t.name||'—', `${t.sport?.name||''} · ${t.country?.name||''}`, `openTeamModal(${t.id||0})`); });
    }
    if(leagues.length){
      h+=sdSection('Leagues');
      leagues.forEach(l=>{ h+=sdItem(l.image?`<img class="sd-item-img" src="${l.image}" alt="" onerror="this.style.display='none'">`:'🏆', l.name||'—', l.category?.name||'', `openTournModal(${l.id||0})`); });
    }
    if(refs.length){
      h+=sdSection('Referees');
      refs.forEach(r=>{ h+=sdItem('🟡', r.name||'—', r.country?.name||'', `openRefModal(${r.id||0})`); });
    }
    if(mgrs.length){
      h+=sdSection('Managers');
      mgrs.forEach(m=>{ h+=sdItem(m.image?`<img class="sd-item-img" src="${m.image}" alt="" onerror="this.style.display='none'">`:'👔', m.name||'—', m.team?.name||'', `openMgrModal(${m.id||0})`); });
    }
    h+=`<div class="sd-footer" onclick="fullSearch('${query.replace(/'/g,"\\'")}');closeSearch()">View all results for "${query}" →</div>`;
    box.innerHTML=h;
  }catch(e){ box.innerHTML=`<div class="sd-empty">Search error: ${e.message}</div>`; }
}

async function fullSearch(query){
  navigate('search');
  document.getElementById('searchPageQuery').textContent=query;
  const box=document.getElementById('searchPageBox');
  if(!box) return;
  box.innerHTML=spin();
  try{
    // GET /search/{query}/{page}
    const d=await sa7(`/search/${encodeURIComponent(query)}/0`);
    SEARCH_RESULTS_DATA=d.results||d||{};
    document.querySelector('#searchTypeFilter .filter-btn.active')?.click() || filterSearchType({classList:{add:()=>{},remove:()=>{}}},'all');
    renderSearchResults();
  }catch(e){ box.innerHTML=errBox(e); }
}

function filterSearchType(el,type){
  document.querySelectorAll('#searchTypeFilter .filter-btn').forEach(b=>b.classList.remove('active'));
  el.classList?.add('active');
  SEARCH_TYPE=type;
  renderSearchResults();
}

function renderSearchResults(){
  const box=document.getElementById('searchPageBox');
  if(!box) return;
  const d=SEARCH_RESULTS_DATA;
  const showAll=SEARCH_TYPE==='all';
  const players=showAll||SEARCH_TYPE==='players'?d.players||[]:[];
  const teams=showAll||SEARCH_TYPE==='teams'?d.teams||[]:[];
  const leagues=showAll||SEARCH_TYPE==='tournaments'?d.uniqueTournaments||d.tournaments||[]:[];
  const refs=showAll||SEARCH_TYPE==='referees'?d.referees||[]:[];
  const mgrs=showAll||SEARCH_TYPE==='managers'?d.managers||[]:[];

  function section(title,items,buildFn){
    if(!items.length) return '';
    return `<div style="margin-bottom:1.5rem"><div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--amber);margin-bottom:.6rem">${title}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.6rem">${items.map(buildFn).join('')}</div></div>`;
  }

  const resultCard=(photo,name,sub,onclick)=>`<div class="result-card" onclick="${onclick}">
    ${photo?`<img class="result-photo" src="${photo}" alt="" onerror="this.style.display='none'">`:`<div class="result-photo" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem">👤</div>`}
    <div><div class="result-name">${name}</div><div class="result-sub">${sub}</div></div>
  </div>`;

  let h=section('Players',players,p=>resultCard(p.image,p.name||'—',`${p.team?.name||''} · ${p.position||''}`,`openPlayerModal(${p.id||0})`))
    +section('Teams',teams,t=>resultCard(t.image,t.name||'—',`${t.sport?.name||''} · ${t.country?.name||''}`,`openTeamModal(${t.id||0})`))
    +section('Leagues',leagues,l=>resultCard(l.image,l.name||'—',l.category?.name||'',`openTournModal(${l.id||0})`))
    +section('Referees',refs,r=>`<div class="result-card" onclick="openRefModal(${r.id||0})"><div class="result-photo" style="display:flex;align-items:center;justify-content:center;background:rgba(245,158,11,.08);font-size:1.2rem">🟡</div><div><div class="result-name">${r.name||'—'}</div><div class="result-sub">${r.country?.name||''}</div></div></div>`)
    +section('Managers',mgrs,m=>resultCard(m.image,m.name||'—',m.team?.name||'',`openMgrModal(${m.id||0})`));
  box.innerHTML=h||emptyBox('No results found.');
}

// ══════════════════════════════════════════════════════
// TEAM MODAL
// Endpoints:
//   /team/{id}             — overview
//   /team/{id}/performance — stats
//   /team/{id}/players     — squad
//   /team/{id}/events/last/{page} — results
//   /team/{id}/career-statistics  — stats table
//   /team/{id}/transfers          — transfer history
//   /team/{id}/media              — media
//   /team/{id}/unique-tournaments — leagues played in
//   /team/{id}/rankings           — rankings
//   /team/{id}/standings/seasons  — season list
// ══════════════════════════════════════════════════════
function closeTeamModal(){ closeModal2('teamModal'); }
function openTmTab(btn,panelId){ tabSwitch('tm',panelId,btn,()=>lazyLoadTeamTab(panelId)); }

async function openTeamModal(teamId){
  if(!teamId) return;
  TEAM_ID=teamId; TEAM_DATA=null; TEAM_LOADED={};
  // clear lazy-load flags
  Object.keys(window).filter(k=>k.startsWith('_loaded_tm')).forEach(k=>delete window[k]);
  resetModal('teamModal');
  document.getElementById('teamName').textContent='Loading…';
  document.getElementById('teamSub').textContent='';
  document.getElementById('teamBadges').innerHTML='';
  document.getElementById('teamLogoPh').innerHTML='🏟';
  openModal('teamModal');
  loadTeamOverview();
}

async function loadTeamOverview(){
  try{
    // GET /team/{id}  +  GET /team/{id}/performance
    const [teamD,perfD]=await Promise.allSettled([
      sa7(`/team/${TEAM_ID}`),
      sa7(`/team/${TEAM_ID}/performance`)
    ]);
    const team=teamD.status==='fulfilled'?(teamD.value?.team||teamD.value):null;
    if(!team){ document.getElementById('tmOverview').innerHTML=emptyBox('Team not found.'); return; }
    TEAM_DATA=team;
    const name=team.name||'Team';
    const logo=team.image||team.logo||'';
    const sport=team.sport?.name||'';
    const country=team.country?.name||'';
    const venue=team.venue?.name||'';
    const founded=team.foundationDateTimestamp?new Date(team.foundationDateTimestamp*1000).getFullYear():'';
    document.getElementById('teamName').textContent=name;
    document.getElementById('teamSub').textContent=`${sport}${country?' · '+country:''}`;
    document.getElementById('teamLogoPh').innerHTML=logo?`<img class="mh-photo" src="${logo}" alt="${name}" onerror="this.outerHTML='<div class=\\"mh-photo-ph\\">🏟</div>'">`:'🏟';
    const badges=[venue&&`🏟 ${venue}`,founded&&`📅 Founded ${founded}`].filter(Boolean);
    document.getElementById('teamBadges').innerHTML=badges.map(b=>`<span class="mh-badge">${b}</span>`).join('');
    let h='<div class="info-table">';
    [['🏟 Venue',venue||'—'],['🌍 Country',country||'—'],['📅 Founded',founded||'—'],['⚽ Sport',sport||'—']].forEach(([l,v])=>{
      h+=`<div class="info-row"><span class="info-label">${l}</span><span class="info-value">${v}</span></div>`;
    });
    h+='</div>';
    if(perfD.status==='fulfilled'){
      const perf=perfD.value?.performance||perfD.value?.total||perfD.value||{};
      const stats=[['W',perf.wins??perf.total?.wins],['D',perf.draws??perf.total?.draws],['L',perf.losses??perf.total?.losses],['Goals',perf.goalsScored??perf.total?.goalsScored],['Conceded',perf.goalsConceded??perf.total?.goalsConceded]].filter(([,v])=>v!=null);
      if(stats.length){
        h+='<div class="stat-boxes">';
        stats.forEach(([l,v])=>{ h+=`<div class="stat-box"><div class="stat-box-v">${v}</div><div class="stat-box-l">${l}</div></div>`; });
        h+='</div>';
      }
    }
    document.getElementById('tmOverview').innerHTML=h;
  }catch(e){ document.getElementById('tmOverview').innerHTML=errBox(e); }
}

async function lazyLoadTeamTab(panelId){
  const el=document.getElementById(panelId);
  if(!el) return;
  try{
    if(panelId==='tmSquad'){
      // GET /team/{id}/players
      const d=await sa7(`/team/${TEAM_ID}/players`);
      const players=d.players||d.squad||[];
      if(!players.length){ el.innerHTML=emptyBox('Squad not available.'); return; }
      let h='<div class="squad-grid">';
      players.forEach(p=>{
        const pl=p.player||p;
        const photo=pl.image||pl.photo||'';
        h+=`<div class="squad-card" onclick="openPlayerModal(${pl.id||0})">
          ${photo?`<img class="sq-photo" src="${photo}" alt="" onerror="this.style.display='none'">`:`<div class="sq-photo" style="display:flex;align-items:center;justify-content:center;font-size:1.3rem;background:rgba(245,158,11,.08)">👤</div>`}
          <div class="sq-name">${pl.name||pl.shortName||'—'}</div>
          <div class="sq-pos">${p.position||pl.position||''}</div>
          ${p.shirtNumber?`<div class="sq-num">#${p.shirtNumber}</div>`:''}
        </div>`;
      });
      el.innerHTML=h+'</div>';
    }
    else if(panelId==='tmResults'){
      // GET /team/{id}/events/last/{page}
      const d=await sa7(`/team/${TEAM_ID}/events/last/0`);
      el.innerHTML=(d.events||[]).length?groupMatchesHTML(d.events):emptyBox('No recent results.');
    }
    else if(panelId==='tmStats'){
      // GET /team/{id}/career-statistics
      const d=await sa7(`/team/${TEAM_ID}/career-statistics`);
      const seasons=d.seasons||d.career||[];
      if(!seasons.length){ el.innerHTML=emptyBox('Stats not available.'); return; }
      let h='<div style="overflow-x:auto"><table class="career-table"><thead><tr>'+
        ['Season','Tournament','P','W','D','L','GF','GA'].map(h=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>';
      seasons.slice(0,20).forEach(s=>{
        const st=s.statistics||s;
        h+=`<tr><td style="color:var(--amber);font-weight:700">${s.year||s.seasonName||'—'}</td>
          <td>${s.uniqueTournament?.name||s.tournament?.name||'—'}</td>
          <td class="cnum">${st.matches||0}</td><td class="cnum">${st.wins||0}</td>
          <td class="cnum">${st.draws||0}</td><td class="cnum">${st.losses||0}</td>
          <td class="cnum">${st.goalsScored||0}</td><td class="cnum">${st.goalsConceded||0}</td></tr>`;
      });
      el.innerHTML=h+'</tbody></table></div>';
    }
    else if(panelId==='tmTransfers'){
      // GET /team/{id}/transfers
      const d=await sa7(`/team/${TEAM_ID}/transfers`);
      const transfers=d.transferHistory||d.transfers||[];
      if(!transfers.length){ el.innerHTML=emptyBox('No transfer data.'); return; }
      let h='';
      transfers.slice(0,30).forEach(t=>{
        const p=t.player||{}; const from=t.fromTeam||{}; const to=t.toTeam||{};
        const fee=t.fee?'€'+Number(t.fee).toLocaleString():'Free';
        const date=fmtDate(t.transferDate||t.date||0);
        h+=`<div class="ptr-row" onclick="openPlayerModal(${p.id||0})" style="cursor:pointer">
          <span class="ptr-date">${date}</span>
          <span class="ptr-club">${p.name||'—'}</span>
          <span style="font-size:.72rem;color:var(--text-muted)">${from.name||'?'} → ${to.name||'?'}</span>
          <span class="ptr-fee">${fee}</span>
        </div>`;
      });
      el.innerHTML=h;
    }
    else if(panelId==='tmMedia'){
      // GET /team/{id}/media
      const d=await sa7(`/team/${TEAM_ID}/media`);
      const items=d.media||d.videos||[];
      if(!items.length){ el.innerHTML=emptyBox('No media available.'); return; }
      el.innerHTML='<div class="media-grid">'+items.slice(0,12).map(m=>`<a class="media-card" href="${m.url||m.videoUrl||'#'}" target="_blank" rel="noopener">
        <div class="media-thumb">${m.thumbnailUrl||m.thumbnail||m.image?`<img src="${m.thumbnailUrl||m.thumbnail||m.image}" alt="" onerror="this.parentNode.innerHTML='🎬'">`:'🎬'}</div>
        <div class="media-title">${m.title||m.name||'Media'}</div>
      </a>`).join('')+'</div>';
    }
  }catch(e){ el.innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// REFEREE MODAL
// Endpoints:
//   /referee/{id}                — profile
//   /referee/{id}/statistics     — career stats
//   /referee/{id}/events/last/0  — recent games
// ══════════════════════════════════════════════════════
function closeRefModal(){ closeModal2('refModal'); }
function openRefTab(btn,panelId){ tabSwitch('rf',panelId,btn,()=>lazyLoadRefTab(panelId)); }

async function openRefModal(refId){
  if(!refId) return;
  REF_ID=refId; REF_LOADED={};
  Object.keys(window).filter(k=>k.startsWith('_loaded_rf')).forEach(k=>delete window[k]);
  resetModal('refModal');
  document.getElementById('refName').textContent='Loading…';
  document.getElementById('refSub').textContent='';
  document.getElementById('refPhotoPh').innerHTML='🟡';
  openModal('refModal');
  try{
    // GET /referee/{id}
    const d=await sa7(`/referee/${refId}`);
    const ref=d.referee||d;
    const name=ref.name||'Referee';
    const country=ref.country?.name||'';
    const photo=ref.image||ref.photo||'';
    document.getElementById('refName').textContent=name;
    document.getElementById('refSub').textContent=country;
    document.getElementById('refPhotoPh').innerHTML=photo?`<img class="mh-photo" src="${photo}" alt="${name}" onerror="this.outerHTML='<div class=\\"mh-photo-ph\\">🟡</div>'">`:'🟡';
    document.getElementById('rfOverview').innerHTML='<div class="info-table">'+
      [['🌍 Country',country||'—'],['🟡 Role','Referee']].map(([l,v])=>
        `<div class="info-row"><span class="info-label">${l}</span><span class="info-value">${v}</span></div>`
      ).join('')+'</div>';
  }catch(e){ document.getElementById('rfOverview').innerHTML=errBox(e); }
}

async function lazyLoadRefTab(panelId){
  const el=document.getElementById(panelId);
  if(!el) return;
  try{
    if(panelId==='rfStats'){
      // GET /referee/{id}/statistics
      const d=await sa7(`/referee/${REF_ID}/statistics`);
      el.innerHTML=renderStatsObj(d.statistics||d.stats||d);
    }
    else if(panelId==='rfGames'){
      // GET /referee/{id}/events/last/{page}
      const d=await sa7(`/referee/${REF_ID}/events/last/0`);
      el.innerHTML=(d.events||[]).length?groupMatchesHTML(d.events):emptyBox('No recent games.');
    }
  }catch(e){ el.innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// MANAGER MODAL
// Endpoints:
//   /manager/{id}                — profile
//   /manager/{id}/career-history — career
//   /manager/{id}/events/last/0  — recent games
// ══════════════════════════════════════════════════════
function closeMgrModal(){ closeModal2('mgrModal'); }
function openMgrTab(btn,panelId){ tabSwitch('mg',panelId,btn,()=>lazyLoadMgrTab(panelId)); }

async function openMgrModal(mgrId){
  if(!mgrId) return;
  MGR_ID=mgrId; MGR_LOADED={};
  Object.keys(window).filter(k=>k.startsWith('_loaded_mg')).forEach(k=>delete window[k]);
  resetModal('mgrModal');
  document.getElementById('mgrName').textContent='Loading…';
  document.getElementById('mgrSub').textContent='';
  document.getElementById('mgrPhotoPh').innerHTML='👔';
  openModal('mgrModal');
  try{
    // GET /manager/{id}
    const d=await sa7(`/manager/${mgrId}`);
    const mgr=d.manager||d;
    const name=mgr.name||'Manager';
    const team=mgr.team?.name||'';
    const country=mgr.country?.name||'';
    const photo=mgr.image||mgr.photo||'';
    document.getElementById('mgrName').textContent=name;
    document.getElementById('mgrSub').textContent=`${team?team+' · ':''}${country}`;
    document.getElementById('mgrPhotoPh').innerHTML=photo?`<img class="mh-photo" src="${photo}" alt="${name}" onerror="this.outerHTML='<div class=\\"mh-photo-ph\\">👔</div>'">`:'👔';
    document.getElementById('mgOverview').innerHTML='<div class="info-table">'+
      [['🏟 Club',team||'—'],['🌍 Nationality',country||'—']].map(([l,v])=>
        `<div class="info-row"><span class="info-label">${l}</span><span class="info-value">${v}</span></div>`
      ).join('')+'</div>';
  }catch(e){ document.getElementById('mgOverview').innerHTML=errBox(e); }
}

async function lazyLoadMgrTab(panelId){
  const el=document.getElementById(panelId);
  if(!el) return;
  try{
    if(panelId==='mgCareer'){
      // GET /manager/{id}/career-history
      const d=await sa7(`/manager/${MGR_ID}/career-history`);
      const history=d.managerHistory||d.career||d.history||[];
      if(!history.length){ el.innerHTML=emptyBox('No career history.'); return; }
      let h='';
      history.forEach(ch=>{
        const team=ch.team||{}; const logo=team.image||'';
        const from=fmtDate(ch.startTimestamp||ch.from||0);
        const to=ch.endTimestamp?fmtDate(ch.endTimestamp):'Present';
        h+=`<div class="ptr-row" onclick="openTeamModal(${team.id||0})" style="cursor:pointer">
          ${logo?`<img style="width:24px;height:24px;object-fit:contain;border-radius:50%" src="${logo}" alt="" onerror="this.style.display='none'">` : ''}
          <span style="flex:1;font-weight:600;color:var(--text)">${team.name||'—'}</span>
          <span style="font-size:.68rem;color:var(--text-muted)">${from} – ${to}</span>
        </div>`;
      });
      el.innerHTML=h;
    }
    else if(panelId==='mgGames'){
      // GET /manager/{id}/events/last/{page}
      const d=await sa7(`/manager/${MGR_ID}/events/last/0`);
      el.innerHTML=(d.events||[]).length?groupMatchesHTML(d.events):emptyBox('No recent games.');
    }
  }catch(e){ el.innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// TOURNAMENT MODAL
// Endpoints:
//   /unique-tournament/{id}                               — info
//   /unique-tournament/{id}/seasons                       — season list
//   /unique-tournament/{id}/season/{sid}/standings/total  — table
//   /unique-tournament/{id}/events/last/0                 — results
//   /unique-tournament/{id}/season/{sid}/top-players/overall/all
//   /unique-tournament/{id}/season/{sid}/cuptrees         — bracket
//   /unique-tournament/{id}/season/{sid}/groups           — groups
//   /unique-tournament/{id}/season/{sid}/teams            — teams
//   /unique-tournament/{id}/media                         — videos
//   /unique-tournament/{id}/season/{sid}/rounds           — rounds
//   /unique-tournament/{id}/season/{sid}/info             — extra info
// ══════════════════════════════════════════════════════
function closeTournModal(){ closeModal2('tournModal'); }
function openTournTab(btn,panelId){ tabSwitch('tn',panelId,btn,()=>lazyLoadTournTab(panelId)); }

async function openTournModal(tournId){
  if(!tournId) return;
  TOURN_ID=tournId; TOURN_DATA=null; TOURN_LOADED={};
  Object.keys(window).filter(k=>k.startsWith('_loaded_tn')).forEach(k=>delete window[k]);
  resetModal('tournModal');
  document.getElementById('tournName').textContent='Loading…';
  document.getElementById('tournSub').textContent='';
  document.getElementById('tournLogoPh').innerHTML='🏆';
  openModal('tournModal');
  try{
    // GET /unique-tournament/{id}
    const d=await sa7(`/unique-tournament/${tournId}`);
    const t=d.uniqueTournament||d;
    TOURN_DATA=t;
    const name=t.name||'Tournament';
    const logo=t.image||t.logo||'';
    const cat=t.category?.name||'';
    const sport=t.category?.sport?.name||'';
    document.getElementById('tournName').textContent=name;
    document.getElementById('tournSub').textContent=`${sport?sport+' · ':''}${cat}`;
    document.getElementById('tournLogoPh').innerHTML=logo?`<img class="mh-photo" src="${logo}" alt="${name}" onerror="this.outerHTML='<div class=\\"mh-photo-ph\\">🏆</div>'">`:'🏆';
    // GET /unique-tournament/{id}/seasons
    const seasonsD=await sa7(`/unique-tournament/${tournId}/seasons`);
    const seasons=seasonsD.seasons||[];
    const cur=seasons[0];
    if(cur) TOURN_DATA.currentSeasonId=cur.id;
    let h='<div class="info-table">'+
      [['⚽ Sport',sport||'—'],['📍 Category',cat||'—'],['📅 Current Season',cur?.year||cur?.name||'—']].map(([l,v])=>
        `<div class="info-row"><span class="info-label">${l}</span><span class="info-value">${v}</span></div>`
      ).join('')+'</div>';
    if(seasons.length>1){
      h+=`<div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);margin-bottom:.5rem">Seasons</div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">`;
      seasons.slice(0,8).forEach(s=>{
        h+=`<span style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:var(--amber);font-size:.68rem;padding:3px 8px;border-radius:4px;cursor:pointer" onclick="TOURN_DATA.currentSeasonId=${s.id};this.parentNode.querySelectorAll('span').forEach(x=>x.style.background='rgba(245,158,11,.08)');this.style.background='rgba(245,158,11,.25)'">${s.year||s.name||s.id}</span>`;
      });
      h+='</div>';
    }
    document.getElementById('tnOverview').innerHTML=h;
  }catch(e){ document.getElementById('tnOverview').innerHTML=errBox(e); }
}

async function lazyLoadTournTab(panelId){
  const el=document.getElementById(panelId);
  if(!el) return;
  const sid=TOURN_DATA?.currentSeasonId;
  try{
    if(panelId==='tnStandings'){
      if(!sid){ el.innerHTML=emptyBox('No season data.'); return; }
      // GET /unique-tournament/{id}/season/{sid}/standings/total
      const d=await sa7(`/unique-tournament/${TOURN_ID}/season/${sid}/standings/total`);
      el.innerHTML=renderFullStandings(d.standings?.[0]?.rows||[]);
    }
    else if(panelId==='tnResults'){
      // GET /unique-tournament/{id}/events/last/{page}
      const d=await sa7(`/unique-tournament/${TOURN_ID}/events/last/0`);
      el.innerHTML=(d.events||[]).length?groupMatchesHTML(d.events):emptyBox('No results.');
    }
    else if(panelId==='tnTopPlayers'){
      if(!sid){ el.innerHTML=emptyBox('No season data.'); return; }
      // GET /unique-tournament/{id}/season/{sid}/top-players/overall/all
      const d=await sa7(`/unique-tournament/${TOURN_ID}/season/${sid}/top-players/overall/all`);
      const cats=d.topPlayers||{};
      let h='';
      Object.entries(cats).slice(0,4).forEach(([cat,players])=>{
        h+=`<div style="margin-bottom:1.2rem"><div class="stat-group-title">${cat}</div><div class="bp-grid">`;
        (Array.isArray(players)?players:[]).slice(0,6).forEach(item=>{
          const p=item.player||item; const val=item.statistics?.goals||item.statistics?.assists||item.value||'';
          h+=`<div class="bp-card" onclick="openPlayerModal(${p.id||0})">
            ${p.image?`<img class="bp-photo" src="${p.image}" alt="" onerror="this.style.display='none'">`:`<div class="bp-photo-ph">👤</div>`}
            <div class="bp-name">${p.name||p.shortName||'—'}</div>
            <div class="bp-rating">${val}</div>
          </div>`;
        });
        h+='</div></div>';
      });
      el.innerHTML=h||emptyBox('No top player data.');
    }
    else if(panelId==='tnBracket'){
      if(!sid){ el.innerHTML=emptyBox('No season data.'); return; }
      try{
        // GET /unique-tournament/{id}/season/{sid}/cuptrees
        const d=await sa7(`/unique-tournament/${TOURN_ID}/season/${sid}/cuptrees`);
        const trees=d.cuptrees||d.cupTrees||[];
        el.innerHTML=trees.length?renderBracket(trees[0]):emptyBox('No bracket data.');
      }catch{
        // Fallback to groups: GET /unique-tournament/{id}/season/{sid}/groups
        const d=await sa7(`/unique-tournament/${TOURN_ID}/season/${sid}/groups`);
        const groups=d.groups||[];
        if(!groups.length){ el.innerHTML=emptyBox('No bracket or group data.'); return; }
        let h='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem">';
        groups.forEach(g=>{
          h+=`<div class="widget"><div class="widget-head"><div class="widget-title">${g.name||'Group'}</div></div><div class="widget-body">`;
          (g.rows||[]).forEach(r=>{ h+=`<div class="smi-row" onclick="openTeamModal(${r.team?.id||0})">
            <span class="smi-pos">${r.position||''}</span><span class="smi-name">${r.team?.name||'—'}</span><span class="smi-pts">${r.points||0}</span></div>`; });
          h+='</div></div>';
        });
        el.innerHTML=h+'</div>';
      }
    }
    else if(panelId==='tnTeams'){
      if(!sid){ el.innerHTML=emptyBox('No season data.'); return; }
      // GET /unique-tournament/{id}/season/{sid}/teams
      const d=await sa7(`/unique-tournament/${TOURN_ID}/season/${sid}/teams`);
      const teams=d.teams||[];
      if(!teams.length){ el.innerHTML=emptyBox('No teams data.'); return; }
      let h='<div class="squad-grid">';
      teams.forEach(t=>{
        h+=`<div class="squad-card" onclick="openTeamModal(${t.id||0})">
          ${t.image?`<img class="sq-photo" src="${t.image}" alt="" onerror="this.style.display='none'">`:`<div class="sq-photo" style="display:flex;align-items:center;justify-content:center;font-size:1rem">🏟</div>`}
          <div class="sq-name">${t.name||'—'}</div>
        </div>`;
      });
      el.innerHTML=h+'</div>';
    }
    else if(panelId==='tnMedia'){
      // GET /unique-tournament/{id}/media
      const d=await sa7(`/unique-tournament/${TOURN_ID}/media`);
      const items=d.media||d.videos||[];
      if(!items.length){ el.innerHTML=emptyBox('No media available.'); return; }
      el.innerHTML='<div class="media-grid">'+items.slice(0,12).map(m=>`<a class="media-card" href="${m.url||m.videoUrl||'#'}" target="_blank" rel="noopener">
        <div class="media-thumb">${m.thumbnailUrl||m.thumbnail?`<img src="${m.thumbnailUrl||m.thumbnail}" alt="" onerror="this.parentNode.innerHTML='🎬'">`:'🎬'}</div>
        <div class="media-title">${m.title||m.name||'Media'}</div>
      </a>`).join('')+'</div>';
    }
  }catch(e){ el.innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// SHARED RENDER HELPERS
// ══════════════════════════════════════════════════════
function groupMatchesHTML(evs){
  const groups={};
  evs.forEach(ev=>{
    const tid=ev.tournament?.uniqueTournament?.id||ev.tournament?.id||'other';
    const tName=ev.tournament?.name||ev.league?.name||'Other';
    if(!groups[tid]) groups[tid]={name:tName,events:[]};
    groups[tid].events.push(ev);
  });
  let html='';
  Object.values(groups).forEach(g=>{
    const gid='g'+Math.random().toString(36).slice(2,8);
    html+=`<div class="match-group">
      <div class="match-group-header" onclick="toggleGrp('${gid}')">
        <span class="mgh-name">${g.name}</span>
        <span class="mgh-count">${g.events.length}</span>
        <span class="mgh-toggle open" id="tog-${gid}">▾</span>
      </div>
      <div id="${gid}">`;
    g.events.forEach(ev=>{ html+=matchRowHTML(ev); });
    html+=`</div></div>`;
  });
  return html||emptyBox('No matches.');
}

function toggleGrp(id){
  const el=document.getElementById(id), tog=document.getElementById('tog-'+id);
  if(!el) return;
  const hidden=el.style.display==='none';
  el.style.display=hidden?'':'none';
  if(tog) tog.textContent=hidden?'▾':'▸';
}

function renderMiniStandings(d,limit=10){
  const rows=d.standings?.[0]?.rows||d.standings?.rows||d.rows||d.table||d.data?.standings?.[0]?.rows||d.data?.rows||[];
  if(!rows.length) return emptyBox('No standings data.');
  let h='';
  rows.slice(0,limit).forEach(r=>{
    h+=`<div class="smi-row" onclick="openTeamModal(${r.team?.id||0})">
      <span class="smi-pos">${r.position||0}</span>
      <span class="smi-name">${r.team?.name||'—'}</span>
      <span class="smi-pts">${r.points||0}</span>
    </div>`;
  });
  return h;
}

function renderMiniScorers(d,limit=8){
  const players=d.topPlayers||d.players||d.topScorers||d.data?.topPlayers||d.data?.players||[];
  if(!players.length) return emptyBox('No scorer data.');
  let h='';
  players.slice(0,limit).forEach((item,i)=>{
    const p=item.player||item;
    const s=(item.statistics||[])[0]||item;
    const goals=s.goals?.total??s.goals??item.goals??0;
    const photo=p.image||p.photo||'';
    h+=`<div class="scr-row" onclick="openPlayerModal(${p.id||0})">
      <span class="scr-rank">${i+1}</span>
      ${photo?`<img class="scr-photo" src="${photo}" alt="" onerror="this.style.display='none'">` : ''}
      <div class="scr-info">
        <div class="scr-name">${p.name||'—'}</div>
        <div class="scr-club">${s.team?.name||item.team?.name||''}</div>
      </div>
      <span class="scr-goals">${goals}</span>
    </div>`;
  });
  return h;
}

function renderFullStandings(rows){
  if(!rows.length) return emptyBox('No standings data.');
  let h=`<div class="st-table">
    <div class="st-head">
      <span class="st-pos">#</span>
      <span class="st-team-info" style="flex:1">Club</span>
      <span class="st-cell">P</span><span class="st-cell">W</span><span class="st-cell">D</span><span class="st-cell">L</span>
      <span class="st-gd">GD</span><span class="st-pts">Pts</span>
    </div>`;
  rows.forEach(r=>{
    const pos=r.position||0;
    const barColor=pos<=4?'var(--sky)':pos<=6?'var(--win)':pos>=18?'var(--loss)':'transparent';
    const gd=r.scoreDiffFormatted??((r.scoresFor||0)-(r.scoresAgainst||0));
    const gdStr=typeof gd==='number'&&gd>0?'+'+gd:gd;
    h+=`<div class="st-row" onclick="openTeamModal(${r.team?.id||0})">
      <div class="st-bar" style="background:${barColor}"></div>
      <span class="st-pos" style="padding-left:6px">${pos}</span>
      <div class="st-team-info">
        ${r.team?.image?`<img class="st-crest" src="${r.team.image}" alt="" onerror="this.style.display='none'">` : ''}
        <span class="st-tname">${r.team?.name||'—'}</span>
      </div>
      <span class="st-cell">${r.matches||0}</span>
      <span class="st-cell">${r.wins||0}</span>
      <span class="st-cell">${r.draws||0}</span>
      <span class="st-cell">${r.losses||0}</span>
      <span class="st-gd">${gdStr}</span>
      <span class="st-pts">${r.points||0}</span>
    </div>`;
  });
  return h+'</div>';
}

function renderBracket(tree){
  const rounds=tree.rounds||[];
  if(!rounds.length) return emptyBox('Bracket data not available.');
  let h='<div class="bracket-scroll"><div class="bracket">';
  rounds.forEach(round=>{
    h+=`<div class="bracket-round"><div class="bracket-round-lbl">${round.name||'Round'}</div>`;
    (round.matchups||round.matches||[]).forEach(m=>{
      const h1=m.home||m.team1||{}, h2=m.away||m.team2||{};
      const s1=m.homeScore||m.score1||'', s2=m.awayScore||m.score2||'';
      h+=`<div class="bracket-match" onclick="if(${m.id||0})openEventModal(${m.id||0})">
        <div class="bracket-team"><span class="bracket-tname">${h1.name||h1.shortName||'TBD'}</span><span class="bracket-tscore">${s1}</span></div>
        <div class="bracket-team"><span class="bracket-tname">${h2.name||h2.shortName||'TBD'}</span><span class="bracket-tscore">${s2}</span></div>
      </div>`;
    });
    h+='</div>';
  });
  return h+'</div></div>';
}

function renderStatsObj(stats){
  if(!stats||typeof stats!=='object') return emptyBox('No statistics available.');
  const entries=Object.entries(stats).filter(([,v])=>typeof v==='number'||typeof v==='string');
  if(!entries.length) return emptyBox('No statistics available.');
  let h='<div class="stat-boxes">';
  entries.slice(0,20).forEach(([key,val])=>{
    const label=key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()).trim();
    h+=`<div class="stat-box"><div class="stat-box-v">${typeof val==='number'&&val%1!==0?val.toFixed(1):val}</div><div class="stat-box-l">${label}</div></div>`;
  });
  return h+'</div>';
}

function updateTicker(evs){
  if(!evs.length) return;
  let s='';
  evs.slice(0,14).forEach(ev=>{
    const hN=ev.homeTeam?.name||'Home', aN=ev.awayTeam?.name||'Away';
    const hG=ev.homeScore?.current??'—', aG=ev.awayScore?.current??'—';
    const min=ev.status?.description?' '+ev.status.description:'';
    s+=`<span class="ticker-item">⚽ ${hN} ${hG}–${aG} ${aN}${min} <span class="ticker-dot"></span></span>`;
  });
  document.getElementById('ticker').innerHTML=s+s;
}

// ══════════════════════════════════════════════════════
// LEAGUE PAGES
// Endpoints used: /sport/football/scheduled-events/{date}
//                 /sport/football/scheduled-events/{date}/inverse
//                 /sport/football/events/live
//                 /tournament/{id}/standings/total
//                 /tournament/{id}/top-players/scorers
//                 /unique-tournament/{id}/events/next/0  (fallback)
//                 /unique-tournament/{id}/events/last/0  (fallback)
// ══════════════════════════════════════════════════════

const LEAGUE_CONFIGS = {
  epl:        { id: 17,  name: 'Premier League',   flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  laliga:     { id: 8,   name: 'La Liga',          flag: '🇪🇸' },
  bundesliga: { id: 35,  name: 'Bundesliga',       flag: '🇩🇪' },
  seriea:     { id: 23,  name: 'Serie A',          flag: '🇮🇹' },
  ligue1:     { id: 34,  name: 'Ligue 1',          flag: '🇫🇷' },
  ucl:        { id: 7,   name: 'Champions League', flag: '🏆' },
  mls:        { id: 242, name: 'MLS',              flag: '🇺🇸' },
};

let CURRENT_LEAGUE = 'epl';
let LEAGUE_DATE    = today();
let LEAGUE_MODE    = 'scheduled';

function bootLeaguePage(key){
  const config = LEAGUE_CONFIGS[key];
  if(!config) return;
  CURRENT_LEAGUE = key;
  LEAGUE_DATE = today();
  LEAGUE_MODE = 'scheduled';

  // Header title
  const titleEl = document.getElementById('leaguePageTitle');
  if(titleEl){
    const parts = config.name.split(' ');
    titleEl.innerHTML = parts.length > 1
      ? parts[0]+' <span>'+parts.slice(1).join(' ')+'</span>'
      : config.flag+' <span>'+config.name+'</span>';
  }

  // Topbar
  const tb = document.getElementById('topbarTitle');
  if(tb) tb.innerHTML = config.flag+' <span>'+config.name+'</span>';

  // Reset mode buttons
  document.getElementById('leagueBtnUpcoming')?.classList.add('active');
  document.getElementById('leagueBtnResults')?.classList.remove('active');
  updateLeagueDateDisplay();

  // Load all three sections
  loadLeagueFixtures(config.id);
  setTimeout(()=>loadLeagueStandings(config.id), 900);
  setTimeout(()=>loadLeagueScorers(config.id), 1700);
}

function updateLeagueDateDisplay(){
  const el = document.getElementById('leagueDateDisplay');
  if(el) el.textContent = new Date(LEAGUE_DATE+'T00:00:00').toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'});
  document.getElementById('leagueTodayBtn')?.classList.toggle('active', LEAGUE_DATE===today());
}

function shiftLeagueDate(delta){
  const d = new Date(LEAGUE_DATE+'T00:00:00');
  d.setDate(d.getDate()+delta);
  LEAGUE_DATE = today2(d);
  updateLeagueDateDisplay();
  const cfg = LEAGUE_CONFIGS[CURRENT_LEAGUE];
  if(cfg) loadLeagueFixtures(cfg.id);
}

function goLeagueToday(){
  LEAGUE_DATE = today();
  updateLeagueDateDisplay();
  const cfg = LEAGUE_CONFIGS[CURRENT_LEAGUE];
  if(cfg) loadLeagueFixtures(cfg.id);
}

function setLeagueMode(btn, mode){
  LEAGUE_MODE = mode;
  document.getElementById('leagueBtnUpcoming')?.classList.toggle('active', mode==='scheduled');
  document.getElementById('leagueBtnResults')?.classList.toggle('active', mode==='results');
  const cfg = LEAGUE_CONFIGS[CURRENT_LEAGUE];
  if(cfg) loadLeagueFixtures(cfg.id);
}

async function loadLeagueFixtures(tournId){
  const box = document.getElementById('leagueFixturesBox');
  if(!box) return;
  box.innerHTML = spin();
  try{
    const ep = LEAGUE_MODE==='results'
      ? `/sport/football/scheduled-events/${LEAGUE_DATE}/inverse`
      : `/sport/football/scheduled-events/${LEAGUE_DATE}`;

    const [mainD, liveD] = await Promise.allSettled([
      sa7(ep),
      LEAGUE_MODE==='scheduled' ? sa7('/sport/football/events/live') : Promise.resolve({events:[]})
    ]);

    const filterByTournament = evs => evs.filter(ev=>{
      const uid = ev.tournament?.uniqueTournament?.id;
      const tid = ev.tournament?.id;
      return uid===tournId || tid===tournId;
    });

    const mainEvents = filterByTournament(mainD.status==='fulfilled' ? mainD.value.events||[] : []);
    const liveEvents = filterByTournament(liveD.status==='fulfilled' ? liveD.value.events||[] : []);

    const seen = new Set();
    const evs = [...liveEvents, ...mainEvents].filter(ev=>{
      if(!ev || seen.has(ev.id)) return false;
      seen.add(ev.id); return true;
    }).sort((a,b)=>(a.startTimestamp||0)-(b.startTimestamp||0));

    if(!evs.length){
      // Fallback: use tournament-specific endpoints
      try{
        const fbEp = LEAGUE_MODE==='results'
          ? `/unique-tournament/${tournId}/events/last/0`
          : `/unique-tournament/${tournId}/events/next/0`;
        const fd = await sa7(fbEp);
        const fbEvs = fd.events||[];
        if(fbEvs.length){
          const label = LEAGUE_MODE==='results' ? 'Recent Results' : 'Next Fixtures';
          box.innerHTML = `<div class="league-fallback-label">${label}</div>`+groupMatchesHTML(fbEvs.slice(0,10));
          return;
        }
      }catch(fe){}
      box.innerHTML = emptyBox(`No fixtures for ${LEAGUE_DATE}.`);
      return;
    }
    box.innerHTML = groupMatchesHTML(evs);
  }catch(e){ box.innerHTML = errBox(e); }
}

async function loadLeagueStandings(tournId){
  const box = document.getElementById('leagueStandBox');
  if(!box) return;
  box.innerHTML = spin();
  try{
    let d;
    try{ d = await sa7(`/tournament/${tournId}/standings/total`); }
    catch(e){ await wait(1200); d = await sa7(`/tournament/${tournId}/standings/total`); }
    box.innerHTML = renderMiniStandings(d, 10);
  }catch(e){ box.innerHTML = emptyBox('Standings temporarily unavailable.'); }
}

async function loadLeagueScorers(tournId){
  const box = document.getElementById('leagueScorersBox');
  if(!box) return;
  box.innerHTML = spin();
  try{
    let d;
    try{ d = await sa7(`/tournament/${tournId}/top-players/scorers`); }
    catch(e){ await wait(1400); d = await sa7(`/tournament/${tournId}/top-players/scorers`); }
    box.innerHTML = renderMiniScorers(d, 8);
  }catch(e){ box.innerHTML = emptyBox('Top scorers temporarily unavailable.'); }
}

// ══════════════════════════════════════════════════════
// HIGHLIGHTS PAGE — YouTube RSS via CORS proxy
// Channels: Sky Sports PL · TNT Sports · MLS · DAZN Football
// Uses allorigins.win (fallback: corsproxy.io) — no API key needed
// ══════════════════════════════════════════════════════

const YT_CHANNELS = {
  skysports: { id:'UCNAf1k0yIjyGu3k9BwAg3lg', name:'Sky Sports Premier League', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  tntsports: { id:'UC4i_9WvfPRTuRWEaWyfKuFw', name:'TNT Sports',                flag:'📺' },
  mls:       { id:'UCSZbXT5TLLW_i-5W8FZpFsg', name:'Major League Soccer',       flag:'🇺🇸' },
  dazn:      { id:'UCSZ21xyG8w_33KriMM69IxQ', name:'DAZN Football',             flag:'⚽' },
};

const HL_LOADED = new Set();

function bootHighlights(){
  // Load all channels on first visit; subsequent visits use cached grids
  if(HL_LOADED.size === 0){
    Object.entries(YT_CHANNELS).forEach(([key, ch])=>loadChannelHighlights(key, ch));
  }
  // Ensure all sections visible
  Object.keys(YT_CHANNELS).forEach(k=>{
    const s = document.getElementById('hlSection-'+k);
    if(s) s.style.display = '';
  });
}

function setHighlightChannel(btn, key){
  document.querySelectorAll('#hlChannelFilter .hl-ch-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  Object.keys(YT_CHANNELS).forEach(k=>{
    const s = document.getElementById('hlSection-'+k);
    if(s) s.style.display = (key==='all' || key===k) ? '' : 'none';
  });
  // Lazy-load channel if not yet fetched
  if(key!=='all' && !HL_LOADED.has(key)) loadChannelHighlights(key, YT_CHANNELS[key]);
}

async function loadChannelHighlights(key, channel){
  const grid = document.getElementById('hlGrid-'+key);
  if(!grid) return;
  grid.innerHTML = spin();

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;

  try{
    // Primary proxy: allorigins.win
    const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`,
      {signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined});
    if(!r.ok) throw new Error('proxy-1 failed');
    const data = await r.json();
    const videos = parseYTFeed(data.contents||'');
    if(!videos.length) throw new Error('empty feed');
    grid.innerHTML = renderVideoGrid(videos, key);
    HL_LOADED.add(key);
  }catch(e){
    try{
      // Fallback proxy: corsproxy.io
      const r2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(feedUrl)}`,
        {signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined});
      if(!r2.ok) throw new Error('proxy-2 failed');
      const xml2 = await r2.text();
      const videos2 = parseYTFeed(xml2);
      if(!videos2.length) throw new Error('empty feed');
      grid.innerHTML = renderVideoGrid(videos2, key);
      HL_LOADED.add(key);
    }catch(e2){
      grid.innerHTML = `<div class="hl-fallback">
        <p>Could not load videos automatically (CORS restriction).</p>
        <a href="https://www.youtube.com/channel/${channel.id}/videos" target="_blank" rel="noopener" class="hl-yt-link">
          ▶ Watch ${escHtml(channel.name)} on YouTube
        </a>
      </div>`;
    }
  }
}

function parseYTFeed(xmlString){
  try{
    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    const NS_YT = 'http://www.youtube.com/xml/schemas/2015';
    const NS_MEDIA = 'http://search.yahoo.com/mrss/';
    return Array.from(doc.querySelectorAll('entry')).slice(0,8).map(entry=>{
      const videoId = (entry.getElementsByTagNameNS(NS_YT,'videoId')[0]
        || entry.querySelector('videoId'))?.textContent?.trim() || '';
      const title   = entry.querySelector('title')?.textContent?.trim() || '';
      const pub     = entry.querySelector('published')?.textContent?.trim() || '';
      const thumbEl = entry.getElementsByTagNameNS(NS_MEDIA,'thumbnail')[0]
        || entry.querySelector('thumbnail');
      const thumbnail = thumbEl?.getAttribute('url')
        || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
      const statsEl = entry.getElementsByTagNameNS(NS_MEDIA,'statistics')[0]
        || entry.querySelector('statistics');
      const views = statsEl?.getAttribute('views') || '';
      return { videoId, title, published:pub, thumbnail, views };
    }).filter(v=>v.videoId);
  }catch(e){ return []; }
}

function renderVideoGrid(videos, channelKey){
  if(!videos.length) return emptyBox('No recent videos found.');
  return '<div class="hl-grid">'+videos.map(v=>{
    const ago   = hlTimeAgo(v.published);
    const vStr  = v.views ? hlFmtViews(Number(v.views))+' views · ' : '';
    const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
    const safeTitleAttr = v.title.replace(/'/g,'&#39;').replace(/"/g,'&quot;');
    return `<div class="hl-card" onclick="openVideoPlayer('${v.videoId}','${safeTitleAttr}','${channelKey}')">
      <div class="hl-thumb">
        <img src="${thumb}" alt="" loading="lazy"
          onerror="this.src='https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg'">
        <div class="hl-play-btn">▶</div>
      </div>
      <div class="hl-card-info">
        <div class="hl-card-title">${escHtml(v.title)}</div>
        <div class="hl-card-meta">${vStr}${ago}</div>
      </div>
    </div>`;
  }).join('')+'</div>';
}

function openVideoPlayer(videoId, title, channelKey){
  const ch = YT_CHANNELS[channelKey] || {};
  document.getElementById('videoModalTitle').textContent = title;
  document.getElementById('videoModalMeta').textContent  = ch.name || '';
  document.getElementById('videoFrame').src =
    `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  document.getElementById('videoModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeVideoModal(){
  document.getElementById('videoModal').classList.remove('open');
  document.getElementById('videoFrame').src = '';
  document.body.style.overflow = '';
}

function hlTimeAgo(isoDate){
  try{
    const ms = Date.now() - new Date(isoDate).getTime();
    const h  = Math.floor(ms/3600000);
    if(h<1)  return 'Just now';
    if(h<24) return h+'h ago';
    const d = Math.floor(h/24);
    if(d<30) return d+'d ago';
    return Math.floor(d/30)+'mo ago';
  }catch(e){ return ''; }
}

function hlFmtViews(n){
  if(!n||isNaN(n)) return '';
  if(n>=1e6) return (n/1e6).toFixed(1)+'M';
  if(n>=1e3) return Math.round(n/1e3)+'K';
  return String(n);
}

function escHtml(str){
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Keyboard escape closes all modals ─────────────────
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    ['teamModal','refModal','mgrModal','tournModal','eventModal','playerModal'].forEach(id=>{
      document.getElementById(id)?.classList.remove('open');
    });
    document.body.style.overflow='';
  }
});
