(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ui = {
    score: $('score'), energyText: $('energyText'), energyBar: $('energyBar'), stressText: $('stressText'), stressBar: $('stressBar'),
    promileText: $('promileText'), promileBar: $('promileBar'), officeClock: $('officeClock'), wallClock: $('wallClock'),
    tasksList: $('tasksList'), queueCount: $('queueCount'), statusText: $('statusText'), speech: $('speech'), eventBanner: $('eventBanner'),
    dzoanna: $('dzoanna'), dzoProp: $('dzoProp'), visitor: $('visitor'), visitorLabel: $('visitorLabel'), screenText: $('screenText'),
    start: $('startScreen'), modal: $('modal'), end: $('endScreen'), recordStart: $('recordStart'), finalScore: $('finalScore'), summary: $('summary'),
    rank: $('rank'), endTitle: $('endTitle'), endQuote: $('endQuote'), pauseBtn: $('pauseBtn'), musicBtn: $('musicBtn')
  };

  const taskDefs = [
    {text:'Zeskanuj dokumenty', target:'printer', pts:90, energy:4, stress:3, time:11, hint:'Kliknij drukarkę/skaner'},
    {text:'Wydrukuj decyzję', target:'printer', pts:95, energy:4, stress:4, time:10, hint:'Drukarka czeka'},
    {text:'Sprawdź maila', target:'computer', pts:80, energy:3, stress:3, time:11, hint:'Kliknij komputer'},
    {text:'Wyślij maila do interesanta', target:'computer', pts:105, energy:4, stress:4, time:10, hint:'Komputer → eURZĄD'},
    {text:'Wyrzuć śmieci', target:'bin', pts:70, energy:2, stress:1, time:9, hint:'Kliknij kosz'},
    {text:'Popraw godzinę na zegarze', target:'clock', pts:75, energy:2, stress:2, time:10, hint:'Kliknij zegar'},
    {text:'Podpisz dokumenty', target:'docs', pts:95, energy:5, stress:4, time:10, hint:'Sterta dokumentów na biurku'},
    {text:'Odbierz telefon', target:'phone', pts:100, energy:4, stress:5, time:9, hint:'Telefon dzwoni'},
    {text:'Znajdź segregator', target:'cabinet', pts:90, energy:3, stress:2, time:11, hint:'Kliknij szafkę'},
    {text:'Podbij pieczątkę', target:'stamp', pts:95, energy:3, stress:2, time:10, hint:'Kliknij pieczątkę'},
    {text:'Sprawdź planer urlopowy', target:'planner', pts:85, energy:3, stress:2, time:11, hint:'Kliknij planer'},
    {text:'Sprawdź pogodę za oknem', target:'window', pts:70, energy:1, stress:-3, time:12, hint:'Kliknij okno'}
  ];

  const quips = {
    success: [
      'No i zrobione. Następny dramat.', 'Proszę bardzo. Dżoanna jeszcze żyje.', 'Elegancko. Jedno mniej.',
      'Dobra, poszło. Nie pytajcie jak.', 'Jakoś to przemieliłam.', 'No i cyk, urząd uratowany.'
    ],
    busy: [
      'A ja pierdolę, nie robię wszystkiego naraz.', 'Halo, ja mam tylko dwie ręce.', 'To już chyba robota dla dwóch osób.',
      'Kto to wszystko nawymyślał?', 'Nie widzę tego. Nie ma problemu.', 'Zaraz weekend, a oni znowu z papierami.'
    ],
    tired: [
      'Ja już nie mam siły.', 'Źle się czuję.', 'Potrzebuję lekarza, coś mi się kręci.',
      'Jeszcze chwila i L4 samo się wypisze.', 'Dżoanna potrzebuje regeneracji.', 'Czy dzisiaj może być już 15:00?'
    ],
    fail: [
      'No i nie zdążyłam. Trudno.', 'To się zrobi jutro.', 'Nie można mieć wszystkiego.',
      'No przecież mówiłam, że jest za dużo roboty.', 'To nie moja wina, że czas tak szybko leci.'
    ],
    drunk: [
      'Oj, chyba mocniej weszło niż myślałam.', 'Kręci mi się trochę urząd.', 'Potrzebuję lekarza albo kanapy.',
      'Mocny full… i od razu mniej stresu.', 'Jak ktoś pyta, to to był syrop.', 'Po tej regeneracji literki tańczą.'
    ],
    idle: [
      'A może by tak wakacje?', 'Może przestawię zegar trochę do przodu…', 'Chyba trzeba mentalnie pakować walizkę.',
      'Kawa sama się nie wypije.', 'Jeszcze chwila i znikam.', 'Dobra, poszła kierowniczka?'
    ]
  };

  const actionTargetX = {
    bin: -300, docs: -175, phone: -210, planner: -145, stamp: -95, computer: -15, coffee: 85,
    printer: 145, cabinet: 250, door: 330, clock: 230, window: 35
  };

  const SHIFT_REAL_SECONDS = 180;
  const SHIFT_MINUTES = 450;
  const MAX_QUEUE = 6;

  let state = {};
  let tickHandle = null;
  let eventHandle = null;
  let modalOpen = false;
  let speechHandle = null;
  let bannerHandle = null;
  let selfEventLock = false;
  let musicEnabled = true;
  let audioCtx = null;
  let musicLoop = null;

  function resetState(){
    state = {
      running:false, paused:false, score:0, energy:100, stress:10, promile:0, tasks:[], id:0,
      elapsed:0, done:0, failed:0, coffees:0, wc:0, beers:0, vodkas:0, holidays:0, escapings:0,
      managerDone:0, sylwiaMeet:0, streak:0, bestStreak:0, ended:false, nextTaskAt:2.1,
      nextEventAt:14, nextSelfAt:11, nextIdleTalkAt:7, lastFrame:0
    };
  }

  function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
  function chance(n){ return Math.random() < n; }

  function ensureAudio(){
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone(freq, duration=0.14, type='square', volume=0.03, delay=0){
    if (!musicEnabled) return;
    ensureAudio();
    const start = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function playSfx(kind){
    const map = {
      success:[[659,.06],[880,.08],[1046,.08]], fail:[[320,.1],[250,.12]], click:[[550,.05]],
      drink:[[392,.07],[330,.07],[262,.1]], manager:[[784,.08],[523,.12],[784,.06]],
      queue:[[196,.08],[174,.08],[147,.12]], sylwia:[[523,.08],[659,.08]],
      l4:[[196,.15],[165,.18],[131,.25]], start:[[523,.08],[659,.08],[784,.12]], pause:[[300,.06],[240,.06]]
    };
    (map[kind] || []).forEach((n,i)=>playTone(n[0],n[1],'square',0.035,i*0.06));
  }

  function startMusic(){
    stopMusic();
    if (!musicEnabled) return;
    ensureAudio();
    const melody = [523,659,784,659,523,659,880,784,494,659,784,659,440,523,659,523];
    const bass = [131,131,147,147,165,165,147,147];
    const step = 0.18;
    const playLoop = () => {
      melody.forEach((note, i) => playTone(note, 0.12, 'square', 0.018, i * step));
      bass.forEach((note, i) => playTone(note, 0.22, 'triangle', 0.018, i * (step*2)));
    };
    playLoop();
    musicLoop = setInterval(playLoop, melody.length * step * 1000);
  }

  function stopMusic(){
    if (musicLoop) clearInterval(musicLoop);
    musicLoop = null;
  }

  function say(text, ms=2400){
    clearTimeout(speechHandle);
    ui.speech.textContent = text;
    ui.speech.classList.remove('hidden');
    speechHandle = setTimeout(() => ui.speech.classList.add('hidden'), ms);
  }

  function banner(text, ms=2200){
    clearTimeout(bannerHandle);
    ui.eventBanner.textContent = text;
    ui.eventBanner.classList.remove('hidden');
    bannerHandle = setTimeout(() => ui.eventBanner.classList.add('hidden'), ms);
  }

  function status(text){ ui.statusText.textContent = text; }

  function showModal(title, text, buttons){
    modalOpen = true;
    $('modalTitle').textContent = title;
    $('modalText').textContent = text;
    const wrap = $('modalButtons');
    wrap.innerHTML = '';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if (b.kind) btn.className = b.kind;
      btn.onclick = () => { hideModal(); b.onClick && b.onClick(); };
      wrap.appendChild(btn);
    });
    ui.modal.classList.add('show');
  }

  function hideModal(){ modalOpen = false; ui.modal.classList.remove('show'); }

  function shiftTimeText(){
    const shiftProgress = clamp(state.elapsed / SHIFT_REAL_SECONDS, 0, 1);
    const mins = 450 + Math.floor(SHIFT_MINUTES * shiftProgress);
    const hh = Math.floor(mins/60);
    const mm = mins%60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  }

  function updateHud(){
    ui.score.textContent = Math.round(state.score);
    ui.energyText.textContent = `${Math.round(state.energy)}%`;
    ui.energyBar.style.width = `${state.energy}%`;
    ui.stressText.textContent = `${Math.round(state.stress)}%`;
    ui.stressBar.style.width = `${state.stress}%`;
    ui.promileText.textContent = `${Math.round(state.promile)}%`;
    ui.promileBar.style.width = `${state.promile}%`;
    const t = shiftTimeText();
    ui.officeClock.textContent = t;
    ui.wallClock.textContent = t;
    ui.queueCount.textContent = `${state.tasks.length}/${MAX_QUEUE}`;
    ui.screenText.textContent = `${Math.max(0, 42 - state.done)} nieprzeczytane`;

    ui.dzoanna.classList.toggle('tired', state.energy < 28);
    ui.dzoanna.classList.toggle('drunk', state.promile > 35);
    document.body.classList.toggle('wobble', state.promile > 55);
    document.body.classList.toggle('drunkPulse', state.promile > 70);
  }

  function renderTasks(){
    ui.tasksList.innerHTML = '';
    if (!state.tasks.length){
      const div = document.createElement('div');
      div.className = 'taskCard';
      div.innerHTML = `<div class="taskTop"><span>Spokój… chwilowy.</span><b>0 s</b></div><div class="taskHint">Dżoanna na razie udaje produktywność.</div><div class="timerBar"><i style="width:100%"></i></div>`;
      ui.tasksList.appendChild(div);
      return;
    }
    state.tasks.forEach(task => {
      const card = document.createElement('div');
      const remain = Math.max(0, task.endsAt - state.elapsed);
      const pct = clamp((remain / task.duration) * 100, 0, 100);
      card.className = 'taskCard' + (remain < 3 ? ' urgent' : '');
      card.innerHTML = `<div class="taskTop"><span>${task.text}</span><b>${remain.toFixed(1)} s</b></div>
                        <div class="taskHint">${task.hint} • cel: ${labelForTarget(task.target)}</div>
                        <div class="timerBar"><i style="width:${pct}%"></i></div>`;
      ui.tasksList.appendChild(card);
    });
  }

  function labelForTarget(target){
    return {
      printer:'drukarka', computer:'komputer', bin:'kosz', clock:'zegar', docs:'dokumenty', phone:'telefon',
      cabinet:'szafka', stamp:'pieczątka', planner:'planer', window:'okno'
    }[target] || target;
  }

  function addTask(def, opts={}){
    const duration = opts.duration || def.time || 10;
    const task = {
      id: ++state.id,
      text: opts.text || def.text,
      target: def.target,
      pts: opts.pts || def.pts,
      energy: opts.energy ?? def.energy,
      stress: opts.stress ?? def.stress,
      duration,
      endsAt: state.elapsed + duration,
      hint: opts.hint || def.hint || '',
      urgent: !!opts.urgent
    };
    state.tasks.push(task);
    renderTasks();
    if (state.tasks.length >= 4) say(rand(quips.busy));
    if (state.tasks.length >= MAX_QUEUE) {
      endGame('L4', 'A ja pierdolę nie robię. Biorę L4, bo to jest jakiś cyrk.');
      playSfx('l4');
    } else {
      playSfx('queue');
    }
  }

  function spawnRandomTask(){
    addTask(rand(taskDefs));
    state.nextTaskAt = state.elapsed + clamp(4.7 - state.elapsed/55, 2.2, 4.7) + Math.random()*1.2;
  }

  function moveDzo(target, prop=''){ 
    const x = actionTargetX[target] || 0;
    ui.dzoanna.style.setProperty('--dzo-x', `${x}px`);
    if (prop) {
      ui.dzoProp.textContent = prop;
      ui.dzoanna.classList.add('holding');
    } else {
      ui.dzoanna.classList.remove('holding');
      ui.dzoProp.textContent = '';
    }
  }

  function resetPose(delay=650){
    setTimeout(() => {
      ui.dzoanna.style.setProperty('--dzo-x', '0px');
      ui.dzoanna.classList.remove('working','drinking');
      ui.dzoanna.classList.remove('holding');
      ui.dzoProp.textContent = '';
      document.querySelectorAll('.gameObject.active').forEach(el => el.classList.remove('active'));
    }, delay);
  }

  function animateObject(target){
    const el = document.querySelector(`[data-target="${target}"]`);
    if (el) el.classList.add('active');
    if (target === 'printer') $('printerObj').classList.add('active');
    if (target === 'phone') $('phoneObj').classList.add('ringing');
    setTimeout(() => $('phoneObj').classList.remove('ringing'), 900);
  }

  function completeTask(target){
    const idx = state.tasks.findIndex(t => t.target === target);
    if (idx < 0) return false;
    const task = state.tasks.splice(idx, 1)[0];
    const remain = Math.max(0, task.endsAt - state.elapsed);
    const timeBonus = remain > 4 ? 35 : remain > 1.5 ? 15 : 0;
    const streakBonus = state.streak >= 4 ? 20 : 0;
    state.score += task.pts + timeBonus + streakBonus;
    state.energy = clamp(state.energy - task.energy, 0, 100);
    state.stress = clamp(state.stress + task.stress - 2, 0, 100);
    state.done++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    renderTasks();
    updateHud();
    playSfx('success');
    status(`Zrobione: ${task.text} (+${task.pts + timeBonus + streakBonus} pkt)`);
    say(rand(quips.success));
    return true;
  }

  function failExpiredTasks(){
    const before = state.tasks.length;
    state.tasks = state.tasks.filter(task => {
      if (task.endsAt > state.elapsed) return true;
      state.failed++;
      state.score = Math.max(0, state.score - 120);
      state.stress = clamp(state.stress + 10, 0, 100);
      state.energy = clamp(state.energy - 4, 0, 100);
      state.streak = 0;
      say(rand(quips.fail));
      status(`Nie zdążono: ${task.text} (-120 pkt)`);
      playSfx('fail');
      return false;
    });
    if (state.tasks.length !== before) renderTasks();
  }

  function actionCoffee(){
    moveDzo('coffee','☕'); animateObject('coffee'); ui.dzoanna.classList.add('drinking');
    state.coffees++; state.energy = clamp(state.energy + 18, 0, 100); state.stress = clamp(state.stress - 8, 0, 100); state.score = Math.max(0, state.score - 30);
    say('Bez kawy tego nie przeżyję.'); status('Dżoanna pije kawę (-30 pkt, +18 energii)'); playSfx('drink');
    resetPose(1200); updateHud();
  }

  function actionDrink(type){
    const isVodka = type === 'vodka';
    moveDzo('cabinet', isVodka ? '🍸' : '🍺'); animateObject('cabinet'); ui.dzoanna.classList.add('drinking');
    if (isVodka) state.vodkas++; else state.beers++;
    state.energy = clamp(state.energy + (isVodka ? 22 : 14), 0, 100);
    state.stress = clamp(state.stress - (isVodka ? 18 : 10), 0, 100);
    state.promile = clamp(state.promile + (isVodka ? 32 : 18), 0, 100);
    state.score = Math.max(0, state.score - (isVodka ? 170 : 110));
    say(isVodka ? 'Mocny full. Jak ktoś pyta, to to był syrop.' : 'Jedno jeszcze nikogo nie zwolniło.');
    status(isVodka ? 'Wódka z szafki (-170 pkt, +22 energii, +32 promile)' : 'Piwo z szafki (-110 pkt, +14 energii, +18 promile)');
    if (state.promile > 50) say(rand(quips.drunk), 3000);
    playSfx('drink'); resetPose(1300); updateHud();
    if (state.promile >= 100) endGame('Lekarz', 'Potrzebuję lekarza, źle się czuję. Obawiam się, że wszystko mi się kręci.');
  }

  function actionWc(){
    moveDzo('door','🚽'); animateObject('door'); $('doorObj').classList.add('open');
    state.wc++; state.energy = clamp(state.energy + 10, 0, 100); state.stress = clamp(state.stress - 4, 0, 100); state.score = Math.max(0, state.score - 40); state.elapsed += 2.5;
    say('Idę do WC, bo już naprawdę nie mogę.'); status('Dżoanna wyszła do WC (-40 pkt, +10 energii)'); playSfx('click');
    setTimeout(() => $('doorObj').classList.remove('open'), 900); resetPose(1100); updateHud(); renderTasks();
  }

  function actionHolidays(){
    moveDzo('window','🧳'); animateObject('window');
    state.holidays++; state.stress = clamp(state.stress - 8, 0, 100); state.energy = clamp(state.energy + 4, 0, 100); state.score = Math.max(0, state.score - 60); state.elapsed += 2;
    say('Zaraz weekend. O chyba trzeba wyjechać…');
    showModal('Wakacje', 'Dżoanna przegląda wyjazdy. Co wybierasz?', [
      {label:'EGIPT 27°C', kind:'good', onClick:() => { say('A może Egipt… tylko kto to wszystko zrobi?'); status('Dżoanna marzy o Egipcie (-60 pkt)'); }},
      {label:'TENERYFA 25°C', kind:'good', onClick:() => { say('Teneryfa brzmi rozsądnie. Najlepiej od jutra.'); status('Dżoanna przegląda Teneryfę (-60 pkt)'); }},
      {label:'WRACAJ DO ROBOTY', kind:'bad', onClick:() => { say('No dobra, już robię.'); status('Dżoanna wraca do pracy.'); }}
    ]);
    playSfx('click'); resetPose(1200); updateHud();
  }

  function actionGoHome(){
    showModal('Do domu?', 'Jeśli Dżoanna wyjdzie z pracy, kończysz zmianę i tracisz 50% punktów.', [
      {label:'ZOSTAŃ', kind:'good'},
      {label:'IDŹ DO DOMU', kind:'bad', onClick:() => {
        state.escapings++;
        state.score = Math.round(state.score * 0.5);
        endGame('Ucieczka', 'Dżoanna opuściła stanowisko pracy przed końcem zmiany.');
      }}
    ]);
  }

  function cabinetModal(){
    showModal('Szafka', 'No to co teraz? Piwo, wódka czy jednak udawanie profesjonalizmu?', [
      {label:'PIWO', kind:'good', onClick:() => actionDrink('beer')},
      {label:'WÓDKA', kind:'bad', onClick:() => actionDrink('vodka')},
      {label:'ZAMKNIJ', onClick:() => say('Dobra, jeszcze nie teraz.')}
    ]);
  }

  function doorModal(){
    showModal('Drzwi', 'Drzwi kuszą. Co robi Dżoanna?', [
      {label:'IDĘ DO WC', kind:'good', onClick:() => actionWc()},
      {label:'IDĘ DO DOMU', kind:'bad', onClick:() => actionGoHome()},
      {label:'WRACAM', onClick:() => say('No dobra, siedzę dalej.')}
    ]);
  }

  function plannerIdle(){
    moveDzo('planner','📝'); animateObject('planner'); ui.dzoanna.classList.add('working');
    state.score = Math.max(0, state.score - 20); state.stress = clamp(state.stress - 2, 0, 100);
    say('Może sobie rozplanuję, jak nic nie zrobić jutro.'); status('Dżoanna grzebie w planerze (-20 pkt)'); playSfx('click'); resetPose(); updateHud();
  }

  function windowIdle(){
    moveDzo('window','🌴'); animateObject('window');
    say('A może lepiej szukać wakacji niż odpowiedzi na maile?'); status('Dżoanna patrzy za okno.'); playSfx('click'); resetPose();
  }

  function objectAction(target){
    if (!state.running || state.paused || state.ended || modalOpen) return;
    const special = {
      coffee: actionCoffee,
      cabinet: cabinetModal,
      door: doorModal,
      planner: () => completeTask('planner') || plannerIdle(),
      window: () => completeTask('window') || windowIdle(),
      clock: () => doWorkAction('clock','🕒'),
      printer: () => doWorkAction('printer','🖨️'),
      computer: () => doWorkAction('computer','💻'),
      docs: () => doWorkAction('docs','📄'),
      phone: () => doWorkAction('phone','☎️'),
      bin: () => doWorkAction('bin','🗑️'),
      stamp: () => doWorkAction('stamp','🔴')
    };
    (special[target] || (() => {}))();
  }

  function doWorkAction(target, prop){
    moveDzo(target, prop); animateObject(target); ui.dzoanna.classList.add('working');
    const ok = completeTask(target);
    if (!ok) {
      state.score = Math.max(0, state.score - 10);
      state.stress = clamp(state.stress + 1, 0, 100);
      say(rand(quips.idle));
      status(`To nie było teraz potrzebne. (-10 pkt)`);
      playSfx('click');
    }
    resetPose(); updateHud();
  }

  function spawnManager(){
    ui.visitor.classList.remove('hidden');
    ui.visitorLabel.textContent = 'KIEROWNICZKA';
    banner('KIEROWNICZKA: PILNE POLECENIE!');
    playSfx('manager');
    const base = rand(taskDefs.filter(t => ['printer','computer','docs','clock','stamp','phone'].includes(t.target)));
    addTask(base, {urgent:true, duration:7, pts:base.pts + 45, text:`PILNE: ${base.text}`, hint:'Kierowniczka patrzy'});
    say(rand([
      'Dżoanna! To miało być już zrobione.',
      'Dżoanna, natychmiast proszę to ogarnąć.',
      'Dżoanna! Interesant czeka.'
    ]), 2600);
    setTimeout(() => ui.visitor.classList.add('hidden'), 3500);
  }

  function spawnSylwia(){
    ui.visitor.classList.remove('hidden');
    ui.visitorLabel.textContent = 'SYLWIA';
    banner('SYLWIA ZNOWU PRZYSZŁA POGADAĆ');
    playSfx('sylwia');
    showModal('Sylwia', rand([
      'Idziesz na kawę? Zostaw te papiery.',
      'Słuchaj, widziałam fajne loty na weekend…',
      'Robisz coś czy tylko wyglądasz, że robisz?'
    ]), [
      {label:'NIE, PRACUJĘ', kind:'good', onClick:() => { state.score += 40; say('No patrz, jaka profesjonalistka.'); status('Dżoanna została przy biurku (+40 pkt)'); }},
      {label:'NO DOBRA', kind:'bad', onClick:() => { state.sylwiaMeet++; state.stress = clamp(state.stress - 6, 0, 100); state.energy = clamp(state.energy + 6, 0, 100); state.score = Math.max(0, state.score - 70); state.elapsed += 2.2; say('Tylko na chwilkę…', 2200); status('Ploteczki z Sylwią (-70 pkt)'); }}
    ]);
    setTimeout(() => ui.visitor.classList.add('hidden'), 3500);
  }

  function spawnRandomEvent(){
    if (chance(0.54)) spawnManager(); else spawnSylwia();
    state.nextEventAt = state.elapsed + 16 + Math.random()*10;
  }

  function spawnSelfSabotage(){
    if (selfEventLock || modalOpen || !state.running) return;
    selfEventLock = true;
    const events = [
      {
        text:'Dżoanna: O, może zrobię sobie kawę.',
        buttons:[
          {label:'SIADAJ I PRACUJ', kind:'good', onClick:() => { state.score += 25; say('No dobra, już robię.'); status('Powstrzymałeś kawowy bunt (+25 pkt)'); }},
          {label:'NIECH IDZIE', kind:'bad', onClick:() => actionCoffee()}
        ]
      },
      {
        text:'Dżoanna: A może by tak spojrzeć za okno i poszukać wakacji?',
        buttons:[
          {label:'WRACAJ DO ROBOTY', kind:'good', onClick:() => { state.score += 20; say('No już, siedzę.'); status('Dżoanna wraca do pracy (+20 pkt)'); }},
          {label:'NIECH SZUKA', kind:'bad', onClick:() => actionHolidays()}
        ]
      },
      {
        text:'Dżoanna: Chyba pójdę do szafki po regenerację.',
        buttons:[
          {label:'ABSOLUTNIE NIE', kind:'good', onClick:() => { state.score += 25; say('Dobra, jeszcze nie teraz.'); status('Powstrzymałeś szafkowy kryzys (+25 pkt)'); }},
          {label:'NIECH WEŹMIE PIWO', kind:'bad', onClick:() => actionDrink('beer')}
        ]
      }
    ];
    const event = rand(events);
    showModal('Dżoanna kombinuje', event.text, event.buttons);
    state.nextSelfAt = state.elapsed + 18 + Math.random()*14;
    selfEventLock = false;
  }

  function periodicTalk(){
    const source = state.promile > 50 ? quips.drunk : (state.energy < 30 ? quips.tired : quips.idle);
    say(rand(source));
    state.nextIdleTalkAt = state.elapsed + 11 + Math.random()*7;
  }

  function checkLoseConditions(){
    if (state.energy <= 0) {
      endGame('L4', 'Jestem zmęczona. Biorę L4. Nie ma mnie.');
      playSfx('l4');
      return true;
    }
    if (state.stress >= 100) {
      endGame('Za dużo', 'Nie, nie, nie. Tego jest za dużo. Dżoanna wychodzi.');
      playSfx('l4');
      return true;
    }
    if (state.promile >= 100) {
      endGame('Lekarz', 'Potrzebuję lekarza, źle się czuję, obawiam się że wszystko mi się kręci.');
      playSfx('l4');
      return true;
    }
    return false;
  }

  function gameTick(now){
    if (!state.running || state.paused || state.ended) return;
    if (!state.lastFrame) state.lastFrame = now;
    const dt = Math.min((now - state.lastFrame) / 1000, 0.25);
    state.lastFrame = now;
    state.elapsed += dt;

    state.energy = clamp(state.energy - dt * (0.45 + state.tasks.length * 0.025 + state.promile * 0.006), 0, 100);
    state.stress = clamp(state.stress + dt * (state.tasks.length * 0.42 + Math.max(0, 28 - state.energy) * 0.015), 0, 100);
    state.promile = clamp(state.promile - dt * 0.42, 0, 100);

    if (state.elapsed >= state.nextTaskAt) spawnRandomTask();
    if (state.elapsed >= state.nextEventAt) spawnRandomEvent();
    if (state.elapsed >= state.nextSelfAt) spawnSelfSabotage();
    if (state.elapsed >= state.nextIdleTalkAt) periodicTalk();

    failExpiredTasks();
    renderTasks();
    updateHud();
    if (checkLoseConditions()) return;
    if (state.elapsed >= SHIFT_REAL_SECONDS) endGame('Koniec zmiany', 'Jakoś to przetrwałam. Jutro też tu będę?');
    tickHandle = requestAnimationFrame(gameTick);
  }

  function getRank(){
    if (state.escapings) return 'Uciekła przed 15:00';
    if (state.promile > 70) return 'Mocny full urzędowy';
    if (state.score >= 4200) return 'Pracownik miesiąca';
    if (state.score >= 3200) return 'Wzorowy referent';
    if (state.score >= 2200) return 'Byle do piętnastej';
    if (state.score >= 1200) return 'Więcej gadania niż roboty';
    return 'L4 po oczach';
  }

  function endGame(title, quote){
    if (state.ended) return;
    state.running = false;
    state.ended = true;
    cancelAnimationFrame(tickHandle);
    ui.endTitle.textContent = title;
    ui.endQuote.textContent = quote;
    ui.finalScore.textContent = Math.round(state.score);
    ui.summary.innerHTML = `
      <div>Wykonane zadania: <b>${state.done}</b></div>
      <div>Niewykonane: <b>${state.failed}</b></div>
      <div>Kawy: <b>${state.coffees}</b></div>
      <div>Wyjścia do WC: <b>${state.wc}</b></div>
      <div>Piwa: <b>${state.beers}</b></div>
      <div>Wódki: <b>${state.vodkas}</b></div>
      <div>Ploty / Sylwia: <b>${state.sylwiaMeet}</b></div>
      <div>Szukanie wakacji: <b>${state.holidays}</b></div>
      <div>Najlepsza seria: <b>${state.bestStreak}</b></div>
      <div>Promile na koniec: <b>${Math.round(state.promile)}%</b></div>`;
    ui.rank.textContent = getRank();
    const rec = Math.max(parseInt(localStorage.getItem('urzedniczka2_record') || '0', 10), Math.round(state.score));
    localStorage.setItem('urzedniczka2_record', rec);
    ui.end.classList.add('show');
  }

  function startGame(){
    resetState();
    ensureAudio();
    ui.start.classList.remove('show');
    ui.end.classList.remove('show');
    ui.modal.classList.remove('show');
    ui.visitor.classList.add('hidden');
    state.running = true;
    state.lastFrame = 0;
    state.nextTaskAt = 1.8;
    state.nextEventAt = 15;
    state.nextSelfAt = 11;
    state.nextIdleTalkAt = 6;
    renderTasks();
    updateHud();
    playSfx('start');
    startMusic();
    say('Dobra. Zaczynamy zmianę. Oby do 15:00.', 2200);
    status('Zmiana rozpoczęta. Klikaj właściwe elementy i pilnuj Dżoanny.');
    tickHandle = requestAnimationFrame(gameTick);
  }

  function togglePause(){
    if (!state.running || state.ended) return;
    state.paused = !state.paused;
    ui.pauseBtn.textContent = state.paused ? '▶' : 'Ⅱ';
    playSfx('pause');
    if (!state.paused) {
      state.lastFrame = 0;
      tickHandle = requestAnimationFrame(gameTick);
      status('Wracamy do urzędu.');
    } else {
      cancelAnimationFrame(tickHandle);
      status('Pauza. Nawet Dżoanna odpoczywa.');
    }
  }

  function toggleMusic(){
    musicEnabled = !musicEnabled;
    ui.musicBtn.textContent = musicEnabled ? '♫' : '×';
    if (musicEnabled) startMusic(); else stopMusic();
  }

  function init(){
    resetState();
    ui.recordStart.textContent = localStorage.getItem('urzedniczka2_record') || '0';

    $('startBtn').addEventListener('click', startGame);
    $('restartBtn').addEventListener('click', startGame);
    ui.pauseBtn.addEventListener('click', togglePause);
    ui.musicBtn.addEventListener('click', toggleMusic);
    $('helpBtn').addEventListener('click', () => {
      showModal('Jak grać?', 'Klikaj właściwe przedmioty zgodnie z zadaniami w panelu. Masz też fizyczne przyciski do WC, wakacji i domu. Uważaj na stres, energię i promile.', [{label:'OK'}]);
    });

    ['clock','door','cabinet','bin','docs','computer','printer','phone','coffee','stamp','planner','window'].forEach(target => {
      const el = document.querySelector(`[data-target="${target}"]`);
      if (el) el.addEventListener('click', () => objectAction(target));
    });

    $('wcBtn').addEventListener('click', () => { if(state.running && !state.paused && !state.ended) actionWc(); });
    $('holidaysBtn').addEventListener('click', () => { if(state.running && !state.paused && !state.ended) actionHolidays(); });
    $('homeBtn').addEventListener('click', () => { if(state.running && !state.paused && !state.ended) actionGoHome(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOpen) hideModal();
      if (e.key.toLowerCase() === 'p') togglePause();
      if (e.key.toLowerCase() === 'm') toggleMusic();
    });

    renderTasks();
    updateHud();
  }

  init();
})();
