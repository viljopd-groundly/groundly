const K="fake-fs";const load=()=>{try{return JSON.parse(localStorage.getItem(K))||{}}catch(e){return{}}};let D=load();
const save=()=>localStorage.setItem(K,JSON.stringify(D));const subs=new Set();
const uid=()=>{try{return(JSON.parse(localStorage.getItem("fake-auth"))||{}).uid}catch(e){return null}};
const deny=()=>{const e=new Error("denied");e.code="permission-denied";return e};
const canWrite=p=>{const s=p.split("/");if(s[0]==="usage")return /^\d{4}-\d\d-\d\d$/.test(s[1]);const u=uid();if(!u)return false;if(s[0]==="users")return s[1]===u;if(["mod","matches","meta","config"].includes(s[0]))return (D["config/admins"]?.uids||[]).includes(u);return s[1]===u;};
export const initializeFirestore=()=>({});export const getFirestore=()=>({});
export const doc=(fs,...p)=>{const path=p.join("/");return{path,id:path.split("/").pop(),k:"doc"}};
export const collection=(fs,...p)=>({path:p.join("/"),k:"col"});
const dsnap=r=>({id:r.id,exists:()=>r.path in D,data:()=>D[r.path]&&JSON.parse(JSON.stringify(D[r.path]))});
const csnap=r=>{const ds=Object.keys(D).filter(k=>k.startsWith(r.path+"/")&&k.split("/").length===r.path.split("/").length+1&&(!r.filt||r.filt(D[k]))).map(k=>({id:k.split("/").pop(),data:()=>JSON.parse(JSON.stringify(D[k]))}));return{size:ds.length,empty:!ds.length,docs:ds}};
const fire=p=>subs.forEach(s=>{if(!p||s.p===p||p.startsWith(s.p+"/"))s();});
export const getDoc=async r=>dsnap(r);export const getDocs=async r=>csnap(r);
export const setDoc=async(r,d,o)=>{if(!canWrite(r.path))throw deny();if(r.path.startsWith("usage/"))D=load();if(Object.values(d||{}).some(v=>v&&v.__inc)){const cur=D[r.path]||{};for(const[k,v]of Object.entries(d))cur[k]=v&&v.__inc?(cur[k]||0)+v.__inc:v;D[r.path]=cur;save();fire(r.path);return;}D[r.path]=fixSt(o&&o.merge?{...(D[r.path]||{}),...JSON.parse(JSON.stringify(d))}:JSON.parse(JSON.stringify(d)));save();fire(r.path)};
export const updateDoc=async(r,d)=>{if(!canWrite(r.path))throw deny();D[r.path]=fixSt({...(D[r.path]||{}),...JSON.parse(JSON.stringify(d))});save();fire(r.path)};
export const deleteDoc=async r=>{if(!canWrite(r.path))throw deny();delete D[r.path];save();fire(r.path)};
export const onSnapshot=(r,next,err)=>{if(r.path.startsWith("users/")&&r.path.split("/")[1]!==uid()){setTimeout(()=>err&&err(deny()),0);return()=>{}}
  const f=()=>next(r.k==="doc"?dsnap(r):csnap(r));f.p=r.path;subs.add(f);setTimeout(f,0);return()=>subs.delete(f)};

const fixSt=d=>{if(d&&d._u&&d._u.__st)d._u={__ts:Date.now()};return d};
export const serverTimestamp=()=>({__st:1});
export class Timestamp{constructor(ms){this.ms=ms}static fromMillis(ms){return new Timestamp(ms)}toMillis(){return this.ms}}
export const where=(f,op,v)=>d=>d&&d[f]&&d[f].__ts>v.ms;
export const query=(r,filt)=>({...r,filt});
window.__fsReads=0;

export const increment=n=>({__inc:n});
