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

function loadData(){
  try{const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");if(d.settings)settings={...settings,...d.settings};if(d.exercises?.length)exercises=d.exercises;if(d.history)history=d.history;}catch(e){}
}
function saveData(){localStorage.setItem(STORAGE_KEY,JSON.stringify({settings,exercises,history}));}
function saveSession(){if(session){localStorage.setItem(STORAGE_KEY+"_session",JSON.stringify({session,currentIndex}));}else{localStorage.removeItem(STORAGE_KEY+"_session");}}
function loadSession(){try{const raw=localStorage.getItem(STORAGE_KEY+"_session");if(!raw)return null;const d=JSON.parse(raw);return d?.session?d:null;}catch(e){return null;}}
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
function setView(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===id));if(id==="progressView")renderProgress();if(id==="historyView")renderHistory();}
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
function startWorkout(chosenDate=null){
  // A date selected from the calendar is saved as that workout's local calendar day.
  const dateValue=chosenDate || new Date().toISOString().slice(0,10);
  session={date:new Date(`${dateValue}T12:00:00`).toISOString(),exercises:exercises.map(e=>({id:e.id,name:e.name,muscles:e.muscles,hold:false,sets:Array.from({length:3},()=>({load:latestExerciseLoad(e.id,e.weight),reps:settings.targetReps,done:false}))}))};
  currentIndex=0;saveSession();setView("workoutView");renderExercise();
}
function resumeWorkout(){if(!session)return;setView("workoutView");renderExercise();}
function current(){return session.exercises[currentIndex];}
function renderExercise(){
  const e=current();if(!e)return;
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
  stopRest();timerRemaining=settings.restSeconds;document.getElementById("restPanel").hidden=false;renderTimer();
  timerInterval=setInterval(()=>{timerRemaining--;renderTimer();if(timerRemaining<=0){stopRest();document.getElementById("restPanel").hidden=true;showToast("Pausen er ferdig – klar for neste sett!");}},1000);
}
function renderTimer(){const m=Math.floor(timerRemaining/60),s=timerRemaining%60;document.getElementById("timerDisplay").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}
function stopRest(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}}
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
  saveData();session=null;saveSession();stopRest();document.getElementById("restPanel").hidden=true;setView("homeView");renderHome();showToast(`Økt lagret · ${fmtNum(volume)} kg totalvolum`);
}
function renderMuscleProgressChart(){
  const chart=document.getElementById("muscleProgressChart");
  if(!chart)return;
  const recent=chronologicalHistory().slice(-10);
  const muscles=["Skuldre","Bryst","Rygg","Biceps","Triceps","Core","Bein","Sete"];
  if(recent.length<2){
    chart.innerHTML='<p class="muscle-progress-empty">Logg minst to økter for å vise relativ framgang på muskelkartet.</p>';
    document.querySelectorAll("#bodyMuscleMap [data-muscle]").forEach(el=>el.classList.remove("muscle-moderate","muscle-good","muscle-top"));
    return;
  }
  const early=recent.slice(0,Math.min(3,recent.length));
  const late=recent.slice(-Math.min(3,recent.length));
  const vals=muscles.map(m=>{
    const collect=ws=>ws.flatMap(w=>(w.exercises||[]).filter(entry=>{
      const ex=exercises.find(x=>x.id===entry.id);return ex&&ex.muscles.includes(m);
    }).flatMap(entry=>(entry.sets||[]).map(s=>({load:Number(s.load)||0,reps:Number(s.reps)||0}))));
    const x=collect(early),y=collect(late);
    if(!x.length||!y.length)return {muscle:m,change:null};
    const mean=a=>a.reduce((sum,v)=>sum+v.load*(1+Math.min(v.reps,20)/100),0)/a.length;
    const baseline=mean(x),current=mean(y);
    return {muscle:m,change:baseline>0?((current-baseline)/baseline)*100:0};
  });
  const available=vals.filter(v=>v.change!==null);
  if(!available.length){chart.innerHTML='<p class="muscle-progress-empty">Ikke nok loggede data til å sammenligne muskelgruppene ennå.</p>';return;}
  const sorted=[...available].sort((a,b)=>a.change-b.change);
  const low=sorted[0].change,high=sorted[sorted.length-1].change;
  const rankFor=m=>{const v=available.find(x=>x.muscle===m);if(!v)return "";const span=high-low;const r=span===0?0.5:(v.change-low)/span;return r>=.75?"muscle-top":r>=.45?"muscle-good":r>=.2?"muscle-moderate":"";};
  document.querySelectorAll("#bodyMuscleMap [data-muscle]").forEach(el=>{
    el.classList.remove("muscle-moderate","muscle-good","muscle-top");
    const cls=rankFor(el.dataset.muscle);if(cls)el.classList.add(cls);
  });
  chart.innerHTML=available.sort((a,b)=>b.change-a.change).map(v=>`<div class="muscle-progress-row"><span class="muscle-progress-label">${escapeHtml(v.muscle)}</span><div class="muscle-progress-track"><div class="muscle-progress-bar" style="width:${Math.max(0,Math.min(100,(v.change-low)/(Math.max(1,high-low))*100))}%"></div></div><span class="muscle-progress-value">${v.change>=0?"+":""}${v.change.toFixed(1)}%</span></div>`).join("");
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
document.getElementById("startWorkoutBtn").addEventListener("click",()=>startWorkout());
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
loadData();
const savedSession=loadSession();if(savedSession){session=savedSession.session;currentIndex=Math.min(savedSession.currentIndex||0,session.exercises.length-1);}
document.getElementById("backfillDate").value=new Date().toISOString().slice(0,10);
document.getElementById("backfillDate").max=new Date().toISOString().slice(0,10);
document.getElementById("targetReps").value=settings.targetReps;
document.getElementById("restSeconds").value=settings.restSeconds;
document.getElementById("incrementKg").value=settings.incrementKg;
renderHome();
