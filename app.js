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
function fmtDate(date){return new Date(date).toLocaleDateString("nb-NO",{day:"numeric",month:"short",year:"numeric"});}
function fmtNum(n){return Math.round(n).toLocaleString("nb-NO");}
function showToast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200);}
function setView(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===id));if(id==="progressView")renderProgress();if(id==="historyView")renderHistory();}
function totalVolume(items){return items.reduce((sum,e)=>sum+(e.sets||[]).reduce((s,set)=>s+(Number(set.load)||0)*(Number(set.reps)||0),0),0);}
function renderHome(){
  document.getElementById("workoutCount").textContent=history.length;
  document.getElementById("volumeMetric").textContent=fmtNum(history.reduce((s,w)=>s+(w.volume||0),0));
  document.getElementById("streakMetric").textContent=history.length?fmtDate(history[history.length-1].date).replace(/\.\s*\d{4}$/,""):"—";
  const list=document.getElementById("exerciseList");list.innerHTML="";
  exercises.forEach((e,i)=>{const row=document.createElement("div");row.className="exercise-row";row.draggable=orderEditing;row.dataset.id=e.id;
    row.innerHTML=`<div class="exercise-icon">${e.icon||"✦"}</div><div class="exercise-info"><strong>${escapeHtml(e.name)}</strong><span>${e.muscles.join(" · ")} · 3 × ${settings.targetReps}</span></div><div class="exercise-weight">${fmtNum(e.weight)}<small>kg · ${i+1}/${exercises.length}</small></div>`;
    if(orderEditing){row.addEventListener("dragstart",()=>{dragId=e.id;row.classList.add("dragging")});row.addEventListener("dragend",()=>row.classList.remove("dragging"));row.addEventListener("dragover",ev=>ev.preventDefault());row.addEventListener("drop",ev=>{ev.preventDefault();const target=e.id;if(dragId&&dragId!==target){const from=exercises.findIndex(x=>x.id===dragId),to=exercises.findIndex(x=>x.id===target);const [m]=exercises.splice(from,1);exercises.splice(to,0,m);saveData();renderHome();}dragId=null;});}
    list.appendChild(row);
  });
  document.getElementById("editOrderBtn").textContent=orderEditing?"Ferdig":"Endre rekkefølge";
}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function startWorkout(){
  session={date:new Date().toISOString(),exercises:exercises.map(e=>({id:e.id,name:e.name,muscles:e.muscles,sets:Array.from({length:3},()=>({load:e.weight,reps:settings.targetReps,done:false}))}))};
  currentIndex=0;setView("workoutView");renderExercise();
}
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
    row.innerHTML=`<div class="set-number">0${i+1}</div><label>Reps<input type="number" min="0" max="100" value="${s.reps}" aria-label="Repetisjoner sett ${i+1}"></label><label>Kg<input type="number" min="0" step="0.5" value="${s.load}" aria-label="Belastning sett ${i+1}"></label><button class="set-check ${s.done?"done":""}" aria-label="Marker sett fullført">${s.done?"✓":"○"}</button>`;
    const inputs=row.querySelectorAll("input");inputs[0].addEventListener("change",()=>{s.reps=Math.max(0,Number(inputs[0].value)||0);updateCoach();});
    inputs[1].addEventListener("change",()=>{s.load=Math.max(0,Number(inputs[1].value)||0);document.getElementById("loadValue").textContent=fmtNum(s.load);updateCoach();});
    row.querySelector("button").addEventListener("click",()=>{s.done=!s.done;renderExercise();if(s.done&&i<e.sets.length-1)startRest();});
    document.getElementById("setsList").appendChild(row);
  });
  document.getElementById("previousExercise").disabled=currentIndex===0;
  document.getElementById("nextExercise").textContent=currentIndex===session.exercises.length-1?"Siste øvelse ✓":"Neste øvelse →";
  updateCoach();
}
function updateCoach(){
  const e=current();const last=e.sets[e.sets.length-1];const tip=document.getElementById("coachTip");
  if(last.reps>settings.targetReps)tip.innerHTML=`<strong>Progresjonsmulighet:</strong> Du har registrert ${last.reps} reps i siste sett – mer enn målet på ${settings.targetReps}. Hvis teknikken var god og dette kjentes kontrollert, vurder ${fmtNum(Number(last.load)+settings.incrementKg)} kg neste gang.`;
  else tip.innerHTML=`<strong>Fokus:</strong> Sikt mot ${settings.targetReps} gode repetisjoner i hvert sett. Når siste sett går over målet med kontroll, vurder en økning på ${settings.incrementKg} kg neste økt.`;
}
function changeLoad(delta){const e=current();e.sets.forEach(s=>s.load=Math.max(0,Number((s.load+delta).toFixed(2))));renderExercise();}
function nextExercise(){if(currentIndex<session.exercises.length-1){currentIndex++;renderExercise();}else showToast("Du er på siste øvelse – avslutt økten når du er klar.");}
function previousExercise(){if(currentIndex>0){currentIndex--;renderExercise();}}
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
  history.push({date:session.date,exercises:session.exercises,volume});
  // Remember the last used load per exercise; do not auto-increase it.
  session.exercises.forEach(se=>{const ex=exercises.find(e=>e.id===se.id);if(ex&&se.sets.length)ex.weight=se.sets[se.sets.length-1].load;});
  saveData();session=null;stopRest();document.getElementById("restPanel").hidden=true;setView("homeView");renderHome();showToast(`Økt lagret · ${fmtNum(volume)} kg totalvolum`);
}
function renderProgress(){
  document.getElementById("progressWorkouts").textContent=history.length;
  document.getElementById("progressVolume").textContent=fmtNum(history.reduce((s,w)=>s+(w.volume||0),0));
  const filter=document.getElementById("muscleFilter").value;const box=document.getElementById("progressCards");box.innerHTML="";
  const matching=exercises.filter(e=>filter==="Alle"||e.muscles.includes(filter));
  if(!matching.length){box.innerHTML='<div class="empty-state">Ingen øvelser i denne muskelgruppen ennå.</div>';return;}
  matching.forEach(ex=>{
    const points=history.map(w=>{const found=w.exercises.find(x=>x.id===ex.id);if(!found)return null;return Math.max(...found.sets.map(s=>Number(s.load)||0));}).filter(v=>v!==null);
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
document.getElementById("startWorkoutBtn").addEventListener("click",startWorkout);
document.getElementById("backHome").addEventListener("click",()=>{if(confirm("Gå ut av økten? Økten blir ikke lagret før du avslutter.")){session=null;stopRest();setView("homeView");}});
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
document.getElementById("targetReps").value=settings.targetReps;
document.getElementById("restSeconds").value=settings.restSeconds;
document.getElementById("incrementKg").value=settings.incrementKg;
renderHome();
