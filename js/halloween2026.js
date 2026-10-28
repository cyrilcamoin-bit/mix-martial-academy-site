/* MMA Halloween 2026. Arrêt automatique au 3 novembre, 00:00 Europe/Paris. */
(function(){
'use strict';
function parisStamp(){const p={};for(const x of new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()))p[x.type]=x.value;return Number(p.year+p.month+p.day+p.hour+p.minute);}
const start=202610280000,end=202611030000;
if(parisStamp()<start||parisStamp()>=end)return;
const root=document.documentElement;root.classList.add('halloween-2026');
const style=document.createElement('link');style.rel='stylesheet';style.href='css/halloween2026.css?v=2';style.dataset.halloween='2026';document.head.appendChild(style);
function removeHalloween(){root.classList.remove('halloween-2026');const b=document.querySelector('.halloween-return-banner');if(b)b.remove();const d=document.querySelector('.halloween-cinema');if(d)d.remove();style.remove();}
function makeHalloween(){
const home=document.getElementById('accueil');if(!home)return;
const banner=document.createElement('aside');banner.className='halloween-return-banner';banner.setAttribute('aria-label','Vacances de la Toussaint');
banner.innerHTML='<span class="halloween-return-kicker">🎃 Vacances de la Toussaint</span><strong>Reprise des cours lundi 2 novembre 2026</strong><span>On se retrouve sur les tatamis ! 🥊</span>';
home.insertBefore(banner,home.firstChild);
const hero=home.querySelector('.home-hero');if(hero){const scene=document.createElement('div');scene.className='halloween-cinema';scene.setAttribute('aria-hidden','true');scene.innerHTML='<div class="moon"></div><div class="halloween-character halloween-ghostface"></div><div class="halloween-character halloween-dracula"></div><div class="halloween-character halloween-chucky"></div><div class="halloween-bats">🦇</div>';hero.insertBefore(scene,hero.firstChild);}
const check=setInterval(function(){if(parisStamp()>=end){clearInterval(check);removeHalloween();}},15000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',makeHalloween,{once:true});else makeHalloween();
}());