(() => {
  "use strict";
  // Bêta Face ID : cette copie ne modifie jamais l'administration de production.
  const API = "https://feature-faceid-passkey-test-mma-lerove-api.cyril-camoin.workers.dev";
  const SESSION = "mma_faceid_preview_token";
  const VIEWS = new Set(["dashboard","aides","certificats","paiements","adherents"]);
  const $ = id => document.getElementById(id);
  const access = $("admin-club-access");
  const password = $("admin-club-code");
  const passwordButton = $("admin-club-unlock");
  const faceButton = $("admin-faceid-login");
  const signOut = $("admin-faceid-logout");
  const status = $("admin-club-access-status");
  let active = false, working = false;
  // Force a fresh Face ID verification each time the preview page opens.
  sessionStorage.removeItem(SESSION);

  const bytes = value => {
    const v = String(value).replace(/-/g,"+").replace(/_/g,"/");
    return Uint8Array.from(atob(v+"=".repeat((4-v.length%4)%4)), c=>c.charCodeAt(0));
  };
  const b64 = ab => {
    const b=new Uint8Array(ab);let t="";
    for(let i=0;i<b.length;i+=8192)t+=String.fromCharCode(...b.subarray(i,i+8192));
    return btoa(t).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  };
  const serialize = credential => {
    // Ne pas utiliser toJSON() : il pourrait inclure le secret WebAuthn
    // PRF dans clientExtensionResults, qui doit rester sur l'iPhone.
    return {
      id:credential.id,rawId:b64(credential.rawId),type:credential.type,
      authenticatorAttachment:credential.authenticatorAttachment,
      clientExtensionResults:{},
      response:{
        authenticatorData:b64(credential.response.authenticatorData),
        clientDataJSON:b64(credential.response.clientDataJSON),
        signature:b64(credential.response.signature),
        userHandle:credential.response.userHandle?b64(credential.response.userHandle):null
      }
    };
  };
  async function request(method,path,body,token) {
    const headers={"Content-Type":"application/json"};
    if(token)headers.Authorization="Bearer "+token;
    const resp=await fetch(API+path,{
      method,headers,cache:"no-store",
      ...(method==="POST"?{body:JSON.stringify(body||{})}:{})
    });
    const result=await resp.json().catch(()=>({}));
    if(!resp.ok||!result.ok) {
      const messages={not_registered:"La clé Face ID n'a pas été enregistrée.",
        challenge_expired:"Le délai Face ID a expiré. Réessaie.",
        verification_failed:"La signature de Face ID n'a pas été acceptée.",
        credential_not_registered:"Clé d'accès non reconnue.",
        incorrect_admin_password:"Mot de passe incorrect."};
      throw Error(messages[result.error]||"Erreur Cloudflare ("+resp.status+").");
    }
    return result;
  }
  function setStatus(value,error=false) {
    if(!status)return;
    status.textContent=value;
    status.classList.toggle("is-error",error);
    status.classList.toggle("is-success",!error);
  }
  function protectedControls(enabled) {
    document.querySelectorAll("[data-admin-protected]").forEach(el=>{el.disabled=!enabled;});
  }
  function setView(next,hash=true) {
    const view=VIEWS.has(next)?next:"dashboard";
    if(!active && view!=="dashboard") {
      faceButton?.focus();return;
    }
    for(const key of VIEWS) {
      const section=$("admin-club-"+key);
      if(section)section.hidden=key!==view;
    }
    document.querySelectorAll(".admin-club-tab").forEach(b=>{
      const on=b.dataset.adminView===view;
      b.classList.toggle("is-active",on);
      b.setAttribute("aria-current",on?"page":"false");
    });
    if(hash)history.replaceState(null,"",location.pathname+location.search+(view==="dashboard"?"":"#"+view));
    scrollTo({top:0,behavior:"smooth"});
  }
  function markUnlocked(source,token) {
    active=true;
    document.body.classList.add("admin-club-unlocked");
    protectedControls(true);
    password.value="";
    password.disabled=true;
    passwordButton.hidden=true;
    faceButton.hidden=true;
    signOut.hidden=false;
    access?.classList.add("is-unlocked");
    $("admin-token").value=token;
    sessionStorage.setItem(SESSION,token);
    // Certificate script handles its own secure API session check.
    $("admin-login-button")?.click();
    if(source==="faceid") {
      setStatus("Face ID activé. Certificats, échéances et listing accessibles en lecture. Les aides demandent encore leur code personnel.");
    }else{
      setStatus("Accès test débloqué. Les aides s'ouvrent aussi avec ton code habituel.");
    }
  }
  async function signInFaceId() {
    if(working)return;
    working=true;
    faceButton.disabled=true;
    passwordButton.disabled=true;
    setStatus("Authentification Face ID en cours…");
    try {
      if(!window.PublicKeyCredential||!navigator.credentials?.get) {
        throw Error("Ton navigateur ne prend pas en charge Face ID. Essaie Safari.");
      }
      const {options,requestId}=await request("POST","/passkey-preview/login/options",{});
      // Sel PRF stable, propre au chiffrement de la clé d'aides MMA.
      // Un résultat PRF absent n'empêche jamais l'accès aux autres modules.
      const salt=new Uint8Array(await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("MMA-Le-Rove|aides|FaceID|PRF|v1")
      ));
      const pub={
        ...options,challenge:bytes(options.challenge),
        allowCredentials:(options.allowCredentials||[]).map(x=>({...x,id:bytes(x.id)})),
        extensions:{...(options.extensions||{}),prf:{eval:{first:salt}}}
      };
      const credential=await navigator.credentials.get({publicKey:pub});
      if(!credential)throw Error("Connexion Face ID annulée.");
      const result=await request("POST","/passkey-preview/login/verify",{requestId,credential:serialize(credential)});
      if(!result.verified||!result.token)throw Error("Face ID n'a pas produit de session valide.");
      // Vérifier le jeton sur une vraie route Admin, jamais sur un indicateur local.
      await request("GET","/admin/mail/status",null,result.token);
      markUnlocked("faceid",result.token);
      const prf=credential.getClientExtensionResults?.()?.prf?.results?.first || null;
      try {
        if (!window.MMAAidesBridge) {
          if (prf && prf.byteLength === 32) {
            setStatus("✅ Face ID fonctionne. ✅ Ton iPhone fournit également la fonction de chiffrement PRF : la passerelle locale des aides est techniquement possible. Elle n'est pas encore activée.");
            // Effacer le secret de vérification du tampon accessible au JS.
            new Uint8Array(prf).fill(0);
          } else {
            setStatus("✅ Face ID fonctionne. La clé d'accès actuelle ne fournit pas encore le chiffrement PRF. Un réenregistrement compatible pourrait être nécessaire pour les aides.");
          }
        } else {
          const bridge=await window.MMAAidesBridge.onVerifiedPRF(prf);
          if(bridge?.ready) {
            setStatus("✅ Face ID : les quatre modules sont déverrouillés, y compris les aides chiffrées.");
          }else if(bridge?.available) {
            setStatus("Face ID fonctionne. Pour les aides, une activation locale avec le code habituel reste nécessaire.");
          }else{
            setStatus("Face ID fonctionne pour les modules Cloudflare. Cette clé d'accès ne fournit pas le chiffrement PRF requis pour les aides.");
          }
        }
      }catch{
        setStatus("Face ID fonctionne pour les modules Cloudflare. Les aides conservent leur accès par code habituel.");
      }
    }catch(e) {
      setStatus(e.name==="NotAllowedError"?"Face ID annulé sur l'iPhone.":(e.message||"Échec Face ID."),true);
    }finally{
      working=false;faceButton.disabled=false;passwordButton.disabled=false;
    }
  }
  async function checkAidesUnlock(timeout=12000) {
    const start=Date.now();
    while(Date.now()-start<timeout) {
      const text=$("admin-message")?.textContent||"";
      if(/demande\(s\) chargée\(s\)\./i.test(text))return true;
      if(/code personnel incorrect/i.test(text))return false;
      await new Promise(r=>setTimeout(r,150));
    }
    return false;
  }
  async function signInPassword() {
    if(working)return;
    const value=password.value.trim();
    if(!value) {setStatus("Saisis ton mot de passe Admin.",true);return;}
    working=true;passwordButton.disabled=true;faceButton.disabled=true;
    setStatus("Vérification du code administrateur…");
    try {
      const aidsInput=$("admin-code");
      const aidsButton=$("unlock-admin");
      if(aidsInput)aidsInput.value=value;
      aidsButton?.click();
      await request("GET","/admin/mail/status",null,value);
      if(!await checkAidesUnlock())throw Error("Impossible de déverrouiller les aides avec ce code.");
      markUnlocked("password",value);
    }catch(e) {setStatus(e.message||"Mot de passe incorrect.",true);}
    finally {working=false;passwordButton.disabled=false;faceButton.disabled=false;}
  }
  async function logout() {
    const token=sessionStorage.getItem(SESSION);
    if(token?.startsWith("mma-fid1.")) {
      await fetch(API+"/passkey-preview/logout",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
        body:"{}",cache:"no-store"
      }).catch(()=>{});
    }
    sessionStorage.removeItem(SESSION);
    location.replace(location.pathname+"?fresh="+Date.now());
  }

  document.addEventListener("DOMContentLoaded",()=>{
    protectedControls(false);
    document.querySelectorAll("[data-admin-view]").forEach(btn=>{
      btn.addEventListener("click",()=>setView(btn.dataset.adminView));
    });
    faceButton?.addEventListener("click",signInFaceId);
    passwordButton?.addEventListener("click",signInPassword);
    password?.addEventListener("keydown",e=>{if(e.key==="Enter")signInPassword();});
    signOut?.addEventListener("click",logout);
    setView("dashboard",false);
  });
  addEventListener("hashchange",()=>{
    setView((location.hash||"").slice(1),false);
  });
})();
