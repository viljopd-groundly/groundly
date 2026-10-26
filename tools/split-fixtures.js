// Delar data/fixtures.json i två filer så att appen startar snabbare:
//   fixtures-next.json – matcher från tre dagar bakåt till 45 dagar framåt (laddas direkt)
//   fixtures-past.json – övriga: äldre resultat och matcher längre fram (laddas när appen är igång)
// fixtures.json ligger kvar orörd för äldre versioner av appen.
const fs=require("fs"),path=require("path");
function splitFixtures(out){const f=path.join(out,"data","fixtures.json");const j=JSON.parse(fs.readFileSync(f,"utf8"));
  const day=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);const cut=day(-3),end=day(45);const next=[],past=[];
  for(const r of j.rows){const d=r[3]||String(r[2]||"").slice(0,10);(d>=cut&&d<=end?next:past).push(r);}
  const meta={updated:j.updated,season:j.season,source:j.source};
  fs.writeFileSync(path.join(out,"data","fixtures-next.json"),JSON.stringify({...meta,cut,end,rows:next}));
  fs.writeFileSync(path.join(out,"data","fixtures-past.json"),JSON.stringify({...meta,cut,end,rows:past}));
  return{next:next.length,past:past.length};}
module.exports={splitFixtures};
if(require.main===module)console.log(splitFixtures(process.argv[2]||path.join(__dirname,"..","site")));
