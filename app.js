const DEFAULT_EXERCISES = [
  {id:"shoulder",name:"Skulderpress",weight:40,muscles:["Skuldre","Triceps"],icon:"↗"},
  {id:"pulldown",name:"Nedtrekk",weight:50,muscles:["Rygg","Biceps"],icon:"↓"},
  {id:"abs",name:"Magemaskin",weight:45,muscles:["Core"],icon:"✦"},
  {id:"chest",name:"Brystpressmaskin",weight:60,muscles:["Bryst","Skuldre","Triceps"],icon:"↔"},
  {id:"row",name:"Sittende roing",weight:40,muscles:["Rygg","Biceps"],icon:"⇠"},
  {id:"backpress",name:"Sittende ryggpress",weight:90,maxLoad:95,muscles:["Rygg"],icon:"⌁"},
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
  const backpress=exercises.find(e=>e.id==="backpress");if(backpress&&backpress.maxLoad===undefined)backpress.maxLoad=95;
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
  document.body.classList.toggle("workout-mode",id==="workoutView");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  if(id==="progressView")renderProgress();
  if(id==="historyView")renderHistory();
  if(id==="settingsView")renderExerciseLimits();
  updateWorkoutDock(id);
}
function totalVolume(items){return items.reduce((sum,e)=>sum+(e.sets||[]).reduce((s,set)=>s+(Number(set.load)||0)*(Number(set.reps)||0),0),0);}
function workoutExerciseEntry(workout,id){return (workout?.exercises||[]).find(e=>e.id===id)||null;}
function exerciseTarget(ex){return Math.max(1,Number(ex.targetReps)||settings.targetReps);}
function exerciseMaxLoad(ex){const n=Number(ex.maxLoad);return Number.isFinite(n)&&n>0?n:null;}
function isEligibleForIncrease(entry,ex){return !!entry&&!entry.hold&&Array.isArray(entry.sets)&&entry.sets.length>0&&entry.sets.every(s=>s.done)&&Number(entry.sets.at(-1).reps)>exerciseTarget(ex);}
function recommendOneIncrease(){
 const latest=latestWorkout();if(!latest)return null;
 const candidates=exercises.map(ex=>{
  const entry=workoutExerciseEntry(latest,ex.id);if(!isEligibleForIncrease(entry,ex))return null;
  const last=entry.sets.at(-1),load=Number(last.load)||ex.weight,target=exerciseTarget(ex),max=exerciseMaxLoad(ex),atMax=max!==null&&load>=max;
  return {exercise:ex,lastLoad:load,lastReps:Number(last.reps)||target,target,maxLoad:max,type:atMax?"reps":"load",score:(Number(last.reps)-target)*2-ex.muscles.length*.2};
 }).filter(Boolean);
 return candidates.sort((x,y)=>y.score-x.score)[0]||null;
}
function renderRecommendation(){
 const box=document.getElementById("progressionRecommendation");if(!box)return;const c=recommendOneIncrease();
 if(c&&c.type==="reps")box.innerHTML=`<p class="eyebrow">ANBEFALT NESTE ØKT · ÉN ØVELSE</p><h3>\${escapeHtml(c.exercise.name)}</h3><div class="recommendation-load">\${fmtNum(c.lastLoad)} kg · \${c.target} → \${c.target+1} reps</div><p>Maksvekten på \${fmtNum(c.maxLoad)} kg er nådd. Behold vekten og øk repetisjonene gradvis.</p>`;
 else if(c)box.innerHTML=`<p class="eyebrow">ANBEFALT NESTE ØKT · ÉN ØVELSE</p><h3>\${escapeHtml(c.exercise.name)}</h3><div class="recommendation-load">\${fmtNum(c.lastLoad)} kg → \${fmtNum(Math.min(c.lastLoad+settings.incrementKg,c.maxLoad??Infinity))} kg</div><p><strong>Øk belastningen neste økt.</strong> Alle sett er fullført og repetisjonsmålet er passert.</p>`;
 else box.innerHTML=`<p class="eyebrow">PROGRESJONSVURDERING</p><h3 class="no-increase">Ingen økning anbefales akkurat nå</h3><p>Fullfør alle sett med god teknikk. Ved registrert maksvekt foreslås flere repetisjoner i stedet for mer belastning.</p>`;
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
 const dateValue=chosenDate||new Date().toISOString().slice(0,10),isCurrent=!chosenDate||chosenDate===new Date().toISOString().slice(0,10);
 const suggested=isCurrent?recommendOneIncrease():null;
 session={date:new Date(`\${dateValue}T12:00:00`).toISOString(),exercises:exercises.map(e=>{
  const base=latestExerciseLoad(e.id,e.weight),apply=!!suggested&&suggested.exercise.id===e.id;
  const load=apply&&suggested.type==="load"?Math.min(suggested.lastLoad+settings.incrementKg,suggested.maxLoad??Infinity):base;
  const reps=apply&&suggested.type==="reps"?suggested.target+1:exerciseTarget(e);
  return {id:e.id,name:e.name,muscles:e.muscles,hold:false,maxLoad:exerciseMaxLoad(e),targetReps:reps,recommendedIncrease:apply?{type:suggested.type,from:suggested.type==="load"?suggested.lastLoad:suggested.target,to:suggested.type==="load"?load:reps,maxLoad:suggested.maxLoad}:null,sets:Array.from({length:3},()=>({load,reps,done:false}))};
 })};
 currentIndex=0;setView("workoutView");renderExercise();saveSession();
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
 const e=current(),last=e.sets.at(-1),tip=document.getElementById("coachTip"),target=Number(e.targetReps)||settings.targetReps;
 const configured=exercises.find(x=>x.id===e.id)||{},max=Number(e.maxLoad)||exerciseMaxLoad(configured),atMax=max!==null&&max!==undefined&&Number(last.load)>=max;
 if(e.hold){tip.className="coach-tip";tip.innerHTML="<strong>HOLD BELASTNINGEN</strong><br>Du har markert øvelsen som tung. Prioriter kontroll – ingen økning anbefales.";}
 else if(e.recommendedIncrease?.type==="reps"){tip.className="coach-tip coach-tip-recommended";tip.innerHTML=`<span class="coach-recommend-label">ANBEFALT NESTE ØKT</span><strong>Øk til \${e.recommendedIncrease.to} repetisjoner per sett</strong><br>Maksvekten på \${fmtNum(max)} kg er nådd. Behold belastningen og øk repetisjonene gradvis.`;}
 else if(e.recommendedIncrease?.type==="load"){tip.className="coach-tip coach-tip-recommended";tip.innerHTML=`<span class="coach-recommend-label">ANBEFALT NESTE ØKT</span><strong>Øk belastningen fra \${fmtNum(e.recommendedIncrease.from)} til \${fmtNum(e.recommendedIncrease.to)} kg</strong><br>Dette er anbefalt etter forrige økt. Reduser igjen hvis teknikken svikter.`;}
 else if(atMax){tip.className="coach-tip coach-tip-max";tip.innerHTML=`<strong>MAKSVEKT NÅDD · \${fmtNum(max)} KG</strong><br>Ikke øk belastningen videre. Sikt mot \${target+1} repetisjoner per sett når du klarer \${target} med god kontroll.`;}
 else{tip.className="coach-tip";tip.innerHTML=`<strong>FOKUS</strong><br>Sikt mot \${target} gode repetisjoner. Når alle sett er fullført og siste sett går over målet, anbefales økt belastning.`;}
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
      if(se.recommendedIncrease?.type==="reps"&&!se.hold&&se.sets.every(s=>s.done)&&Number(se.sets.at(-1).reps)>=Number(se.targetReps))ex.targetReps=Number(se.targetReps);
    }
  });
  saveData();session=null;saveSession();stopRest();document.getElementById("restPanel").hidden=true;updateWorkoutDock("homeView");setView("homeView");renderHome();showToast(`Økt lagret · ${fmtNum(volume)} kg totalvolum`);
}
function completedSetMetrics(entry){
  const sets=(entry?.sets||[]).filter(s=>s.done && Number(s.load)>0 && Number(s.reps)>0);
  if(!sets.length)return null;
  const e1rmValues=sets.map(s=>Number(s.load)*(1+Number(s.reps)/30));
  return {
    e1rm:Math.max(...e1rmValues),
    load:Math.max(...sets.map(s=>Number(s.load))),
    reps:Math.max(...sets.map(s=>Number(s.reps))),
    volume:sets.reduce((sum,s)=>sum+Number(s.load)*Number(s.reps),0)
  };
}
function smoothedChange(points){
  if(points.length<2)return null;
  const n=Math.min(3,Math.floor(points.length/2));
  const baseline=points.slice(0,n).reduce((s,p)=>s+p.e1rm,0)/n;
  const recent=points.slice(-n).reduce((s,p)=>s+p.e1rm,0)/n;
  return baseline>0?((recent-baseline)/baseline)*100:null;
}
const muscleProgressColors={down:"#ef4444",stable:"#94a3b8",moderate:"#38bdf8",good:"#22c55e",top:"#a3e635"};
let muscleMaps=null;
let muscleMapPromise=null;
let latestMuscleProgress=[];
let selectedMuscleFocus=null;
const appToLibraryMuscles={
  "Skuldre":["shoulders"],
  "Bryst":["chest"],
  "Rygg":["upper_back","lats","lower_back"],
  "Biceps":["biceps"],
  "Triceps":["triceps"],
  "Core":["abs","obliques"],
  "Bein":["quads","hamstrings","calves"],
  "Sete":["glutes"]
};
const libraryToAppMuscle={
  shoulders:"Skuldre",chest:"Bryst",upper_back:"Rygg",lats:"Rygg",lower_back:"Rygg",
  biceps:"Biceps",triceps:"Triceps",abs:"Core",obliques:"Core",
  quads:"Bein",hamstrings:"Bein",calves:"Bein",glutes:"Sete"
};
function muscleProgressKey(change){
  if(change===null||!Number.isFinite(change))return "stable";
  if(change < -3)return "down";
  if(change < 3)return "stable";
  if(change < 10)return "moderate";
  if(change < 20)return "good";
  return "top";
}
function buildMuscleHighlights(progress){
  const byMuscle=new Map(progress.map(item=>[item.muscle,item]));
  const highlights=[];
  Object.entries(appToLibraryMuscles).forEach(([appMuscle,libraryGroups])=>{
    const item=byMuscle.get(appMuscle);
    const isSelected=selectedMuscleFocus===appMuscle;
    if(!item||item.change===null){
      if(!isSelected)return;
    }
    const color=muscleProgressColors[muscleProgressKey(item?.change??null)];
    const intensity=selectedMuscleFocus?(isSelected?94:16):(item?.change===null?0:66);
    if(intensity<=0)return;
    libraryGroups.forEach(group=>highlights.push({group,intensity,color}));
  });
  return highlights;
}
function updateMuscleFocusUI(){
  const chart=document.getElementById("muscleProgressChart");
  if(!chart)return;
  chart.querySelectorAll("[data-muscle]").forEach(row=>{
    const active=row.dataset.muscle===selectedMuscleFocus;
    row.classList.toggle("is-selected",active);
    row.setAttribute("aria-pressed",active?"true":"false");
  });
}
function setMuscleFocus(appMuscle){
  selectedMuscleFocus=selectedMuscleFocus===appMuscle?null:appMuscle;
  const highlights=buildMuscleHighlights(latestMuscleProgress);
  if(muscleMaps){
    muscleMaps.front.update({highlights});
    muscleMaps.back.update({highlights});
  }
  updateMuscleFocusUI();
}
function onMuscleMapClick(muscle){
  const appMuscle=libraryToAppMuscle[muscle?.group];
  if(appMuscle)setMuscleFocus(appMuscle);
}
function showMuscleMapFallback(){
  const views=document.querySelector(".musclemap-views");
  const fallback=document.getElementById("muscleMapFallback");
  if(views)views.hidden=true;
  if(fallback)fallback.hidden=false;
}
async function ensureMuscleMaps(){
  if(muscleMaps)return muscleMaps;
  if(muscleMapPromise)return muscleMapPromise;
  muscleMapPromise=(async()=>{
    let timeoutId;
    const modulePromise=import("https://cdn.jsdelivr.net/npm/js-rich-body-highlighter@0.1.1/+esm");
    const timeoutPromise=new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error("Muskelkartet brukte for lang tid på å laste.")),15000);});
    let library;
    try{library=await Promise.race([modulePromise,timeoutPromise]);}
    finally{clearTimeout(timeoutId);}
    if(typeof library.MuscleMap!=="function")throw new Error("MuscleMap-eksporten ble ikke funnet.");
    const options={
      gender:"male",width:"100%",theme:"dark",blendMode:"multiply",
      hoverHighlight:true,hoverIntensity:22,
      highlights:buildMuscleHighlights(latestMuscleProgress),
      onMuscleClick:onMuscleMapClick
    };
    const frontHost=document.getElementById("muscleMapFront");
    const backHost=document.getElementById("muscleMapBack");
    if(!frontHost||!backHost)throw new Error("Muskelkartets visningsfelt mangler.");
    const front=new library.MuscleMap(frontHost,{...options,view:"front"});
    const back=new library.MuscleMap(backHost,{...options,view:"back"});
    muscleMaps={front,back};
    const fallback=document.getElementById("muscleMapFallback");
    const views=document.querySelector(".musclemap-views");
    if(fallback)fallback.hidden=true;
    if(views)views.hidden=false;
    return muscleMaps;
  })().catch(error=>{
    console.warn("Muskelkartet kunne ikke lastes:",error);
    showMuscleMapFallback();
    muscleMapPromise=null;
    throw error;
  });
  return muscleMapPromise;
}
async function renderMuscleProgressMap(progress){
  latestMuscleProgress=progress;
  try{
    const maps=await ensureMuscleMaps();
    // Build after awaiting the map so a tap made during loading is not overwritten
    // by an older highlight state.
    const highlights=buildMuscleHighlights(latestMuscleProgress);
    maps.front.update({highlights});
    maps.back.update({highlights});
  }catch(error){
    // The OpenStax reference image remains as a no-overlay fallback.
  }
}
function renderMuscleProgressChart(){
  const chart=document.getElementById("muscleProgressChart");
  if(!chart)return;
  const muscles=["Skuldre","Bryst","Rygg","Biceps","Triceps","Core","Bein","Sete"];
  const workouts=chronologicalHistory().slice(-10);
  const perMuscle=muscles.map(muscle=>{
    const perExercise=exercises.filter(ex=>Array.isArray(ex.muscles)&&ex.muscles.includes(muscle)).map(ex=>{
      const points=workouts.map(w=>completedSetMetrics(workoutExerciseEntry(w,ex.id))).filter(Boolean);
      if(points.length<2)return null;
      const change=smoothedChange(points);
      return change===null?null:{change,exercise:ex.name};
    }).filter(Boolean);
    if(!perExercise.length)return {muscle,change:null,sources:[]};
    return {muscle,change:perExercise.reduce((sum,x)=>sum+x.change,0)/perExercise.length,sources:perExercise.map(x=>x.exercise)};
  });
  window.styrkeloggenMuscleProgress=perMuscle;
  renderMuscleProgressMap(perMuscle);
  const classFor=change=>change>=20?"muscle-top":change>=10?"muscle-good":change>=3?"muscle-moderate":change>-3?"muscle-stable":"muscle-down";
  const labelFor=change=>change>=20?"Svært stor framgang":change>=10?"Stor framgang":change>=3?"Moderat framgang":change>-3?"Stabil":"Tilbakegang";
  const measured=perMuscle.filter(x=>x.change!==null).sort((a,b)=>b.change-a.change);
  const missing=perMuscle.filter(x=>x.change===null);
  chart.innerHTML=measured.map(v=>{
    const width=Math.max(3,Math.min(100,Math.abs(v.change)/25*100));
    return `<div class="muscle-progress-row ${classFor(v.change)}" data-muscle="${escapeHtml(v.muscle)}" role="button" tabindex="0" aria-pressed="false" aria-label="Fremhev ${escapeHtml(v.muscle)} på muskelkartet"><span class="muscle-progress-label">${escapeHtml(v.muscle)}</span><div class="muscle-progress-track"><div class="muscle-progress-bar" style="width:${width}%"></div></div><span class="muscle-progress-value">${v.change>0?"+":""}${v.change.toFixed(1)}%</span><small class="muscle-progress-status">${labelFor(v.change)} · ${escapeHtml(v.sources.join(", "))}</small></div>`;
  }).join("")+missing.map(v=>
    `<div class="muscle-progress-row muscle-stable muscle-no-data" data-muscle="${escapeHtml(v.muscle)}" role="button" tabindex="0" aria-pressed="false" aria-label="Fremhev ${escapeHtml(v.muscle)} på muskelkartet"><span class="muscle-progress-label">${escapeHtml(v.muscle)}</span><div class="muscle-progress-track"><div class="muscle-progress-bar" style="width:0%"></div></div><span class="muscle-progress-value">—</span><small class="muscle-progress-status">Ikke nok data · minst 2 økter med fullførte sett</small></div>`
  ).join("");
  if(!measured.length)chart.innerHTML='<p class="muscle-progress-empty">Det er ennå ikke nok fullførte sett i gjentatte økter til å beregne estimert styrkeutvikling.</p>'+chart.innerHTML;
  chart.querySelectorAll("[data-muscle]").forEach(row=>{
    const activate=()=>setMuscleFocus(row.dataset.muscle);
    row.addEventListener("click",activate);
    row.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();activate();}});
  });
  updateMuscleFocusUI();
}
function renderProgress(){
  renderMuscleProgressChart();
  document.getElementById("progressWorkouts").textContent=history.length;
  document.getElementById("progressVolume").textContent=fmtNum(history.reduce((s,w)=>s+(w.volume||0),0));
  const filter=document.getElementById("muscleFilter").value;
  const box=document.getElementById("progressCards");box.innerHTML="";
  const matching=exercises.filter(e=>filter==="Alle"||e.muscles.includes(filter));
  if(!matching.length){box.innerHTML='<div class="empty-state">Ingen øvelser i denne muskelgruppen ennå.</div>';return;}
  const chronological=chronologicalHistory();
  matching.forEach(ex=>{
    const records=chronological.map(w=>{
      const metrics=completedSetMetrics(workoutExerciseEntry(w,ex.id));
      return metrics?{date:w.date,...metrics}:null;
    }).filter(Boolean);
    const latest=records.at(-1);
    const change=smoothedChange(records);
    const trend=change===null?"For få økter":`${change>0?"+":""}${change.toFixed(1)}% estimert styrke`;
    const spark=records.length>1?makeSparkline(records.map(p=>p.e1rm)):'<div class="small-muted" style="margin-top:12px">Logg minst to økter med fullførte sett for å se utviklingen.</div>';
    const card=document.createElement("div");card.className="progress-card";
    card.innerHTML=`<div class="progress-card-top"><div><h3>${escapeHtml(ex.name)}</h3><div class="small-muted">${ex.muscles.join(" · ")} · ${records.length} økter med fullførte sett</div></div><div class="progress-current">${latest?fmtNum(latest.e1rm)+" kg e1RM":"—"}</div></div><div class="progress-metrics"><span>Belastning: <strong>${latest?fmtNum(latest.load)+" kg":"—"}</strong></span><span>Reps: <strong>${latest?latest.reps:"—"}</strong></span><span>Volum siste økt: <strong>${latest?fmtNum(latest.volume)+" kg":"—"}</strong></span></div><div class="progress-trend">${trend}</div>${spark}`;
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
function renderExerciseLimits(){
 const host=document.getElementById("exerciseLimits");if(!host)return;host.innerHTML="";
 exercises.forEach(ex=>{const row=document.createElement("label");row.className="exercise-limit-row";const max=exerciseMaxLoad(ex);
  row.innerHTML=`<span><strong>\${escapeHtml(ex.name)}</strong><small>\${escapeHtml(ex.muscles.join(" · "))}</small></span><span class="exercise-limit-input"><input type="number" min="0" step="0.5" inputmode="decimal" placeholder="Ingen grense" value="\${max??""}" aria-label="Maksvekt for \${escapeHtml(ex.name)}"><small>kg maks</small></span>`;host.appendChild(row);});
}
function saveExerciseLimits(){
 document.querySelectorAll(".exercise-limit-row").forEach((row,i)=>{const ex=exercises[i],raw=row.querySelector("input").value.trim();ex.maxLoad=raw===""?null:Math.max(0,Number(raw)||0);if(ex.maxLoad===0)ex.maxLoad=null;});
 saveData();renderRecommendation();showToast("Maksvektene er lagret.");
}
function saveSettings(){
  settings.targetReps=Math.max(1,Number(document.getElementById("targetReps").value)||12);
  settings.restSeconds=Math.max(0,Number(document.getElementById("restSeconds").value)||0);
  settings.incrementKg=Math.max(1,Number(document.getElementById("incrementKg").value)||5);
  saveData();renderHome();showToast("Innstillingene er lagret.");
}
async function exportData(){
  const savedSession=await loadSession();
  const backup={app:"Styrkeloggen",backupVersion:2,exportedAt:new Date().toISOString(),settings,exercises,history,activeSession:session||savedSession?.session||null,currentIndex:session?currentIndex:(savedSession?.currentIndex??currentIndex)};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;
  a.download=`styrkeloggen-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  showToast("Sikkerhetskopien er klar for nedlasting.");
}
function validateBackup(data){
  if(!data||typeof data!=="object"||!Array.isArray(data.history)||!Array.isArray(data.exercises)||!data.settings||typeof data.settings!=="object")throw new Error("Filen ser ikke ut til å være en gyldig Styrkeloggen-sikkerhetskopi.");
  if(data.history.some(w=>!w||!w.date||!Array.isArray(w.exercises)))throw new Error("Treningshistorikken i filen har feil format.");
  if(data.exercises.some(e=>!e||typeof e.id!=="string"||typeof e.name!=="string"||!Array.isArray(e.muscles)))throw new Error("Øvelseslisten i filen har feil format.");
  if(data.activeSession!==null&&data.activeSession!==undefined&&(!Array.isArray(data.activeSession.exercises)||!data.activeSession.date))throw new Error("Den pågående økten i filen har feil format.");
  return data;
}
async function importDataFile(file){
  if(!file)return;if(file.size>10*1024*1024){showToast("Filen er for stor. Velg en backup under 10 MB.");return;}
  try{
    const parsed=validateBackup(JSON.parse(await file.text()));
    const activeText=parsed.activeSession?"\nEn pågående økt blir også gjenopprettet.":"";
    if(!confirm(`Importer treningslogg?\n\n${parsed.history.length} lagrede økter og ${parsed.exercises.length} øvelser blir lagt inn.\n\nDette erstatter treningsdataene som allerede ligger på denne enheten.${activeText}\n\nFortsette?`))return;
    const nextSettings={targetReps:12,restSeconds:180,incrementKg:5,...parsed.settings};
    const nextExercises=parsed.exercises,nextHistory=parsed.history;
    const ok=await writeStored(STORAGE_KEY,{settings:nextSettings,exercises:nextExercises,history:nextHistory});
    if(!ok)throw new Error("Nettleseren kunne ikke lagre dataene permanent. Importen ble avbrutt.");
    if(parsed.activeSession){
      const sessionOk=await writeStored(STORAGE_KEY+"_session",{session:parsed.activeSession,currentIndex:Math.max(0,Math.min(Number(parsed.currentIndex)||0,parsed.activeSession.exercises.length-1))});
      if(!sessionOk)throw new Error("Historikken ble lagret, men den pågående økten kunne ikke lagres permanent.");
    }else await deleteStored(STORAGE_KEY+"_session");
    settings=nextSettings;exercises=nextExercises;history=nextHistory;stopRest();session=parsed.activeSession||null;
    currentIndex=session?Math.max(0,Math.min(Number(parsed.currentIndex)||0,session.exercises.length-1)):0;
    document.getElementById("targetReps").value=settings.targetReps;document.getElementById("restSeconds").value=settings.restSeconds;document.getElementById("incrementKg").value=settings.incrementKg;
    renderHome();renderProgress();renderHistory();setView("homeView");if(session)restoreRestClock();
    showToast(`Importert ${history.length} treningsøkter.`);
  }catch(error){console.error("Import failed:",error);showToast(error.message||"Kunne ikke importere filen.");}
  finally{document.getElementById("importData").value="";}
}
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
document.getElementById("saveExerciseLimits").addEventListener("click",saveExerciseLimits);
document.getElementById("exportData").addEventListener("click",()=>{exportData().catch(error=>{console.error(error);showToast("Kunne ikke lage sikkerhetskopi.");});});
document.getElementById("importData").addEventListener("change",event=>importDataFile(event.target.files?.[0]));
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
