// ═══════════════════════════════════════════════════════
// FootyLive.ca — events.js
// Event detail modal — all event/* endpoints
// ═══════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────
let MODAL_EVENT_ID=null;

// Safely formats API rating values. SportAPI can return ratings as numbers, strings,
// or nested objects depending on the endpoint, so never call .toFixed() directly.
function fmtRatingValue(value){
  if(value==null || value==='') return '';
  if(typeof value==='object'){
    value=value.value ?? value.rating ?? value.avgRating ?? value.current ?? '';
  }
  const n=Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : '';
}

// ── Open/Close ────────────────────────────────────────
function closeEventModal(){
  document.getElementById('eventModal').classList.remove('open');
  document.body.style.overflow='';
}

async function openEventModal(eventId){
  if(!eventId) return;
  MODAL_EVENT_ID=eventId;
  // Clear lazy flags
  Object.keys(window).filter(k=>k.startsWith('_loaded_ep')).forEach(k=>delete window[k]);
  // Reset panels
  document.querySelectorAll('#eventModal .modal-panel').forEach(p=>{ p.innerHTML=spin(); p.classList.remove('active'); });
  document.querySelectorAll('#eventModal .mtab').forEach(t=>t.classList.remove('active'));
  document.querySelector('#eventModal .mtab')?.classList.add('active');
  document.getElementById('epSummary')?.classList.add('active');
  // Reset hero
  document.getElementById('evLeague').textContent='League';
  document.getElementById('evScore').textContent='— : —';
  document.getElementById('evStatusPill').innerHTML='';
  document.getElementById('evMeta').innerHTML='';
  document.getElementById('evHomeName').textContent='Home';
  document.getElementById('evAwayName').textContent='Away';
  document.getElementById('evHomeCrest').innerHTML='';
  document.getElementById('evAwayCrest').innerHTML='';
  document.getElementById('eventModal').classList.add('open');
  document.body.style.overflow='hidden';
  // Load summary + incidents + lineups in parallel (all immediately needed)
  loadEventSummary();
  loadEventIncidents();
  loadEventLineups();
}

function openETab(tab,panelId){
  document.querySelectorAll('#eventModal .mtab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#eventModal .modal-panel').forEach(p=>p.classList.remove('active'));
  tab.classList.add('active');
  document.getElementById(panelId)?.classList.add('active');
  if(!window[`_loaded_${panelId}`]){
    window[`_loaded_${panelId}`]=true;
    if(panelId==='epStats')       loadEventStats();
    if(panelId==='epH2H')         loadEventH2H();
    if(panelId==='epShotmap')     loadEventShotmap();
    if(panelId==='epBestPlayers') loadEventBestPlayers();
    if(panelId==='epForm')        loadEventForm();
    if(panelId==='epOdds')        loadEventOdds();
    if(panelId==='epVotes')       loadEventVotes();
    if(panelId==='epMedia')       loadEventMedia();
  }
}

