// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
const SK   = 'rpi_termine_v4';
const SETT = 'rpi_settings_v4';
let appts = [];
let pendingDeleteId = null;
let miniCalViewDate = new Date();
let selectedDate    = null;
let calMode = 'month'; // day | week | month | year
let calViewDate = new Date();
let yearViewYear = new Date().getFullYear();
let settings = {
  timeFmt: '24', seconds: 'yes',
  fontSize: 1, startView: 'today', showPast: 'show', theme: 'dark'
};

// ── PERSIST – Flask API ─────────────────────────────
// Termine und Einstellungen werden über den lokalen
// Python-Server (server.py) in JSON-Dateien gespeichert.
const API = 'http://127.0.0.1:5000/api';

async function loadData() {
  try {
    const [rT, rS] = await Promise.all([
      fetch(`${API}/termine`),
      fetch(`${API}/settings`)
    ]);
    if (rT.ok) appts    = await rT.json();
    if (rS.ok) {
      const s = await rS.json();
      if (s && Object.keys(s).length) settings = { ...settings, ...s };
    }
  } catch(e) {
    console.warn('Server nicht erreichbar, starte leer.', e);
  }
}

function save() {
  fetch(`${API}/termine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appts)
  }).catch(e => console.error('Fehler beim Speichern der Termine:', e));
}

function saveSett() {
  fetch(`${API}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  }).catch(e => console.error('Fehler beim Speichern der Einstellungen:', e));
}

// ── HELPERS ─────────────────────────────────
function toDS(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function esc(s)  { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTHS_SHORT = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const DAYS   = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const DAYS_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa'];

// ── CLOCK ────────────────────────────────────
function tick() {
  const now = new Date();
  const h=String(now.getHours()).padStart(2,'0');
  const m=String(now.getMinutes()).padStart(2,'0');
  const s=String(now.getSeconds()).padStart(2,'0');
  document.getElementById('clock').textContent = `${h}:${m}:${s}`;
  document.getElementById('clock-date').textContent =
    `${DAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  updateNextAppt(now);
  updateDayProgress(now);
  if (calMode==='week'  && document.getElementById('calendar-view').classList.contains('active')) drawWeekNowLine();
  if (calMode==='day'   && document.getElementById('calendar-view').classList.contains('active')) drawDayNowLine();
}

// ── DAY PROGRESS ─────────────────────────────
function updateDayProgress(now) {
  const pct = Math.round(((now.getHours()*60+now.getMinutes()+now.getSeconds()/60)/(24*60))*100);
  document.getElementById('day-progress-fill').style.width = pct+'%';
  document.getElementById('day-progress-pct').textContent  = pct+'%';
  const track = document.getElementById('day-progress-track');
  track.querySelectorAll('.day-progress-appt-marker').forEach(m=>m.remove());
  const ds = toDS(now);
  appts.filter(a=>a.date===ds&&a.time).forEach(a=>{
    const[h,m]=a.time.split(':').map(Number);
    const pos=((h*60+m)/(24*60))*100;
    const mk=document.createElement('div');
    mk.className='day-progress-appt-marker';
    mk.style.left=pos+'%';
    mk.setAttribute('data-title',a.time+' '+a.title);
    mk.title=a.time+' – '+a.title;
    track.appendChild(mk);
  });
}

function updateNextAppt(now) {
  const ds=toDS(now), cur=now.getHours()*60+now.getMinutes();
  const todayA=appts.filter(a=>a.date===ds&&a.time).sort((a,b)=>a.time.localeCompare(b.time));
  const el=document.getElementById('next-appt');
  const cur45=todayA.find(a=>{ const[h,m]=a.time.split(':').map(Number); const d=(h*60+m)-cur; return d>=0&&d<=45; });
  if(cur45){ el.textContent=`⏰ Gleich: ${cur45.time} – ${esc(cur45.title)}`; el.classList.add('urgent'); return; }
  const next=todayA.find(a=>{ const[h,m]=a.time.split(':').map(Number); return(h*60+m)>cur; });
  el.classList.remove('urgent');
  el.textContent = next ? `Nächster: ${next.time} – ${esc(next.title)}`
    : todayA.length ? 'Alle Termine erledigt' : 'Keine Termine heute';
}

// ── VIEW SWITCH ──────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(name+'-view').classList.add('active');
  document.getElementById('tab-'+name).classList.add('active');
  if(name==='today')    renderToday();
  if(name==='calendar') renderCalBody();
}

// ═══════════════════════════════════════════
//  TODAY VIEW
// ═══════════════════════════════════════════
function renderToday() {
  const ds=toDS(new Date()), now=new Date(), cur=now.getHours()*60+now.getMinutes();
  let list=appts.filter(a=>a.date===ds).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
  if(settings.showPast==='hide') list=list.filter(a=>{ if(!a.time)return true; const[h,m]=a.time.split(':').map(Number); return(h*60+m)>=cur; });
  const cont=document.getElementById('appointments-list');
  const noEl=document.getElementById('no-appts');
  if(list.length===0){ noEl.style.display='block'; cont.querySelectorAll('.appt-card').forEach(c=>c.remove()); return; }
  noEl.style.display='none';
  cont.querySelectorAll('.appt-card').forEach(c=>c.remove());
  list.forEach((a,i)=>{
    let state='';
    if(a.time){ const[h,m]=a.time.split(':').map(Number), mins=h*60+m; if(mins<cur)state='past'; else if(mins-cur<=45)state='now'; }
    const card=document.createElement('div');
    card.className='appt-card '+state;
    card.style.animationDelay=(i*0.05)+'s';
    card.style.cursor='pointer';
    card.addEventListener('click', e=>{ if(!e.target.closest('.appt-del-btn')) openEditModal(a.id); });
    card.innerHTML=`<div class="appt-stripe"></div><div class="appt-inner"><div class="appt-time-col"><div class="appt-time">${esc(a.time||'–')}</div>${a.endtime?`<div style="font-size:10px;color:var(--muted2);font-family:'IBM Plex Mono',monospace;margin-top:2px;">bis ${esc(a.endtime)}</div>`:''}</div><div class="appt-divider"></div><div class="appt-body"><div class="appt-title">${esc(a.title)}</div>${a.note?`<div class="appt-note">${esc(a.note)}</div>`:''}</div>${state==='now'?'<div class="appt-badge">Jetzt</div>':''}<button class="appt-del-btn" onclick="askDelete('${a.id}')" title="Löschen">&#10005;</button></div>`;
    cont.appendChild(card);
  });
  renderMiniCal();
}

