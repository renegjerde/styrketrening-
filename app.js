const DEFAULT_EXERCISES = [
  {id:"shoulder",name:"Skulderpress",weight:40,muscles:["Skuldre","Triceps"],icon:"↗"},
  {id:"pulldown",name:"Nedtrekk",weight:50,muscles:["Rygg","Biceps"],icon:"↓"},
  {id:"abs",name:"Magemaskin",weight:45,muscles:["Core"],icon:"✦"},
  {id:"chest",name:"Brystpressmaskin",weight:60,muscles:["Bryst","Skuldre","Triceps"],icon:"↔"},
  {id:"row",name:"Sittende roing",weight:40,muscles:["Rygg","Biceps"],icon:"⇠"},
  {id:"backpress",name:"Sittende ryggpress",weight:90,muscles:["Rygg"],icon:"⌁"},
  {id:"legpress",name:"Beinpress",weight:130,muscles:["Bein","Sete"],icon:"↑"}
];
const STORAGE_KEY="styrkeloggen_v1_data";
let settings={targetReps:12,restSeconds:180,incrementKg:5};
let exercises=DEFAULT_EXERCISES.map(x=>({...x}));
let history=[];
let session=null;
let currentIndex=0;
let timerInterval=null;
let timerRemaining=180;
let orderEditing=false;
let dragId=null;

