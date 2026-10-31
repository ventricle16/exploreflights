/* Explore Flights A4 PDF generator. Live offer data may appear, but a flight offer is NOT a booked ticket. */
(() => {
  'use strict';
  const W=595.28,H=841.89,M=36,R=W-M;
  const navy='#09264B',deep='#122F55',blue='#2563EB',ink='#173451',sub='#6B7D93',border='#DFE7F0',pale='#F3F7FD',sky='#EDF4FF',white='#FFFFFF',orange='#9D5719',peach='#FFF6EB';
  const carrierColors={'QR':'#65143D','EK':'#C92335','TK':'#C42538','BG':'#CC2B36','SQ':'#C99B39','BA':'#17457F'};
  const rgb=x=>[1,3,5].map(i=>(parseInt(x.slice(i,i+2),16)/255).toFixed(4)).join(' ');
  const simple=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,c=>({'–':'-','—':'-','→':'>','·':' | ','’':"'",'৳':'BDT '}[c]||' '));
  const esc=x=>simple(x).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const textWidth=(s,n)=>[...simple(s)].reduce((w,c)=>w+n*(c===' '?0.29:/[WM@]/.test(c)?.82:/[il.:,;|!]/.test(c)?.24:/[A-Z0-9]/.test(c)?.65:.52),0);
  const sized=(s,n,max,min=7.5)=>{while(n>min&&textWidth(s,n)>max)n-=.35;return n;};
  class Doc{
    constructor(){this.pages=[];this.newPage();}
    newPage(){this.commands=[];this.pages.push(this.commands);}
    write(v){this.commands.push(v);}
    rect(x,y,w,h,fill,stroke){this.write(`${rgb(fill)} rg ${x.toFixed(2)} ${(H-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);if(stroke)this.write(`${rgb(stroke)} RG .7 w ${x.toFixed(2)} ${(H-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);}
    line(x,y,x2,y2,color=border,width=.8){this.write(`${rgb(color)} RG ${width} w ${x.toFixed(2)} ${(H-y).toFixed(2)} m ${x2.toFixed(2)} ${(H-y2).toFixed(2)} l S`);}
    text(s,x,y,size=10,color=ink,bold=false){this.write(`BT /F${bold?2:1} ${size.toFixed(2)} Tf ${rgb(color)} rg 1 0 0 1 ${x.toFixed(2)} ${(H-y).toFixed(2)} Tm (${esc(s)}) Tj ET`);}
    small(s,x,y,color=sub){this.text(s,x,y,7.5,color,true);}
    wrap(s,x,y,width,sz=8.2,leading=11.5,color=ink){let line='',rows=[];for(const word of simple(s).split(/\s+/)){const trial=(line?line+' ':'')+word;if(line&&textWidth(trial,sz)>width){rows.push(line);line=word;}else line=trial;}if(line)rows.push(line);rows.forEach((v,i)=>this.text(v,x,y+i*leading,sz,color));return y+rows.length*leading;}
    blob(){const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];const kids=[];
      for(const page of this.pages){const id=objects.length;kids.push(`${id} 0 R`);const stream=page.join('\n')+'\n';objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id+1} 0 R >>`);objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);}
      objects[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
      let output='%PDF-1.4\n%EXPLORE\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=output.length;output+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}const xref=output.length;output+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)output+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;output+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Blob([new TextEncoder().encode(output)],{type:'application/pdf'});}
  }
  function generate(data){
    if(!data?.segments?.length||!data?.travelers?.length)throw Error('Please complete flight search and passenger details first.');
    const doc=new Doc();let y=0,page=1;
    function header(continued=false){
      doc.rect(0,0,W,87,navy);doc.rect(0,0,W,5,blue);
      doc.rect(M,25,34,34,blue);doc.text('E',M+11,49,21,white,true);
      doc.text('explore',M+43,39,18,white,true);doc.text('flights',M+115,39,18,'#91C1FF',true);
      doc.text('TRAVEL DOCUMENT / FLIGHT ITINERARY',M+43,55,7.1,'#C7DEFC',true);
      doc.rect(R-148,26,148,26,'#294B77');doc.text(data.liveOffer?'OFFER  |  NOT BOOKED':'DEMO  |  NOT BOOKED',R-138,42.5,8.5,white,true);
      y=continued?113:107;
      if(continued){doc.text('FLIGHT ITINERARY (CONTINUED)',M,y,10,blue,true);y+=19;}
    }
    function footer(){doc.line(M,H-47,R,H-47,border);doc.text(data.liveOffer?'EXPLORE FLIGHTS  /  AIRLINE OFFER ONLY  /  NOT A CONFIRMED RESERVATION':'EXPLORE FLIGHTS  /  EXAMPLE ONLY  /  NOT A TICKET OR CONFIRMED RESERVATION',M,H-31,7,sub,true);doc.text(`PAGE ${page} / {TOTAL}`,R-74,H-31,7,sub,true);}
    function need(h){if(y+h>H-75){footer();doc.newPage();page++;header(true);}}
    header();
    doc.text('FLIGHT ITINERARY',M,y,16,ink,true);doc.text(`Generated ${simple(data.generated)}`,R-147,y,8.2,sub);y+=19;
    doc.rect(M,y,R-M,25,peach,'#F2DDC2');doc.text(data.liveOffer?'SUPPLIER OFFER: NO BOOKING, PNR, PAYMENT OR TICKET HAS BEEN ISSUED':'SAMPLE DOCUMENT: NO BOOKING, PNR, PAYMENT OR TICKET HAS BEEN ISSUED',M+10,y+16.5,8,orange,true);y+=41;
    doc.text('BOOKING INFORMATION',M,y,10.4,ink,true);y+=12;
    doc.rect(M,y,R-M,97,white,border);
    doc.line(M,y+49,R,y+49);doc.line(M+261,y,M+261,y+97);
    doc.small('DOCUMENT REFERENCE (DEMO)',M+12,y+16);doc.text(data.bookingReference,M+12,y+34,15,ink,true);
    doc.small('SAMPLE 6-CHAR CODE (NOT PNR)',M+275,y+16);doc.text(data.demoCode,M+275,y+34,15,blue,true);
    doc.small('AIRLINE PNR / RECORD LOCATOR',M+12,y+66);doc.text('NOT ISSUED',M+12,y+85,12,orange,true);
    doc.small('E-TICKET NUMBER',M+275,y+66);doc.text('NOT ISSUED',M+275,y+85,12,orange,true);
    y+=118;
    const first=data.segments[0],last=data.segments[data.segments.length-1];
    const end=data.trip==='Round trip'?data.legs[0].to:last.to.code;
    doc.text(first.from.code,M+3,y+20,27,navy,true);doc.text('------------------>',M+141,y+16,13,blue,true);doc.text(end,R-99,y+20,27,navy,true);
    doc.text(simple(first.from.city),M+3,y+36,9,sub);doc.text(simple(data.trip==='Round trip'?data.segments.find(x=>x.to.code===data.legs[0].to)?.to.city||last.to.city:last.to.city),R-120,y+36,9,sub);
    y+=53;
    doc.rect(M,y,R-M,43,sky);
    const facts=[['TRIP TYPE',data.trip],['TRAVELERS',String(data.travelers.length)],['CLASS',data.cabin],['STATUS','UNCONFIRMED']];
    facts.forEach(([k,v],i)=>{let x=M+12+i*127;doc.small(k,x,y+15);doc.text(v,x,y+31,sized(v,10.3,110),ink,true);});
    y+=66;
    doc.text('FLIGHT SEGMENTS',M,y,11,ink,true);doc.text(data.liveOffer?(data.providerLive?'SUPPLIER SCHEDULE - UNBOOKED':'PROVIDER TEST DATA - UNBOOKED'):'EXAMPLE AIRLINE DETAILS - NOT LIVE INVENTORY',R-235,y,7.4,orange,true);y+=13;
    const sectors=data.segments;
    for(let i=0;i<sectors.length;i++){
      const s=sectors[i];const h=124;need(h+11);
      doc.rect(M,y,R-M,h,white,border);doc.rect(M,y,4,h,blue);
      doc.rect(M+13,y+10,38,28,carrierColors[data.carrierCode]||blue);doc.text(data.carrierCode,M+19,y+29,12,white,true);
      doc.text(s.operatingAirline||data.carrier,M+61,y+20,sized(s.operatingAirline||data.carrier,10.5,300),ink,true);doc.text(`${s.flightNo}  |  ${s.aircraft}`,M+61,y+34,8,sub);
      doc.rect(R-129,y+12,117,19,peach);doc.text(data.liveOffer?'OFFER / NO BOOKING':'SAMPLE / NO BOOKING',R-123,y+25.2,7.2,orange,true);
      doc.line(M+14,y+44,R-14,y+44);
      doc.text(s.departureTime,M+19,y+70,20,ink,true);doc.text(s.arrivalTime,R-114,y+70,20,ink,true);
      doc.text(`${s.from.code}  ${simple(s.from.city).slice(0,21)}`,M+19,y+84,8,blue,true);
      doc.text(`${s.to.code}  ${simple(s.to.city).slice(0,19)}`,R-114,y+84,sized(`${s.to.code} ${simple(s.to.city)}`,8,107),blue,true);
      doc.text('--------->',M+220,y+69,11,blue,true);
      doc.text('local times',M+220,y+82,7.2,sub);
      doc.text(`${s.date}  |  T: ${s.terminalFrom&&s.terminalFrom!=='Check with airline'?s.terminalFrom:'verify'}`,M+19,y+98,7.6,sub);
      doc.text(`${s.arrivalDate}  |  T: ${s.terminalTo&&s.terminalTo!=='Check with airline'?s.terminalTo:'verify'}`,R-174,y+98,7.6,sub);
      doc.rect(M+4,y+105,R-M-8,18,pale);doc.text(`FLIGHT ${s.flightNo}     CABIN ${data.cabin}     BAGGAGE ${s.baggage}     ${data.liveOffer?'AIRCRAFT':'EXAMPLE AIRCRAFT'} ${s.aircraft}`,M+13,y+117,7.1,sub,true);
      y+=h+11;
    }
    need(98);y+=7;
    doc.text('PASSENGER DETAILS',M,y,10.5,ink,true);y+=13;
    doc.rect(M,y,R-M,24,sky);doc.small('PASSENGER NAME',M+10,y+16);doc.small('TYPE',M+250,y+16);doc.small('TICKET NO.',M+344,y+16);y+=24;
    for(let i=0;i<data.travelers.length;i++){
      const t=data.travelers[i];need(32);doc.rect(M,y,R-M,30,i%2?pale:white,border);
      doc.text(simple(t.name).slice(0,43),M+10,y+19,sized(simple(t.name),9.4,225),ink,true);
      doc.text(t.type,M+250,y+19,8.8,ink);doc.text('NOT ISSUED',M+344,y+19,8.1,orange,true);y+=30;
    }
    y+=16;need(63);doc.rect(M,y,R-M,62,sky);doc.small(data.liveOffer?'SUPPLIER TOTAL FARE (SUBJECT TO RECHECK)':'ILLUSTRATIVE TRAVEL FARE (NOT A LIVE QUOTE)',M+12,y+17);
    doc.text(data.liveOffer?`${data.currency} ${Number(data.fareTotal).toLocaleString('en-US',{minimumFractionDigits:2})}`:`BDT ${(Number(data.fareSample)*data.travelers.length).toLocaleString('en-US')}`,M+12,y+38,16,navy,true);
    doc.small('PAYMENT STATUS',M+310,y+17);doc.text('NOT PAID',M+310,y+38,12,orange,true);y+=78;
    // Avoid an otherwise empty second page for a short one-leg itinerary.
    const remaining=H-74-y;
    if(remaining>=31&&remaining<95){
      doc.rect(M,y,R-M,28,peach,'#F1D7B6');
      doc.text(data.liveOffer?'IMPORTANT: OFFER IS NOT A CONFIRMED BOOKING':'IMPORTANT: DEMONSTRATION ONLY',M+12,y+11.5,8.1,orange,true);
      doc.text(data.liveOffer?'An airline offer is not a reservation. No airline PNR or ticket exists. Price and schedule can change.':'Sample only: not a reservation or ticket. No valid airline PNR or e-ticket has been issued.',M+12,y+22,7.0,ink);
      y+=31;
    }else{
      need(95);doc.rect(M,y,R-M,88,peach,'#F1D7B6');doc.text(data.liveOffer?'IMPORTANT: NOT A CONFIRMED BOOKING':'IMPORTANT: DEMONSTRATION ONLY',M+13,y+20,10,orange,true);
      doc.wrap(data.liveOffer?'This itinerary displays airline offer information returned by a connected flight provider. It is NOT a reservation or ticket. The 6-character Explore Flights demo reference is NOT an airline PNR. Schedules, fares, availability, baggage and terminals can change. Confirm directly with the airline or authorized booking provider before travel.':'This document is a sample flight itinerary, not a reservation or ticket. The six-character demo reference is not an airline PNR. Example flight numbers, aircraft, baggage, terminals, fares and times have not been verified. Only an airline or authorized booking provider can issue a genuine, verifiable PNR.',M+13,y+36,R-M-27,8.6,12,ink);y+=100;
    }
    footer();
    for(const pageCommands of doc.pages)for(let i=0;i<pageCommands.length;i++)pageCommands[i]=pageCommands[i].replace(/\{TOTAL\}/g,String(doc.pages.length));
    return doc.blob();
  }
  function download(data){const blob=generate(data);const filename=`Explore_Flights_Itinerary_${data.demoCode||'DEMO'}.pdf`.replace(/[^A-Za-z0-9_.-]/g,'_');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.style.display='none';a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return filename;}
  window.ExploreFlightsPDF={generate,download};
})();