// ── MINI CALENDAR ────────────────────────────
function renderMiniCal() {
  const y=miniCalViewDate.getFullYear(), m=miniCalViewDate.getMonth(), today=toDS(new Date());
  document.getElementById('mini-month-lbl').textContent=`${MONTHS_SHORT[m]} ${y}`;
  const dayNms=['Mo','Di','Mi','Do','Fr','Sa','So'];
  let html=dayNms.map(d=>`<div class="mini-day-name">${d}</div>`).join('');
  let dow=new Date(y,m,1).getDay(); dow=dow===0?6:dow-1;
  const last=new Date(y,m+1,0).getDate();
  for(let i=0;i<dow;i++) html+=`<div class="mini-day empty"></div>`;
  for(let d=1;d<=last;d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isT=ds===today, hasA=appts.some(a=>a.date===ds);
    html+=`<div class="mini-day${isT?' today':''}${hasA?' has-appt':''}" onclick="miniDayClick('${ds}')">${d}</div>`;
  }
  document.getElementById('mini-grid').innerHTML=html;
}

function miniCalNav(dir){ miniCalViewDate.setMonth(miniCalViewDate.getMonth()+dir); renderMiniCal(); }
function miniDayClick(ds){ calViewDate=new Date(ds+'T12:00:00'); calMode='day'; showView('calendar'); updateCalSubTabs(); }

// ═══════════════════════════════════════════
//  CALENDAR – MODE CONTROLLER
// ═══════════════════════════════════════════
function setCalMode(mode) {
  calMode = mode;
  updateCalSubTabs();
  renderCalBody();
}

