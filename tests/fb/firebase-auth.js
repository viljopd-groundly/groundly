const K="fake-auth";let cbs=[];const cur=()=>{try{return JSON.parse(localStorage.getItem(K))}catch(e){return null}};
const mk=u=>u&&({...u,getIdToken:async()=>"t",metadata:{lastSignInTime:new Date().toUTCString()},providerData:[{providerId:"google.com"}]});
export const getAuth=()=>({get currentUser(){return mk(cur())}});export const onAuthStateChanged=(a,cb)=>{cbs.push(cb);setTimeout(()=>cb(mk(cur())),0);return()=>{cbs=cbs.filter(x=>x!==cb)}};
const setU=u=>{localStorage.setItem(K,JSON.stringify(u));cbs.forEach(c=>c(mk(u)))};
export class GoogleAuthProvider{};export const getRedirectResult=async()=>null;
export const signInWithPopup=async()=>{setU({uid:"uidGOOGLE123",displayName:"Viljo Test",email:"v@example.com"});return{user:mk(cur())}};
export const signInWithRedirect=signInWithPopup;
export const createUserWithEmailAndPassword=async(a,m,p)=>{setU({uid:"uidMAIL456",displayName:"",email:m});return{user:mk(cur())}};
export const signInWithEmailAndPassword=async(a,m,p)=>{if(p!=="hemligt1"){const e=new Error("x");e.code="auth/invalid-credential";throw e;}setU({uid:"uidMAIL456",email:m});};
export const updateProfile=async()=>{};export const sendEmailVerification=async()=>{};export const sendPasswordResetEmail=async()=>{};
export const signOut=async()=>{localStorage.removeItem(K);cbs.forEach(c=>c(null))};
export const deleteUser=async u=>{localStorage.removeItem(K);window.__deleted=true;cbs.forEach(c=>c(null))};
export const reauthenticateWithPopup=async()=>{};export const reauthenticateWithCredential=async()=>{};export class EmailAuthProvider{static credential(){return{}}}
