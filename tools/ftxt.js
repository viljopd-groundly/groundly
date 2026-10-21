const MON={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
function parse(txt){const lines=txt.split(/\r?\n/);let year=null,lastMon=null,date=null,round="",time="";const out=[];
  const hm=txt.match(/# Date\s+\w{3} (\w{3}) \d+(?: (\d{4}))?/);const hy=txt.match(/\b(\d{4})\b/);year=hm&&hm[2]?+hm[2]:(hy?+hy[1]:null);
  if(hm&&!hm[2]){const y2=txt.match(/# Date[^\n]*?(\d{4})/);if(y2)year=+y2[1];} // "Fri Mar 28 - Sun Nov 9 2025"
  for(let raw of lines){const L=raw.replace(/\s+$/,"");const t=L.trim();if(!t||t.startsWith("#")||t.startsWith("=")||t.startsWith("(")||/^\d+-\d+\s/.test(t))continue;
    if(t.startsWith("▪")){round=t.replace(/^▪\s*/,"");continue;}
    let m=t.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?$/);
    if(m){const mo=MON[m[2]];if(m[4])year=+m[4];else if(lastMon!==null){const df=mo-lastMon;if(df<-5)year++;else if(df>6)year--;}lastMon=mo;date=`${year}-${String(mo+1).padStart(2,"0")}-${String(+m[3]).padStart(2,"0")}`;time="";continue;}
    if(!date)continue;let rest=t;const tm=rest.match(/^(\d{1,2})[:.](\d{2})\s+(.*)$/);if(tm){time=`${tm[1].padStart(2,"0")}:${tm[2]}`;rest=tm[3];}
    rest=rest.replace(/\s+@\s+.*$/,"");const parts=rest.split(/\s{2,}/);let t1,t2,sc="";
    if(parts.length>=2&&/^v\s/.test(parts[1])){t1=parts[0];t2=parts[1].replace(/^v\s+/,"");sc=parts.slice(2).join(" ");}
    else if(parts.length>=3&&/^\d+-\d+/.test(parts[1])){t1=parts[0];sc=parts[1];t2=parts.slice(2).join(" ");}
    else if(parts.length===2&&/\sv\s/.test(parts[0])){const q=parts[0].split(/\s+v\s+/);t1=q[0];t2=q[1];sc=parts[1];}
    else continue;
    let ft=null,pen="";const pm=sc.match(/(\d+)-(\d+)\s+pen\./);if(pm)pen=`${pm[1]}-${pm[2]}`;const am=sc.match(/(\d+)-(\d+)\s+a\.e\.t\./);
    if(am)ft=[+am[1],+am[2]];else if(pm){const pr=sc.match(/\((\d+)-(\d+)/);if(pr)ft=[+pr[1],+pr[2]];}else{const f=sc.match(/^(\d+)-(\d+)/);if(f)ft=[+f[1],+f[2]];}
    if(/abd|awd|canc|postp/i.test(sc)&&!ft)continue;
    const cl=x=>x.replace(/\s*\[[^\]]*\]\s*/g," ").trim();out.push({date,time,round,t1:cl(t1),t2:cl(t2),ft,pen});}
  return out;}

module.exports={parse};