function updateCalSubTabs() {
  document.querySelectorAll('.cal-sub-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('csub-'+calMode).classList.add('active');
}

function calNavStep(dir) {
  if(calMode==='day')   calViewDate.setDate(calViewDate.getDate()+dir);
  if(calMode==='week')  calViewDate.setDate(calViewDate.getDate()+dir*7);
  if(calMode==='month') calViewDate.setMonth(calViewDate.getMonth()+dir);
  if(calMode==='year')  calViewDate.setFullYear(calViewDate.getFullYear()+dir);
  renderCalBody();
}

function calGoToday() {
  calViewDate = new Date();
  renderCalBody();
}

function renderCalBody() {
  if(calMode==='day')   renderDayView();
  if(calMode==='week')  renderWeekView();
  if(calMode==='month') renderMonthView();
  if(calMode==='year')  renderYearViewInCal();
}

// ── PERIOD LABEL ─────────────────────────────
function setPeriodLabel(txt) {
  document.getElementById('cal-period-label').textContent = txt;
}

// ═══════════════════════════════════════════
//  DAY VIEW
// ═══════════════════════════════════════════
function renderDayView() {
  const y=calViewDate.getFullYear(), m=calViewDate.getMonth(), d=calViewDate.getDate();
  const ds=toDS(calViewDate);
  const today=toDS(new Date());
  const isToday=ds===today;
  setPeriodLabel(`${DAYS[calViewDate.getDay()]}, ${d}. ${MONTHS_SHORT[m]} ${y}`);

  const dayAppts=appts.filter(a=>a.date===ds).sort((a,b)=>(a.time||'').localeCompare(b.time||''));

  let hourRows='';
  for(let h=0;h<24;h++){
    const hAppts=dayAppts.filter(a=>a.time&&parseInt(a.time.split(':')[0])===h);
    const blocks=hAppts.map(a=>`<div class="day-appt-block" onclick="event.stopPropagation();openEditModal('${a.id}')"><span class="day-appt-time">${esc(a.time)}</span>${esc(a.title)}${a.endtime?`<span class="day-appt-time"> – ${esc(a.endtime)}</span>`:''}</div>`).join('');
    const hStr=String(h).padStart(2,'0');
    hourRows+=`<div class="day-hour-row" id="dhr-${h}" onclick="openModal('${ds}','${hStr}:00')" style="cursor:pointer;"><div class="day-hour-label">${hStr}:00</div><div class="day-hour-content">${blocks}</div></div>`;
  }

  // Detail side panel
  let sideHtml=`<div id="day-detail-date">${d}. ${MONTHS[m]} ${y}${isToday?' — Heute':''}</div>`;
  sideHtml+=`<button id="day-detail-add" onclick="openModal('${ds}')">+ Termin</button>`;
  if(dayAppts.length===0){
    sideHtml+=`<div id="day-detail-empty">Keine Termine.</div>`;
  } else {
    sideHtml+=dayAppts.map(a=>`<div class="detail-appt fade-in" style="cursor:pointer;" onclick="openEditModal('${a.id}')"><div class="detail-time">${esc(a.time||'–')}${a.endtime?`<div style="font-size:10px;color:var(--muted);">– ${esc(a.endtime)}</div>`:''}</div><div class="detail-body"><div class="detail-title">${esc(a.title)}</div>${a.note?`<div class="detail-note">${esc(a.note)}</div>`:''}</div><button class="detail-del" onclick="event.stopPropagation();askDelete('${a.id}',true,'${a.date}')" title="Löschen">&#10005;</button></div>`).join('');
  }

  document.getElementById('cal-body').innerHTML=`
    <div id="day-view-wrap">
      <div id="day-timeline">
        <div id="day-date-header">${DAYS[calViewDate.getDay()]} – ${d}. ${MONTHS[m]} ${y}</div>
        ${hourRows}
      </div>
      <div id="day-side-panel">${sideHtml}</div>
    </div>`;

  if(isToday) drawDayNowLine();

  // Scroll to current hour
  if(isToday){
    const curHour=new Date().getHours();
    const row=document.getElementById('dhr-'+Math.max(0,curHour-1));
    if(row) setTimeout(()=>row.scrollIntoView({behavior:'smooth',block:'start'}),100);
  }
}

function drawDayNowLine() {
  const existing=document.getElementById('day-now-row'); if(existing){existing.remove();}
  const now=new Date(), h=now.getHours(), m=now.getMinutes();
  const row=document.getElementById('dhr-'+h);
  if(!row) return;
  const pct=(m/60)*100;
  const line=document.createElement('div');
  line.id='day-now-row';
  line.style.cssText=`position:absolute;left:52px;right:0;top:${pct}%;height:2px;background:var(--accent);z-index:5;pointer-events:none;`;
  const dot=document.createElement('div');
  dot.style.cssText=`position:absolute;left:-6px;top:-4px;width:10px;height:10px;background:var(--accent);border-radius:50%;`;
  line.appendChild(dot);
  row.style.position='relative';
  row.appendChild(line);
}

// ═══════════════════════════════════════════
//  WEEK VIEW
// ═══════════════════════════════════════════
function getWeekStart(d) {
  const dt=new Date(d); let dow=dt.getDay(); dow=dow===0?6:dow-1;
  dt.setDate(dt.getDate()-dow); return dt;
}

function renderWeekView() {
  const ws=getWeekStart(calViewDate);
  const we=new Date(ws); we.setDate(ws.getDate()+6);
  const today=toDS(new Date());
  setPeriodLabel(`${ws.getDate()}. ${MONTHS_SHORT[ws.getMonth()]} – ${we.getDate()}. ${MONTHS_SHORT[we.getMonth()]} ${we.getFullYear()}`);

  // Day headers
  let hdrHtml=`<div class="week-day-col-hdr" style="background:var(--surface);border:none;"></div>`;
  for(let i=0;i<7;i++){
    const dt=new Date(ws); dt.setDate(ws.getDate()+i);
    const ds=toDS(dt); const isT=ds===today;
    hdrHtml+=`<div class="week-day-col-hdr${isT?' today-col':''}"><span>${DAYS_SHORT[(dt.getDay())]}</span><span class="wday-num">${dt.getDate()}</span></div>`;
  }

  // Time rows + day columns
  let timeCol='';
  for(let h=0;h<24;h++) timeCol+=`<div class="week-time-slot">${String(h).padStart(2,'0')}:00</div>`;

  let dayCols='';
  for(let i=0;i<7;i++){
    const dt=new Date(ws); dt.setDate(ws.getDate()+i);
    const ds=toDS(dt); const isT=ds===today;
    const dayAppts=appts.filter(a=>a.date===ds&&a.time);
    let rows=''; for(let h=0;h<24;h++) rows+=`<div class="week-hour-row" onclick="openModal('${ds}','${String(h).padStart(2,'0')}:00')" style="cursor:pointer;"></div>`;
    const blocks=dayAppts.map(a=>{
      const[ah,am]=a.time.split(':').map(Number);
      const topPct=((ah*60+am)/(24*60))*100;
      return `<div class="week-appt-block" style="top:${topPct}%;height:calc(52px * 0.85);cursor:pointer;" title="${esc(a.time)} – ${esc(a.title)}" onclick="event.stopPropagation();openEditModal('${a.id}')">${esc(a.time)} ${esc(a.title)}</div>`;
    }).join('');
    dayCols+=`<div class="week-day-col${isT?' today-col':''}" id="wcol-${ds}">${rows}${blocks}</div>`;
  }

  document.getElementById('cal-body').innerHTML=`
    <div id="week-view-wrap">
      <div id="week-header-row">${hdrHtml}</div>
      <div id="week-grid-scroll">
        <div id="week-grid">
          <div class="week-time-col">${timeCol}</div>
          ${dayCols}
        </div>
      </div>
    </div>`;

  drawWeekNowLine();

  // Scroll to now
  const curH=new Date().getHours();
  const scroll=document.getElementById('week-grid-scroll');
  if(scroll) setTimeout(()=>{ scroll.scrollTop=Math.max(0,(curH-1)*52); },100);
}

function drawWeekNowLine(){
  document.querySelectorAll('.week-now-line').forEach(l=>l.remove());
  const now=new Date(), ds=toDS(now);
  const col=document.getElementById('wcol-'+ds);
  if(!col) return;
  const pct=((now.getHours()*60+now.getMinutes())/(24*60))*100;
  const line=document.createElement('div');
  line.className='week-now-line';
  line.style.top=pct+'%';
  col.appendChild(line);
}

// ═══════════════════════════════════════════
//  MONTH VIEW
// ═══════════════════════════════════════════
function renderMonthView() {
  const y=calViewDate.getFullYear(), m=calViewDate.getMonth(), today=toDS(new Date());
  setPeriodLabel(`${MONTHS[m]} ${y}`);
  const dn=['Mo','Di','Mi','Do','Fr','Sa','So'];
  let dnHtml=dn.map(d=>`<div class="month-dn">${d}</div>`).join('');
  let dow=new Date(y,m,1).getDay(); dow=dow===0?6:dow-1;
  const last=new Date(y,m+1,0).getDate();
  let html='';
  for(let i=0;i<dow;i++) html+=`<div class="month-cell empty"></div>`;
  for(let d=1;d<=last;d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isT=ds===today, isSel=ds===selectedDate;
    const dayA=appts.filter(a=>a.date===ds).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    const banners=dayA.slice(0,3).map(a=>`<div class="month-appt-banner" onclick="event.stopPropagation();openEditModal('${a.id}')" style="cursor:pointer;">${a.time?a.time+' ':''}${esc(a.title)}</div>`).join('');
    const extra=dayA.length>3?`<div class="month-appt-banner more" onclick="event.stopPropagation();">+${dayA.length-3}</div>`:'';
    html+=`<div class="month-cell${isT?' today':''}${isSel?' selected':''}" onclick="monthDayClick('${ds}')"><div class="month-cell-num">${d}</div>${banners}${extra}</div>`;
  }
  const total=dow+last, rem=total%7===0?0:7-(total%7);
  for(let i=0;i<rem;i++) html+=`<div class="month-cell empty other-month"></div>`;

  document.getElementById('cal-body').innerHTML=`
    <div id="month-view-wrap">
      <div id="month-label-row">${dnHtml}</div>
      <div id="month-grid">${html}</div>
    </div>`;
}

function monthDayClick(ds){
  // Open appointment modal pre-filled with the clicked date
  openModal(ds);
}

// ═══════════════════════════════════════════
//  YEAR VIEW (in calendar)
// ═══════════════════════════════════════════
function renderYearViewInCal() {
  const y=calViewDate.getFullYear(), today=toDS(new Date()), curY=new Date().getFullYear();
  setPeriodLabel(`${y}`);
  let monthsHtml='';
  for(let mi=0;mi<12;mi++){
    const isCurM=(y===curY&&mi===new Date().getMonth());
    const dayNms=['Mo','Di','Mi','Do','Fr','Sa','So'];
    let dayNmH=dayNms.map(d=>`<div class="year-mini-day-name">${d}</div>`).join('');
    let dow=new Date(y,mi,1).getDay(); dow=dow===0?6:dow-1;
    const last=new Date(y,mi+1,0).getDate();
    let daysH=''; for(let i=0;i<dow;i++) daysH+=`<div class="year-mini-day empty"></div>`;
    const mAppts=[];
    for(let d=1;d<=last;d++){
      const ds=`${y}-${String(mi+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isT=ds===today;
      const dA=appts.filter(a=>a.date===ds);
      if(dA.length) dA.forEach(a=>mAppts.push({d,ds,a}));
      daysH+=`<div class="year-mini-day${isT?' today':''}${dA.length?' has-appt':''}" onclick="event.stopPropagation();yearInCalDayClick('${ds}')">${d}</div>`;
    }
    const sorted=mAppts.sort((x,yy)=>x.ds.localeCompare(yy.ds)||((x.a.time||'').localeCompare(yy.a.time||'')));
    const shown=sorted.slice(0,4);
    const extra=sorted.length-shown.length;
    let bannersHtml=shown.map(({d,a})=>`<div class="year-appt-banner">${String(d).padStart(2,'0')}. ${a.time?a.time+' ':''}${esc(a.title)}</div>`).join('');
    if(extra>0) bannersHtml+=`<div class="year-appt-banner more">+${extra} weitere</div>`;
    monthsHtml+=`<div class="year-month-card${isCurM?' current-month':''}" onclick="yearInCalMonthClick(${y},${mi})">
      <div class="year-month-name">${MONTHS[mi]}</div>
      <div class="year-mini-grid">${dayNmH}${daysH}</div>
      ${sorted.length?`<div class="year-appt-banners">${bannersHtml}</div>`:''}
    </div>`;
  }
  document.getElementById('cal-body').innerHTML=`<div id="year-view-wrap"><div id="year-months-grid">${monthsHtml}</div></div>`;
}

function yearInCalDayClick(ds){
  calViewDate=new Date(ds+'T12:00:00');
  calMode='day'; updateCalSubTabs(); renderCalBody();
}
function yearInCalMonthClick(y,m){
  calViewDate=new Date(y,m,1);
  calMode='month'; updateCalSubTabs(); renderCalBody();
}

// ═══════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════
let _editId = null;

function openModal(date, prefillTime){
  _editId = null;
  document.getElementById('modal-heading').textContent = 'Termin hinzufügen';
  document.querySelector('#modal .btn-confirm').textContent = 'Speichern';
  document.getElementById('f-title').value='';
  document.getElementById('f-date').value=date||toDS(new Date());
  document.getElementById('f-time').value=prefillTime||'';
  document.getElementById('f-endtime').value='';
  document.getElementById('f-note').value='';
  document.getElementById('f-dur-custom').value='';
  document.getElementById('m-duration-display').textContent='';
  document.querySelectorAll('.dur-chip').forEach(c=>c.classList.remove('active'));
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('f-title').focus(),80);
}

function openEditModal(id){
  const a=appts.find(x=>x.id===id);
  if(!a) return;
  _editId=id;
  document.getElementById('modal-heading').textContent = 'Termin bearbeiten';
  document.querySelector('#modal .btn-confirm').textContent = 'Aktualisieren';
  document.getElementById('f-title').value   = a.title   || '';
  document.getElementById('f-date').value    = a.date    || toDS(new Date());
  document.getElementById('f-time').value    = a.time    || '';
  document.getElementById('f-endtime').value = a.endtime || '';
  document.getElementById('f-note').value    = a.note    || '';
  document.getElementById('f-dur-custom').value = '';
  document.querySelectorAll('.dur-chip').forEach(c=>c.classList.remove('active'));
  updateDurationDisplay();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('f-title').focus(),80);
}

function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); _editId=null; }

/* ── DURATION / TIME LOGIC ────────────────── */
function timeToMinutes(t){
  if(!t) return null;
  const [h,m]=t.split(':').map(Number);
  return h*60+m;
}
function minutesToTime(mins){
  if(mins==null||isNaN(mins)) return '';
  mins=((mins%1440)+1440)%1440;
  return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
}
function updateDurationDisplay(){
  const s=timeToMinutes(document.getElementById('f-time').value);
  const e=timeToMinutes(document.getElementById('f-endtime').value);
  const disp=document.getElementById('m-duration-display');
  if(s==null||e==null){ disp.textContent=''; return; }
  let diff=e-s; if(diff<0) diff+=1440;
  if(diff===0){ disp.textContent=''; return; }
  const h=Math.floor(diff/60), m=diff%60;
  disp.textContent='⏱ Dauer: '+(h?h+' Std ':'')+( m?m+' Min':'');
}
function setDuration(mins){
  if(!mins) return;
  document.querySelectorAll('.dur-chip').forEach(c=>c.classList.remove('active'));
  // mark chip active
  document.querySelectorAll('.dur-chip').forEach(c=>{
    if(parseInt(c.textContent)=== Math.round(mins)||
       (mins===60&&c.textContent.includes('1 Std'))||
       (mins===90&&c.textContent.includes('1,5'))||
       (mins===120&&c.textContent.includes('2 Std'))) c.classList.add('active');
  });
  const startVal=document.getElementById('f-time').value;
  const s=timeToMinutes(startVal);
  if(s!=null){
    document.getElementById('f-endtime').value=minutesToTime(s+mins);
  } else {
    // no start time – if endtime set, back-calculate start
    const eVal=document.getElementById('f-endtime').value;
    const e=timeToMinutes(eVal);
    if(e!=null) document.getElementById('f-time').value=minutesToTime(e-mins);
  }
  document.getElementById('f-dur-custom').value=mins;
  updateDurationDisplay();
}
function onStartTimeChange(){
  // if endtime already set, keep duration; else do nothing
  const s=timeToMinutes(document.getElementById('f-time').value);
  const e=timeToMinutes(document.getElementById('f-endtime').value);
  if(s!=null&&e!=null){
    const dur=((e-s)+1440)%1440;
    if(dur>0) document.getElementById('f-dur-custom').value=dur;
  }
  updateDurationDisplay();
}
function onEndTimeChange(){
  const s=timeToMinutes(document.getElementById('f-time').value);
  const e=timeToMinutes(document.getElementById('f-endtime').value);
  document.querySelectorAll('.dur-chip').forEach(c=>c.classList.remove('active'));
  if(s!=null&&e!=null){
    const dur=((e-s)+1440)%1440;
    document.getElementById('f-dur-custom').value=dur||'';
  }
  updateDurationDisplay();
}

function saveAppt(){
  const title=document.getElementById('f-title').value.trim();
  if(!title){ document.getElementById('f-title').focus(); return; }
  const data={ title, date:document.getElementById('f-date').value,
    time:document.getElementById('f-time').value,
    endtime:document.getElementById('f-endtime').value,
    note:document.getElementById('f-note').value.trim() };
  if(_editId){
    const idx=appts.findIndex(x=>x.id===_editId);
    if(idx>-1) appts[idx]={...appts[idx], ...data};
  } else {
    appts.push({id:genId(), ...data});
  }
  save(); closeModal();
  const av=document.querySelector('.view.active')?.id;
  if(av==='today-view')    renderToday();
  if(av==='calendar-view') renderCalBody();
  renderMiniCal();
}

// ═══════════════════════════════════════════
//  DELETE
// ═══════════════════════════════════════════
let _afterDelDs=null, _afterDelCal=false;
function askDelete(id,cal=false,ds=null){ pendingDeleteId=id; _afterDelDs=ds; _afterDelCal=cal; document.getElementById('confirm-overlay').classList.add('open'); }
function closeConfirm(){ document.getElementById('confirm-overlay').classList.remove('open'); pendingDeleteId=null; }
function confirmDelete(){
  if(!pendingDeleteId) return;
  appts=appts.filter(a=>a.id!==pendingDeleteId);
  save(); closeConfirm(); renderToday(); renderMiniCal();
  if(_afterDelCal) renderCalBody();
}

// ═══════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════
function previewFontSize(val){
  document.documentElement.style.setProperty('--fs',val);
  document.getElementById('fs-label').textContent=Math.round(val*100)+'%';
}
function saveFontSize(){ settings.fontSize=parseFloat(document.getElementById('fs-slider').value); saveSett(); showBadge('fs-saved'); }
function saveDisplaySettings(){ settings.startView=document.getElementById('s-startview').value; settings.showPast=document.getElementById('s-past').value; saveSett(); showBadge('disp-saved'); renderToday(); }
function showBadge(id){ const el=document.getElementById(id); if(el){ el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2500); } }

function toggleTheme(isWhite){
  settings.theme=isWhite?'white':'dark'; applyTheme(); saveSett();
}
function applyTheme(){
  if(settings.theme==='white'){ document.body.classList.add('white-mode'); document.getElementById('theme-label').textContent='White Mode'; }
  else { document.body.classList.remove('white-mode'); document.getElementById('theme-label').textContent='Dark Mode'; }
  const cb=document.getElementById('theme-toggle-cb');
  if(cb) cb.checked=(settings.theme==='white');
}

function loadSettingsUI(){
  document.getElementById('s-startview').value=settings.startView;
  document.getElementById('s-past').value=settings.showPast;
  document.getElementById('fs-slider').value=settings.fontSize;
  document.getElementById('fs-label').textContent=Math.round(settings.fontSize*100)+'%';
  document.documentElement.style.setProperty('--fs',settings.fontSize);
}

// ═══════════════════════════════════════════
//  HELP
// ═══════════════════════════════════════════
function openHelp() { document.getElementById('help-overlay').classList.add('open'); }
function closeHelp(){ document.getElementById('help-overlay').classList.remove('open'); }

// ═══════════════════════════════════════════
//  KEYBOARD
// ═══════════════════════════════════════════
document.addEventListener('keydown', e=>{
  const mO=document.getElementById('modal-overlay').classList.contains('open');
  const cO=document.getElementById('confirm-overlay').classList.contains('open');
  const hO=document.getElementById('help-overlay').classList.contains('open');
  const tag=document.activeElement.tagName;
  const isInp=['INPUT','TEXTAREA','SELECT'].includes(tag);
  if(e.key==='Escape'){ if(mO)closeModal(); if(cO)closeConfirm(); if(hO)closeHelp(); return; }
  if(e.key==='Enter'&&mO){ saveAppt(); return; }
  if((e.key==='h'||e.key==='H')&&!isInp){ openHelp(); return; }
  if(mO||cO||hO||isInp) return;
  if(e.key==='n'||e.key==='N') openModal(null);
  else if(e.key==='1') showView('today');
  else if(e.key==='2') showView('calendar');
  else if(e.key==='3') showView('settings');
  else if(e.key==='ArrowLeft'  && document.getElementById('calendar-view').classList.contains('active')) calNavStep(-1);
  else if(e.key==='ArrowRight' && document.getElementById('calendar-view').classList.contains('active')) calNavStep(1);
});

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
(async () => {
  await loadData();       // Daten vom Server laden (async)
  loadSettingsUI();
  applyTheme();
  showView(settings.startView);
  tick();
  setInterval(tick, 1000);
})();
