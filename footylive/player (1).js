// ═══════════════════════════════════════════════════════
// FootyLive.ca — player.js
// Player profile modal — all player/* endpoints
// ═══════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────
let PLAYER_ID=null, PLAYER_DATA=null;
let P_TOURNAMENT_ID=17, P_SEASON_ID=null, P_TEAM_ID=null;

// ── Open/Close ────────────────────────────────────────
function closePlayerModal(){
  document.getElementById('playerModal').classList.remove('open');
  document.body.style.overflow='';
}

async function openPlayerModal(playerId){
  if(!playerId) return;
  PLAYER_ID=playerId; PLAYER_DATA=null;
  Object.keys(window).filter(k=>k.startsWith('_loaded_pp')).forEach(k=>delete window[k]);
  document.querySelectorAll('#playerModal .modal-panel').forEach(p=>{ p.innerHTML=spin(); p.classList.remove('active'); });
  document.querySelectorAll('#playerModal .mtab').forEach(t=>t.classList.remove('active'));
  document.querySelector('#playerModal .mtab')?.classList.add('active');
  document.getElementById('ppOverview')?.classList.add('active');
  // Reset hero
  document.getElementById('playerName').textContent='Loading…';
  document.getElementById('playerPosBadge').textContent='';
  document.getElementById('playerTeamName').innerHTML='';
  document.getElementById('playerMetaPills').innerHTML='';
  document.getElementById('playerStatHeroes').innerHTML='';
  document.getElementById('playerPhotoPh').innerHTML='👤';
  document.getElementById('playerModal').classList.add('open');
  document.body.style.overflow='hidden';
  loadPlayerOverview();
}

function openPTab(tab,panelId){
  document.querySelectorAll('#playerModal .mtab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#playerModal .modal-panel').forEach(p=>p.classList.remove('active'));
  tab.classList.add('active');
  document.getElementById(panelId)?.classList.add('active');
  if(!window[`_loaded_${panelId}`]){
    window[`_loaded_${panelId}`]=true;
    if(panelId==='ppAttributes')  loadPlayerAttributes();
    if(panelId==='ppCareer')      loadPlayerCareer();
    if(panelId==='ppSeasonStats') loadPlayerSeasonStats();
    if(panelId==='ppRatings')     loadPlayerRatings();
    if(panelId==='ppHeatmap')     loadPlayerHeatmap();
    if(panelId==='ppTransfers')   loadPlayerTransfers();
    if(panelId==='ppPenalties')   loadPlayerPenalties();
    if(panelId==='ppNational')    loadPlayerNational();
    if(panelId==='ppGames')       loadPlayerGames();
    if(panelId==='ppMedia')       loadPlayerMedia();
  }
}

