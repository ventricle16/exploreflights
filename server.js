'use strict';
/** Explore Flights: zero-dependency server. Duffel token MUST remain server-side. */
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {URL}=require('node:url');
const ROOT=__dirname;
const PORT=Number(process.env.PORT||3000);
const TOKEN=(process.env.DUFFEL_ACCESS_TOKEN||'').trim();
const DUFFEL_API=(process.env.DUFFEL_API_BASE_URL||'https://api.duffel.com').replace(/\/$/,'');
const requestIds=new Map(), offerIds=new Map(), rate=new Map();
const logoCache=new Map();
const AIRHEX_KEY=(process.env.AIRHEX_API_KEY||'').trim();
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.json':'application/json'};
function respond(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function capped(str,n){return String(str||'').slice(0,n);}
const iata=x=>typeof x==='string'&&/^[A-Z]{3}$/.test(x.toUpperCase());
const isoDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'));
const dt=x=>typeof x==='string'?x:'';
const flightDuration=x=>{const m=/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?/.exec(x||'');return m?`${Number(m[1]||0)}h ${String(Number(m[2]||0)).padStart(2,'0')}m`:''};
function safeOffer(o){
  const slices=Array.isArray(o.slices)?o.slices:[];
  return {
    id:o.id, amount:o.total_amount, currency:o.total_currency, expiresAt:o.expires_at,
    totalDuration:flightDuration(o.total_duration || ''),
    slices:slices.map(s=>({duration:flightDuration(s.duration),segments:(s.segments||[]).map(g=>({
      flightNumber:capped(g.marketing_carrier_flight_number||g.operating_carrier_flight_number||'',10),
      marketingAirline:capped(g.marketing_carrier?.name||'',120),
      marketingCode:capped(g.marketing_carrier?.iata_code||'',3),
      operatingAirline:capped(g.operating_carrier?.name||'',120),
      operatingCode:capped(g.operating_carrier?.iata_code||'',3),
      origin:{code:g.origin?.iata_code||'',name:g.origin?.name||'',city:g.origin?.city_name||g.origin?.city?.name||''},
      destination:{code:g.destination?.iata_code||'',name:g.destination?.name||'',city:g.destination?.city_name||g.destination?.city?.name||''},
      departingAt:dt(g.departing_at),arrivingAt:dt(g.arriving_at),
      aircraft:g.aircraft?.name||'',originTerminal:g.origin_terminal||'',destinationTerminal:g.destination_terminal||'',
      duration:flightDuration(g.duration),
      baggage:(g.passengers||[]).flatMap(p=>p.baggages||[]).map(b=>`${b.quantity} ${b.type==='checked'?'checked bag(s)':b.type==='carry_on'?'carry-on bag(s)':b.type}`).join(', ')
    }))}))
  };
}
async function callDuffel(endpoint,{method='GET',body=null}={}){
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),42000);
  try {
    const response=await fetch(DUFFEL_API+endpoint,{method,headers:{Authorization:`Bearer ${TOKEN}`,'Duffel-Version':'v2','Accept':'application/json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:controller.signal});
    const raw=await response.text();let json;try{json=JSON.parse(raw)}catch{json={errors:[{message:'Provider returned an unexpected response'}]}};
    if(!response.ok){const msg=(json.errors||[]).map(e=>e.message||e.title||e.code).filter(Boolean).join(' / ');const error=new Error(msg||`Provider error ${response.status}`);error.status=response.status;throw error;}
    return json;
  }finally{clearTimeout(timeout)}
}
function clientIP(req){return req.socket.remoteAddress||'unknown'}
function allow(req,res){const key=clientIP(req),time=Date.now();let r=rate.get(key);if(!r||time-r.since>60_000)r={since:time,count:0};r.count++;rate.set(key,r);if(r.count>70){respond(res,429,{error:'Too many requests. Please retry shortly.'});return false}return true}
function remember(id){requestIds.set(id,Date.now()+30*60_000);offerIds.set(id,new Set());if(requestIds.size>600)for(const [k,v] of requestIds)if(v<Date.now()){requestIds.delete(k);offerIds.delete(k)}}
function known(id){return typeof id==='string'&&/^orq_[a-zA-Z0-9_]+$/.test(id)&&requestIds.get(id)>Date.now()}
async function jsonBody(req){let v='';for await(const chunk of req){v+=chunk;if(v.length>12_000)throw new Error('Search request is too large.')}return JSON.parse(v)}
async function listOffers(requestId,after=''){
  const p=new URLSearchParams({offer_request_id:requestId,limit:'100',sort:'total_amount',max_connections:'2'});
  if(after)p.set('after',after);
  const result=await callDuffel('/air/offers?'+p);
  for(const offer of result.data||[])offerIds.get(requestId)?.add(offer.id);
  return {offers:(result.data||[]).map(safeOffer),after:result.meta?.after||null,requestId};
}
async function handler(req,res){
  const u=new URL(req.url,'http://localhost');
  if(/^\/api\/airline-logo\/[A-Z0-9]{2,3}$/.test(u.pathname) && req.method==='GET'){
    const code=u.pathname.split('/').pop();
    // Only vetted image sources, fixed paths, and IATA/ICAO codes are accepted.
    // Image-provider API keys never reach the browser.
    const localNames=[`assets/airlines/${code}.png`,`assets/airlines/${code}.jpg`,`assets/airlines/${code}.jpeg`,
      ...(code==='EK'?['assets/EK.jpg']:[])];
    for(const local of localNames){
      try {const buf=await fs.readFile(path.join(ROOT,local));
        if(buf.length>100&&buf.length<800000){const contentType=/\.png$/i.test(local)?'image/png':'image/jpeg';
          res.writeHead(200,{'Content-Type':contentType,'Cache-Control':'public, max-age=86400','X-Logo-Source':'local','X-Content-Type-Options':'nosniff'});
          return res.end(buf);
        }
      }catch(e){if(e.code!=='ENOENT')console.warn('Local logo read:',e.message)}
    }
    const cached=logoCache.get(code);
    if(cached && cached.expires>Date.now()){
      res.writeHead(200,{'Content-Type':cached.type,'Cache-Control':'public, max-age=3600','X-Logo-Source':cached.source,'X-Content-Type-Options':'nosniff'});
      return res.end(cached.data);
    }
    if(!allow(req,res))return;
    const sources=[];
    if(AIRHEX_KEY){
      const signature=crypto.createHash('md5').update(`${code}_350_100_r_${AIRHEX_KEY}`).digest('hex');
      sources.push({name:'airhex',url:`https://content.airhex.com/content/logos/airlines_${code}_350_100_r.png?md5apikey=${signature}`});
    }
    sources.push(
      // Free public lookup sources. Availability, correctness and licensing vary; cached/local is preferred.
      {name:'aviasales',url:`https://pics.avs.io/350/100/${code}.png`},
      {name:'aviasales-mobile',url:`https://ios.aviasales.com/logos/xxhdpi/${code}.png`},
      {name:'airlines-logo-cdn',url:`https://cdn.jsdelivr.net/gh/spydogenesis/airlines-logo@main/airlines-logo/200x200_v2/${code}.png`},
      {name:'airlines-logo-raw',url:`https://raw.githubusercontent.com/spydogenesis/airlines-logo/main/airlines-logo/200x200_v2/${code}.png`},
      {name:'kiwi',url:`https://images.kiwi.com/airlines/128/${code}.png`},
      {name:'wway',url:`https://img.wway.io/pics/root/${code}@png?exar=1&rs=fit:350:100`}
    );
    for(const source of sources){
      const controller=new AbortController(),tm=setTimeout(()=>controller.abort(),5000);
      try{
        const response=await fetch(source.url,{signal:controller.signal,headers:{'User-Agent':'ExploreFlights/1.0 (airline-branding)'},redirect:'follow'});
        if(!response.ok)continue;
        const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
        if(!['image/png','image/jpeg'].includes(type))continue;
        const data=Buffer.from(await response.arrayBuffer());
        // Reject unexpected HTML bodies and tiny placeholders.
        const png=type==='image/png'&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpg=type==='image/jpeg'&&data[0]===255&&data[1]===216;
        if((!png&&!jpg)||data.length<250||data.length>800000)continue;
        logoCache.set(code,{data,type,source:source.name,expires:Date.now()+6*60*60*1000});
        if(logoCache.size>1500){logoCache.delete(logoCache.keys().next().value)}
        res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=3600','X-Logo-Source':source.name,'X-Content-Type-Options':'nosniff'});
        return res.end(data);
      }catch(e){/* Try another vetted provider. */}
      finally{clearTimeout(tm)}
    }
    // A blank logo is not silently replaced with a fabricated airline emblem.
    return respond(res,404,{error:`Verified airline logo for ${code} unavailable. Add assets/airlines/${code}.png or configure licensed AIRHEX_API_KEY.`});
  }
  if(u.pathname==='/api/config'){return respond(res,200,{connected:!!TOKEN,provider:'Duffel',message:TOKEN?'Provider token configured. Search results identify test versus live inventory.':'Live inventory requires a Duffel API token on the server.'})}
  if(u.pathname.startsWith('/api/')){
    if(!allow(req,res))return;
    if(!TOKEN)return respond(res,503,{error:'Live flight inventory is not connected yet. Set DUFFEL_ACCESS_TOKEN on your Node.js hosting server. No real flights can be displayed until then.'});
    try{
      if(u.pathname==='/api/flights/search'&&req.method==='POST'){
        const d=await jsonBody(req);const legs=d.legs||[];
        if(!Array.isArray(legs)||!legs.length||legs.length>5||!legs.every(l=>iata(l.from)&&iata(l.to)&&l.from!==l.to&&isoDate(l.date)))return respond(res,400,{error:'Enter 1–5 valid routes, airports and travel dates.'});
        const counts=['adults','children','infants'].map(k=>Number(d[k]||0));if(!Number.isInteger(counts[0])||counts[0]<1||counts.reduce((a,b)=>a+b,0)>9||counts.some(n=>n<0)||counts[2]>counts[0])return respond(res,400,{error:'Enter a valid number of travelers (maximum nine).'});
        const cabins=['economy','premium_economy','business','first'];const cabin=capped(d.cabin||'',30).toLowerCase().replace(/ /g,'_');if(!cabins.includes(cabin))return respond(res,400,{error:'Unsupported cabin class.'});
        const passengers=[...Array(counts[0])].map(()=>({type:'adult'})).concat([...Array(counts[1])].map(()=>({type:'child'})),[...Array(counts[2])].map(()=>({type:'infant_without_seat'})));
        const slices=legs.map(l=>({origin:l.from.toUpperCase(),destination:l.to.toUpperCase(),departure_date:l.date}));
        const created=await callDuffel('/air/offer_requests?return_offers=false&supplier_timeout=25000',{method:'POST',body:{data:{slices,passengers,cabin_class:cabin,max_connections:2}}});
        const requestId=created.data?.id;if(!requestId)throw new Error('No offer request ID returned by provider.');
        remember(requestId);const offers=await listOffers(requestId);
        return respond(res,200,{...offers,liveMode:created.data?.live_mode===true,source:'Duffel',searchedAt:new Date().toISOString()});
      }
      if(u.pathname==='/api/flights/more'&&req.method==='GET'){
        const id=u.searchParams.get('requestId'),after=u.searchParams.get('after')||'';
        if(!known(id))return respond(res,400,{error:'The search expired. Please run a new search.'});
        if(after.length>2500)return respond(res,400,{error:'Invalid page cursor.'});
        return respond(res,200,await listOffers(id,after));
      }
      if(u.pathname==='/api/flights/offer'&&req.method==='GET'){
        const id=u.searchParams.get('id'),requestId=u.searchParams.get('requestId');
        if(!known(requestId)||!/^off_[A-Za-z0-9_]+$/.test(id||'')||!offerIds.get(requestId)?.has(id))return respond(res,400,{error:'Invalid or expired offer.'});
        const o=await callDuffel('/air/offers/'+encodeURIComponent(id));
        if(o.data?.offer_request_id && o.data.offer_request_id!==requestId)return respond(res,400,{error:'Offer does not belong to this search.'});
        return respond(res,200,{offer:safeOffer(o.data)});
      }
      return respond(res,404,{error:'Unknown API endpoint.'});
    }catch(e){console.error('Flight API:',e.message);return respond(res,e.status>=400&&e.status<500?e.status:502,{error:e.message==='This operation was aborted'?'The airline search timed out. Please try again.':e.message||'Flight provider unavailable.'});}
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return respond(res,405,{error:'Method not allowed'});
  const name=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
  if(!/^(index\.html|app\.js|styles\.css|pdf-export\.js|passport-ocr\.js|favicon\.svg|assets\/website-qr\.jpg|assets\/airlines\/[A-Z0-9]{2,3}\.(?:png|jpe?g))$/.test(name)){res.writeHead(404);return res.end('Not found')}
  try{const body=await fs.readFile(path.join(ROOT,name));res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?'':body)}catch{res.writeHead(404);res.end('Not found')}
}
const server=http.createServer((req,res)=>{handler(req,res).catch(e=>{console.error(e);if(!res.headersSent)respond(res,500,{error:'Internal server error'})})});
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`Explore Flights listening on 0.0.0.0:${PORT} (flight provider ${TOKEN?'configured':'not configured'})`));
module.exports={server,safeOffer,flightDuration};
