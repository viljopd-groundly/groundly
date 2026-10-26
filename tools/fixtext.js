// Rättar namn som kommit dubbelkodade från API:t, t.ex. "L. Ã\x96stman" -> "L. Östman".
// Bara byte-par/tripplar som är giltig UTF-8 byts, så riktiga tecken som "ð" och "ó" lämnas orörda.
const RE=/[\xC2-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}/g;
function fixMoji(s){if(typeof s!=="string"||!/[\xC2-\xEF][\x80-\xBF]/.test(s))return s;
  return s.replace(RE,m=>{const t=Buffer.from(m,"latin1").toString("utf8");return t.includes("�")||t.length!==1?m:t;});}
const fixReplacer=(k,v)=>typeof v==="string"?fixMoji(v):v;
module.exports={fixMoji,fixReplacer};
if(require.main===module){const fs=require("fs"),path=require("path");const dir=process.argv[2]||path.join(__dirname,"..","site","data");
  for(const f of ["players.json","squads.json","events.json","standings.json","fixtures.json","fixtures-next.json","fixtures-past.json"]){const p=path.join(dir,f);if(!fs.existsSync(p))continue;
    const raw=fs.readFileSync(p,"utf8");const out=JSON.stringify(JSON.parse(raw),fixReplacer);if(out!==JSON.stringify(JSON.parse(raw)))fs.writeFileSync(p,out),console.log("rättade",f);}}
