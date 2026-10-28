/* Halloween 2026 — habillage temporaire sans modifier les contenus du club.
   Retour à l'accueil ordinaire dès le 3 novembre à 00:00 Europe/Paris. */
(function () {
  'use strict';
  function parisDateParts() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris', year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',hourCycle:'h23'
    }).formatToParts(new Date());
    const o={}; for (const p of parts) o[p.type]=p.value;
    return o;
  }
  const n=parisDateParts();
  const stamp=Number(n.year+n.month+n.day+n.hour);
  const start=2026102800, end=2026110300;
  if(stamp<start || stamp>=end) return;
  document.documentElement.classList.add('halloween-2026');
  const s=document.createElement('link');
  s.rel='stylesheet';s.href='css/halloween2026.css?v=1';
  document.head.appendChild(s);
  document.addEventListener('DOMContentLoaded', function () {
    const home=document.getElementById('accueil');
    if(!home)return;
    const banner=document.createElement('aside');
    banner.className='halloween-return-banner';
    banner.setAttribute('aria-label','Vacances de la Toussaint');
    banner.innerHTML='<span class="halloween-return-kicker">🎃 Vacances de la Toussaint</span><strong>Reprise des cours lundi 2 novembre 2026</strong><span>On se retrouve sur les tatamis ! 🥊</span>';
    home.insertBefore(banner,home.firstChild);
  });
}());
