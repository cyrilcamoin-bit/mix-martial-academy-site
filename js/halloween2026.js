/* Mix Martial Academy — Halloween temporaire ; fin 03/11/2026 00:00, heure de Paris. */
(function(){
'use strict';
function parisStamp(){const p={};for(const x of new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()))p[x.type]=x.value;return Number(p.year+p.month+p.day+p.hour+p.minute);}
const end=202611030000;if(parisStamp()<202610280000||parisStamp()>=end)return;
const root=document.documentElement;root.classList.add('halloween-2026');
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='css/halloween2026.css?v=3';document.head.appendChild(sheet);
function clear(){root.classList.remove('halloween-2026');document.querySelectorAll('.halloween-return-banner,.halloween-cinema').forEach(x=>x.remove());sheet.remove()}
function start(){
const home=document.getElementById('accueil');if(!home)return;
const hero=home.querySelector('.home-hero');if(hero){
const scene=document.createElement('div');scene.className='halloween-cinema';scene.setAttribute('aria-hidden','true');
scene.innerHTML='<div class="moon"></div><div class="halloween-character halloween-ghostface"></div><div class="halloween-character halloween-dracula"></div><div class="halloween-character halloween-chucky"></div><div class="halloween-bats">🦇</div>';
hero.insertBefore(scene,hero.firstChild);
const banner=document.createElement('aside');banner.className='halloween-return-banner';banner.setAttribute('aria-label','Vacances de la Toussaint');
banner.innerHTML='<span class="halloween-return-kicker">Vacances de la Toussaint</span><strong>Reprise des cours lundi 2 novembre 2026</strong><span>On se retrouve sur les tatamis ! 🥊</span>';
hero.insertAdjacentElement('afterend',banner);
}
const check=setInterval(()=>{if(parisStamp()>=end){clearInterval(check);clear()}},15000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}());