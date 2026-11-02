/* Explore Flights: compact airline-style A4 itinerary, matching the layout of the supplied ticket.
   Only genuine provider-issued PNR / confirmation fields may be shown as confirmed. */
(() => {
  'use strict';
  const W=595.28, H=841.89, L=14, R=581, navy='#1B395C', dark='#1B2735', muted='#626D7B';
  const light='#F2F5F8', gray='#D8DEE6', cream='#FFF8E7', bluePale='#E6F2F9', white='#FFFFFF', orange='#93611B';
  const palette={EK:'#D71920',QR:'#70183F',TK:'#D62828',BG:'#C52A36',SQ:'#A17F22',BA:'#154A81',EY:'#AF914E',MH:'#C43B37',AI:'#C42D38',WY:'#6F375A',CX:'#08665F',SV:'#145FA8',KU:'#145E8D',GF:'#9B8C58'};
  const sanitize=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2014\u2013]/g,'-').replace(/[\u2019]/g,"'").replace(/[^\x20-\x7e]/g,' ');
  const esc=s=>sanitize(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const rgb=s=>[1,3,5].map(i=>(parseInt(s.slice(i,i+2),16)/255).toFixed(4)).join(' ');
  const width=(s,z=9)=>[...sanitize(s)].reduce((a,c)=>a+z*(c===' '?0.29:/[MW@]/.test(c)?.83:/[il.,:;|!]/.test(c)?.25:/[A-Z0-9]/.test(c)?.64:.52),0);
  const fit=(s,z,max,min=5.8)=>{while(z>min&&width(s,z)>max)z-=.3;return Math.max(min,z)};
  function fmtDate(s){if(!s)return '-';const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(s)?s+'T12:00:00Z':s);return Number.isFinite(+d)?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d):sanitize(s)}
  function fmtMoney(n,c='BDT'){return `${sanitize(c)} ${Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
  class PDF{
    constructor(){this.pages=[];this.images=[];this.newPage()}
    newPage(){this.cmd=[];this.pages.push(this.cmd)}
    emit(s){this.cmd.push(s)}
    rect(x,y,w,h,color,stroke){this.emit(`${rgb(color)} rg ${x.toFixed(2)} ${(H-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);if(stroke){this.emit(`${rgb(stroke)} RG .5 w ${x.toFixed(2)} ${(H-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`)}}
    line(x,y,x2,y2,color=gray,thick=.55){this.emit(`${rgb(color)} RG ${thick} w ${x.toFixed(2)} ${(H-y).toFixed(2)} m ${x2.toFixed(2)} ${(H-y2).toFixed(2)} l S`)}
    txt(v,x,y,size=8,color=dark,bold=false){this.emit(`BT /F${bold?2:1} ${size.toFixed(2)} Tf ${rgb(color)} rg 1 0 0 1 ${x.toFixed(2)} ${(H-y).toFixed(2)} Tm (${esc(v)}) Tj ET`)}
    right(v,x,y,size=8,color=dark,bold=false){this.txt(v,x-width(v,size),y,size,color,bold)}
    wrapped(v,x,y,max,z=7.4,lh=10,color=dark,maxLines=4){let line='',out=[];for(const word of sanitize(v).split(/\s+/)){const t=line?line+' '+word:word;if(line&&width(t,z)>max){out.push(line);line=word;}else line=t}if(line)out.push(line);out.slice(0,maxLines).forEach((s,i)=>this.txt(s,x,y+i*lh,z,color));return Math.min(out.length,maxLines)*lh}
    image(jpeg,x,y,w,h){
      const n=this.images.push(jpeg);
      this.emit(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(H-y-h).toFixed(2)} cm /Im${n} Do Q`);
    }
    // Keep genuine airline marks in their original aspect ratio (no stretching).
    fittedImage(jpeg,x,y,w,h){
      if(!jpeg?.width||!jpeg?.height)return;
      const ratio=Math.min(w/jpeg.width,h/jpeg.height),iw=jpeg.width*ratio,ih=jpeg.height*ratio;
      this.image(jpeg,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
    }
    file(){
      const enc=new TextEncoder(), parts=[];let totalBytes=0;
      const append=v=>{const bytes=typeof v==='string'?enc.encode(v):v;parts.push(bytes);totalBytes+=bytes.length};
      const pageCount=this.pages.length, imageStart=5+2*pageCount;
      const numObjects=4+2*pageCount+this.images.length;
      const offsets=new Array(numObjects+1).fill(0);
      const object=(id,contents)=>{offsets[id]=totalBytes;append(`${id} 0 obj\n`);append(contents);append('\nendobj\n')};
      append('%PDF-1.4\n%ExploreFlights\n');
      object(1,'<< /Type /Catalog /Pages 2 0 R >>');
      object(2,`<< /Type /Pages /Kids [${this.pages.map((_,i)=>`${5+i*2} 0 R`).join(' ')}] /Count ${pageCount} >>`);
      object(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      object(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const xobjects=this.images.map((_,i)=>`/Im${i+1} ${imageStart+i} 0 R`).join(' ');
      for(let i=0;i<this.pages.length;i++){
        const id=5+i*2,stream=enc.encode(this.pages[i].join('\n')+'\n');
        object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobjects} >> >> /Contents ${id+1} 0 R >>`);
        offsets[id+1]=totalBytes;append(`${id+1} 0 obj\n<< /Length ${stream.length} >>\nstream\n`);append(stream);append('endstream\nendobj\n');
      }
      for(let i=0;i<this.images.length;i++){
        const id=imageStart+i,img=this.images[i];offsets[id]=totalBytes;
        append(`${id} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`);
        append(img.bytes);append('\nendstream\nendobj\n');
      }
      const xref=totalBytes;append(`xref\n0 ${numObjects+1}\n0000000000 65535 f \n`);
      for(let i=1;i<=numObjects;i++)append(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
      append(`trailer\n<< /Size ${numObjects+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
      return new Blob(parts,{type:'application/pdf'});
    }
  }
  async function loadJpeg(url){
    // Use same-origin routes to avoid canvas CORS issues. No passenger data is sent.
    // Fetch first so HTML errors or missing logo assets cannot be mistaken for images.
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),14000);
    try{
      const response=await fetch(url,{signal:controller.signal,cache:'no-cache'});
      if(!response.ok||!/^image\/(png|jpeg)/i.test(response.headers.get('content-type')||''))return null;
      const blob=await response.blob();
      const objectUrl=URL.createObjectURL(blob);
      try{
        const image=new Image();image.src=objectUrl;await image.decode();
        if(!image.naturalWidth||!image.naturalHeight) return null;
        const canvas=document.createElement('canvas');
        canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const ctx=canvas.getContext('2d');if(!ctx)return null;
        ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);
        const data=canvas.toDataURL('image/jpeg',.96).split(',')[1];
        const raw=atob(data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
        return {width:canvas.width,height:canvas.height,bytes};
      }finally{URL.revokeObjectURL(objectUrl)}
    }catch{return null}finally{clearTimeout(timeout)}
  }
  async function generate(d){
    if(!d?.segments?.length||!d?.travelers?.length)throw Error('Complete your flight selection and passenger details first.');
    const pdf=new PDF();let y=0,page=1;
    const iataCode=String(d.carrierCode||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
    const logoCodes=[...new Set([iataCode,...d.segments.map(s=>String(s.operatingCode||s.marketingCode||iataCode).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3))])]
      .filter(code=>/^[A-Z0-9]{2,3}$/.test(code));
    const logoPairs=await Promise.all(logoCodes.map(async code=>[code,await loadJpeg(`/api/airline-logo/${encodeURIComponent(code)}`)]));
    const logos=new Map(logoPairs);
    // Every generated PDF must contain a real image logo; no fake/generic brand icon.
    const absent=logoCodes.filter(code=>!logos.get(code));
    if(absent.length)throw new Error(`Airline logo unavailable for ${absent.join(', ')}. Add assets/airlines/${absent[0]}.png to GitHub or configure an airline-logo provider on Render.`);
    const logo=logos.get(iataCode);
    const qr=await loadJpeg('/assets/website-qr.jpg');
    if(!qr)throw new Error('QR artwork missing. Upload assets/website-qr.jpg along with server.js.');
    // An airline OFFER is not proof of a reservation. This UI has no booking-create endpoint.
    const booked=false; // Set only by a future verified, server-side booking integration.
    const pnr=booked&&d.airlinePnr?d.airlinePnr:'NOT ISSUED';
    const code=(d.carrierCode||'EF').toUpperCase().slice(0,3),airline=sanitize(d.carrier||'Explore Flights');
    const ink=palette[code]||navy,ref=sanitize(d.bookingReference||'EF-ITINERARY');
    const currency=d.liveOffer&&d.currency?d.currency:'BDT';
    const total=d.liveOffer?Number(d.fareTotal||0):Number(d.fareSample||0)*d.travelers.length;
    const pending='NOT CONFIRMED';
    function top(continuation=false){
      if(logo)pdf.fittedImage(logo,L+8,13,147,37);

      pdf.txt('FLIGHT ITINERARY',L+16,62,7.3,navy,true);
      pdf.right(`Itinerary Ref: ${ref}`,R,23,8.5,dark,true);
      pdf.right(`Airline PNR: ${pnr}`,R,37,8.0,dark,true);
      pdf.right(`Status: ${pending}`,R,51,8.0,dark,true);
      y=continuation?82:81;
    }
    function foot(){pdf.line(L,799,R,799,gray);pdf.txt(`Explore Flights  |  Itinerary ref ${ref}  |  No airline booking issued`,L+2,813,7,muted);pdf.right(`PAGE ${page} / {TOTAL}`,R,813,7,muted)}
    function newPage(){foot();pdf.newPage();page++;top(true)}
    function room(h){if(y+h>792)newPage()}
    function bar(title){room(24);pdf.rect(L,y,R-L,18,navy);pdf.txt(title.toUpperCase(),L+8,y+12,9.1,white,true);y+=18}
    top();
    bar('Passenger information');
    // The reference table uses six columns and light zebra rows.
    const cols=[L+8,L+29,L+190,L+279,L+368,L+467];
    pdf.rect(L,y,R-L,18,light);['SL','FULL NAME','DATE OF BIRTH','PASSPORT NO.','PASSPORT EXPIRY','NATIONALITY','PAX TYPE'].forEach((v,i)=>{
      const x=[L+6,L+30,L+186,L+262,L+356,L+461,R-53][i];
      const size=[7.1,7.1,7.1,7.1,6.7,5.8,5.8][i];
      pdf.txt(v,x,y+12,size,dark,true)
    });y+=18;
    d.travelers.forEach((p,i)=>{
      room(26);const row=26;pdf.rect(L,y,R-L,row,i%2?light:white);pdf.line(L,y+row,R,y+row,gray);
      pdf.txt(i+1,L+8,y+17,8,muted);
      const nm=sanitize(p.name||'PASSENGER');const multiline=width(nm,8)>149;
      if(multiline){const parts=nm.split(' ');let a='',b='';for(const part of parts){if(!b&&width(a+' '+part,8)<147)a+=(a?' ':'')+part;else b+=(b?' ':'')+part}pdf.txt(a,L+31,y+11,fit(a,8,149),dark,true);pdf.txt(b,L+31,y+20,fit(b,7.5,149),dark,true)}else pdf.txt(nm,L+31,y+17,fit(nm,8.3,149),dark,true);
      pdf.txt(p.dob?fmtDate(p.dob):'-',L+186,y+17,7.8,dark);
      pdf.txt(sanitize(p.passport||'-'),L+263,y+17,fit(p.passport||'-',8,84),dark,true);
      pdf.txt(p.passportExpiry?fmtDate(p.passportExpiry):'-',L+356,y+17,7.7,dark);
      pdf.txt(sanitize(p.nationality||'-'),L+460,y+17,fit(p.nationality||'-',7.5,79),dark);
      pdf.txt(sanitize(p.type||'Adult'),R-59,y+17,7.8,dark);
      y+=row;
    });
    y+=9;bar('Flight itinerary');
    function flightTableHead(){pdf.rect(L,y,R-L,18,light);const cx=[L+8,L+88,L+175,L+287,L+370,L+412,L+471,L+530];const th=['FLIGHT','DATE','FROM','TO','DEP.','ARR.','DURATION','CLASS'];th.forEach((t,i)=>pdf.txt(t,cx[i],y+12,fit(t,7.2,[72,80,105,76,42,42,54,39][i]),dark,true));pdf.line(L,y+18,R,y+18,navy,1);y+=18}
    flightTableHead();
    const groups=new Map();d.segments.forEach((s,i)=>{const k=String(s.routeIndex||1);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s)});
    const direction=k=>{const n=Number(k);return d.trip==='Round trip'?(n===1?'OUTBOUND':'RETURN'):(d.trip==='Multi-city'?`JOURNEY ${n}`:'OUTBOUND')};
    let ix=0;
    for(const [k,ss] of groups){room(18);pdf.txt(direction(k),L+8,y+12,7.5,orange,true);pdf.txt(`Baggage: ${sanitize(ss[0]?.baggage||'Refer to airline rules')}`,L+87,y+12,7.3,muted);y+=17;
      for(let j=0;j<ss.length;j++){
        const s=ss[j];room(29);pdf.line(L,y+28,R,y+28,gray);if(ix++%2)pdf.rect(L,y,R-L,28,'#FAFBFD');
        const sectorLogo=logos.get(String(s.operatingCode||s.marketingCode||iataCode).toUpperCase())||logo;
        if(sectorLogo)pdf.fittedImage(sectorLogo,L+7,y+2,51,10);
        pdf.txt(sanitize(s.flightNo||'-'),L+7,y+20,7.5,dark,true);
        pdf.txt(sanitize(s.operatingAirline||airline),L+7,y+27,5.4,muted);
        pdf.txt(sanitize(s.date||'-'),L+86,y+17,fit(s.date||'-',8,86),dark);
        const frm=`${sanitize(s.from?.city||'')} (${sanitize(s.from?.code||'')})`;
        const to=`${sanitize(s.to?.city||'')} (${sanitize(s.to?.code||'')})`;
        pdf.txt(frm,L+174,y+17,fit(frm,8.6,109),dark,true);
        pdf.txt(to,L+285,y+17,fit(to,8.6,79),dark,true);
        pdf.txt(sanitize(s.departureTime||'-'),L+369,y+17,8.5,dark,true);
        pdf.txt(sanitize(s.arrivalTime||'-'),L+411,y+17,8.5,dark,true);
        pdf.txt(sanitize(s.duration||'-'),L+469,y+17,fit(s.duration||'-',8.1,53),dark);
        pdf.txt(sanitize(s.cabin||d.cabin||'Economy'),L+529,y+17,fit(s.cabin||d.cabin||'Economy',7.7,38),dark);
        y+=28;
        if(j<ss.length-1){room(16);pdf.rect(L,y,R-L,15,cream);const place=s.to?.city||'Connecting airport';pdf.txt(`    Connection at ${sanitize(place)} (${sanitize(s.to?.code||'')}) - change planes`,L+185,y+10.5,7.3,orange);y+=15;}
      }
    }
    y+=5;room(32);
    pdf.line(L,y,R,y,gray);y+=13;
    const outbound=d.segments.filter(x=>String(x.routeIndex||1)==='1').map(x=>x.flightNo).join(' - ');
    const ret=d.segments.filter(x=>String(x.routeIndex||1)==='2').map(x=>x.flightNo).join(' - ');
    pdf.txt(`Flights: Outbound ${sanitize(outbound)}${ret?'  |  Return '+sanitize(ret):''}`,L+7,y,fit(`Flights: Outbound ${outbound}${ret?' | Return '+ret:''}`,8.2,558),dark);
    y+=13;pdf.txt(`All times local to each airport. Schedules and aircraft are subject to airline changes.`,L+7,y,7.5,muted);
    y+=14;bar('Fare summary');
    pdf.rect(L,y,R-L,18,light);pdf.txt('DESCRIPTION',L+8,y+12,7.5,dark,true);pdf.right(`AMOUNT (${currency})`,R-9,y+12,7.5,dark,true);y+=18;
    const amount=fmtMoney(total,currency).replace(`${currency} `,'');
    const fareRows=[
      ['Airfare (estimated / offered)',amount],
      ['Taxes, fees and surcharges','Included where quoted'],
      ['Convenience fee','Not charged']
    ];
    fareRows.forEach(([label,value],i)=>{room(19);pdf.rect(L,y,R-L,19,i%2?white:light);pdf.line(L,y+19,R,y+19,gray);pdf.txt(label,L+8,y+13,8.1,dark);pdf.right(value,R-9,y+13,7.8,dark);y+=19});
    room(24);pdf.rect(L,y,R-L,24,bluePale);pdf.txt(d.liveOffer?'Total offered fare (not charged)':'Estimated total (not charged)',L+8,y+16,9.4,dark,true);pdf.right(fmtMoney(total,currency),R-9,y+16,10.2,dark,true);y+=32;
    bar('Important information');
    room(110);
    const notes=[
      'Itinerary information is not proof of an airline reservation.',
      'No airline PNR or e-ticket has been issued.',
      'Check departure/arrival times with the operating airline.',
      'Arrive at least 3 hours before international departures.',
      'Passport and visa requirements vary by destination.',
      'Baggage rules are determined by the operating airline.',
      'Price and availability may change prior to booking.',
      'For actual reservations, obtain a confirmed airline record.'
    ];
    let leftY=y+11,rightY=y+11;
    notes.slice(0,4).forEach(v=>{pdf.txt('*',L+10,leftY,8,navy);leftY+=pdf.wrapped(v,L+20,leftY,225,7.4,10,dark,3)+4;});
    notes.slice(4,8).forEach(v=>{pdf.txt('*',L+245,rightY,8,navy);rightY+=pdf.wrapped(v,L+255,rightY,205,7.4,10,dark,3)+4;});
    // Public website URL only; this code does not validate an airline reservation.
    const qrX=R-93,qrY=y+8,dim=78;
    pdf.rect(qrX-5,qrY-5,dim+10,dim+10,white,gray);
    if(qr)pdf.image(qr,qrX,qrY,dim,dim);
    pdf.txt('VISIT EXPLORE FLIGHTS',qrX-7,qrY+dim+18,6.7,muted,true);
    y=Math.max(leftY,rightY,qrY+dim+23)+10;
    if(y>792){ // for long documents, the important-information block may end on a new page.
      newPage();
    }
    foot();
    for(const c of pdf.pages)for(let i=0;i<c.length;i++)c[i]=c[i].replace(/\{TOTAL\}/g,String(pdf.pages.length));
    return pdf.file();
  }
  async function download(data){const blob=await generate(data);const filename=`Explore_Flights_Itinerary_${sanitize(data.bookingReference||'')||'Itinerary'}.pdf`.replace(/[^\w.\-]/g,'_');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);return filename}
  window.ExploreFlightsPDF={generate,download};
})();