// ══════════════════════════════════════════════════════
// OVERVIEW
// Endpoints:
//   GET /player/{id}               — profile, bio
//   GET /player/{id}/last-year-summary — season summary stats
//   GET /player/{id}/near-events   — upcoming & recent games
// ══════════════════════════════════════════════════════
async function loadPlayerOverview(){
  try{
    const [playerD,summaryD,nearD]=await Promise.allSettled([
      sa7(`/player/${PLAYER_ID}`),
      sa7(`/player/${PLAYER_ID}/last-year-summary`),
      sa7(`/player/${PLAYER_ID}/near-events`),
    ]);
    const pObj=playerD.status==='fulfilled'?(playerD.value?.player||playerD.value):null;
    if(!pObj){ document.getElementById('ppOverview').innerHTML=emptyBox('Player not found.'); return; }
    PLAYER_DATA=pObj;
    P_TEAM_ID=pObj.team?.id||pObj.teamId||null;
    P_TOURNAMENT_ID=pObj.primaryUniqueTournament?.id||pObj.uniqueTournamentId||17;

    // Photo
    const photoUrl=pObj.image||pObj.photo||'';
    document.getElementById('playerPhotoPh').innerHTML=photoUrl
      ?`<img class="ph-photo" src="${photoUrl}" alt="${pObj.name||''}" onerror="this.outerHTML='<div class=\\"ph-photo-ph\\">👤</div>'">`:'👤';

    // Hero info
    const name=pObj.name||pObj.shortName||'—';
    const pos=pObj.position||pObj.positionCategory||'';
    const teamName=pObj.team?.name||'';
    const teamLogo=pObj.team?.image||'';
    const country=pObj.country?.name||pObj.nationality||'';
    const dob=pObj.dateOfBirthTimestamp?new Date(pObj.dateOfBirthTimestamp*1000).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'}):'';
    const age=pObj.dateOfBirthTimestamp?Math.floor((Date.now()/1000-pObj.dateOfBirthTimestamp)/31557600):'';
    const height=pObj.height?pObj.height+'cm':'';
    const foot=pObj.preferredFoot||'';
    const shirt=pObj.jerseyNumber||pObj.shirtNumber||'';
    const mv=pObj.proposedMarketValue?'€'+Number(pObj.proposedMarketValue).toLocaleString():'';

    document.getElementById('playerName').textContent=name;
    document.getElementById('playerPosBadge').textContent=pos;
    document.getElementById('playerTeamName').innerHTML=teamLogo
      ?`<img src="${teamLogo}" style="width:18px;height:18px;object-fit:contain;border-radius:50%;vertical-align:middle;margin-right:4px" alt="">${teamName}`
      :teamName;

    document.getElementById('playerMetaPills').innerHTML=[
      country&&`🌍 ${country}`,
      age&&`🎂 Age ${age}`,
      height&&`📏 ${height}`,
      foot&&`👟 ${foot.charAt(0).toUpperCase()+foot.slice(1)} foot`,
      shirt&&`#${shirt}`,
      mv&&`💰 ${mv}`,
    ].filter(Boolean).map(p=>`<span class="ph-pill">${p}</span>`).join('');

    // Summary stat heroes from /player/{id}/last-year-summary
    const summary=summaryD.status==='fulfilled'?(summaryD.value?.statistics||summaryD.value?.summary||summaryD.value):null;
    if(summary&&typeof summary==='object'){
      const heroStats=[['Goals',summary.goals??summary.goalsScored??'—'],['Assists',summary.assists??'—'],['Matches',summary.appearances??summary.matchesPlayed??'—'],['Rating',summary.rating?.toFixed(1)??summary.avgRating?.toFixed(1)??'—'],['Shots',summary.totalShots??summary.shots??'—']].filter(([,v])=>v!=='—'&&v!==undefined);
      document.getElementById('playerStatHeroes').innerHTML=heroStats.slice(0,5).map(([l,v])=>
        `<div class="mhs-box"><div class="mhs-val">${v}</div><div class="mhs-lbl">${l}</div></div>`
      ).join('');
    }

    // Overview panel
    let h='<div class="info-table">'+
      [['🏟 Club',teamName||'—'],['🌍 Nationality',country||'—'],['📅 Date of Birth', dob ? (dob + (age ? ' (age ' + age + ')' : '')) : '—'],['📏 Height',height||'—'],['👟 Preferred Foot',foot||'—'],['#️⃣ Shirt Number',shirt||'—'],['💰 Market Value',mv||'—'],['📋 Position',pos||'—']]
      .map(([l,v])=>`<div class="info-row"><span class="info-label">${l}</span><span class="info-value">${v}</span></div>`)
      .join('')+'</div>';

    // Near events from /player/{id}/near-events
    if(nearD.status==='fulfilled'){
      const nd=nearD.value;
      const nearEvents=nd.previousEvent&&nd.nextEvent?[nd.previousEvent,nd.nextEvent].filter(Boolean):nd.events||nd.nearEvents||[];
      if(nearEvents.length){
        h+=`<div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);margin-bottom:.5rem;margin-top:1rem">Upcoming / Recent</div>`;
        nearEvents.forEach(ev=>{
          const hN=ev.homeTeam?.name||'Home', aN=ev.awayTeam?.name||'Away';
          const hG=ev.homeScore?.current??'—', aG=ev.awayScore?.current??'—';
          const d=ev.startTimestamp?fmtDateShort(ev.startTimestamp):'';
          const status=ev.status?.description||'';
          h+=`<div class="near-row" onclick="openEventModal(${ev.id||0})">
            <div class="near-teams">${hN} vs ${aN}</div>
            <div class="near-score">${hG}–${aG}</div>
            <div class="near-date">${d} ${status}</div>
          </div>`;
        });
      }
    }
    document.getElementById('ppOverview').innerHTML=h;
  }catch(e){ document.getElementById('ppOverview').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// ATTRIBUTES
// Endpoints:
//   GET /player/{id}/attribute-overviews — skill attribute scores (pace, shooting…)
//   GET /player/{id}/characteristics     — positional/style characteristics
// ══════════════════════════════════════════════════════
async function loadPlayerAttributes(){
  try{
    const [attrD,charD]=await Promise.allSettled([
      sa7(`/player/${PLAYER_ID}/attribute-overviews`),
      sa7(`/player/${PLAYER_ID}/characteristics`),
    ]);
    let h='';
    if(attrD.status==='fulfilled'){
      const attrs=attrD.value?.playerAttributes||attrD.value?.attributes||attrD.value||[];
      if(Array.isArray(attrs)&&attrs.length){
        h+=`<div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);margin-bottom:.7rem">Skill Attributes</div>`;
        h+='<div style="display:flex;flex-direction:column;gap:.4rem">';
        attrs.forEach(a=>{
          const name=a.name||a.key||'';
          const val=parseFloat(a.value||a.average||0);
          const pct=Math.min(100,Math.round(val/(a.max||100)*100));
          h+=`<div>
            <div style="display:flex;justify-content:space-between;font-size:.7rem;margin-bottom:3px">
              <span style="color:var(--text-muted)">${name}</span>
              <span style="color:var(--amber);font-weight:700">${val%1===0?val:val.toFixed(1)}</span>
            </div>
            <div class="attr-bar"><div class="attr-fill" style="width:${pct}%"></div></div>
          </div>`;
        });
        h+='</div>';
      }
    }
    if(charD.status==='fulfilled'){
      const chars=charD.value?.averageAttributeOverviews||charD.value?.characteristics||charD.value?.positions||[];
      if(Array.isArray(chars)&&chars.length){
        h+=`<div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);margin:.9rem 0 .6rem">Characteristics</div>
          <div class="nat-grid">`;
        chars.forEach(ch=>{
          const label=ch.name||ch.position||ch.key||'';
          const val=ch.value||ch.average||ch.rating||'';
          h+=`<div class="nat-box"><div class="nat-val">${typeof val==='number'?val.toFixed(1):val}</div><div class="nat-lbl">${label}</div></div>`;
        });
        h+='</div>';
      }
    }
    document.getElementById('ppAttributes').innerHTML=h||emptyBox('Attribute data not available.');
  }catch(e){ document.getElementById('ppAttributes').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// CAREER STATISTICS
// Endpoint: GET /player/{id}/career-statistics
// ══════════════════════════════════════════════════════
async function loadPlayerCareer(){
  try{
    const d=await sa7(`/player/${PLAYER_ID}/career-statistics`);
    const seasons=d.seasons||d.career||d.statistics||[];
    if(!seasons.length){ document.getElementById('ppCareer').innerHTML=emptyBox('Career statistics not available.'); return; }
    let h='<div style="overflow-x:auto"><table class="career-table"><thead><tr>'+
      ['Season','Team','Apps','Goals','Assists','Mins','Rating'].map(h=>`<th>${h}</th>`).join('')+
      '</tr></thead><tbody>';
    seasons.forEach(s=>{
      const stats=s.statistics||s.stats||s;
      const team=s.team||stats.team||{};
      const logo=team.image||team.logo||'';
      const year=s.year||s.seasonName||s.season||'—';
      h+=`<tr>
        <td style="font-weight:700;color:var(--amber)">${year}</td>
        <td><div style="display:flex;align-items:center;gap:.4rem">${logo?`<img style="width:18px;height:18px;object-fit:contain;border-radius:50%" src="${logo}" alt="" onerror="this.style.display='none'">` : ''}<span>${team.name||'—'}</span></div></td>
        <td class="cnum">${stats.appearances??stats.matchesPlayed??stats.games??'—'}</td>
        <td class="cnum">${stats.goals??stats.goalsScored??'—'}</td>
        <td class="cnum">${stats.assists??'—'}</td>
        <td class="cnum">${stats.minutesPlayed??stats.minutes??'—'}</td>
        <td class="cnum">${stats.rating?.toFixed?stats.rating.toFixed(1):stats.rating??'—'}</td>
      </tr>`;
    });
    document.getElementById('ppCareer').innerHTML=h+'</tbody></table></div>';
  }catch(e){ document.getElementById('ppCareer').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// SEASON STATISTICS
// Endpoints:
//   GET /player/{id}/statistics/seasons
//     → gets season list with tournament + season IDs
//   GET /player/{id}/unique-tournament/{tid}/season/{sid}/statistics/overall
//     → detailed stats for that season
//   GET /player/{id}/unique-tournament/{tid}/season/{sid}/shot-actions/overall
//     → shot zone breakdown
// ══════════════════════════════════════════════════════
async function loadPlayerSeasonStats(){
  try{
    // GET /player/{id}/statistics/seasons
    const seasonsD=await sa7(`/player/${PLAYER_ID}/statistics/seasons`);
    const seasons=seasonsD.seasons||seasonsD.uniqueTournamentSeasons||[];
    if(!seasons.length){ document.getElementById('ppSeasonStats').innerHTML=emptyBox('Season data not available.'); return; }
    const first=seasons[0];
    const tid=first.uniqueTournament?.id||first.id||P_TOURNAMENT_ID;
    const sid=first.seasons?.[0]?.id||first.season?.id||first.id||0;
    if(!sid){ document.getElementById('ppSeasonStats').innerHTML=emptyBox('No season ID available.'); return; }
    // GET /player/{id}/unique-tournament/{tid}/season/{sid}/statistics/overall
    const statsD=await sa7(`/player/${PLAYER_ID}/unique-tournament/${tid}/season/${sid}/statistics/overall`);
    const stats=statsD.statistics||statsD.stats||statsD;
    if(!stats||typeof stats!=='object'){ document.getElementById('ppSeasonStats').innerHTML=emptyBox('Stats unavailable.'); return; }
    const seasonName=first.seasons?.[0]?.year||first.name||'Season';
    const tourName=first.uniqueTournament?.name||first.name||'';
    let h=`<div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--amber);margin-bottom:.8rem">${tourName} — ${seasonName}</div>`;
    const groups=[
      {label:'Attacking',keys:['goals','assists','totalShots','shotsOnTarget','goalsFromInsideBox','goalsFromOutsideBox','bigChancesCreated']},
      {label:'Passing',keys:['accuratePassesPercentage','keyPasses','accurateLongBallsPercentage','crosses','accurateCrossesPercentage']},
      {label:'Defending',keys:['tackles','interceptions','clearances','blockedShots','dribbledPast']},
      {label:'Discipline',keys:['yellowCards','redCards','fouls','offsides']},
      {label:'General',keys:['appearances','minutesPlayed','rating','successfulDribbles']},
    ];
    groups.forEach(group=>{
      const items=group.keys.map(k=>{ if(stats[k]==null) return null; const l=k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()); return [l,typeof stats[k]==='number'&&stats[k]%1!==0?stats[k].toFixed(1):stats[k]]; }).filter(Boolean);
      if(!items.length) return;
      h+=`<div class="stat-group"><div class="stat-group-title">${group.label}</div><div class="nat-grid">`;
      items.forEach(([l,v])=>{ h+=`<div class="nat-box"><div class="nat-val">${v}</div><div class="nat-lbl">${l}</div></div>`; });
      h+='</div></div>';
    });
    // Season selector
    if(seasons.length>1){
      h+=`<div style="margin-top:1rem;font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text-muted);margin-bottom:.5rem">Other Seasons</div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">`;
      seasons.slice(1,6).forEach(s=>{
        const stid=s.uniqueTournament?.id||s.id||P_TOURNAMENT_ID;
        const ssid=s.seasons?.[0]?.id||s.season?.id||s.id||0;
        h+=`<button class="filter-btn" onclick="loadPlayerSeasonById(${stid},${ssid},'${s.seasons?.[0]?.year||s.name||s.id}')">${s.seasons?.[0]?.year||s.name||s.id}</button>`;
      });
      h+='</div>';
    }
    document.getElementById('ppSeasonStats').innerHTML=h;
  }catch(e){ document.getElementById('ppSeasonStats').innerHTML=errBox(e); }
}

async function loadPlayerSeasonById(tid,sid,label){
  const el=document.getElementById('ppSeasonStats');
  if(!el) return;
  const bottom=el.querySelector('[style*="Other Seasons"]')?.parentNode?.outerHTML||'';
  el.querySelector('.nat-grid')?.closest('.stat-group')?.previousSibling?.remove?.();
  el.innerHTML=spin();
  try{
    const statsD=await sa7(`/player/${PLAYER_ID}/unique-tournament/${tid}/season/${sid}/statistics/overall`);
    const stats=statsD.statistics||statsD.stats||statsD;
    // Re-render (simplified re-use of above logic)
    el.innerHTML=`<div style="font-size:.62rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--amber);margin-bottom:.8rem">${label}</div>`;
    const groups=[{label:'Attacking',keys:['goals','assists','totalShots','shotsOnTarget']},{label:'Passing',keys:['accuratePassesPercentage','keyPasses']},{label:'General',keys:['appearances','minutesPlayed','rating']}];
    groups.forEach(g=>{
      const items=g.keys.map(k=>stats[k]!=null?[k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()),typeof stats[k]==='number'&&stats[k]%1!==0?stats[k].toFixed(1):stats[k]]:null).filter(Boolean);
      if(!items.length) return;
      el.innerHTML+=`<div class="stat-group"><div class="stat-group-title">${g.label}</div><div class="nat-grid">${items.map(([l,v])=>`<div class="nat-box"><div class="nat-val">${v}</div><div class="nat-lbl">${l}</div></div>`).join('')}</div></div>`;
    });
  }catch(e){ el.innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// RATINGS
// Endpoints:
//   GET /player/{id}/statistics/seasons → get tid, sid
//   GET /player/{id}/unique-tournament/{tid}/season/{sid}/ratings
//   GET /player/{id}/unique-tournament/{tid}/season/{season}/last-ratings
// ══════════════════════════════════════════════════════
async function loadPlayerRatings(){
  try{
    const seasonsD=await sa7(`/player/${PLAYER_ID}/statistics/seasons`);
    const seasons=seasonsD.seasons||seasonsD.uniqueTournamentSeasons||[];
    const first=seasons[0];
    const tid=first?.uniqueTournament?.id||P_TOURNAMENT_ID;
    const sid=first?.seasons?.[0]?.id||first?.season?.id||first?.id||0;
    if(!sid){ document.getElementById('ppRatings').innerHTML=emptyBox('No season data for ratings.'); return; }
    // GET /player/{id}/unique-tournament/{tid}/season/{sid}/ratings
    const d=await sa7(`/player/${PLAYER_ID}/unique-tournament/${tid}/season/${sid}/ratings`);
    const ratings=d.ratings||d.playerRatings||d||[];
    const ratingArr=Array.isArray(ratings)?ratings:Object.values(ratings);
    if(!ratingArr.length){ document.getElementById('ppRatings').innerHTML=emptyBox('Ratings not available.'); return; }
    const maxR=Math.max(...ratingArr.map(r=>parseFloat(r.rating||r.value||0)||0));
    let h='<div class="ratings-chart">';
    ratingArr.slice(0,20).forEach(r=>{
      const rating=parseFloat(r.rating||r.value||0)||0;
      const pct=maxR>0?Math.round(rating/maxR*100):0;
      const label=r.event?(r.event.homeTeam?.shortName||'?')+'–'+(r.event.awayTeam?.shortName||'?'):(r.round||r.match||'');
      h+=`<div class="rb-wrap" title="${label}: ${rating}">
        <div class="rb-bar" style="height:${pct}%"><span class="rb-val">${rating.toFixed(1)}</span></div>
        <div class="rb-lbl">${label}</div>
      </div>`;
    });
    h+=`</div><div style="text-align:center;font-size:.7rem;color:var(--text-muted)">Match ratings — last ${Math.min(ratingArr.length,20)} games</div>`;
    document.getElementById('ppRatings').innerHTML=h;
  }catch(e){ document.getElementById('ppRatings').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// HEATMAP
// Endpoints:
//   GET /player/{id}/statistics/seasons → get tid, sid
//   GET /player/{id}/unique-tournament/{tid}/season/{sid}/heatmap
// Also available: GET /event/{id}/player/{playerId}/heatmap (per-match)
// ══════════════════════════════════════════════════════
async function loadPlayerHeatmap(){
  try{
    const seasonsD=await sa7(`/player/${PLAYER_ID}/statistics/seasons`);
    const first=(seasonsD.seasons||seasonsD.uniqueTournamentSeasons||[])[0];
    const tid=first?.uniqueTournament?.id||P_TOURNAMENT_ID;
    const sid=first?.seasons?.[0]?.id||first?.season?.id||first?.id||0;
    if(!sid){ document.getElementById('ppHeatmap').innerHTML=emptyBox('No season data for heatmap.'); return; }
    // GET /player/{id}/unique-tournament/{tid}/season/{sid}/heatmap
    const d=await sa7(`/player/${PLAYER_ID}/unique-tournament/${tid}/season/${sid}/heatmap`);
    const points=d.heatmap||d.points||d.data||[];
    if(!points.length){ document.getElementById('ppHeatmap').innerHTML=emptyBox('Heatmap data not available.'); return; }
    const W=360, H=240;
    const maxVal=Math.max(...points.map(p=>parseFloat(p.value||p.count||1)||1));
    let circles='';
    points.forEach(p=>{
      const x=(parseFloat(p.x||p.lng||50)/100)*W;
      const y=(parseFloat(p.y||p.lat||50)/100)*H;
      const v=parseFloat(p.value||p.count||1)||1;
      const intensity=v/maxVal;
      const r=Math.max(8,intensity*24);
      const opacity=(0.2+intensity*0.6).toFixed(2);
      const g=Math.round(100+intensity*130);
      circles+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="rgba(245,${g},11,${opacity})"/>`;
    });
    const svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;border-radius:8px;display:block;margin:0 auto">
      <rect width="${W}" height="${H}" fill="#0c1a0c" rx="6"/>
      <rect x="2" y="2" width="${W-4}" height="${H-4}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.5" rx="4"/>
      <line x1="${W/2}" y1="0" x2="${W/2}" y2="${H}" stroke="rgba(255,255,255,.1)" stroke-width="1"/>
      <circle cx="${W/2}" cy="${H/2}" r="28" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1"/>
      <rect x="2" y="${H/2-33}" width="60" height="66" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1"/>
      <rect x="${W-62}" y="${H/2-33}" width="60" height="66" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1"/>
      ${circles}
    </svg>`;
    document.getElementById('ppHeatmap').innerHTML=`${svg}<div style="text-align:center;font-size:.7rem;color:var(--text-muted);margin-top:.6rem">Position heatmap — brighter = more frequent</div>`;
  }catch(e){ document.getElementById('ppHeatmap').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// TRANSFER HISTORY
// Endpoint: GET /player/{id}/transfer-history
// ══════════════════════════════════════════════════════
async function loadPlayerTransfers(){
  try{
    const d=await sa7(`/player/${PLAYER_ID}/transfer-history`);
    const transfers=d.transferHistory||d.transfers||[];
    if(!transfers.length){ document.getElementById('ppTransfers').innerHTML=emptyBox('No transfer history found.'); return; }
    let h='';
    transfers.forEach(t=>{
      const fromTeam=t.fromTeam||t.from||{}; const toTeam=t.toTeam||t.to||{};
      const fromName=fromTeam.name||fromTeam.shortName||'—';
      const toName=toTeam.name||toTeam.shortName||'—';
      const fromLogo=fromTeam.image||fromTeam.logo||'';
      const toLogo=toTeam.image||toTeam.logo||'';
      const fee=t.fee||t.transferFee||t.value||'';
      const feeStr=fee&&fee!=='0'?(typeof fee==='number'?'€'+Number(fee).toLocaleString():fee):'Free';
      const dateStr=fmtDate(t.transferDate||t.date||0);
      const typeRaw=String(t.type||t.transferType||'').toLowerCase();
      const typeLabel=typeRaw.includes('loan')?'🔄 Loan':typeRaw.includes('free')||feeStr==='Free'?'📋 Free':'✅ Transfer';
      h+=`<div class="ptr-row">
        <span class="ptr-date">${dateStr}</span>
        <div class="ptr-club">${fromLogo?`<img src="${fromLogo}" style="width:16px;height:16px;object-fit:contain" alt="" onerror="this.style.display='none'">`:''}<span>${fromName}</span></div>
        <span class="ptr-arrow">→</span>
        <div class="ptr-club">${toLogo?`<img src="${toLogo}" style="width:16px;height:16px;object-fit:contain" alt="" onerror="this.style.display='none'">`:''}<span>${toName}</span></div>
        <span style="font-size:.62rem;color:var(--text-muted);flex-shrink:0">${typeLabel}</span>
        <span class="ptr-fee">${feeStr}</span>
      </div>`;
    });
    document.getElementById('ppTransfers').innerHTML=h;
  }catch(e){ document.getElementById('ppTransfers').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// PENALTY HISTORY
// Endpoints:
//   GET /player/{id}/penalty-history
//   GET /player/{id}/penalty-history/unique-tournament/{tid}/season/{sid}
// ══════════════════════════════════════════════════════
async function loadPlayerPenalties(){
  try{
    // GET /player/{id}/penalty-history
    const d=await sa7(`/player/${PLAYER_ID}/penalty-history`);
    const arr=Array.isArray(d.penalties||d.penaltyHistory||d)?d.penalties||d.penaltyHistory||d:[];
    if(!arr.length){ document.getElementById('ppPenalties').innerHTML=emptyBox('No penalty history found.'); return; }
    const scored=arr.filter(p=>String(p.shotType||p.outcome||'').toLowerCase()==='goal').length;
    const missed=arr.length-scored;
    let h=`<div class="nat-grid" style="margin-bottom:1rem">
      <div class="nat-box"><div class="nat-val" style="color:var(--win)">${scored}</div><div class="nat-lbl">Scored</div></div>
      <div class="nat-box"><div class="nat-val" style="color:var(--loss)">${missed}</div><div class="nat-lbl">Missed</div></div>
      <div class="nat-box"><div class="nat-val">${arr.length}</div><div class="nat-lbl">Total</div></div>
      <div class="nat-box"><div class="nat-val">${arr.length>0?Math.round(scored/arr.length*100):0}%</div><div class="nat-lbl">Success</div></div>
    </div>`;
    arr.forEach(p=>{
      const isGoal=String(p.shotType||p.outcome||'').toLowerCase()==='goal';
      const match=p.event?(p.event.homeTeam?.name||'?')+' vs '+(p.event.awayTeam?.name||'?'):'';
      const date=p.event?.startTimestamp?fmtDateShort(p.event.startTimestamp):'';
      h+=`<div style="display:flex;align-items:center;gap:.7rem;padding:.35rem .5rem;border-bottom:1px solid rgba(255,255,255,.03);font-size:.8rem">
        <span style="font-size:1rem">${isGoal?'✅':'❌'}</span>
        <div style="flex:1"><div style="font-weight:700;font-size:.78rem;color:${isGoal?'var(--win)':'var(--loss)'}">${isGoal?'Scored':'Missed'}</div>${match?`<div style="font-size:.7rem;color:var(--text-muted)">${match}</div>`:''}</div>
        <span style="font-size:.65rem;color:var(--text-muted)">${date}</span>
      </div>`;
    });
    document.getElementById('ppPenalties').innerHTML=h;
  }catch(e){ document.getElementById('ppPenalties').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// NATIONAL TEAM
// Endpoint: GET /player/{id}/national-team-statistics
// ══════════════════════════════════════════════════════
async function loadPlayerNational(){
  try{
    const d=await sa7(`/player/${PLAYER_ID}/national-team-statistics`);
    const stats=d.statistics||d.nationalTeamStatistics||d||{};
    if(!stats||typeof stats!=='object'||!Object.keys(stats).length){
      document.getElementById('ppNational').innerHTML=emptyBox('No national team data available.'); return;
    }
    const keyStats=[['Caps',stats.appearances??stats.caps],['Goals',stats.goals],['Assists',stats.assists],['Rating',stats.rating?.toFixed?stats.rating.toFixed(1):stats.rating],['Minutes',stats.minutesPlayed],['Yellow Cards',stats.yellowCards],['Red Cards',stats.redCards]].filter(([,v])=>v!=null);
    let h=`<div class="nat-grid">`;
    keyStats.forEach(([l,v])=>{ h+=`<div class="nat-box"><div class="nat-val">${v}</div><div class="nat-lbl">${l}</div></div>`; });
    h+='</div>';
    const team=d.team||stats.team||{};
    if(team.name){
      h+=`<div class="info-table" style="margin-top:.8rem"><div class="info-row">
        ${team.image?`<img src="${team.image}" style="width:28px;height:28px;object-fit:contain;margin-right:.4rem" alt="">`:''}<span class="info-value" style="font-weight:700">${team.name}</span></div></div>`;
    }
    document.getElementById('ppNational').innerHTML=h;
  }catch(e){ document.getElementById('ppNational').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// RECENT GAMES
// Endpoints:
//   GET /player/{id}/events/last/0   — most recent
//   GET /player/{id}/events/{span}/{page}  — span: last/next
//   GET /player/{id}/team/{teamId}/events/{span}/{page}
//   GET /player/{id}/unique-tournament/{tid}/events/{span}/{page}
// ══════════════════════════════════════════════════════
async function loadPlayerGames(){
  try{
    // GET /player/{id}/events/last/0
    const d=await sa7(`/player/${PLAYER_ID}/events/last/0`);
    const evs=d.events||[];
    if(!evs.length){ document.getElementById('ppGames').innerHTML=emptyBox('No recent games found.'); return; }
    let h='';
    evs.slice(0,15).forEach(ev=>{
      const hN=ev.homeTeam?.name||'Home', aN=ev.awayTeam?.name||'Away';
      const hG=ev.homeScore?.current??'—', aG=ev.awayScore?.current??'—';
      const dateStr=ev.startTimestamp?fmtDateShort(ev.startTimestamp):'';
      const status=ev.status?.description||'';
      h+=`<div class="near-row" onclick="openEventModal(${ev.id||0})">
        <div class="near-teams">${hN} vs ${aN}</div>
        <div class="near-score">${hG}–${aG}</div>
        <div class="near-date">${dateStr} <span style="font-size:.6rem;color:var(--text-muted)">${status}</span></div>
      </div>`;
    });
    document.getElementById('ppGames').innerHTML=h;
  }catch(e){ document.getElementById('ppGames').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// MEDIA
// Endpoint: GET /player/{id}/media
// ══════════════════════════════════════════════════════
async function loadPlayerMedia(){
  try{
    const d=await sa7(`/player/${PLAYER_ID}/media`);
    const items=d.media||d.videos||d.highlights||[];
    if(!items.length){ document.getElementById('ppMedia').innerHTML=emptyBox('No media available for this player.'); return; }
    let h='<div class="media-grid">';
    items.slice(0,12).forEach(m=>{
      const url=m.url||m.videoUrl||m.link||'#';
      const thumb=m.thumbnailUrl||m.thumbnail||m.image||'';
      const title=m.title||m.name||'Media';
      h+=`<a class="media-card" href="${url}" target="_blank" rel="noopener">
        <div class="media-thumb">${thumb?`<img src="${thumb}" alt="${title}" onerror="this.parentNode.innerHTML='🎬'">`:'🎬'}</div>
        <div class="media-title">${title}</div>
      </a>`;
    });
    document.getElementById('ppMedia').innerHTML=h+'</div>';
  }catch(e){ document.getElementById('ppMedia').innerHTML=errBox(e); }
}

// ══════════════════════════════════════════════════════
// ADDITIONAL ENDPOINTS (available for future use)
// ══════════════════════════════════════════════════════
// GET /player/{id}/unique-tournament-season-teams  — list of all team/season combos
// GET /player/{id}/unique-tournament/{tid}/team/{teamId}/events/{span}/{page}
// GET /player/{id}/team/{teamId}/events/{span}/{page}
// GET /player/{id}/unique-tournament/{tid}/season/{sid}/shot-actions/overall
// GET /player/{id}/unique-tournament/{tid}/season/{season}/last-ratings
// GET /player/{id}/unique-tournament/{tid}/events/{span}/{page}
// GET /player/{id}/image  — returns raw image (used in img src)
