(() => {
  const standalone=matchMedia('(display-mode: standalone)'),compact=matchMedia('(max-width: 700px)');
  const adapt=()=>{const installed=standalone.matches || navigator.standalone===true;document.body.classList.toggle('installed-pwa',installed);document.body.classList.toggle('mobile-pwa',installed&&compact.matches);};
  [standalone,compact].forEach(query=>query.addEventListener('change',adapt));
  const themeToggle = document.querySelector('#dark-mode-toggle');
  const renderTheme = () => { const dark=document.documentElement.dataset.theme === 'dark'; themeToggle.setAttribute('aria-checked', String(dark)); document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#101722':'#245ca6'); };
  themeToggle.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('foulee.theme', dark ? 'dark' : 'light'); } catch {}
    renderTheme();
  });
  window.addEventListener('storage', event => {
    if (event.key === 'foulee.theme') { document.documentElement.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light'; renderTheme(); }
  });
  renderTheme();
  adapt();
})();

(() => {
  const install = document.querySelector('#pwa-install');
  const update = document.querySelector('#pwa-update');
  const status = document.querySelector('#pwa-status');
  const panel = document.querySelector('.pwa-panel');
  const standalone = matchMedia('(display-mode: standalone)');
  let installPrompt;
  let registration;
  let activatingUpdate = false;
  const isInstalled = () => standalone.matches || navigator.standalone === true;
  const renderInstalled = () => {
    install.hidden = isInstalled();
    panel.hidden = false;
  };
  renderInstalled();
  standalone.addEventListener('change', renderInstalled);
  let checking = false, reloadReady = false;
  const checkForUpdate = async (manual = false) => {
    if (!registration || checking || document.hidden) return;
    if (navigator.onLine === false) {
      if (manual) status.textContent = 'Hors connexion. Retrouve le réseau du Mac pour vérifier les mises à jour.';
      return;
    }
    checking = true;
    if (manual) {update.disabled = true; status.textContent = 'Recherche d’une mise à jour sur le Mac…';}
    let timer;
    try {
      await Promise.race([registration.update(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),15000);})]);
      if (!offerUpdate() && manual) status.textContent = registration.installing ? 'Téléchargement de la nouvelle version…' : 'Aucune nouvelle version détectée.';
    } catch {
      if (manual) status.textContent = 'Mise à jour indisponible. Vérifie le Wi-Fi et que le serveur Foulée tourne sur le Mac, puis réessaie.';
    } finally {clearTimeout(timer);checking=false;update.disabled=false;}
  };
  window.addEventListener('pageshow', () => checkForUpdate());
  window.addEventListener('online', () => checkForUpdate());
  document.addEventListener('visibilitychange', () => checkForUpdate());
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event;
    if (!isInstalled()) { panel.hidden = false; install.hidden = false; }
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; install.hidden = true; status.textContent = 'Foulée est installée.'; });
  install.addEventListener('click', async () => {
    if (installPrompt) {
      const prompt = installPrompt; installPrompt = null;
      await prompt.prompt(); await prompt.userChoice;
      return;
    }
    status.textContent = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      ? 'Dans Safari : Partager → Sur l’écran d’accueil → Ouvrir comme app, si proposé → Ajouter.'
      : 'Ouvre Foulée dans Safari (Fichier → Ajouter au Dock), ou dans Chrome / Edge et utilise l’option d’installation du navigateur.';
    if (!window.isSecureContext) status.textContent += ' Pour le mode hors connexion sur cet appareil, une adresse HTTPS est nécessaire.';
  });
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    status.textContent = !window.isSecureContext
      ? 'Hors connexion indisponible : ouvre Foulée en HTTPS avec un certificat approuvé sur cet iPhone, puis ajoute cette adresse à l’écran d’accueil.'
      : 'Ce navigateur ne permet pas de préparer le mode hors connexion.';
    return;
  }
  const offerUpdate = () => {
    panel.hidden = false; update.hidden = false;
    document.body.classList.toggle('pwa-update-available',Boolean(reloadReady || registration?.waiting));
    if (reloadReady || registration?.waiting) {
      update.textContent = 'Mettre à jour Foulée';
      status.textContent = 'Une nouvelle version est prête. Enregistre tes modifications, puis mets à jour Foulée.';
      return true;
    }
    update.textContent = 'Vérifier les mises à jour';
    return false;
  };
  update.addEventListener('click', () => {
    if (reloadReady) {location.reload();return;}
    if (!registration?.waiting) {checkForUpdate(true);return;}
    activatingUpdate = true; update.disabled = true;
    registration.waiting.postMessage({type: 'ACTIVATE_UPDATE'});
    // Recover the button if the worker cannot activate (for example offline).
    setTimeout(() => {if(activatingUpdate){activatingUpdate=false;update.disabled=false;offerUpdate();}},15000);
  });
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (activatingUpdate) {location.reload();return;}
    if (hadController) {reloadReady = true;offerUpdate();}
    hadController = true;
  });
  const watchWorker = worker => {
    if (!worker) return;
    const render = () => {
      if (worker.state === 'installed' || worker.state === 'activated') offerUpdate();
      if (worker.state === 'redundant') {update.disabled=false;status.textContent='Le téléchargement de la mise à jour a échoué. Vérifie la connexion au Mac puis réessaie.';}
    };
    worker.addEventListener('statechange', render);render();
  };
  navigator.serviceWorker.register('/sw.js', {scope: '/', updateViaCache: 'none'}).then(value => {
    registration = value;
    registration.addEventListener('updatefound', () => watchWorker(registration.installing));
    watchWorker(registration.installing);
    if (!offerUpdate()) status.textContent = 'Application disponible hors connexion.';
    checkForUpdate();
  }).catch(() => { panel.hidden = false; status.textContent = 'Le mode hors connexion n’a pas pu être préparé. Vérifie la connexion au Mac puis recharge Foulée.'; });
})();