const IDB_NAME="styrkeloggen_storage";
const IDB_STORE="records";
let storageMode="localStorage";
let memoryStore={};
function openWorkoutDB(){
  return new Promise((resolve,reject)=>{
    if(!("indexedDB" in window)){reject(new Error("IndexedDB støttes ikke"));return;}
    const request=indexedDB.open(IDB_NAME,1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(IDB_STORE))db.createObjectStore(IDB_STORE);};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("Kunne ikke åpne IndexedDB"));
  });
}
async function idbGet(key){
  const db=await openWorkoutDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(IDB_STORE,"readonly"),req=tx.objectStore(IDB_STORE).get(key);
    req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
async function idbSet(key,value){
  const db=await openWorkoutDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(IDB_STORE,"readwrite");tx.objectStore(IDB_STORE).put(value,key);
    tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};
  });
}
async function idbDelete(key){
  const db=await openWorkoutDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(IDB_STORE,"readwrite");tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
async function readStored(key){
  try{const value=localStorage.getItem(key);if(value!==null)return JSON.parse(value);}catch(error){console.warn("localStorage read failed; trying IndexedDB",error);}
  try{return await idbGet(key);}catch(error){console.warn("IndexedDB read failed",error);return memoryStore[key]??null;}
}
async function writeStored(key,value){
  const serialized=JSON.stringify(value);
  try{localStorage.setItem(key,serialized);storageMode="localStorage";return true;}
  catch(error){
    console.warn("localStorage write failed; using IndexedDB",error);
    try{await idbSet(key,value);storageMode="IndexedDB";return true;}
    catch(idbError){
      console.error("Persistent storage unavailable",idbError);
      memoryStore[key]=value;storageMode="midlertidig minne";return false;
    }
  }
}
async function deleteStored(key){
  try{localStorage.removeItem(key);return true;}
  catch(error){try{await idbDelete(key);return true;}catch(e){delete memoryStore[key];return false;}}
}
async function loadData(){
  const d=await readStored(STORAGE_KEY);
  if(d){if(d.settings)settings={...settings,...d.settings};if(d.exercises?.length)exercises=d.exercises;if(d.history)history=d.history;}
}
function saveData(){
  return writeStored(STORAGE_KEY,{settings,exercises,history}).then(ok=>{
    if(!ok)showToast("Lagring er begrenset i nettleseren. Eksporter backup før du lukker siden.");
    return ok;
  });
}
async function saveSession(){
  if(session){
    const ok=await writeStored(STORAGE_KEY+"_session",{session,currentIndex});
    if(!ok)showToast("Økten er startet, men nettleseren tillater bare midlertidig lagring. Eksporter data når økten er lagret.");
    return ok;
  }
  return deleteStored(STORAGE_KEY+"_session");
}
async function loadSession(){const d=await readStored(STORAGE_KEY+"_session");return d?.session?d:null;}
function fmtDate(date){return new Date(date).toLocaleDateString("nb-NO",{day:"numeric",month:"short",year:"numeric"});}
function chronologicalHistory(){return [...history].sort((a,b)=>new Date(a.date)-new Date(b.date));}
function latestWorkout(){return chronologicalHistory().at(-1)||null;}
function latestExerciseWorkout(exerciseId){return chronologicalHistory().filter(w=>(w.exercises||[]).some(e=>e.id===exerciseId)).at(-1)||null;}
function latestExerciseLoad(exerciseId,fallback){
  const workout=latestExerciseWorkout(exerciseId);
  const entry=workout?.exercises?.find(e=>e.id===exerciseId);
  if(!entry?.sets?.length)return fallback;
  return Number(entry.sets[entry.sets.length-1].load)||fallback;
}
function fmtNum(n){return Math.round(n).toLocaleString("nb-NO");}
function showToast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200);}
function setView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  if(id==="progressView")renderProgress();
  if(id==="historyView")renderHistory();
  updateWorkoutDock(id);
}
function totalVolume(items){return items.reduce((sum,e)=>sum+(e.sets||[]).reduce((s,set)=>s+(Number(set.load)||0)*(Number(set.reps)||0),0),0);}
function workoutExerciseEntry(workout,id){return (workout?.exercises||[]).find(e=>e.id===id)||null;}
function isEligibleForIncrease(entry){
  if(!entry||entry.hold||!Array.isArray(entry.sets)||entry.sets.length===0)return false;
  // Require every planned set completed and the final set beyond the rep target.
  return entry.sets.every(s=>s.done) && Number(entry.sets[entry.sets.length-1].reps)>settings.targetReps;
}
function recommendOneIncrease(){
  const latest=latestWorkout();
  if(!latest)return null;
  const candidates=exercises.map(ex=>{
    const entry=workoutExerciseEntry(latest,ex.id);
    if(!isEligibleForIncrease(entry))return null;
    const lastLoad=Number(entry.sets[entry.sets.length-1].load)||ex.weight;
    const muscleCoverage=ex.muscles.length;
    return {exercise:ex,entry,lastLoad,muscleCoverage};
  }).filter(Boolean);
  if(!candidates.length)return null;
  // Conservative tie-break: choose the least recently increased movement first;
  // avoid increasing multiple exercises or over-weighting overlapping muscle groups.
  const scored=candidates.map(c=>{
    const previous=chronologicalHistory().filter(w=>w.date<latest.date&&workoutExerciseEntry(w,c.exercise.id));
    const previousLoad=previous.length?Number(workoutExerciseEntry(previous.at(-1),c.exercise.id).sets.at(-1).load):c.lastLoad;
    const gain=c.lastLoad-previousLoad;
    return {...c,score:(c.entry.sets.at(-1).reps-settings.targetReps)*2 - Math.max(0,gain/settings.incrementKg)*1.5 - (c.muscleCoverage>2?1:0)};
  }).sort((a,b)=>b.score-a.score);
  return candidates.length?scored[0]:null;
}
function renderRecommendation(){
  const box=document.getElementById("progressionRecommendation");
  if(!box)return;
  const candidate=recommendOneIncrease();
  if(candidate){
    box.innerHTML=`<p class="eyebrow">ANBEFALT NESTE ØKNING · ÉN ØVELSE</p><h3>${escapeHtml(candidate.exercise.name)}</h3><div class="recommendation-load">${fmtNum(candidate.lastLoad)} kg → ${fmtNum(candidate.lastLoad+settings.incrementKg)} kg</div><p>Alle sett er fullført, og siste sett gikk over ${settings.targetReps} reps. Dette er et forsiktig forslag basert på øktloggen – ikke en automatisk økning. Hvis øvelsen kjentes tung eller teknikken sviktet, behold belastningen.</p>`;
  }else{
    box.innerHTML=`<p class="eyebrow">PROGRESJONSVURDERING</p><h3 class="no-increase">Ingen økning anbefales akkurat nå</h3><p>Fullfør settene med kontroll og bygg opp repetisjonene. Appen foreslår maksimalt én øvelse per økt, og bare når siste sett går over ${settings.targetReps} reps. Ved tunge eller ujevne økter er det helt riktig å holde vekten.</p>`;
  }
}
function renderHome(){
  document.getElementById("workoutCount").textContent=history.length;
  document.getElementById("volumeMetric").textContent=fmtNum(history.reduce((s,w)=>s+(w.volume||0),0));
  const latest=latestWorkout();
  document.getElementById("streakMetric").textContent=latest?fmtDate(latest.date).replace(/\.\s*\d{4}$/,""):"—";
  const list=document.getElementById("exerciseList");list.innerHTML="";
  exercises.forEach((e,i)=>{const row=document.createElement("div");row.className="exercise-row";row.draggable=orderEditing;row.dataset.id=e.id;
    row.innerHTML=`<div class="exercise-icon">${e.icon||"✦"}</div><div class="exercise-info"><strong>${escapeHtml(e.name)}</strong><span>${e.muscles.join(" · ")} · 3 × ${settings.targetReps}</span></div><div class="exercise-weight">${fmtNum(latestExerciseLoad(e.id,e.weight))}<small>kg · ${i+1}/${exercises.length}</small></div>`;
    if(orderEditing){row.addEventListener("dragstart",()=>{dragId=e.id;row.classList.add("dragging")});row.addEventListener("dragend",()=>row.classList.remove("dragging"));row.addEventListener("dragover",ev=>ev.preventDefault());row.addEventListener("drop",ev=>{ev.preventDefault();const target=e.id;if(dragId&&dragId!==target){const from=exercises.findIndex(x=>x.id===dragId),to=exercises.findIndex(x=>x.id===target);const [m]=exercises.splice(from,1);exercises.splice(to,0,m);saveData();renderHome();}dragId=null;});}
    list.appendChild(row);
  });
  document.getElementById("editOrderBtn").textContent=orderEditing?"Ferdig":"Endre rekkefølge";
  document.getElementById("resumeWorkoutBtn").hidden=!session;
  document.getElementById("startWorkoutBtn").hidden=!!session;
  renderRecommendation();
}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function updateWorkoutDock(activeView){
  const dock=document.getElementById("workoutDock");
  if(!dock)return;
  dock.hidden=!session;
  if(!session)return;
  const exercise=session.exercises?.[currentIndex];
  document.getElementById("workoutDockExercise").textContent=exercise?.name||"Pågående treningsøkt";
  document.getElementById("workoutDockTimer").textContent=session.restEndsAt?formatRestRemaining(): "ØKT PÅGÅR";
  dock.classList.toggle("is-current",activeView==="workoutView");
}
function formatRestRemaining(){
  const remaining=Math.max(0,Math.ceil(((Number(session?.restEndsAt)||0)-Date.now())/1000));
  const m=Math.floor(remaining/60),s=remaining%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function returnToWorkout(){
  if(!session)return;
  setView("workoutView");
  renderExercise();
}
function startWorkout(chosenDate=null){
  // A date selected from the calendar is saved as that workout's local calendar day.
  const dateValue=chosenDate || new Date().toISOString().slice(0,10);
  session={date:new Date(`${dateValue}T12:00:00`).toISOString(),exercises:exercises.map(e=>({id:e.id,name:e.name,muscles:e.muscles,hold:false,sets:Array.from({length:3},()=>({load:latestExerciseLoad(e.id,e.weight),reps:settings.targetReps,done:false}))}))};
  currentIndex=0;
  // Show the workout immediately; persistence must never block the primary action.
  setView("workoutView");
  renderExercise();
  saveSession();
}
function resumeWorkout(){if(!session)return;setView("workoutView");renderExercise();}
function current(){return session.exercises[currentIndex];}
function renderExercise(){
  const e=current();if(!e)return;
  updateWorkoutDock("workoutView");
  document.getElementById("currentExerciseName").textContent=e.name;
  document.getElementById("currentMuscles").textContent=e.muscles.join(" · ");
  document.getElementById("sessionProgress").textContent=`ØVELSE ${currentIndex+1} / ${session.exercises.length}`;
  document.getElementById("progressFill").style.width=`${((currentIndex+1)/session.exercises.length)*100}%`;
  document.getElementById("loadValue").textContent=fmtNum(e.sets[0].load);
  document.getElementById("setsList").innerHTML="";
  e.sets.forEach((s,i)=>{
    const row=document.createElement("div");row.className="set-row";
    row.innerHTML=`<div class="set-number">0${i+1}</div><label>Reps<div class="rep-control"><button class="rep-minus" aria-label="Reduser reps i sett ${i+1}">−</button><input type="number" min="0" max="100" value="${s.reps}" aria-label="Repetisjoner sett ${i+1}"><button class="rep-plus" aria-label="Øk reps i sett ${i+1}">+</button></div></label><label>Kg<input type="number" min="0" step="0.5" value="${s.load}" aria-label="Belastning sett ${i+1}"></label><button class="set-check ${s.done?"done":""}" aria-label="Marker sett fullført">${s.done?"✓":"○"}</button>`;
    const inputs=row.querySelectorAll("input");inputs[0].addEventListener("change",()=>{s.reps=Math.max(0,Number(inputs[0].value)||0);saveSession();updateCoach();});
    row.querySelector(".rep-minus").addEventListener("click",()=>{s.reps=Math.max(0,(Number(s.reps)||0)-1);saveSession();renderExercise();});
    row.querySelector(".rep-plus").addEventListener("click",()=>{s.reps=Math.min(100,(Number(s.reps)||0)+1);saveSession();renderExercise();});
    inputs[1].addEventListener("change",()=>{s.load=Math.max(0,Number(inputs[1].value)||0);document.getElementById("loadValue").textContent=fmtNum(s.load);saveSession();updateCoach();});
    row.querySelector(".set-check").addEventListener("click",()=>{s.done=!s.done;saveSession();renderExercise();if(s.done&&i<e.sets.length-1)startRest();});
    document.getElementById("setsList").appendChild(row);
  });
  document.getElementById("previousExercise").disabled=currentIndex===0;
  document.getElementById("nextExercise").textContent=currentIndex===session.exercises.length-1?"Siste øvelse ✓":"Neste øvelse →";
  const holdToggle=document.getElementById("markStruggle");
  holdToggle.checked=!!e.hold;
  holdToggle.onchange=()=>{e.hold=holdToggle.checked;saveSession();updateCoach();};
  updateCoach();saveSession();
}
function updateCoach(){
  const e=current();const last=e.sets[e.sets.length-1];const tip=document.getElementById("coachTip");
  if(e.hold)tip.innerHTML=`<strong>Hold belastningen:</strong> Du har markert at øvelsen kjentes tung. Ikke anbefal økning her – prioriter kontroll og stabil gjennomføring.`;
  else if(last.reps>settings.targetReps)tip.innerHTML=`<strong>Progresjonsmulighet:</strong> Du har registrert ${last.reps} reps i siste sett – mer enn målet på ${settings.targetReps}. Hvis teknikken var god og dette kjentes kontrollert, vurder ${fmtNum(Number(last.load)+settings.incrementKg)} kg neste gang.`;
  else tip.innerHTML=`<strong>Fokus:</strong> Sikt mot ${settings.targetReps} gode repetisjoner i hvert sett. Når siste sett går over målet med kontroll, vurder en økning på ${settings.incrementKg} kg neste økt.`;
}
function changeLoad(delta){const e=current();e.sets.forEach(s=>s.load=Math.max(0,Number((s.load+delta).toFixed(2))));saveSession();renderExercise();}
function nextExercise(){if(currentIndex<session.exercises.length-1){currentIndex++;saveSession();renderExercise();}else showToast("Du er på siste øvelse – avslutt økten når du er klar.");}
function previousExercise(){if(currentIndex>0){currentIndex--;saveSession();renderExercise();}}
function startRest(){
  stopRest();
  timerRemaining=settings.restSeconds;
  session.restEndsAt=Date.now()+settings.restSeconds*1000;
  document.getElementById("restPanel").hidden=false;
  saveSession();
  renderTimer();
  timerInterval=setInterval(updateRestClock,250);
}
function updateRestClock(){
  if(!session?.restEndsAt){stopRest();return;}
  timerRemaining=Math.max(0,Math.ceil((session.restEndsAt-Date.now())/1000));
  renderTimer();
  const dockTimer=document.getElementById("workoutDockTimer");
  if(dockTimer) dockTimer.textContent=timerRemaining>0?formatRestRemaining():"PAUSE FERDIG";
  if(timerRemaining<=0){
    session.restEndsAt=null;
    stopRest();
    document.getElementById("restPanel").hidden=true;
    saveSession();
    updateWorkoutDock(document.querySelector(".view.active")?.id);
    showToast("Pausen er ferdig – klar for neste sett!");
  }
}
function renderTimer(){
  const m=Math.floor(timerRemaining/60),s=timerRemaining%60;
  const display=document.getElementById("timerDisplay");
  if(display)display.textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  const dockTimer=document.getElementById("workoutDockTimer");
  if(dockTimer)dockTimer.textContent=session?.restEndsAt&&timerRemaining>0?formatRestRemaining():"ØKT PÅGÅR";
}
function stopRest(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}}
function restoreRestClock(){
  if(!session?.restEndsAt)return;
  if(session.restEndsAt>Date.now()){
    document.getElementById("restPanel").hidden=false;
    timerRemaining=Math.ceil((session.restEndsAt-Date.now())/1000);
    renderTimer();
    timerInterval=setInterval(updateRestClock,250);
  }else{
    session.restEndsAt=null;
    document.getElementById("restPanel").hidden=true;
    saveSession();
  }
}
function finishWorkout(){
  if(!session)return;
  const completed=session.exercises.filter(e=>e.sets.some(s=>s.done));
  if(!completed.length&&!confirm("Ingen sett er markert som fullført. Vil du lagre økten likevel?"))return;
  const volume=totalVolume(session.exercises);
  const previousLatestByExercise=new Map(session.exercises.map(se=>[se.id,latestExerciseWorkout(se.id)]));
  history.push({date:session.date,exercises:session.exercises,volume});
  // Keep each exercise's displayed/default load tied to its latest performed date.
  // Backfilled older workouts must not overwrite a newer session's load.
  session.exercises.forEach(se=>{
    const ex=exercises.find(e=>e.id===se.id);
    const previousLatest=previousLatestByExercise.get(se.id);
    if(ex&&se.sets.length&&(!previousLatest||new Date(session.date)>=new Date(previousLatest.date))){
      ex.weight=Number(se.sets[se.sets.length-1].load)||ex.weight;
    }
  });
  saveData();session=null;saveSession();stopRest();document.getElementById("restPanel").hidden=true;updateWorkoutDock("homeView");setView("homeView");renderHome();showToast(`Økt lagret · ${fmtNum(volume)} kg totalvolum`);
}
function renderMuscleProgressChart(){
  const chart=document.getElementById("muscleProgressChart");
  if(!chart)return;
  const map=document.querySelectorAll("#bodyMuscleMap [data-muscle]");
  const muscles=["Skuldre","Bryst","Rygg","Biceps","Triceps","Core","Bein","Sete"];
  map.forEach(el=>el.classList.remove("muscle-down","muscle-stable","muscle-moderate","muscle-good","muscle-top"));
  const workouts=chronologicalHistory().slice(-10);
  if(workouts.length<2){
    chart.innerHTML='<p class="muscle-progress-empty">Ikke nok data ennå. Logg minst to gjennomførte økter for å sammenligne utviklingen.</p>';
    return;
  }
  // Compare earliest and latest available appearances for each exercise, rather than
  // using a simple average across unrelated machines or assuming every workout has every exercise.
  const perMuscle=muscles.map(muscle=>{
    const perExercise=exercises.filter(ex=>ex.muscles.includes(muscle)).map(ex=>{
      const entries=workouts.map(w=>({workout:w,entry:workoutExerciseEntry(w,ex.id)}))
        .filter(x=>x.entry && Array.isArray(x.entry.sets) && x.entry.sets.length);
      if(entries.length<2)return null;
      const score=entry=>{
        const valid=entry.sets.filter(s=>(Number(s.load)||0)>0 && (Number(s.reps)||0)>0);
        if(!valid.length)return null;
        // Epley estimate per set; use the strongest completed/recorded set.
        return Math.max(...valid.map(s=>(Number(s.load)||0)*(1+(Number(s.reps)||0)/30)));
      };
      const first=score(entries[0].entry),last=score(entries[entries.length-1].entry);
      if(first===null||last===null||first<=0)return null;
      return {change:((last-first)/first)*100,exercise:ex.name};
    }).filter(Boolean);
    if(!perExercise.length)return {muscle,change:null};
    return {muscle,change:perExercise.reduce((sum,x)=>sum+x.change,0)/perExercise.length};
  });
  const valid=perMuscle.filter(x=>x.change!==null);
  if(!valid.length){
    chart.innerHTML='<p class="muscle-progress-empty">Det finnes ennå ikke minst to registrerte målinger for samme øvelse i perioden. Når øvelser er logget flere ganger, vises muskelgruppenes utvikling her.</p>';
    return;
  }
  // Absolute, meaningful thresholds: equal/negative results remain neutral rather than
  // turning every muscle green through a relative rank calculation.
  const classFor=change=>change>=20?"muscle-top":change>=10?"muscle-good":change>=3?"muscle-moderate":change>-3?"muscle-stable":"muscle-down";
  map.forEach(el=>{
    const value=valid.find(x=>x.muscle===el.dataset.muscle);
    if(value){const cls=classFor(value.change);if(cls)el.classList.add(cls);}
  });
  const labelFor=change=>change>=20?"Svært stor framgang":change>=10?"Stor framgang":change>=3?"Moderat framgang":change>-3?"Stabil":"Tilbakegang";
  chart.innerHTML=valid.sort((a,b)=>b.change-a.change).map(v=>{
    const width=Math.max(3,Math.min(100,Math.abs(v.change)/25*100));
    const cls=classFor(v.change);
    return `<div class="muscle-progress-row ${cls}"><span class="muscle-progress-label">${escapeHtml(v.muscle)}</span><div class="muscle-progress-track"><div class="muscle-progress-bar" style="width:${width}%"></div></div><span class="muscle-progress-value">${v.change>0?"+":""}${v.change.toFixed(1)}%</span><small class="muscle-progress-status">${labelFor(v.change)}</small></div>`;
  }).join("");
}
function renderProgress(){
  renderMuscleProgressChart();
  document.getElementById("progressWorkouts").textContent=history.length;
  document.getElementById("progressVolume").textContent=fmtNum(history.reduce((s,w)=>s+(w.volume||0),0));
  const filter=document.getElementById("muscleFilter").value;const box=document.getElementById("progressCards");box.innerHTML="";
  const matching=exercises.filter(e=>filter==="Alle"||e.muscles.includes(filter));
  if(!matching.length){box.innerHTML='<div class="empty-state">Ingen øvelser i denne muskelgruppen ennå.</div>';return;}
  // Use chronological order for every progression curve, including backfilled sessions.
  const chronological=chronologicalHistory();
  matching.forEach(ex=>{
    const points=chronological.map(w=>{const found=w.exercises.find(x=>x.id===ex.id);if(!found)return null;return Math.max(...found.sets.map(s=>Number(s.load)||0));}).filter(v=>v!==null);
    const currentLoad=points.length?points[points.length-1]:ex.weight;
    const card=document.createElement("div");card.className="progress-card";
    card.innerHTML=`<div class="progress-card-top"><div><h3>${escapeHtml(ex.name)}</h3><div class="small-muted">${ex.muscles.join(" · ")} · ${history.length?points.length+" loggede økter":"ikke logget ennå"}</div></div><div class="progress-current">${fmtNum(currentLoad)} kg</div></div>${points.length>1?makeSparkline(points):'<div class="small-muted" style="margin-top:12px">Logg flere økter for å se utviklingskurven.</div>'}`;
    box.appendChild(card);
  });
}
function makeSparkline(values){const min=Math.min(...values)-1,max=Math.max(...values)+1;const points=values.map((v,i)=>`${(i/(values.length-1))*280},${36-((v-min)/(max-min))*30}`).join(" ");return `<svg class="sparkline" viewBox="0 0 280 40" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="#c8f169" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
function renderHistory(){
  const box=document.getElementById("historyList");box.innerHTML="";
  if(!history.length){box.innerHTML='<div class="empty-state">Ingen økter lagret ennå.<br>Den første økten din dukker opp her.</div>';return;}
  [...history].reverse().forEach(w=>{
    const card=document.createElement("div");card.className="history-card";
    const summary=w.exercises.map(e=>`${e.name}: ${e.sets.map(s=>`${s.load} kg × ${s.reps}`).join(", ")}`).join(" · ");
    card.innerHTML=`<div class="history-card-head"><strong>${fmtDate(w.date)}</strong><span class="progress-current">${fmtNum(w.volume)} kg</span></div><p>${escapeHtml(summary)}</p>`;
    box.appendChild(card);
  });
}
function saveSettings(){
  settings.targetReps=Math.max(1,Number(document.getElementById("targetReps").value)||12);
  settings.restSeconds=Math.max(0,Number(document.getElementById("restSeconds").value)||0);
  settings.incrementKg=Math.max(1,Number(document.getElementById("incrementKg").value)||5);
  saveData();renderHome();showToast("Innstillingene er lagret.");
}
function exportData(){const blob=new Blob([JSON.stringify({settings,exercises,history},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="styrkeloggen-backup.json";a.click();URL.revokeObjectURL(url);}
function resetData(){if(confirm("Dette sletter all historikk og tilbakestiller appen. Er du sikker?")){localStorage.removeItem(STORAGE_KEY);settings={targetReps:12,restSeconds:180,incrementKg:5};exercises=DEFAULT_EXERCISES.map(x=>({...x}));history=[];renderHome();renderProgress();renderHistory();showToast("Data er nullstilt.");}}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
document.getElementById("workoutDock").addEventListener("click",returnToWorkout);
document.getElementById("startWorkoutBtn").addEventListener("click",event=>{
  event.preventDefault();
  try{startWorkout();}
  catch(error){console.error("Could not start workout:",error);showToast("Kunne ikke starte økten. Last siden på nytt og prøv igjen.");}
});
document.getElementById("resumeWorkoutBtn").addEventListener("click",resumeWorkout);
document.getElementById("startBackfill").addEventListener("click",()=>{
  const date=document.getElementById("backfillDate").value;
  if(!date){showToast("Velg dato i kalenderen først.");return;}
  if(date>new Date().toISOString().slice(0,10)){showToast("Du kan ikke etterregistrere en fremtidig økt.");return;}
  startWorkout(date);
});
document.getElementById("backHome").addEventListener("click",()=>{if(confirm("Gå ut av økten? Økten blir ikke lagret før du avslutter.")){session=null;saveSession();stopRest();setView("homeView");}});
document.getElementById("loadDown").addEventListener("click",()=>changeLoad(-settings.incrementKg));
document.getElementById("loadUp").addEventListener("click",()=>changeLoad(settings.incrementKg));
document.getElementById("nextExercise").addEventListener("click",nextExercise);
document.getElementById("previousExercise").addEventListener("click",previousExercise);
document.getElementById("finishWorkout").addEventListener("click",finishWorkout);
document.getElementById("skipRest").addEventListener("click",()=>{stopRest();document.getElementById("restPanel").hidden=true;});
document.getElementById("editOrderBtn").addEventListener("click",()=>{orderEditing=!orderEditing;renderHome();showToast(orderEditing?"Hold og dra øvelsene for å endre rekkefølge.":"Rekkefølgen er lagret.");});
document.getElementById("muscleFilter").addEventListener("change",renderProgress);
document.getElementById("saveSettings").addEventListener("click",saveSettings);
document.getElementById("exportData").addEventListener("click",exportData);
document.getElementById("resetData").addEventListener("click",resetData);
(async function initializeApp(){
  await loadData();
  const savedSession=await loadSession();
  if(savedSession){session=savedSession.session;currentIndex=Math.min(savedSession.currentIndex||0,session.exercises.length-1);}
  document.getElementById("backfillDate").value=new Date().toISOString().slice(0,10);
  document.getElementById("backfillDate").max=new Date().toISOString().slice(0,10);
  document.getElementById("targetReps").value=settings.targetReps;
  document.getElementById("restSeconds").value=settings.restSeconds;
  document.getElementById("incrementKg").value=settings.incrementKg;
  renderHome();
  if(storageMode==="IndexedDB")showToast("Lagring bruker sikkerhetskopi i nettleseren (IndexedDB).");
})();