// ══════════════════════════════════════════════════════
// SUMMARY
// Endpoints:
//   GET /event/{id}          — event details, venue, referee
//   GET /event/{id}/managers — both team managers
//   GET /event/{id}/comments — live commentary
// ══════════════════════════════════════════════════════
async function loadEventSummary(){
  try{
    const [evD,mgrD]=await Promise.allSettled([
      sa7(`/event/${MODAL_EVENT_ID}`),
      sa7(`/event/${MODAL_EVENT_ID}/managers`)
    ]);
    const ev=evD.status==='fulfilled'?(evD.value?.event||evD.value):null;
    if(!ev){ document.getElementById('epSummary').innerHTML=emptyBox('Event details not available.'); return; }

    // Populate scoreboard hero
    const hN=ev.homeTeam?.name||'Home', aN=ev.awayTeam?.name||'Away';
    const hLo=ev.homeTeam?.image||ev.homeTeam?.logo||'';
    const aLo=ev.awayTeam?.image||ev.awayTeam?.logo||'';
    const hG=ev.homeScore?.current??ev.homeScore?.display??'—';
    const aG=ev.awayScore?.current??ev.awayScore?.display??'—';
    const leag=ev.tournament?.name||ev.league?.name||'Match';
    const {isLive,isFinished,isHT,desc}=parseEventStatus(ev);

    document.getElementById('evLeague').textContent=leag;
    document.getElementById('evHomeName').textContent=hN;
    document.getElementById('evAwayName').textContent=aN;
    document.getElementById('evScore').textContent=`${hG} : ${aG}`;
    const crest=(src,alt,id)=>{ document.getElementById(id).innerHTML=src?`<img class="ev-crest" src="${src}" alt="${alt}" onerror="this.style.display='none'">`:`<div class="ev-crest-ph">⚽</div>`; };
    crest(hLo,hN,'evHomeCrest'); crest(aLo,aN,'evAwayCrest');
    const pillClass=isHT?'ns':isLive?'live':isFinished?'ft':'ns';
    document.getElementById('evStatusPill').innerHTML=`<div class="ev-status-pill ${pillClass}">${desc||'—'}</div>`;

    // Meta row: time, venue, referee
    const venue=ev.venue?.name||''; const city=ev.venue?.city?.name||'';
    const ref=ev.referee||''; const time=ev.startTimestamp?fmtTime(ev.startTimestamp):'';
    let meta='';
    if(time) meta+=`<span>🕐 ${time}</span>`;
    if(venue) meta+=`<span>🏟 ${venue}${city?', '+city:''}</span>`;
    if(ref) meta+=`<span>🟡 ${typeof ref==='object'?ref.name||'':ref}</span>`;
    document.getElementById('evMeta').innerHTML=meta;

    // Build summary panel
    let h='';
    // Managers
    if(mgrD.status==='fulfilled'&&mgrD.value){
      const mgrs=mgrD.value;
      const hMgr=mgrs.homeTeam?.manager||mgrs.home||null;
      const aMgr=mgrs.awayTeam?.manager||mgrs.away||null;
      if(hMgr||aMgr){
        h+=`<h4 style="font-family:var(--fd);font-size:1rem;font-weight:700;color:var(--white);margin-bottom:.7rem;letter-spacing:.5px">Managers</h4>`;
        h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:1rem">`;
        [hMgr&&[hMgr,hN], aMgr&&[aMgr,aN]].filter(Boolean).forEach(([mgr,teamName])=>{
          const photo=mgr.image||mgr.photo||'';
          h+=`<div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:.75rem;display:flex;align-items:center;gap:.65rem">
            ${photo?`<img style="width:38px;height:38px;border-radius:50%;object-fit:cover" src="${photo}" alt="" onerror="this.style.display='none'">`:`<div style="width:38px;height:38px;border-radius:50%;background:rgba(245,158,11,.08);display:flex;align-items:center;justify-content:center;font-size:1.2rem">👔</div>`}
            <div><div style="font-weight:700;font-size:.82rem;color:var(--white)">${mgr.name||'—'}</div><div style="font-size:.65rem;color:var(--muted)">${teamName}</div></div>
          </div>`;
        });
        h+='</div>';
      }
    }
    // Match details table
    h+='<div class="info-table">';
    const roundLabel=ev.roundInfo?.name||ev.roundInfo?.round?`Round ${ev.roundInfo.round}`:'—';
    [
      ['🏟 Venue', venue?(venue+(city?', '+city:'')):'—'],
      ['📅 Date', ev.startTimestamp?new Date(ev.startTimestamp*1000).toLocaleDateString('en-CA',{weekday:'long',year:'numeric',month:'long',day:'numeric'}):'—'],
      ['🕐 Kickoff', time||'—'],
      ['🟡 Referee', typeof ref==='object'?ref.name||'—':ref||'—'],
      ['🏆 Round', roundLabel],
    ].forEach(([l,v])=>{ h+=`<div class="info-row"><span class="info-label">${l}</span><span class="info-value">${v}</span></div>`; });
    h+='</div>';
    document.getElementById('epSummary').innerHTML=h;
  }catch(e){ document.getElementById('epSummary').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// INCIDENTS
// Endpoint: GET /event/{id}/incidents
// ══════════════════════════════════════════════════════
async function loadEventIncidents(){
  try{
    const d=await sa7(`/event/${MODAL_EVENT_ID}/incidents`);
    const incidents=d.incidents||[];
    if(!incidents.length){ document.getElementById('epIncidents').innerHTML=emptyBox('No incidents yet.'); return; }
    const ICONS={goal:'⚽','own-goal':'⚽🔴',penalty:'🥅','missed-penalty':'❌',yellowCard:'🟨',redCard:'🟥',yellowRedCard:'🟥',substitution:'🔄','period-start':'▶','period-end':'⏹',var:'📺'};
    let h='<div class="timeline">';
    incidents.forEach(inc=>{
      const type=String(inc.incidentType||inc.type||'').toLowerCase().replace(/ /g,'-');
      const isHome=inc.isHome??(inc.teamSide==='home');
      const min=inc.time||inc.minute||'';
      const inj=inc.addedTime||inc.injuryTime||0;
      const minStr=min?(inj?`${min}+${inj}'`:`${min}'`):'';
      const player=inc.player||{};
      const playerName=player.name||inc.playerName||inc.name||'';
      const playerId=player.id||0;
      const assist=inc.playerIn?.name||inc.assist?.name||inc.assistName||'';
      const subOut=inc.playerOut?.name||'';
      const ico=ICONS[type]||'▪';
      if(type==='period-start'){
        h+=`<div class="inc-period">— ${inc.description||inc.text||`Period ${inc.period||''}`} —</div>`; return;
      }
      let pHtml=`<div class="inc-player"${playerId?` onclick="openPlayerModal(${playerId})" style="cursor:pointer;text-decoration:underline dotted rgba(245,158,11,.4)"`:''}>${playerName}</div>`;
      if(type==='substitution'&&subOut) pHtml=`<div class="inc-player">▲ ${playerName}</div><div class="inc-assist">▼ ${subOut}</div>`;
      else if(assist) pHtml+=`<div class="inc-assist">↳ ${assist}</div>`;
      h+=`<div class="inc-row ${isHome?'home':'away'}">
        <span class="inc-min">${minStr}</span>
        <span class="inc-ico">${ico}</span>
        <div class="inc-info">${pHtml}</div>
      </div>`;
    });
    h+='</div>';
    document.getElementById('epIncidents').innerHTML=h;
  }catch(e){ document.getElementById('epIncidents').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// LINEUPS
// Endpoint: GET /event/{id}/lineups
// ══════════════════════════════════════════════════════
async function loadEventLineups(){
  try{
    const d=await sa7(`/event/${MODAL_EVENT_ID}/lineups`);
    const home=d.home||d.homeTeam||{};
    const away=d.away||d.awayTeam||{};
    if(!home.players&&!away.players){ document.getElementById('epLineups').innerHTML=emptyBox('Lineups not announced yet.'); return; }
    const hN=document.getElementById('evHomeName').textContent;
    const aN=document.getElementById('evAwayName').textContent;
    function buildSide(team,teamName){
      const players=team.players||[];
      const formation=team.formation||'';
      const starters=players.filter(p=>!p.substitute);
      const subs=players.filter(p=>p.substitute);
      let h=`<div class="lu-team">
        <h4>${teamName}</h4>
        ${formation?`<div class="lu-formation">⚽ ${formation}</div>`:''}
        <div class="lu-section">Starting XI</div>`;
      starters.forEach(p=>{
        const pl=p.player||p;
        h+=`<div class="lu-player">
          <span class="lu-num">${p.shirtNumber||pl.shirtNumber||''}</span>
          <span class="lu-name${p.captain?' lu-cap':''}" onclick="openPlayerModal(${pl.id||0})" style="cursor:pointer">${pl.name||pl.shortName||'—'}</span>
          <span class="lu-pos">${p.position||pl.position||''}</span>
        </div>`;
      });
      if(subs.length){
        h+='<div class="lu-section">Substitutes</div>';
        subs.forEach(p=>{
          const pl=p.player||p;
          h+=`<div class="lu-player lu-sub">
            <span class="lu-num">${p.shirtNumber||pl.shirtNumber||''}</span>
            <span class="lu-name" onclick="openPlayerModal(${pl.id||0})" style="cursor:pointer">${pl.name||pl.shortName||'—'}</span>
            <span class="lu-pos">${p.position||pl.position||''}</span>
          </div>`;
        });
      }
      return h+'</div>';
    }
    document.getElementById('epLineups').innerHTML=`<div class="lu-grid">${buildSide(home,hN)}${buildSide(away,aN)}</div>`;
  }catch(e){ document.getElementById('epLineups').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// STATISTICS
// Endpoint: GET /event/{id}/statistics
// Also available: GET /event/{id}/player/{playerId}/statistics
// ══════════════════════════════════════════════════════
async function loadEventStats(){
  try{
    const d=await sa7(`/event/${MODAL_EVENT_ID}/statistics`);
    const groups=d.statistics||d.stats||[];
    if(!groups.length){ document.getElementById('epStats').innerHTML=emptyBox('Statistics not yet available.'); return; }
    const hN=document.getElementById('evHomeName').textContent;
    const aN=document.getElementById('evAwayName').textContent;
    let h=`<div style="display:flex;justify-content:space-between;margin-bottom:1rem;font-size:.75rem;font-weight:700">
      <span style="color:var(--amber)">${hN}</span>
      <span style="color:var(--muted)">Statistics</span>
      <span style="color:var(--amber)">${aN}</span>
    </div>`;
    groups.forEach(group=>{
      const title=group.period||group.groupName||group.name||'';
      h+=`<div class="stat-group"><div class="stat-group-title">${title}</div>`;
      (group.statisticsItems||group.stats||group.items||[]).forEach(stat=>{
        const name=stat.name||stat.key||'';
        const hv=parseFloat(stat.home??stat.homeValue??0)||0;
        const av=parseFloat(stat.away??stat.awayValue??0)||0;
        const tot=hv+av||1;
        const hp=Math.round(hv/tot*100);
        h+=`<div class="stat-item">
          <div class="stat-labels">
            <span class="stat-lv">${stat.homeValue??stat.home??hv}</span>
            <span class="stat-nm">${name}</span>
            <span class="stat-rv">${stat.awayValue??stat.away??av}</span>
          </div>
          <div class="stat-bar">
            <div class="stat-bl" style="width:${hp}%"></div>
            <div class="stat-br" style="width:${100-hp}%"></div>
          </div>
        </div>`;
      });
      h+='</div>';
    });
    document.getElementById('epStats').innerHTML=h;
  }catch(e){ document.getElementById('epStats').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// H2H
// Endpoints:
//   GET /event/{id}/h2h            — team duel summary + recent matches
//   GET /event/{id}/team-streaks   — current form streaks
// ══════════════════════════════════════════════════════
async function loadEventH2H(){
  try{
    const d=await sa7(`/event/${MODAL_EVENT_ID}/h2h`);
    const matches=d.events||d.matches||[];
    const hW=d.teamDuel?.homeWins??matches.filter(m=>{ const hg=m.homeScore?.current??0,ag=m.awayScore?.current??0; return hg>ag; }).length;
    const aW=d.teamDuel?.awayWins??matches.filter(m=>{ const hg=m.homeScore?.current??0,ag=m.awayScore?.current??0; return ag>hg; }).length;
    const dr=d.teamDuel?.draws??matches.filter(m=>{ const hg=m.homeScore?.current??0,ag=m.awayScore?.current??0; return hg===ag; }).length;
    const hN=document.getElementById('evHomeName').textContent;
    const aN=document.getElementById('evAwayName').textContent;
    let h=`<div class="h2h-summary">
      <div class="h2h-box"><div class="h2h-num">${hW}</div><div class="h2h-lbl">${hN.split(' ')[0]} Wins</div></div>
      <div class="h2h-box"><div class="h2h-num">${dr}</div><div class="h2h-lbl">Draws</div></div>
      <div class="h2h-box"><div class="h2h-num">${aW}</div><div class="h2h-lbl">${aN.split(' ')[0]} Wins</div></div>
    </div>`;
    if(matches.length){
      h+=`<div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem">Previous Meetings</div>`;
      matches.slice(0,10).forEach(m=>{
        const hG=m.homeScore?.current??'—', aG=m.awayScore?.current??'—';
        const date=m.startTimestamp?fmtDateShort(m.startTimestamp):'';
        const hn=m.homeTeam?.name||'Home', an=m.awayTeam?.name||'Away';
        h+=`<div class="h2h-match" onclick="openEventModal(${m.id||0})">
          <span class="h2h-date">${date}</span>
          <span class="h2h-teams">${hn} vs ${an}</span>
          <span class="h2h-score">${hG}–${aG}</span>
        </div>`;
      });
    } else {
      h+=emptyBox('No previous meetings found.');
    }
    document.getElementById('epH2H').innerHTML=h;
  }catch(e){ document.getElementById('epH2H').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// SHOTMAP
// Endpoints:
//   GET /event/{id}/shotmap                — all shots
//   GET /event/{id}/shotmap/{teamId}       — shots for one team
//   GET /event/{id}/player/{id}/shotmap    — shots for one player
//   GET /event/{id}/heatmap/{teamId}       — team heatmap
// ══════════════════════════════════════════════════════
async function loadEventShotmap(){
  try{
    const d=await sa7(`/event/${MODAL_EVENT_ID}/shotmap`);
    const shots=d.shotmap||d.shots||[];
    if(!shots.length){ document.getElementById('epShotmap').innerHTML=emptyBox('Shotmap not available.'); return; }
    const W=340, H=220;
    const COLOR={goal:'#f59e0b',saved:'#f97316',blocked:'#38bdf8',missed:'rgba(255,255,255,0.25)',post:'#a78bfa'};
    let circles='';
    shots.forEach(s=>{
      const outcome=String(s.shotType||s.outcome||'missed').toLowerCase();
      const color=COLOR[outcome]||COLOR.missed;
      const x=(parseFloat(s.playerCoordinates?.x??s.x??50)/100)*W;
      const y=(parseFloat(s.playerCoordinates?.y??s.y??50)/100)*H;
      const r=outcome==='goal'?7:4;
      const glow=outcome==='goal'?'filter:drop-shadow(0 0 5px rgba(245,158,11,.8));':'';
      circles+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" opacity=".85" style="${glow}" title="${s.player?.name||''} — ${outcome}"/>`;
    });
    const pitch=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;border-radius:8px;display:block;margin:0 auto">
      <rect width="${W}" height="${H}" fill="#0c1f0e" rx="6"/>
      <rect x="2" y="2" width="${W-4}" height="${H-4}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1.5" rx="4"/>
      <line x1="${W/2}" y1="0" x2="${W/2}" y2="${H}" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
      <circle cx="${W/2}" cy="${H/2}" r="28" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
      <rect x="2" y="${H/2-33}" width="65" height="66" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/>
      <rect x="${W-67}" y="${H/2-33}" width="65" height="66" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/>
      <rect x="2" y="${H/2-15}" width="22" height="30" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
      <rect x="${W-24}" y="${H/2-15}" width="22" height="30" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
      ${circles}
    </svg>`;
    const goal=shots.filter(s=>String(s.shotType||s.outcome||'').toLowerCase()==='goal').length;
    const saved=shots.filter(s=>String(s.shotType||s.outcome||'').toLowerCase()==='saved').length;
    const blocked=shots.filter(s=>String(s.shotType||s.outcome||'').toLowerCase()==='blocked').length;
    const missed=shots.length-goal-saved-blocked;
    document.getElementById('epShotmap').innerHTML=`${pitch}
      <div class="shotmap-legend">
        <span><span class="sml-dot" style="background:var(--amber)"></span>Goals (${goal})</span>
        <span><span class="sml-dot" style="background:var(--coral)"></span>Saved (${saved})</span>
        <span><span class="sml-dot" style="background:var(--sky)"></span>Blocked (${blocked})</span>
        <span><span class="sml-dot" style="background:rgba(255,255,255,.25)"></span>Missed (${missed})</span>
      </div>`;
  }catch(e){ document.getElementById('epShotmap').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// BEST PLAYERS
// Endpoints:
//   GET /event/{id}/best-players      — top performers
//   GET /event/{id}/featured-players  — featured highlights
// ══════════════════════════════════════════════════════
async function loadEventBestPlayers(){
  try{
    const [bestD,featD]=await Promise.allSettled([
      sa7(`/event/${MODAL_EVENT_ID}/best-players`),
      sa7(`/event/${MODAL_EVENT_ID}/featured-players`)
    ]);
    let players=[];
    if(bestD.status==='fulfilled') players=[...(bestD.value?.bestPlayers||bestD.value?.players||[])];
    if(!players.length&&featD.status==='fulfilled') players=[...(featD.value?.featuredPlayers||featD.value?.players||[])];
    if(!players.length){ document.getElementById('epBestPlayers').innerHTML=emptyBox('Best player data not available.'); return; }
    let h='<div class="bp-grid">';
    players.slice(0,8).forEach(item=>{
      const p=item.player||item;
      const rating=fmtRatingValue(item.value ?? item.rating ?? item.avgRating);
      const photo=p.image||p.photo||'';
      h+=`<div class="bp-card" onclick="openPlayerModal(${p.id||0})">
        ${photo?`<img class="bp-photo" src="${photo}" alt="${p.name||''}" onerror="this.style.display='none'">`:`<div class="bp-photo-ph">👤</div>`}
        <div class="bp-name">${p.name||p.shortName||'—'}</div>
        <div class="bp-team">${item.team?.name||p.team?.name||''}</div>
        ${rating?`<div class="bp-rating">${rating}</div>`:''}
        <div class="bp-label">${item.label||item.title||'Player'}</div>
      </div>`;
    });
    document.getElementById('epBestPlayers').innerHTML=h+'</div>';
  }catch(e){ document.getElementById('epBestPlayers').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// PREGAME FORM
// Endpoint: GET /event/{id}/pregame-form
// ══════════════════════════════════════════════════════
async function loadEventForm(){
  try{
    const d=await sa7(`/event/${MODAL_EVENT_ID}/pregame-form`);
    const hForm=d.homeTeam||d.home||{};
    const aForm=d.awayTeam||d.away||{};
    const hN=document.getElementById('evHomeName').textContent;
    const aN=document.getElementById('evAwayName').textContent;
    function formRow(form,teamName){
      const results=form.form||form.recentForm||[];
      const dots=results.slice(0,6).map(r=>{
        const v=String(r).toUpperCase();
        return `<div class="form-dot ${v}">${v}</div>`;
      }).join('');
      const avg=fmtRatingValue(form.avgRating ?? form.rating ?? form.averageRating);
      return `<div class="form-row">
        <div class="form-name">${teamName}</div>
        <div class="form-dots">${dots||'<span style="color:var(--muted);font-size:.75rem">No data</span>'}</div>
        ${avg?`<span style="font-family:var(--fd);font-size:1.1rem;color:var(--amber);margin-left:.5rem">${avg}</span>`:''}
      </div>`;
    }
    let h=`<div style="margin-bottom:1rem">
      <div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:.6rem">Recent Form (last 6)</div>
      ${formRow(hForm,hN)}
      ${formRow(aForm,aN)}
    </div>`;
    const hp=hForm.position, ap=aForm.position;
    if(hp||ap){
      h+=`<div class="stat-boxes">`;
      if(hp) h+=`<div class="stat-box"><div class="stat-box-v">${hp}</div><div class="stat-box-l">${hN.split(' ')[0]} Position</div></div>`;
      if(ap) h+=`<div class="stat-box"><div class="stat-box-v">${ap}</div><div class="stat-box-l">${aN.split(' ')[0]} Position</div></div>`;
      h+='</div>';
    }
    document.getElementById('epForm').innerHTML=h;
  }catch(e){ document.getElementById('epForm').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// ODDS
// Endpoints:
//   GET /event/{id}/odds/{providerId}/featured  — main markets
//   GET /event/{id}/odds/{providerId}/all       — all markets
// Provider 1 = bet365 (default)
// ══════════════════════════════════════════════════════
async function loadEventOdds(){
  try{
    const d=await sa7(`/event/${MODAL_EVENT_ID}/odds/1/featured`);
    const markets=d.featured||d.markets||d.odds||[];
    if(!markets.length){ document.getElementById('epOdds').innerHTML=emptyBox('Odds not available for this event.'); return; }
    let h='';
    markets.slice(0,6).forEach(market=>{
      const name=market.marketName||market.name||'Market';
      h+=`<div style="margin-bottom:1.2rem">
        <div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem">${name}</div>
        <div class="odds-row">`;
      (market.choices||market.odds||[]).slice(0,6).forEach(c=>{
        h+=`<div class="odd-pill">
          <div class="odd-pill-l">${c.name||c.label||''}</div>
          <div class="odd-pill-v">${c.fractionalValue||c.decimalValue||c.odds||'—'}</div>
        </div>`;
      });
      h+='</div></div>';
    });
    document.getElementById('epOdds').innerHTML=h;
  }catch(e){ document.getElementById('epOdds').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// VOTES
// Endpoint: GET /event/{id}/votes
// ══════════════════════════════════════════════════════
async function loadEventVotes(){
  try{
    const d=await sa7(`/event/${MODAL_EVENT_ID}/votes`);
    const vote=d.vote||d.votes||d;
    const home=parseFloat(vote.vote1||vote.home||vote.homeWin||0);
    const draw=parseFloat(vote.voteDraw||vote.draw||0);
    const away=parseFloat(vote.vote2||vote.away||vote.awayWin||0);
    const total=home+draw+away||1;
    const hp=Math.round(home/total*100), dp=Math.round(draw/total*100), ap=100-hp-dp;
    const hN=document.getElementById('evHomeName').textContent;
    const aN=document.getElementById('evAwayName').textContent;
    document.getElementById('epVotes').innerHTML=`
      <div style="margin-bottom:1rem;font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted)">Fan Predictions</div>
      <div class="vote-wrap">
        <div class="vb-home" style="width:${hp}%">${hp>8?hp+'%':''}</div>
        <div class="vb-draw" style="width:${dp}%">${dp>8?dp+'%':''}</div>
        <div class="vb-away" style="width:${ap}%">${ap>8?ap+'%':''}</div>
      </div>
      <div class="vote-labels">
        <span>${hN.split(' ')[0]} Win — ${hp}%</span>
        <span>Draw — ${dp}%</span>
        <span>${aN.split(' ')[0]} Win — ${ap}%</span>
      </div>`;
  }catch(e){ document.getElementById('epVotes').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// MEDIA / HIGHLIGHTS
// Endpoints:
//   GET /event/{id}/media       — all media (videos, images)
//   GET /event/{id}/highlights  — highlight videos
// ══════════════════════════════════════════════════════
async function loadEventMedia(){
  try{
    const [mediaD,hlD]=await Promise.allSettled([
      sa7(`/event/${MODAL_EVENT_ID}/media`),
      sa7(`/event/${MODAL_EVENT_ID}/highlights`)
    ]);
    let items=[];
    if(mediaD.status==='fulfilled') items=[...(mediaD.value?.media||mediaD.value?.videos||[])];
    if(!items.length&&hlD.status==='fulfilled') items=[...(hlD.value?.highlights||hlD.value?.media||[])];
    if(!items.length){ document.getElementById('epMedia').innerHTML=emptyBox('No media available for this event.'); return; }
    let h='<div class="media-grid">';
    items.slice(0,12).forEach(m=>{
      const url=m.url||m.videoUrl||m.link||'#';
      const thumb=m.thumbnailUrl||m.thumbnail||m.image||'';
      const title=m.title||m.name||'Highlight';
      h+=`<a class="media-card" href="${url}" target="_blank" rel="noopener">
        <div class="media-thumb">${thumb?`<img src="${thumb}" alt="${title}" onerror="this.parentNode.innerHTML='🎬'">`:'🎬'}</div>
        <div class="media-title">${title}</div>
      </a>`;
    });
    document.getElementById('epMedia').innerHTML=h+'</div>';
  }catch(e){ document.getElementById('epMedia').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// BASEBALL (shown as extra tab when sport=baseball)
// Endpoints:
//   GET /event/{id}/at-bats                         — at-bat list
//   GET /event/{id}/atbat/{atBatId}/pitches         — pitches in an at-bat
//   GET /event/{id}/player/{playerId}/pitches/pitching — pitcher stats
// These endpoints are used when event sport is baseball
// ══════════════════════════════════════════════════════
async function loadEventAtBats(eventId){
  // Called when viewing a baseball game
  try{
    // GET /event/{id}/at-bats
    const d=await sa7(`/event/${eventId}/at-bats`);
    return d.atBats||d.atBatsList||d||[];
  }catch(e){ return []; }
}

async function loadAtBatPitches(eventId, atBatId){
  // GET /event/{id}/atbat/{atBatId}/pitches
  try{
    const d=await sa7(`/event/${eventId}/atbat/${atBatId}/pitches`);
    return d.pitches||d||[];
  }catch(e){ return []; }
}

async function loadPitcherStats(eventId, playerId){
  // GET /event/{id}/player/{playerId}/pitches/pitching
  try{
    const d=await sa7(`/event/${eventId}/player/${playerId}/pitches/pitching`);
    return d.pitching||d.pitches||d||{};
  }catch(e){ return {}; }
}

// Also available on event objects (used internally):
// GET /event/{id}/graph          — momentum graph data
// GET /event/{id}/point-by-point — tennis point by point
// GET /event/{id}/tennis-power   — tennis power ranking context
// GET /event/{id}/comments       — live commentary feed
