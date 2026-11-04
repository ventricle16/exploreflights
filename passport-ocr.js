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
    // A TD3 passport's MRZ has exactly two 44-character lines. Ignore every
    // other text block, including numbers printed elsewhere on the page.
    const original=String(text||'').split(/[\r\n]+/).map(clean).filter(x=>x.length>=24);
    const lines=[...original];
    // Some OCR engines return both MRZ lines as a single text line.
    for(const line of original){
      const at=line.indexOf('P<');
      if(at>=0 && line.length-at>=88){lines.push(line.slice(at,at+44),line.slice(at+44,at+88));}
    }
    const candidates=[];
    for(let i=0;i<lines.length;i++){
      const raw=lines[i];
      const start=raw.indexOf('P<');
      if(start<0)continue;
      const first=raw.slice(start);
      if(first.length<32||!first.includes('<<'))continue; // OCR may omit trailing filler characters
      const l1=first.slice(0,44).padEnd(44,'<');
      const country=l1.slice(2,5).replace(/[0]/g,'O').replace(/[1]/g,'I');
      if(!/^[A-Z]{3}$/.test(country))continue;
      for(let j=i+1;j<Math.min(i+5,lines.length);j++){
        // Align the second line by its nationality field and check digits.
        const raw2=lines[j];
        const possible=raw2.length>=44 ? [raw2.slice(0,44),raw2.slice(-44)] : [];
        for(const line2 of possible){
          if(line2.length!==44)continue;
          const name=l1.slice(5);
          if(!name.includes('<<'))continue;
          const checks={
            passport:validCheck(line2.slice(0,9),line2[9]),
            birth:validCheck(digit(line2.slice(13,19)),line2[19]),
            expiry:validCheck(digit(line2.slice(21,27)),line2[27])
          };
          const count=Object.values(checks).filter(Boolean).length;
          if(count<2)continue;
          const nationality=line2.slice(10,13).replace(/[0]/g,'O').replace(/[1]/g,'I');
          if(!/^[A-Z]{3}$/.test(nationality))continue;
          const composite=line2.slice(0,10)+digit(line2.slice(13,19))+line2[19]+digit(line2.slice(21,27))+line2.slice(27,43);
          const compositeValid=validCheck(composite,line2[43]);
          const score=count*30+Number(compositeValid)*13+Number(first.length===44)*5+Number(country===nationality)*4;
          candidates.push({line1:l1,line2,checks,count,compositeValid,score});
        }
      }
    }
    candidates.sort((a,b)=>b.score-a.score);
    return candidates[0]||null;
  }
  function parse(text, referenceDate) {
    const found=findLines(text);
    if(!found)throw new Error('No reliable passport MRZ found. Take a straight, sharp photo with both bottom MRZ lines fully visible.');
    const {line1:a,line2:b,checks,compositeValid}=found;
    const names=a.slice(5).split('<<');
    const last=(names[0]||'').replace(/<+/g,' ').trim();
    const first=names.slice(1).join(' ').replace(/<+/g,' ').trim();
    if(!/^[A-Z][A-Z ]{0,42}$/.test(last)|| (first&&!/^[A-Z][A-Z ]{0,42}$/.test(first)))throw new Error('MRZ name is unclear. Please retake the photo showing both machine-readable lines.');
    const nat=b.slice(10,13).replace(/0/g,'O').replace(/1/g,'I');
    const gender=b[20]==='M'?'Male':b[20]==='F'?'Female':'';
    const result={
      first, last,
      nationality:/^[A-Z]{3}$/.test(nat)?(NATIONALITIES[nat]||nat):'',
      gender,
      passport:checks.passport?b.slice(0,9).replace(/<+$/,''):'',
      dob:checks.birth?dateFromMRZ(b.slice(13,19),'birth',referenceDate):'',
      passportExpiry:checks.expiry?dateFromMRZ(b.slice(21,27),'expiry',referenceDate):'',
      checks,validated:Object.values(checks).filter(Boolean).length,
      compositeValid
    };
    if(!first&&!last)throw new Error('Could not read names. Try a sharper, well-lit passport photo.');
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
  function makeCanvas(image,region,style='contrast',rotation=0) {
    // Work on the MRZ strip first, so non-MRZ text cannot contaminate results.
    // Only if that fails, try wider crops and rotated photos.
    const crops={lower:0.68,bottom:0.50,wide:0.30,full:0};
    const cut=rotation?0:(crops[region]??0.5);
    const srcY=Math.floor(image.height*cut),srcH=image.height-srcY;
    const scale=Math.min(2.2,2400/image.width);
    const width=Math.max(800,Math.round(image.width*scale));
    const height=Math.max(100,Math.round(srcH*scale));
    const c=document.createElement('canvas');
    const rotated=rotation===90||rotation===270;
    c.width=rotated?height:width;c.height=rotated?width:height;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw Error('Unable to process the image in this browser.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
    ctx.save();
    if(rotation===180){ctx.translate(width,height);ctx.rotate(Math.PI);}
    if(rotation===90){ctx.translate(height,0);ctx.rotate(Math.PI/2);}
    if(rotation===270){ctx.translate(0,width);ctx.rotate(-Math.PI/2);}
    ctx.filter='grayscale(1) contrast('+(style==='threshold'?'2.2':'1.65')+')';
    ctx.drawImage(image,0,srcY,image.width,srcH,0,0,width,height);
    ctx.restore();
    if(style==='threshold'){
      const data=ctx.getImageData(0,0,c.width,c.height);
      const hist=new Uint32Array(256);let total=0;
      for(let i=0;i<data.data.length;i+=4){const v=data.data[i];hist[v]++;total+=v;}
      const size=c.width*c.height;let leftCount=0,leftSum=0,best=-1,level=145;
      for(let t=0;t<256;t++){
        leftCount+=hist[t];leftSum+=t*hist[t];if(!leftCount||leftCount===size)continue;
        const w0=leftCount/size,w1=1-w0;
        const m0=leftSum/leftCount,m1=(total-leftSum)/(size-leftCount);
        const between=w0*w1*(m0-m1)**2;
        if(between>best){best=between;level=t;}
      }
      for(let i=0;i<data.data.length;i+=4){const v=data.data[i]<level?0:255;data.data[i]=data.data[i+1]=data.data[i+2]=v;}
      ctx.putImageData(data,0,0);
    }
    return c;
  }
  async function recognize(file, onProgress=()=>{}) {
    const image=await openImage(file);
    onProgress('Loading passport text scanner…');
    const engine=await loadEngine();
    const worker=await engine.createWorker('eng');
    let best=null,lastError=null;
    const passes=[
      ['lower','contrast',0,6,'Reading the two MRZ lines…'],
      ['bottom','threshold',0,6,'Enhancing the passport text…'],
      ['wide','contrast',0,6,'Checking a wider passport crop…'],
      ['full','threshold',0,11,'Searching the entire passport…'],
      ['full','contrast',180,6,'Checking photo orientation…'],
      ['full','contrast',90,6,'Checking sideways photo…'],
      ['full','contrast',270,6,'Checking sideways photo…']
    ];
    try {
      await worker.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',tessedit_pageseg_mode:'6'});
      for(const [region,style,rotation,psm,message] of passes){
        if(best?.validated===3&&best?.compositeValid)break;
        onProgress(message);
        const c=makeCanvas(image,region,style,rotation);
        let result;
        try{await worker.setParameters({tessedit_pageseg_mode:String(psm)});result=await worker.recognize(c);}
        finally{c.width=0;c.height=0;}
        try{
          const parsed=parse(result.data?.text||'');
          if(!best||parsed.validated>best.validated||parsed.validated===best.validated&&parsed.compositeValid&&!best.compositeValid)best=parsed;
        }catch(e){lastError=e;}
      }
      if(best)return best;
      throw Error(lastError?.message||'No readable MRZ found. Upload a close-up of the two lines at the bottom of the passport page.');
    }finally{await worker.terminate();}
  }
  const api={parse,checkDigit,validCheck,dateFromMRZ,recognize,findLines};
  root.ExplorePassportOCR=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
