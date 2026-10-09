import test from "node:test";
import assert from "node:assert/strict";
import { handlePasskeyPreview } from "../src/passkeyPreview.js";
import { issuePasskeySession, verifyPasskeySession, revokePasskeySession } from "../src/passkeySession.js";

class MemoryR2 {
  constructor(){ this.files = new Map(); }
  async get(key){ const v=this.files.get(key); return v ? {json: async()=>JSON.parse(v)} : null; }
  async put(key,value){this.files.set(key,String(value));}
  async delete(key){this.files.delete(key);}
}
const env = () => ({ ADMIN_API_TOKEN: "test-secret", CERTIFICATES: new MemoryR2() });
function call(path, body, e, {origin="https://www.mma-lerove.fr", bearer=""}={}){
  const headers = {"Origin":origin,"Content-Type":"application/json"};
  if(bearer)headers.Authorization="Bearer "+bearer;
  const req = new Request("https://worker.example/passkey-preview/"+path, {
    method:"POST",headers,body:JSON.stringify(body||{})
  });
  return handlePasskeyPreview(req,e,(data,status=200)=>({data,status}));
}
test("enrollment must not proceed without real administrator password", async()=>{
  const e=env();
  const result=await call("register/options",{},e);
  assert.equal(result.status,401);
  assert.equal(e.CERTIFICATES.files.size,0);
});
test("cross-origin registration is refused even with password",async()=>{
  const e=env();
  const result=await call("register/options",{},e,{origin:"https://evil.example",bearer:"test-secret"});
  assert.equal(result.status,403);
  assert.equal(e.CERTIFICATES.files.size,0);
});
test("registration challenge uses relying-party domain and requires user verification",async()=>{
  const e=env();
  const r=await call("register/options",{},e,{bearer:"test-secret"});
  assert.equal(r.status,200);
  assert.equal(r.data.options.rp.id,"mma-lerove.fr");
  assert.equal(r.data.options.authenticatorSelection.userVerification,"required");
  assert.equal(r.data.options.authenticatorSelection.residentKey,"required");
  assert.ok(r.data.requestId);
  assert.ok(r.data.options.challenge);
  assert.equal(e.CERTIFICATES.files.size,1);
});
test("login cannot bypass enrollment and never reveals an admin token",async()=>{
  const e=env();
  const r=await call("login/options",{},e);
  assert.equal(r.status,404);
  const invalid=await call("login/verify",{requestId:"bad",credential:{}},e);
  assert.equal(invalid.status,400);
  assert.equal(invalid.data.adminToken,undefined);
});
test("attestation without valid one-time challenge is rejected",async()=>{
  const e=env();
  const r=await call("register/verify",{requestId:"d4d73c2e-3544-4527-9ea3-2a440b21c331",credential:{}},e,{bearer:"test-secret"});
  assert.equal(r.status,400);
});


test("a correctly issued passkey session grants access without revealing admin password", async() => {
  const e = env();
  const sess = await issuePasskeySession(e);
  assert.match(sess.token, /^mma-fid1\.[A-Za-z0-9_-]{43}$/);
  assert.ok(sess.expiresIn <= 1200);
  assert.ok(!sess.token.includes(e.ADMIN_API_TOKEN));
  const req = new Request("https://worker.example/admin/mail/status", {
    headers: { Authorization: "Bearer " + sess.token }
  });
  assert.equal(await verifyPasskeySession(req, e), true);
  assert.equal(await verifyPasskeySession(new Request(req.url), e), false);
  assert.equal(await verifyPasskeySession(new Request(req.url, {headers: {Authorization:"Bearer test-secret"}}), e), false);
  await revokePasskeySession(req, e);
  assert.equal(await verifyPasskeySession(req, e), false);
});

test("expired sessions fail closed", async () => {
  const e = env();
  const sess = await issuePasskeySession(e);
  const key = [...e.CERTIFICATES.files.keys()][0];
  const record = JSON.parse(e.CERTIFICATES.files.get(key));
  record.expiresAt = Date.now() - 1000;
  e.CERTIFICATES.files.set(key, JSON.stringify(record));
  const request = new Request("https://worker.example/admin/mail/status", {
    headers: {Authorization: "Bearer " + sess.token}
  });
  assert.equal(await verifyPasskeySession(request,e),false);
});

test("admin middleware protects routes with passkey session, while original password access remains", async () => {
  const {readFileSync} = await import("node:fs");
  const worker = readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
  assert.match(worker,/await isAdmin\(request, env\)/);
  assert.match(worker,/verifyPasskeySession\(request, env\)/);
  assert.match(worker,/request\.headers\.get\("Authorization"\) ===/);
});
