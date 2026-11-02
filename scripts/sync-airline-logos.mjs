#!/usr/bin/env node
/**
 * Fetch real airline logo images for local PDF/website use.
 * npm run logos:sync                     -> priority airline codes
 * npm run logos:sync -- --codes SQ,QR,BG -> selected IATA codes
 * npm run logos:sync -- --all            -> every logo in upstream GitHub collection (best effort)
 * This program does not grant permission to redistribute airline trademarks.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve(import.meta.dirname,'..');
const DEST=path.join(ROOT,'assets','airlines');
const args=process.argv.slice(2);
const arg=(s)=>{const ix=args.indexOf(s);return ix===-1?'':args[ix+1]||''};
const DEFAULT=`BG BS EK QR SQ TK G9 TG MH EY AI CX LH BA WY SV GF KU FZ EK 6E 9W UL OD GA PK BI WY PR JL NH KE CZ MU CA CX BR CI OZ HX QF NZ VA TR UA AA DL AC AF KL LX OS SK AY IB TP AZ BA VS U2 FR W6 VY LO RO A3 TK MS ET KQ WB RQ IX 6E 4Y HY HM PD WS B6 AS HA NK F9 Y4 WN G4 UO FD DD FD VN VJ JT AK QZ D7 D8 JQ SG UK VU VY ZH MF GS 3U 8L HU SC JD FM HO 9C 7C TN TS CA PC XQ LY RJ AT AH ME TU BJ J9 W5 7G 2Z`;
const codeRe=/^[A-Z0-9]{2,3}$/;
const unique=(a)=>[...new Set(a.filter(x=>codeRe.test(x)))];
let codes=unique(DEFAULT.split(/\s+/));
const custom=arg('--codes');
if(custom)codes=unique(custom.toUpperCase().split(/[,;\s]+/));
async function fetchLimited(url,ms=9000){
 const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),ms);
 try{return await fetch(url,{headers:{'User-Agent':'ExploreFlightsLogoSync/1.0','Accept':'image/png,image/jpeg,application/json'},signal:ctrl.signal});}finally{clearTimeout(t)}
}
if(args.includes('--all')){
  try{
    const response=await fetchLimited('https://api.github.com/repos/spydogenesis/airlines-logo/git/trees/main?recursive=1',15000);
    if(!response.ok)throw new Error('GitHub API '+response.status);
    const j=await response.json();
    const paths=(j.tree||[]).map(f=>f.path||'');
    const all=paths.map(p=>p.match(/^airlines-logo\/200x200_v2\/([A-Z0-9]{2,3})\.png$/i)).filter(Boolean).map(m=>m[1].toUpperCase());
    if(!all.length)throw new Error('Logo list not found in upstream repository');
    codes=unique(all);
  }catch(e){console.error('Full catalog unavailable; using priority airline list:',e.message)}
}
await fs.mkdir(DEST,{recursive:true});
const seenHashes=new Set();
const sources=c=>[
 `https://pics.avs.io/350/100/${c}.png`,
 `https://cdn.jsdelivr.net/gh/spydogenesis/airlines-logo@main/airlines-logo/200x200_v2/${c}.png`,
 `https://raw.githubusercontent.com/spydogenesis/airlines-logo/main/airlines-logo/200x200_v2/${c}.png`,
 `https://ios.aviasales.com/logos/xxhdpi/${c}.png`,
 `https://images.kiwi.com/airlines/128/${c}.png`
];
const magicOk=(b)=>b.length>300 && b.length<850000 && (b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || b.subarray(0,2).equals(Buffer.from([0xFF,0xD8])));
let next=0,succeeded=0,missing=[],existing=0;
async function worker(){
 while(next<codes.length){
  const code=codes[next++],dstP=path.join(DEST,code+'.png'),dstJ=path.join(DEST,code+'.jpg');
  try{await fs.access(dstP);existing++;continue}catch{}
  try{await fs.access(dstJ);existing++;continue}catch{}
  let found=false;
  for(const url of sources(code)){
   try{
     const r=await fetchLimited(url);if(!r.ok)continue;
     const type=(r.headers.get('content-type')||'').split(';')[0];if(!/^image\/(png|jpeg)$/.test(type))continue;
     const b=Buffer.from(await r.arrayBuffer());if(!magicOk(b))continue;
     // Avoid sharing the same tiny placeholder file across multiple airline codes.
     const hash=crypto.createHash('sha256').update(b).digest('hex');
     if(seenHashes.has(hash))continue;
     seenHashes.add(hash);
     const file=path.join(DEST,code+(b[0]===0x89?'.png':'.jpg'));
     await fs.writeFile(file,b);found=true;succeeded++;break;
   }catch{ /* Other source may be available */ }
  }
  if(!found){missing.push(code)}
  if((succeeded+missing.length+existing)%20===0)console.log(`${succeeded+missing.length+existing}/${codes.length} checked; ${succeeded} downloaded`);
 }
}
await Promise.all(Array.from({length:Math.min(6,codes.length)},()=>worker()));
await fs.writeFile(path.join(DEST,'download-report.json'),JSON.stringify({checked:codes.length,downloaded:succeeded,alreadyPresent:existing,unavailable:missing},null,2));
console.log(`Finished: ${succeeded} downloaded, ${existing} already present, ${missing.length} unavailable. Report: assets/airlines/download-report.json`);
if(missing.length)console.log('Unavailable:',missing.slice(0,60).join(', ')+(missing.length>60?' ...':''));
