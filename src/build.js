const fs=require("fs");
const clubs=require("./clubs.js");const {m,s}=require("./fixtures.js");
const C={};for(const r of clubs){if(C[r[0]])throw new Error("dup "+r[0]);C[r[0]]=r;}
const slug=x=>x.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/gi,"");
const doc=(h,a,comp,tier,ko,from,to)=>{const H=C[h],A=C[a];if(!H||!A)throw new Error("missing "+h+" "+a);
  const d=(ko||from).slice(0,10);
  return {id:`${d}-${slug(h)}-${slug(a)}`,data:{home:h,away:a,homeName:H[1],awayName:A[1],comp,tier,country:H[3],city:H[4],venue:H[8]||null,kickoff:ko||null,dateFrom:from||null,dateTo:to||null}};};
const docs=[...m.map(r=>doc(r[0],r[1],r[2],r[3],r[4])),...s.map(r=>doc(r[0],r[1],"Superettan","2",null,r[2],r[3]))];
const ids=new Set();docs.forEach(d=>{if(ids.has(d.id))throw new Error("dupid "+d.id);ids.add(d.id);});
const ops=docs.map(d=>({op:"set",collection:"matches",doc_id:d.id,data:d.data}));
ops.push({op:"set",collection:"meta",doc_id:"info",data:{updated:new Date().toISOString(),count:docs.length}});
fs.writeFileSync("seed.json",JSON.stringify(ops));
const html=fs.readFileSync("template.html","utf8").replace("/*CLUBS*/[]",JSON.stringify(clubs)).replace("/*GEO*/{}",JSON.stringify(require("./geo.js"))).replace("/*TIPS*/{derbies:[],cult:[]}",JSON.stringify(require("./tips.js"))).replace("/*MAPS*/{}",JSON.stringify(Object.fromEntries(Object.entries(require("./maps.js")).map(([k,v])=>[k,{lon0:v.lon0,lon1:v.lon1,lat0:v.lat0,lat1:v.lat1,w:v.w,h:v.h,pts:v.pts}])))).replace("/*PUBSEED*/[]",JSON.stringify(require("./pubseed.js"))).replace("/*COLORS*/{}",JSON.stringify(require("./colors.js"))).replace("/*CUPS*/[]",JSON.stringify(require("./cups.js"))).replace("/*SEASONS*/{}",JSON.stringify(require("./seasons.js"))).replace("/*WEB*/{}",JSON.stringify(require("./web.js")));
fs.writeFileSync("fotbollskartan.html",html);
fs.mkdirSync("data",{recursive:true});fs.writeFileSync("data/flags.json",JSON.stringify(require("./flags.js")));fs.writeFileSync("data/maps.json",JSON.stringify(Object.fromEntries(Object.entries(require("./maps.js")).map(([k,v])=>[k,{path:v.path,path2:v.path2||null}]))));fs.writeFileSync("data/fixtures.json",JSON.stringify({updated:new Date().toISOString(),source:"openfootball (CC0)",rows:JSON.parse(fs.readFileSync("fx27.json","utf8"))}));
console.log(clubs.length,"clubs",docs.length,"matches",html.length,"bytes");
// syntax check of page script
const js=html.split("<script>")[1].split("</script>")[0];new Function(js);console.log("script ok");
