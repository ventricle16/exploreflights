/* Explore Flights passport autofill — browser-only OCR of the passport MRZ.
 * Images never leave this browser. OCR assets download on demand from jsDelivr.
 * ICAO TD3: two 44-character machine readable lines, with check digits.
 * This module does NOT authenticate a passport; all fields must be reviewed.
 */
(function (root) {
  'use strict';
  const NATIONALITIES = {
    BGD:'Bangladeshi',IND:'Indian',MYS:'Malaysian',GBR:'British',USA:'American',CAN:'Canadian',AUS:'Australian',
    ARE:'Emirati',SAU:'Saudi Arabian',QAT:'Qatari',OMN:'Omani',KWT:'Kuwaiti',BHR:'Bahraini',
    THA:'Thai',SGP:'Singaporean',IDN:'Indonesian',PAK:'Pakistani',NPL:'Nepali',LKA:'Sri Lankan',
    CHN:'Chinese',JPN:'Japanese',KOR:'South Korean',PHL:'Filipino',VNM:'Vietnamese',
    TUR:'Turkish',DEU:'German',FRA:'French',ITA:'Italian',ESP:'Spanish',NLD:'Dutch',PRT:'Portuguese',
    CHE:'Swiss',SWE:'Swedish',NOR:'Norwegian',DNK:'Danish',FIN:'Finnish',RUS:'Russian',
    POL:'Polish',IRL:'Irish',AUT:'Austrian',BEL:'Belgian',EGY:'Egyptian',ZAF:'South African',
    NGA:'Nigerian',KEN:'Kenyan',BRA:'Brazilian',ARG:'Argentine',MEX:'Mexican',NZL:'New Zealander'
  };
  const clean = s => String(s||'').toUpperCase().replace(/[«‹〈《]/g,'<').replace(/[^A-Z0-9<]/g,'');
  const digit = s => String(s||'').replace(/[OQD]/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/B/g,'8').replace(/Z/g,'2').replace(/G/g,'6');
  const digitValue = char => char==='<'?0:/^[0-9]$/.test(char)?Number(char):/^[A-Z]$/.test(char)?char.charCodeAt(0)-55:0;
  function checkDigit(s) { const weights=[7,3,1];let n=0;for(let i=0;i<s.length;i++)n+=digitValue(s[i])*weights[i%3];return String(n%10); }
  function validCheck(text, check) {return /^[0-9]$/.test(digit(check)) && checkDigit(text)===digit(check);}
  function dateFromMRZ(value, kind, referenceDate) {
    const s=digit(value);
    if(!/^\d{6}$/.test(s))return '';
    const yy=Number(s.slice(0,2)),mm=Number(s.slice(2,4)),dd=Number(s.slice(4,6));
    const now=referenceDate||new Date();
    let year=2000+yy;
    if(kind==='birth'){
      if(year>now.getFullYear() || (year===now.getFullYear() && mm-1>now.getMonth()))year-=100;
    }else if(year>now.getFullYear()+20){year-=100;}
    const d=new Date(Date.UTC(year,mm-1,dd));
    if(d.getUTCFullYear()!==year||d.getUTCMonth()!==mm-1||d.getUTCDate()!==dd)return '';
    return `${year}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
  }
  function findLines(text) {
    const lines=String(text||'').split(/[\r\n]+/).map(clean).filter(x=>x.length>=25);
    const candidates=[];
    for(let i=0;i<lines.length;i++){
      // OCR sometimes splits the passport MRZ over several text lines.
      for(let j=i+1;j<Math.min(i+4,lines.length);j++){
        const first=lines[i],second=lines[j];
        if(!/^P[A-Z0-9<]/.test(first)||first.length<35||second.length<40)continue;
        const a=first.slice(0,44).padEnd(44,'<'),b=second.slice(0,44).padEnd(44,'<');
        const checks=Number(validCheck(b.slice(0,9),b[9]))+Number(validCheck(digit(b.slice(13,19)),b[19]))+Number(validCheck(digit(b.slice(21,27)),b[27]));
        candidates.push({line1:a,line2:b,checks,score:checks*15 + Number(first.includes('<<'))*4 + Math.min(second.length,44)});
      }
    }
    candidates.sort((a,b)=>b.score-a.score);
    return candidates[0]||null;
  }
  function parse(text, referenceDate) {
    const found=findLines(text);
    if(!found)throw new Error('Could not read the two MRZ lines. Use a clear photo showing the full bottom edge of the passport.');
    const {line1:a,line2:b}=found;
    const names=a.slice(5).split('<<');
    const last=(names[0]||'').replace(/<+/g,' ').trim();
    const first=names.slice(1).join(' ').replace(/<+/g,' ').trim();
    const n=b.slice(10,13), gender=b[20]==='M'?'Male':b[20]==='F'?'Female':'';
    const checks={
      passport:validCheck(b.slice(0,9),b[9]),
      birth:validCheck(digit(b.slice(13,19)),b[19]),
      expiry:validCheck(digit(b.slice(21,27)),b[27])
    };
    // Never autofill a number/date whose MRZ check digit did not validate.
    const result={
      first:first||'',last:last||'',nationality:/^[A-Z]{3}$/.test(n)?(NATIONALITIES[n]||n):'',gender,
      passport:checks.passport?b.slice(0,9).replace(/<+$/,''):'',
      dob:checks.birth?dateFromMRZ(b.slice(13,19),'birth',referenceDate):'',
      passportExpiry:checks.expiry?dateFromMRZ(b.slice(21,27),'expiry',referenceDate):'',
      checks,validated:Object.values(checks).filter(Boolean).length
    };
    if(!first&&!last)throw new Error('Names could not be extracted. Please try a sharper passport photo.');
    return result;
  }
  let loadPromise;
  function loadEngine() {
    if(typeof document==='undefined')return Promise.reject(new Error('Passport scanner requires a browser.'));
    if(root.Tesseract?.createWorker)return Promise.resolve(root.Tesseract);
    if(loadPromise)return loadPromise;
    loadPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.async=true;s.crossOrigin='anonymous';
      s.onload=()=>root.Tesseract?.createWorker?resolve(root.Tesseract):reject(new Error('Passport OCR engine failed to initialize.'));
      s.onerror=()=>reject(new Error('Could not load the scanner. Check your internet connection and try again.'));
      document.head.appendChild(s);
    }).catch(e=>{loadPromise=null;throw e;});
    return loadPromise;
  }
  async function openImage(file) {
    if(!file||!file.type.startsWith('image/'))throw new Error('Please choose a passport photo (JPG, PNG, WEBP, or HEIC if supported).');
    if(file.size>15*1024*1024)throw new Error('Image exceeds 15 MB. Choose a smaller photo.');
    const url=URL.createObjectURL(file);
    try {return await new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Unable to open this image. Try JPG or PNG.'));image.src=url;
    });}finally{URL.revokeObjectURL(url);}
  }
  function prepareImage(image,area='bottom') {
    const fromY=area==='bottom'?Math.floor(image.height*.52):0;
    const srcH=image.height-fromY;
    const destW=Math.min(2600,Math.max(1500,image.width));
    const scale=destW/image.width;
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(image.width*scale);canvas.height=Math.round(srcH*scale);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('Your browser could not process the photo.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.filter='grayscale(1) contrast(1.5)';
    ctx.drawImage(image,0,fromY,image.width,srcH,0,0,canvas.width,canvas.height);
    return canvas;
  }
  async function recognize(file, onProgress=()=>{}) {
    const img=await openImage(file);
    onProgress('Loading text recognition…');
    const engine=await loadEngine();
    const worker=await engine.createWorker('eng');
    try {
      await worker.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',tessedit_pageseg_mode:'6'});
      let err;
      for(const area of ['bottom','full']) {
        onProgress(area==='bottom'?'Reading passport MRZ…':'Trying the full passport image…');
        const canvas=prepareImage(img,area);
        const result=await worker.recognize(canvas);
        canvas.width=0;canvas.height=0;
        try{return parse(result.data?.text||'');}catch(e){err=e;}
      }
      throw err||new Error('Passport MRZ was not found.');
    }finally{await worker.terminate();}
  }
  const api={parse,checkDigit,validCheck,dateFromMRZ,recognize,findLines};
  root.ExplorePassportOCR=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
