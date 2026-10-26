import "reflect-metadata";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import request from "supertest";
import { createApplication } from "../../src/app";
import type { GoogleFetch } from "../../src/auth/google.service";

const ORIGIN="http://127.0.0.1:3300";
const PREFIX="google-auth-";
const { privateKey, publicKey }=generateKeyPairSync("rsa",{modulusLength:2048});
const key={...publicKey.export({format:"jwk"}),kid:"local-test",alg:"RS256",use:"sig"};

describe("Google OAuth HTTP com emissor simulado",()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:3});
 let app:INestApplication;
 let nonce="";
 let subject="";
 let email="";
 let now=Date.now();
 const states:string[]=[];
 let tokenCalls=0;
 let claimsOverride:Record<string,unknown>={};
 const fakeFetch:GoogleFetch=async(input,init)=>{
  if(input==="https://www.googleapis.com/oauth2/v3/certs") return Response.json({keys:[key]});
  if(input!=="https://oauth2.googleapis.com/token") throw new Error("endpoint inesperado");
  tokenCalls++;
  expect(init?.body).toBeInstanceOf(URLSearchParams);
  const form=init?.body as URLSearchParams;
  expect(form.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(form.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/google/callback`);
  const time=Math.floor(Date.now()/1000);
  const header=Buffer.from(JSON.stringify({alg:"RS256",kid:"local-test"})).toString("base64url");
  const payload=Buffer.from(JSON.stringify({iss:"https://accounts.google.com",aud:"local-client",sub:subject,email,email_verified:true,name:"Ana Google",nonce,iat:time,exp:time+600,...claimsOverride})).toString("base64url");
  const signed=`${header}.${payload}`;
  return Response.json({id_token:`${signed}.${sign("RSA-SHA256",Buffer.from(signed),privateKey).toString("base64url")}`});
 };
 beforeAll(async()=>{
  if(!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL necessária");
  const url=new URL(process.env.TEST_DATABASE_URL);
  if(url.port!=="5463"||!["127.0.0.1","localhost"].includes(url.hostname)) throw new Error("Somente local5463");
  app=await createApplication({connectionString:process.env.TEST_DATABASE_URL,logger:false,auditKey:null,now:()=>now,googleConfig:{clientId:"local-client",clientSecret:"local-test-only",redirectUri:`${ORIGIN}/api/auth/google/callback`},googleFetch:fakeFetch});
  await app.init();
 });
 beforeEach(()=>{now+=120000;subject=randomUUID();email=`${PREFIX}${randomUUID()}@example.com`;claimsOverride={};tokenCalls=0;});
 afterAll(async()=>{
  await pool.query(`DELETE FROM oauth_states WHERE state_hash=ANY($1::text[])`,[states]);
  await pool.query(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,[`${PREFIX}%`]);
  await pool.query(`DELETE FROM users WHERE email LIKE $1`,[`${PREFIX}%`]);
  await app?.close();await pool.end();
 });
 async function begin(agent:ReturnType<typeof request.agent>){
  const csrf=(await agent.get("/api/auth/csrf")).body.csrfToken as string;
  const started=await agent.post("/api/auth/google/start").set("Origin",ORIGIN).set("X-CSRF-Token",csrf).send({});
  expect(started.status).toBe(201);
  const url=new URL(started.body.url as string);
  expect(url.origin).toBe("https://accounts.google.com");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("client_secret")).toBeNull();
  nonce=url.searchParams.get("nonce")??"";
  const state=url.searchParams.get("state")??"";
  states.push(createHash("sha256").update(state).digest("hex"));
  const raw=started.headers["set-cookie"];
  const cookies=Array.isArray(raw)?raw:[raw];
  return {state,cookie:cookies.find((c:string)=>c.startsWith("google="))?.split(";")[0]??""};
 }
 async function register(agent:ReturnType<typeof request.agent>){
  const csrf=(await agent.get("/api/auth/csrf")).body.csrfToken as string;
  const created=await agent.post("/api/auth/register").set("Origin",ORIGIN).set("X-CSRF-Token",csrf).send({name:"Ana local",email,password:"cadastro-seguro-2026",termsAccepted:true});
  expect(created.status).toBe(201);
 }
 it("cria conta BIDDER por subject, cookie e callback; não aceita dummy password; login futuro mantém identidade",async()=>{
  const agent=request.agent(app.getHttpServer());
  expect((await agent.get("/api/auth/google/status")).body).toEqual({available:true});
  const {state}=await begin(agent);
  const done=await agent.get("/api/auth/google/callback").query({state,code:"ok"});
  expect(done.status).toBe(303);expect(done.headers.location).toBe("/");
  const me=(await agent.get("/api/auth/me")).body;
  expect(me).toMatchObject({role:"BIDDER",name:"Ana Google",userId:expect.any(String)});
  const row=(await pool.query(`SELECT password_hash,google_subject FROM users WHERE id=$1`,[me.userId])).rows[0];
  expect(row.password_hash).toBeNull();expect(row.google_subject).toBe(subject);
  const csrf=(await agent.get("/api/auth/csrf")).body.csrfToken as string;
  expect((await agent.post("/api/auth/login").set("Origin",ORIGIN).set("X-CSRF-Token",csrf).send({email,password:"placeholder-not-a-user-password"})).status).toBe(401);
  const second=request.agent(app.getHttpServer());
  const later=await begin(second);
  expect((await second.get("/api/auth/google/callback").query({state:later.state,code:"ok"})).headers.location).toBe("/");
  expect((await second.get("/api/auth/me")).body.userId).toBe(me.userId);
 });
 it("state é do navegador, expira e só pode ser consumido uma vez; cancelamento é genérico",async()=>{
  const agent=request.agent(app.getHttpServer());
  const flow=await begin(agent);
  expect((await request(app.getHttpServer()).get("/api/auth/google/callback").query({state:flow.state,code:"ok"})).headers.location).toBe("/entrar?google=erro");
  expect(tokenCalls).toBe(0);
  await pool.query(`UPDATE oauth_states SET expires_at=statement_timestamp()-interval '1 second' WHERE state_hash=$1`,[states.at(-1)]);
  expect((await agent.get("/api/auth/google/callback").query({state:flow.state,code:"ok"})).headers.location).toBe("/entrar?google=erro");
  const cancelled=await begin(agent);
  expect((await agent.get("/api/auth/google/callback").query({state:cancelled.state,error:"access_denied"})).headers.location).toBe("/entrar?google=erro");
  const valid=await begin(agent);
  expect((await agent.get("/api/auth/google/callback").query({state:valid.state,code:"ok"})).headers.location).toBe("/");
  expect((await request(app.getHttpServer()).get("/api/auth/google/callback").set("Cookie",valid.cookie).query({state:valid.state,code:"ok"})).headers.location).toBe("/entrar?google=erro");
  expect(tokenCalls).toBe(1);
 });
 it("não vincula email local sem sessão; vincula só na mesma sessão iniciadora",async()=>{
  const local=request.agent(app.getHttpServer());await register(local);
  const before=(await local.get("/api/auth/me")).body;
  const anonymous=request.agent(app.getHttpServer());const blocked=await begin(anonymous);
  expect((await anonymous.get("/api/auth/google/callback").query({state:blocked.state,code:"ok"})).headers.location).toBe("/entrar?google=erro");
  expect((await anonymous.get("/api/auth/me")).status).toBe(401);
  const linking=await begin(local);
  expect((await local.get("/api/auth/google/callback").query({state:linking.state,code:"ok"})).headers.location).toBe("/perfil");
  expect((await local.get("/api/auth/me")).body.userId).toBe(before.userId);
  const stored=(await pool.query(`SELECT google_subject,password_hash FROM users WHERE id=$1`,[before.userId])).rows[0];
  expect(stored.google_subject).toBe(subject);expect(stored.password_hash).toMatch(/^\$argon2id\$/);
 });
 it("rejeita state errado, claims erradas e logout durante vínculo",async()=>{
  const agent=request.agent(app.getHttpServer());await register(agent);
  const flow=await begin(agent);
  const csrf=(await agent.get("/api/auth/csrf")).body.csrfToken as string;
  expect((await agent.post("/api/auth/logout").set("Origin",ORIGIN).set("X-CSRF-Token",csrf)).status).toBe(204);
  expect((await agent.get("/api/auth/google/callback").query({state:flow.state,code:"ok"})).headers.location).toBe("/entrar?google=erro");
  expect(tokenCalls).toBe(0);
  const invalid=await begin(agent);claimsOverride={nonce:"wrong"};
  expect((await agent.get("/api/auth/google/callback").query({state:invalid.state,code:"ok"})).headers.location).toBe("/entrar?google=erro");
  const wrong=await begin(agent);
  expect((await agent.get("/api/auth/google/callback").query({state:"x".repeat(43),code:"ok"})).headers.location).toBe("/entrar?google=erro");
  expect(wrong.state.length).toBe(43);
  expect((await agent.get("/api/auth/me")).status).toBe(401);
 });
 it("sem configuração desabilita Google e start exige CSRF",async()=>{
  expect((await request(app.getHttpServer()).post("/api/auth/google/start").send({})).status).toBe(403);
  const off=await createApplication({connectionString:process.env.TEST_DATABASE_URL,logger:false,auditKey:null,googleConfig:null});
  try {await off.init();expect((await request(off.getHttpServer()).get("/api/auth/google/status")).body).toEqual({available:false});}
  finally {await off.close();}
 });
});
