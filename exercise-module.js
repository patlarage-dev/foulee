/* Independent exercise import and analysis. No plan is required. */
const ExerciseModule = (() => {
  const storageKey = 'foulee.exercises.v1';
  let context, selectedId = '', selectedAthlete = '';
  const inspections = new Map();
  const exerciseTabs = new Map();
  const exerciseDrafts = new Map();
  let mapResizeObserver, basemapCleanup, mapLibrary;
  const mapStyles = {positron:"Épuré · Positron", bright:"Détaillé · Bright", liberty:"Classique · Liberty", dark:"Sombre · Dark", fiord:"Bleuté · Fiord"};
  function loadMapLibrary() {
    if (!mapLibrary) {
      const css=document.createElement("link");css.rel="stylesheet";css.href="https://unpkg.com/maplibre-gl@6.12.0/dist/maplibre-gl.css";document.head.append(css);
      mapLibrary=import("https://unpkg.com/maplibre-gl@6.12.0/dist/maplibre-gl.mjs").catch(error=>{css.remove();mapLibrary=null;throw error;});
    }
    return mapLibrary;
  }
  function basemapCamera(svg,view,width) {
    const base=Number(svg.dataset.scale);
    const lon=Number(svg.dataset.cx)+(view.x+view.w/2-360)/base;
    const mercatorY=Number(svg.dataset.cy)+(view.y+view.h/2-170)/base;
    return {center:[lon,Math.atan(Math.sinh(-mercatorY*Math.PI/180))*180/Math.PI],zoom:Math.log2(base*width/view.w*360/512),bearing:0,pitch:0};
  }
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => value == null || value === '' || typeof value === 'boolean' ? NaN : Number(value);
  const time = value => Date.parse(value);
  const fmt = (value, digits=0) => Number.isFinite(value) ? value.toLocaleString('fr-FR', {maximumFractionDigits:digits}) : '—';
  const pace = seconds => Number.isFinite(seconds) && seconds > 0 ? `${Math.floor(Math.round(seconds)/60)}:${String(Math.round(seconds)%60).padStart(2,'0')}` : '—';
  const clock = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  function speed(value, unit) {
    if (['m/s','m·s⁻¹'].includes(unit)) return value;
    if (unit === 'km/hr' || unit === 'km/h') return value / 3.6;
    if (unit === 'mi/hr' || unit === 'mph') return value * 0.44704;
    return NaN;
  }
  const phaseColors=['#1760a7','#c15c24','#8b64bf','#249475','#c63d65','#9b7618','#486cc4','#658133','#a14c9b'];
  function normalizePhases(activities, start, end) {
    return (Array.isArray(activities)?activities:[]).flatMap((activity,index)=>{
      if(!activity || typeof activity!=='object')return [];
      const from=(time(activity.startDate)-start)/1000,to=(time(activity.endDate)-start)/1000;
      if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to<=0||from>=end)return [];
      const stats=Array.isArray(activity.statistics)?activity.statistics:[];
      const distance=stats.find(stat=>String(stat.identifier).endsWith('DistanceWalkingRunning'));
      const raw=number(distance?.sum),km=distance?.unit==='km'?raw:distance?.unit==='m'?raw/1000:NaN;
      const seconds=number(activity.durationSeconds)>0?number(activity.durationSeconds):to-from;
      return [{sourceIndex:index,start:Math.max(0,from),end:Math.min(end,to),seconds,km:Number.isFinite(km)&&km>=0?km:null,step:String(activity.metadata?.WOIntervalStepKeyPath || ''),name:String(activity.name || `Phase ${index+1}`)}];
    }).sort((a,b)=>a.start-b.start || a.sourceIndex-b.sourceIndex);
  }
  function phaseRoutes(routes, phase) {
    return routes.flatMap(route=>{
      // Never connect across route boundaries or GPS outages.
      const segments=[];let segment=[];
      const flush=()=>{if(segment.length>1)segments.push(segment);segment=[];};
      for(let i=1;i<route.length;i++){
        const a=route[i-1],b=route[i];
        if(b.t<=a.t || b.t-a.t>120 || b.t<=phase.start || a.t>=phase.end){flush();continue;}
        const from=Math.max(a.t,phase.start),to=Math.min(b.t,phase.end);
        const first=gpsAtTime([[a,b]],from),last=gpsAtTime([[a,b]],to);
        if(!first||!last){flush();continue;}
        if(!segment.length)segment.push(first);
        segment.push(last);
      }
      flush();return segments;
    });
  }
  function bindPhases(item) {
    const phases=item.phases || [];
    if(!phases.length)return;
    const panel=document.createElement('section');panel.className='panel exercise-phases';
    panel.innerHTML=`<h2>Phases de l’exercice</h2><p>Découpage enregistré dans le fichier. Les noms des blocs et les objectifs ne sont pas déduits automatiquement.</p><label class="exercise-phase-toggle"><input type="checkbox" id="exercise-show-phases"> Afficher les phases sur les graphiques et le parcours GPS</label><div class="exercise-phase-list">${phases.map((phase,i)=>`<article><h3><span style="color:${phaseColors[i%phaseColors.length]}">●</span> ${esc(phase.name)}</h3><p>${clock(phase.start)} → ${clock(phase.end)} · ${clock(phase.seconds)} · ${phase.km===null?'Distance indisponible':fmt(phase.km,3)+' km'} · ${phase.km>0?pace(phase.seconds/phase.km)+' /km':'Allure indisponible'}</p>${phase.step?`<small>Étape ${esc(phase.step)}</small>`:''}</article>`).join('')}</div><p class="exercise-chart-note">Les couleurs et les numéros sont communs aux courbes et à la carte. Les segments GPS sont limités aux points disponibles; les interruptions ne sont pas reliées.</p>`;
    el('exercise-detail').children[0].after(panel);
    const ns='http://www.w3.org/2000/svg';
    const group=()=>{const g=document.createElementNS(ns,'g');g.setAttribute('class','exercise-phase-overlay');g.setAttribute('pointer-events','none');g.style.display='none';return g;};
    document.querySelectorAll('.exercise-interactive-chart').forEach(svg=>{
      const g=group();
      phases.forEach((phase,i)=>{
        const x=62+phase.start/item.end*390,width=(phase.end-phase.start)/item.end*390;
        const rect=document.createElementNS(ns,'rect');
        for(const [key,value] of Object.entries({x,y:45,width,height:135,fill:phaseColors[i%phaseColors.length],'fill-opacity':.12}))rect.setAttribute(key,value);
        const title=document.createElementNS(ns,'title');title.textContent=`${phase.name} : ${clock(phase.start)} – ${clock(phase.end)}`;rect.append(title);g.append(rect);
        const label=document.createElementNS(ns,'text');label.setAttribute('x',x+3);label.setAttribute('y',38);label.setAttribute('fill',phaseColors[i%phaseColors.length]);label.textContent=String(i+1);g.append(label);
      });svg.prepend(g);
    });
    const svg=el('exercise-route-map');
    if(svg){
      const g=group(),{origin,scale,cx,cy}=svg.dataset;
      const xy=p=>[360+(Number(origin)+((p.lon-Number(origin)+540)%360)-180-Number(cx))*Number(scale),170+(-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,p.lat))*Math.PI/360))*180/Math.PI-Number(cy))*Number(scale)];
      phases.forEach((phase,i)=>{
        const segments=phaseRoutes(item.points,phase);
        segments.forEach(segment=>{
          const line=document.createElementNS(ns,'polyline');
          for(const [key,value] of Object.entries({points:segment.map(p=>xy(p).join(',')).join(' '),fill:'none',stroke:phaseColors[i%phaseColors.length],'stroke-width':5,'stroke-linejoin':'round'}))line.setAttribute(key,value);
          const title=document.createElementNS(ns,'title');title.textContent=phase.name;line.append(title);g.append(line);
        });
        // One number per phase, rather than one per disconnected GPS segment.
        const segment=segments.reduce((longest,current)=>current.length>longest.length?current:longest,[]);
        if(!segment.length)return;
        const point=xy(segment[Math.floor(segment.length/2)]),anchor=document.createElementNS(ns,'g');
        anchor.setAttribute('class','exercise-map-phase-label');anchor.dataset.x=point[0];anchor.dataset.y=point[1];
        anchor.setAttribute('transform',`translate(${point[0]},${point[1]})`);
        const fixed=document.createElementNS(ns,'g');fixed.setAttribute('data-map-fixed','');
        const label=document.createElementNS(ns,'text');label.setAttribute('x',7);label.setAttribute('y',-7);
        label.setAttribute('style',`font-size:10px;fill:${phaseColors[i%phaseColors.length]};paint-order:stroke;stroke:white;stroke-width:2px;font-weight:600`);
        label.textContent=String(i+1);fixed.append(label);anchor.append(fixed);g.append(anchor);
      });svg.insertBefore(g,el('exercise-map-selection'));
    }
    el('exercise-show-phases').onchange=event=>{
      document.querySelectorAll('.exercise-phase-overlay').forEach(g=>g.style.display=event.target.checked?'':'none');
      if(svg)updateMapAnnotations(svg);
    };
  }
  function normalize(payload) {
    const results = payload?.format === 'foulee-results-v1' ? payload.results : payload?.healthKit ? [payload] : payload?.samples || payload?.routes ? [{healthKit:payload}] : null;
    if (!Array.isArray(results) || results.length !== 1) throw new Error('Choisis un JSON contenant un seul exercice (format foulee-results-v1).');
    const result = results[0], detail = result?.healthKit;
    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) throw new Error('Le fichier ne contient pas les données détaillées de l’exercice (healthKit).');
    const start = time(detail.startDate || result.date);
    if (!Number.isFinite(start)) throw new Error('La date de début de l’exercice est absente ou invalide.');
    const duration = number(detail.elapsedSeconds) > 0 ? number(detail.elapsedSeconds) : (time(detail.endDate)-start)/1000;
    const at = date => (time(date)-start)/1000;
    const validAt = t => Number.isFinite(t) && t >= 0 && (!Number.isFinite(duration) || duration <= 0 || t <= duration+1);
    const points = (Array.isArray(detail.routes) ? detail.routes : []).map(route => (Array.isArray(route.points) ? route.points : []).map(p => ({t:at(p.timestamp),lat:number(p.latitude),lon:number(p.longitude),alt:number(p.altitudeMeters),speed:number(p.speedMetersPerSecond),accuracy:number(p.verticalAccuracyMeters)})).filter(p => validAt(p.t) && Math.abs(p.lat)<=90 && Math.abs(p.lon)<=180).sort((a,b)=>a.t-b.t)).filter(route=>route.length);
    const heart=[], cadence=[], paces=[];
    for (const sample of Array.isArray(detail.samples) ? detail.samples : []) {
      const t=at(sample.startDate), value=number(sample.value), identifier=String(sample.identifier || '');
      if(!validAt(t) || !Number.isFinite(value)) continue;
      if(identifier.endsWith('HeartRate') && value>0 && ['count/min','count/minute','bpm'].includes(sample.unit)) heart.push({t,v:value});
      if(identifier.endsWith('RunningSpeed')) {const v=speed(value,sample.unit); if(v>0) paces.push({t,v:1000/v});}
      if(identifier.endsWith('StepCount') && sample.unit === 'count' && value>=0) {
        const end=at(sample.endDate), span=end-t;
        if(span>0 && validAt(end)) cadence.push({t:t+span/2,v:value*60/span});
      }
    }
    if(!paces.length) for(const route of points) for(const p of route) if(p.speed>0) paces.push({t:p.t,v:1000/p.speed});
    const elevation=points.flatMap(route=>route.filter(p=>Number.isFinite(p.alt) && (!Number.isFinite(p.accuracy) || p.accuracy>=0)).map(p=>({t:p.t,v:p.alt})));
    for(const series of [heart,cadence,paces,elevation]) series.sort((a,b)=>a.t-b.t);
    let gain=0,loss=0, altitudePairs=0;
    for(const route of points) {
      let last=null;
      for(const p of route) {
        if(!Number.isFinite(p.alt) || (Number.isFinite(p.accuracy) && p.accuracy<0)) {last=null;continue;}
        if(last!==null) {const delta=p.alt-last;gain+=Math.max(0,delta);loss+=Math.max(0,-delta);altitudePairs++;} last=p.alt;
      }
    }
    const km=number(result.distanceKm)>=0 ? number(result.distanceKm) : number(detail.totalDistanceMeters)/1000;
    const seconds=number(detail.durationSeconds)>0 ? number(detail.durationSeconds) : number(result.durationMin)*60;
    const actualEnd=Math.max(1, Number.isFinite(duration) && duration>0 ? duration : 0, [heart,cadence,paces,elevation].reduce((max,series)=>Math.max(max,series.at(-1)?.t || 0),0), points.reduce((max,route)=>Math.max(max,route.at(-1)?.t || 0),0));
    return {id:String(result.healthWorkoutId || detail.uuid || `exercise-${start}`),date:detail.startDate || result.date, title:String(result.name || 'Exercice importé'),km:Number.isFinite(km)?km:null,seconds:Number.isFinite(seconds)?seconds:null,end:actualEnd,phases:normalizePhases(detail.activities,start,actualEnd),points,heart,cadence,paces,elevation,gain:altitudePairs?gain:null,loss:altitudePairs?loss:null,warnings:Array.isArray(payload.warnings)?payload.warnings.map(String):[]};
  }
  // Ground distance on the sphere, in metres (not the 3D distance along the slope).
  function groundDistance(a, b) {
    const radians = Math.PI / 180;
    const dLat = (b.lat-a.lat)*radians, dLon = (b.lon-a.lon)*radians;
    const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(dLon/2)**2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
  }
  function calculateGrade(routes, windowMeters=100) {
    const grade=[];
    if(!Number.isFinite(windowMeters) || windowMeters<=0)return grade;
    for(const route of routes) {
      let segment=[], distance=0, anchor=0, segmentStart=true;
      for(const point of route) {
        if(!Number.isFinite(point.alt) || !Number.isFinite(point.lat) || !Number.isFinite(point.lon) || !Number.isFinite(point.t) || (Number.isFinite(point.accuracy) && point.accuracy<0)) {
          segment=[];distance=0;anchor=0;segmentStart=true;continue;
        }
        const previous=segment.at(-1);
        if(previous) {
          // Do not infer a slope across a GPS outage, a route boundary or a pause.
          if(point.t<=previous.t || point.t-previous.t>120) {segment=[];distance=0;anchor=0;segmentStart=true;}
          else {
            const step=groundDistance(previous,point);
            if(step<1) continue; // Avoid dividing by stationary GPS jitter.
            distance+=step;
          }
        }
        segment.push({...point,d:distance});
        if(distance<windowMeters) continue;
        const target=distance-windowMeters;
        while(anchor+1<segment.length && segment[anchor+1].d<target) anchor++;
        const before=segment[anchor], after=segment[anchor+1];
        if(!after || after.d===before.d) continue;
        const altitude=before.alt+(after.alt-before.alt)*(target-before.d)/(after.d-before.d);
        grade.push({t:point.t,v:100*(point.alt-altitude)/windowMeters,breakBefore:segmentStart});
        segmentStart=false;
      }
    }
    return grade.sort((a,b)=>a.t-b.t);
  }
  function chartGeometry(series, end, inverted=false) {
    const low=series.reduce((m,p)=>Math.min(m,p.v),Infinity), high=series.reduce((m,p)=>Math.max(m,p.v),-Infinity);
    const x=t=>62+t/end*390;
    const y=v=>high-low<1e-6 ? 112.5 : inverted ? 45+(v-low)/(high-low)*135 : 180-(v-low)/(high-low)*135;
    return {low,high,x,y,top:inverted?low:high,bottom:inverted?high:low};
  }
  // Lookup in the original series, even when the drawn curve is simplified.
  function nearestSample(series, target) {
    let low=0,high=series.length;
    while(low<high) {const mid=(low+high)>>1;if(series[mid].t<target)low=mid+1;else high=mid;}
    if(low===0)return 0;
    if(low===series.length)return low-1;
    return target-series[low-1].t<=series[low].t-target?low-1:low;
  }
  // Read the common instant on the line, without inventing values outside its domain.
  function sampleAtTime(series, target) {
    if(!series.length || target<series[0].t || target>series.at(-1).t)return null;
    const index=nearestSample(series,target),nearest=series[index];
    if(Math.abs(nearest.t-target)<1e-7)return {...nearest,estimated:false};
    const before=nearest.t<target?nearest:series[index-1],after=nearest.t>target?nearest:series[index+1];
    if(!before || !after || after.breakBefore || after.t<=before.t)return null;
    const ratio=(target-before.t)/(after.t-before.t);
    return {t:target,v:before.v+(after.v-before.v)*ratio,estimated:true};
  }
  function gpsAtTime(routes, target) {
    for(const route of routes) {
      if(!route.length || target<route[0].t || target>route.at(-1).t)continue;
      const index=nearestSample(route,target),nearest=route[index];
      if(Math.abs(nearest.t-target)<1e-7)return {...nearest,estimated:false};
      const before=nearest.t<target?nearest:route[index-1],after=nearest.t>target?nearest:route[index+1];
      if(!before || !after || after.t-before.t>120 || after.t<=before.t)continue;
      const ratio=(target-before.t)/(after.t-before.t),delta=((after.lon-before.lon+540)%360)-180;
      return {t:target,lat:before.lat+(after.lat-before.lat)*ratio,lon:((before.lon+delta*ratio+540)%360)-180,estimated:true};
    }
    return null;
  }
  function chartSamples(series) {
    const draw=[]; const size=Math.max(1,Math.ceil(series.length/600));
    for(let i=0;i<series.length;i+=size) {
      const bucket=series.slice(i,i+size),first=bucket[0],last=bucket.at(-1);
      const min=bucket.reduce((a,b)=>a.v<b.v?a:b),max=bucket.reduce((a,b)=>a.v>b.v?a:b);
      draw.push(...[...new Set([first,min,max,last,...bucket.filter(p=>p.breakBefore)])].sort((a,b)=>a.t-b.t));
    }
    return draw;
  }
  function chart(title, series, unit, color, end, format=fmt, note='', options={}) {
    const key=options.key;
    if (!series.length) return `<section class="panel exercise-chart" data-chart-key="${key}"><h3>${title}</h3><p class="exercise-missing">${esc(options.empty || 'Aucune mesure disponible dans ce fichier.')}</p></section>`;
    const {low,high,x,y,top,bottom}=chartGeometry(series,end,options.inverted);
    // Preserve peaks without piling a circle onto each measurement.
    const draw=chartSamples(series);
    const path=draw.map((p,i)=>`${i && !p.breakBefore?'L':'M'}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
    return `<section class="panel exercise-chart" data-chart-key="${key}"><h3>${title} <small>${unit}</small></h3><p class="exercise-range">${format(low)} – ${format(high)} ${unit}</p><svg class="exercise-interactive-chart" viewBox="0 0 480 225" tabindex="0" role="slider" aria-label="${esc(title)} : choisir un instant de la séance" aria-valuemin="0" aria-valuemax="${end}" aria-valuenow="0" aria-describedby="exercise-readout-${key}" data-inverted="${Boolean(options.inverted)}"><path d="M62 45H452 M62 112H452 M62 180H452" stroke="#e3e8ef" stroke-width="0.6" vector-effect="non-scaling-stroke" fill="none"/><text x="6" y="49">${esc(format(top))}</text><text x="6" y="184">${esc(format(bottom))}</text><path class="exercise-curve" d="${path}" stroke="${color}" stroke-width="1.2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" fill="none"/>${series.length===1?`<circle cx="${x(series[0].t)}" cy="${y(series[0].v)}" r="2" fill="${color}"/>`:''}<g class="exercise-chart-selection" visibility="hidden" pointer-events="none"><line y1="45" y2="180" stroke="${color}" stroke-width="0.8" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/><circle r="3.5" fill="white" stroke="${color}" stroke-width="1.4" vector-effect="non-scaling-stroke"/></g><text x="62" y="211">0:00</text><text x="230" y="211">${clock(end/2)}</text><text x="410" y="211">${clock(end)}</text></svg><output class="exercise-chart-readout" id="exercise-readout-${key}" aria-live="polite">Clique ou touche la courbe pour lire une valeur.</output><p class="exercise-chart-note">Temps écoulé depuis le départ. Le curseur suit le même instant sur toutes les courbes et la carte. ${esc(note)}</p></section>`;
  }
  function bindChart(definition, selectTime) {
    const {key,series,unit,end,format,inverted}=definition;
    if(!series.length)return ()=>{};
    const panel=document.querySelector(`[data-chart-key="${key}"]`),svg=panel.querySelector('svg'),selection=panel.querySelector('.exercise-chart-selection');
    const output=panel.querySelector('output'),{x,y}=chartGeometry(series,end,inverted);
    let selectedTime=null;
    function update(target) {
      selectedTime=target;
      const sample=sampleAtTime(series,target),px=x(target);
      selection.setAttribute('visibility','visible');
      const line=selection.querySelector('line'),marker=selection.querySelector('circle');
      line.setAttribute('x1',px);line.setAttribute('x2',px);
      marker.setAttribute('visibility',sample?'visible':'hidden');
      if(sample) {marker.setAttribute('cx',px);marker.setAttribute('cy',y(sample.v));}
      output.textContent=sample?`${clock(target)} · ${format(sample.v)} ${unit}${sample.estimated?' · estimé entre deux mesures':''}`:`${clock(target)} · Aucune mesure à cet instant`;
      output.classList.toggle('has-value',Boolean(sample));
      svg.setAttribute('aria-valuenow',target);svg.setAttribute('aria-valuetext',output.textContent);
    }
    svg.addEventListener('click',event=>{
      const matrix=svg.getScreenCTM();if(!matrix)return;
      const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
      const position=point.matrixTransform(matrix.inverse());
      const target=Math.max(0,Math.min(end,(position.x-62)/390*end));
      selectTime(series[nearestSample(series,target)].t);
    });
    svg.addEventListener('keydown',event=>{
      const current=selectedTime===null?-1:nearestSample(series,selectedTime);
      let next;
      if(event.key==='ArrowRight' || event.key==='ArrowUp')next=current<0?0:series[current].t<=selectedTime?current+1:current;
      else if(event.key==='ArrowLeft' || event.key==='ArrowDown')next=current<0?series.length-1:series[current].t>=selectedTime?current-1:current;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=series.length-1;
      else return;
      event.preventDefault();selectTime(series[Math.max(0,Math.min(series.length-1,next))].t);
    });
    return update;
  }
  function bindInspection(item, charts) {
    const memoryKey=`${context.athleteId}:${item.id}`;
    const mapSvg=el('exercise-route-map'),mapMarker=el('exercise-map-selection'),mapOutput=el('exercise-map-readout');
    function selectTime(target) {
      target=Math.max(0,Math.min(item.end,target));
      inspections.set(memoryKey,target);
      updates.forEach(update=>update(target));
      el('exercise-selected-time').textContent=`Instant sélectionné : ${clock(target)}`;
      const position=gpsAtTime(item.points,target);
      if(!position || !mapSvg) {
        if(mapMarker)mapMarker.setAttribute('visibility','hidden');
        const popup=el('exercise-map-popup');if(popup)popup.hidden=true;
        mapOutput.textContent=`${clock(target)} · Position GPS indisponible à cet instant`;
        mapOutput.classList.remove('has-value');return;
      }
      const {origin,scale,cx,cy}=mapSvg.dataset;
      const projectedX=Number(origin)+((position.lon-Number(origin)+540)%360)-180;
      const projectedY=-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,position.lat))*Math.PI/360))*180/Math.PI;
      mapMarker.setAttribute('transform',`translate(${360+(projectedX-Number(cx))*Number(scale)},${170+(projectedY-Number(cy))*Number(scale)})`);
      mapMarker.setAttribute('visibility','visible');mapMarker.dataset.time=target;
      mapMarker.dataset.x=360+(projectedX-Number(cx))*Number(scale);
      mapMarker.dataset.y=170+(projectedY-Number(cy))*Number(scale);
      const popup=el('exercise-map-popup');
      if(popup){popup.innerHTML=mapPopupContent(item,target,charts.find(def=>def.key==='grade')?.series);popup.hidden=false;updateMapPopup(mapSvg);}
      mapOutput.textContent=`${clock(target)} · ${fmt(position.lat,5)}, ${fmt(position.lon,5)}${position.estimated?' · position estimée entre deux points GPS':''}`;
      mapOutput.classList.add('has-value');
    }
    const overlay=document.createElement('section');overlay.className='panel exercise-chart exercise-overlay';
    overlay.innerHTML='<h3>Évolution des données</h3><p>Chaque courbe utilise sa propre échelle : compare leur évolution. Les valeurs et unités sont indiquées ci-dessous. Pour l’allure, le plus rapide est en haut.</p><svg viewBox="0 0 480 225" tabindex="0" role="slider" aria-label="Courbes superposées : choisir un instant" aria-valuemin="0" aria-valuemax="'+item.end+'" aria-valuenow="0"><path d="M62 45H452 M62 112H452 M62 180H452" stroke="currentColor" opacity=".15" fill="none"/>'+charts.filter(def=>def.series.length).map(def=>{
      const {x,y}=chartGeometry(def.series,item.end,def.inverted);
      return '<g data-overlay-key="'+def.key+'"><path d="'+chartSamples(def.series).map((p,i)=>(i&&!p.breakBefore?'L':'M')+x(p.t).toFixed(2)+','+y(p.v).toFixed(2)).join(' ')+'" stroke="'+def.color+'" stroke-width="1.7" vector-effect="non-scaling-stroke" fill="none"/></g>';
    }).join('')+'<line class="overlay-cursor" y1="45" y2="180" stroke="currentColor" stroke-dasharray="3 4" visibility="hidden"/><text x="62" y="211">0:00</text><text x="230" y="211">'+clock(item.end/2)+'</text><text x="410" y="211">'+clock(item.end)+'</text></svg><div class="overlay-legend">'+charts.filter(def=>def.series.length).map(def=>{const {low,high}=chartGeometry(def.series,item.end,def.inverted);return '<div data-overlay-key="'+def.key+'" style="--series-color:'+def.color+'"><b>'+esc(def.title)+'</b><span>'+esc(def.format(low))+' – '+esc(def.format(high))+' '+def.unit+'</span><output></output></div>';}).join('')+'</div>';
    el('exercise-detail').querySelector('.exercise-charts').append(overlay);
    const svg=overlay.querySelector('svg');let overlayTime=0;
    svg.onclick=event=>{const matrix=svg.getScreenCTM();if(!matrix)return;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;selectTime(Math.max(0,Math.min(item.end,(point.matrixTransform(matrix.inverse()).x-62)/390*item.end)));};
    svg.onkeydown=event=>{let target;if(event.key==='Home')target=0;else if(event.key==='End')target=item.end;else if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(event.key))target=overlayTime+(['ArrowLeft','ArrowDown'].includes(event.key)?-1:1)*item.end/100;else return;event.preventDefault();selectTime(target);};
    const updates=charts.map(def=>bindChart(def,selectTime));
    updates.push(target=>{overlayTime=target;const line=overlay.querySelector('.overlay-cursor');line.setAttribute('visibility','visible');line.setAttribute('x1',62+target/item.end*390);line.setAttribute('x2',62+target/item.end*390);svg.setAttribute('aria-valuenow',target);svg.setAttribute('aria-valuetext',clock(target));charts.filter(def=>def.series.length).forEach(def=>{const sample=sampleAtTime(def.series,target);overlay.querySelector('.overlay-legend [data-overlay-key="'+def.key+'"] output').textContent=sample?clock(target)+' · '+def.format(sample.v)+' '+def.unit+(sample.estimated?' · estimé':''):'Aucune mesure à cet instant';});});
    if(inspections.has(memoryKey))selectTime(inspections.get(memoryKey));
  }
  function map(routes) {
    const all=routes.flat();
    if(!all.length) return '<section class="panel exercise-map"><h3>Parcours GPS</h3><p class="exercise-missing">Aucune trace GPS disponible dans ce fichier.</p><output id="exercise-map-readout" class="exercise-chart-readout" aria-live="polite">Sélectionne un instant sur une courbe.</output></section>';
    // Mercator projection; wrap longitudes around the start for date-line crossings.
    const origin=all[0].lon;
    const project=p=>({x:origin+((p.lon-origin+540)%360)-180,y:-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,p.lat))*Math.PI/360))*180/Math.PI});
    const projected=routes.map(route=>route.map(project)),flat=projected.flat();
    const minX=flat.reduce((m,p)=>Math.min(m,p.x),Infinity),maxX=flat.reduce((m,p)=>Math.max(m,p.x),-Infinity),minY=flat.reduce((m,p)=>Math.min(m,p.y),Infinity),maxY=flat.reduce((m,p)=>Math.max(m,p.y),-Infinity);
    const fit=Math.min(620/(maxX-minX || .001),270/(maxY-minY || .001));
    const zoom=Math.max(0,Math.min(18,Math.floor(Math.log2(fit*360/256))));
    const scale=256*2**zoom/360,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const xy=p=>[360+(p.x-cx)*scale,170+(p.y-cy)*scale];
    const first=xy(flat[0]),last=xy(flat.at(-1));
    return `<section class="panel exercise-map"><h3>Parcours GPS</h3><div class="exercise-map-controls" role="group" aria-label="Zoom de la carte"><button type="button" id="exercise-map-zoom-in" aria-label="Agrandir la carte">+</button><button type="button" id="exercise-map-zoom-out" aria-label="Réduire la carte">−</button><button type="button" id="exercise-map-reset">Voir tout le parcours</button></div><div class="exercise-map-viewport"><div id="exercise-vector-basemap" aria-hidden="true"></div><svg id="exercise-route-map" data-origin="${origin}" data-scale="${scale}" data-cx="${cx}" data-cy="${cy}" viewBox="0 0 720 340" tabindex="0" aria-describedby="exercise-map-help" role="img" aria-label="Tracé géographique GPS de l’exercice, nord en haut"><defs><pattern id="exercise-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#dce5ed"/></pattern></defs><rect x="-100000" y="-100000" width="200000" height="200000" fill="#f0f5f8"/><rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#exercise-grid)"/><g id="exercise-tiles"></g>${projected.map(route=>`<polyline points="${route.map(p=>xy(p).join(',')).join(' ')}" fill="none" stroke="#1760a7" stroke-width="3" stroke-linejoin="round"/>`).join('')}<g class="exercise-map-endpoint" data-x="${first[0]}" data-y="${first[1]}" transform="translate(${first[0]},${first[1]})"><g data-map-fixed><circle r="4" fill="#588bc4" stroke="white" stroke-width="1.5"/><title>Départ</title></g></g><g class="exercise-map-endpoint" data-x="${last[0]}" data-y="${last[1]}" transform="translate(${last[0]},${last[1]})"><g data-map-fixed><circle r="4" fill="#ef774d" stroke="white" stroke-width="1.5"/><title>Arrivée</title></g></g><g id="exercise-map-selection" visibility="hidden" pointer-events="none"><g data-map-fixed><circle r="8" fill="#c63d43" opacity=".18"/><circle r="4" fill="#c63d43" stroke="white" stroke-width="1.5"/><title>Position à l’instant sélectionné</title></g></g><text x="680" y="30">N ↑</text></svg><label class="exercise-basemap-choice map-layers-button" for="exercise-basemap-style"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 9-5 9 5-9 5Z M3 12l9 5 9-5 M3 17l9 5 9-5"/></svg><span>Calques</span><select aria-label="Fond de carte" id="exercise-basemap-style"><option value="none">Sans fond · hors connexion</option>${Object.entries(mapStyles).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}<option value="osm">OpenStreetMap · original</option></select></label><div id="exercise-map-popup" class="exercise-map-popup" role="status" aria-live="polite" hidden></div></div><p id="exercise-map-help" class="exercise-chart-note">Utilise + / − pour zoomer. Sur iPhone, pince avec deux doigts. Fais glisser la carte pour te déplacer.</p><output id="exercise-map-readout" class="exercise-chart-readout" aria-live="polite">Sélectionne un instant sur une courbe pour situer ta position.</output><p class="exercise-chart-note"><span class="exercise-start">● Départ</span> · <span class="exercise-finish">● Arrivée</span> · <span class="exercise-position">● Instant sélectionné</span> · ${fmt(all.length)} points</p><p class="exercise-chart-note" id="exercise-map-credit">Tracé GPS disponible hors connexion. Le fond de carte nécessite Internet.</p><p class="exercise-chart-note">Départ : ${fmt(all[0].lat,5)}, ${fmt(all[0].lon,5)} · Arrivée : ${fmt(all.at(-1).lat,5)}, ${fmt(all.at(-1).lon,5)}</p></section>`;
  }
  function mapPopupContent(item,target,grade=calculateGrade(item.points||[])) {
    const metrics=[['FC',item.heart,'bpm',value=>fmt(value)],['Allure',item.paces,'/km',pace],['Altitude',item.elevation,'m',value=>fmt(value,1)],['Pente',grade,'%',value=>`${value>0?'+':''}${fmt(value,1)}`]];
    let estimated=false;
    const rows=metrics.map(([label,series,unit,format])=>{
      const sample=sampleAtTime(series||[],target);estimated ||= Boolean(sample?.estimated);
      return `<div><span>${label}</span><b>${sample?`${sample.estimated?'≈ ':''}${format(sample.v)} ${unit}`:'—'}</b></div>`;
    }).join('');
    return `<strong>${clock(target)}</strong>${rows}${estimated?'<small>≈ valeur interpolée</small>':''}`;
  }
  function updateMapPopup(svg) {
    const popup=el('exercise-map-popup'),marker=el('exercise-map-selection');
    if(!popup || popup.hidden || !marker)return;
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const point=new DOMPoint(Number(marker.dataset.x),Number(marker.dataset.y)).matrixTransform(matrix);
    const box=svg.getBoundingClientRect(),container=popup.parentElement.getBoundingClientRect();
    if(point.x<box.left || point.x>box.right || point.y<box.top || point.y>box.bottom){popup.style.visibility='hidden';return;}
    popup.style.visibility='visible';
    const width=popup.offsetWidth,height=popup.offsetHeight;
    const left=Math.max(6,Math.min(container.width-width-6,point.x-container.left+12));
    const above=point.y-container.top-height-12;
    const top=Math.max(6,Math.min(container.height-height-6,above>=6?above:point.y-container.top+12));
    popup.style.left=`${left}px`;popup.style.top=`${top}px`;
  }
  function updateMapAnnotations(svg) {
    const matrix=svg.getScreenCTM();if(!matrix || !matrix.a)return;
    const inverse=1/Math.abs(matrix.a),box=svg.getBoundingClientRect();
    svg.querySelectorAll('[data-map-fixed]').forEach(node=>node.setAttribute('transform',`scale(${inverse})`));
    const project=node=>new DOMPoint(Number(node.dataset.x),Number(node.dataset.y)).matrixTransform(matrix);
    const occupied=[...svg.querySelectorAll('.exercise-map-endpoint')].map(project);
    const candidates=[...svg.querySelectorAll('.exercise-map-phase-label')].map(node=>({node,point:project(node)}));
    candidates.forEach(({node})=>node.style.display='none');
    const visible=candidates.filter(({point})=>point.x>=box.left+12 && point.x<=box.right-24 && point.y>=box.top+18 && point.y<=box.bottom-12);
    // Spread a maximum of eight labels over the visible phases, then avoid collisions.
    const stride=Math.max(1,Math.ceil(visible.length/8));
    visible.forEach(({node,point},index)=>{
      if(index%stride || occupied.some(other=>Math.hypot(point.x-other.x,point.y-other.y)<36))return;
      node.style.display='';occupied.push(point);
    });
  }
  function bindMapNavigation() {
    mapResizeObserver?.disconnect();
    const svg=el('exercise-route-map');if(!svg)return;

    let bounds={x:0,y:0,w:720,h:340},view={...bounds},tilesEnabled=false,vectorMap=null,revision=0,disposed=false,loadTimer;
    const viewport=svg.parentElement,selector=el('exercise-basemap-style'),credit=el('exercise-map-credit'),host=el('exercise-vector-basemap');
    const attribution='© <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
    function syncVector() {
      if(!vectorMap || !svg.isConnected)return;
      const width=svg.getBoundingClientRect().width;if(!width)return;
      vectorMap.resize();vectorMap.jumpTo(basemapCamera(svg,view,width));
    }
    function removeVector() {clearTimeout(loadTimer);viewport.classList.remove('has-vector-map');if(vectorMap){vectorMap.remove();vectorMap=null;}host.replaceChildren();}
    basemapCleanup=()=>{disposed=true;revision++;removeVector();mapResizeObserver?.disconnect();};
    if(typeof ResizeObserver!=='undefined'){mapResizeObserver=new ResizeObserver(resizeView);mapResizeObserver.observe(svg);}
    const pointers=new Map(), zoomIn=el('exercise-map-zoom-in'),zoomOut=el('exercise-map-zoom-out');
    function updateTiles() {
      if(!tilesEnabled)return;
      const base=Number(svg.dataset.scale),cx=Number(svg.dataset.cx),cy=Number(svg.dataset.cy);
      const level=Math.max(0,Math.min(19,Math.floor(Math.log2(base*720/view.w*360/256))));
      const count=2**level,degrees=360/count,size=degrees*base,tiles=[];
      const left=cx+(view.x-360)/base,right=cx+(view.x+view.w-360)/base;
      const top=cy+(view.y-170)/base,bottom=cy+(view.y+view.h-170)/base;
      for(let tx=Math.floor((left+180)/degrees);tx<=Math.floor((right+180)/degrees);tx++){
        for(let ty=Math.max(0,Math.floor((top+180)/degrees));ty<=Math.min(count-1,Math.floor((bottom+180)/degrees));ty++){
          tiles.push(`<image x="${360+(tx*degrees-180-cx)*base}" y="${170+(ty*degrees-180-cy)*base}" width="${size}" height="${size}" href="https://tile.openstreetmap.org/${level}/${((tx%count)+count)%count}/${ty}.png"/>`);
        }
      }
      const layer=el('exercise-tiles'),markup=tiles.join('');
      if(layer.dataset.visibleTiles===markup)return;
      layer.dataset.visibleTiles=markup;layer.innerHTML=markup;
      layer.querySelectorAll('image').forEach(tile=>tile.addEventListener('error',()=>tile.remove()));
    }
    function apply(next) {
      next.x=Math.max(bounds.x,Math.min(bounds.x+bounds.w-next.w,next.x));next.y=Math.max(bounds.y,Math.min(bounds.y+bounds.h-next.h,next.y));
      view=next;svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
      zoomIn.disabled=view.w<=45+1e-6;zoomOut.disabled=view.w>=720-1e-6;
      updateTiles();syncVector();updateMapAnnotations(svg);updateMapPopup(svg);
    }
    function zoom(factor,anchor={x:view.x+view.w/2,y:view.y+view.h/2}) {
      const w=Math.max(45,Math.min(720,view.w/factor)),ratio=w/view.w;
      apply({x:anchor.x-(anchor.x-view.x)*ratio,y:anchor.y-(anchor.y-view.y)*ratio,w,h:bounds.h*w/bounds.w});
    }
    zoomIn.onclick=()=>zoom(2);zoomOut.onclick=()=>zoom(.5);
    el('exercise-map-reset').onclick=()=>apply({...bounds});
    const center=points=>({x:points.reduce((sum,p)=>sum+p.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.y,0)/points.length});
    const distance=points=>points.length<2?0:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
    svg.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener('pointermove',event=>{
      if(!pointers.has(event.pointerId))return;
      const before=[...pointers.values()].slice(0,2),oldCenter=center(before),oldDistance=distance(before);
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      const after=[...pointers.values()].slice(0,2),newCenter=center(after),newDistance=distance(after);
      const matrix=svg.getScreenCTM();if(!matrix)return;
      const anchor=new DOMPoint(oldCenter.x,oldCenter.y).matrixTransform(matrix.inverse());
      const factor=oldDistance>0&&newDistance>0?newDistance/oldDistance:1;
      const w=Math.max(45,Math.min(720,view.w/factor)),ratio=w/view.w;
      apply({x:anchor.x-(anchor.x-view.x)*ratio-(newCenter.x-oldCenter.x)/matrix.a*ratio,
        y:anchor.y-(anchor.y-view.y)*ratio-(newCenter.y-oldCenter.y)/matrix.d*ratio,w,h:bounds.h*w/bounds.w});
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>svg.addEventListener(type,event=>pointers.delete(event.pointerId)));
    svg.addEventListener('keydown',event=>{
      if(event.key==='+'||event.key==='='){event.preventDefault();zoom(2);}
      else if(event.key==='-'){event.preventDefault();zoom(.5);}
      else if(event.key==='0'){event.preventDefault();apply({...bounds});}
      else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();apply({...view,x:view.x+(event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0)*view.w*.15,y:view.y+(event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0)*view.h*.15});
      }
    });
    selector.onchange=async()=>{
      const style=selector.value,request=++revision;
      removeVector();tilesEnabled=style==='osm';
      el('exercise-tiles').replaceChildren();delete el('exercise-tiles').dataset.visibleTiles;
      try {localStorage.setItem('foulee.basemap',style);} catch {}
      if(style==='none'){credit.textContent='Tracé GPS disponible hors connexion. Le fond de carte nécessite Internet.';return;}
      if(style==='osm'){updateTiles();credit.innerHTML='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · Le tracé reste visible si le fond ne charge pas.';return;}
      credit.textContent='Chargement du fond de carte…';
      const failed=()=>{
        if(disposed || request!==revision)return;
        revision++;removeVector();credit.textContent='Fond de carte indisponible. Le tracé reste visible. Vérifie Internet ou choisis un autre fond pour réessayer.';
      };
      loadTimer=setTimeout(failed,20000);
      try {
        const library=await loadMapLibrary();
        if(disposed || request!==revision || !svg.isConnected)return;
        vectorMap=new library.Map({container:host,style:'https://tiles.openfreemap.org/styles/'+style,interactive:false,attributionControl:false,renderWorldCopies:true,minZoom:-2,maxZoom:24,...basemapCamera(svg,view,svg.getBoundingClientRect().width)});
        vectorMap.on('load',()=>{
          if(disposed || request!==revision)return;
          clearTimeout(loadTimer);viewport.classList.add('has-vector-map');syncVector();credit.innerHTML=attribution;
        });
        vectorMap.on('error',()=>{
          if(disposed || request!==revision)return;
          credit.innerHTML=attribution+' · Certaines données du fond ne sont pas disponibles. Le tracé GPS reste visible.';
        });
      } catch {failed();}
    };
    let saved='none';try {saved=localStorage.getItem('foulee.basemap') || 'none';} catch {}
    selector.value=saved==='osm' || mapStyles[saved]?saved:'none';
    if(selector.value!=='none')selector.onchange();
    function resizeView() {
      const box=svg.getBoundingClientRect();if(!box.width || !box.height)return;
      const height=720*box.height/box.width;
      bounds={x:0,y:(340-height)/2,w:720,h:height};
      const h=height*view.w/720;
      apply({...view,y:view.y+view.h/2-h/2,h});
      const installed=window.matchMedia('(max-width: 700px)').matches || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
      el('exercise-map-help').textContent=installed?'Pince avec deux doigts pour zoomer. Fais glisser la carte pour te déplacer.':'Utilise + / − pour zoomer. Sur iPhone, pince avec deux doigts. Fais glisser la carte pour te déplacer.';
    }
    resizeView();
  }
  function read() {try {const data=JSON.parse(context.read(storageKey));return Array.isArray(data)?data:[];} catch {return [];}}
  // Pure, deterministic interpretation. Phase roles require explicit user mapping.
  function plannedBlocks(planned) {
    if(Array.isArray(planned?.phases)&&planned.phases.length){const ids=new Set();return planned.phases.every(phase=>phase.id&&!ids.has(phase.id)&&ids.add(phase.id)&&Number(phase.seconds)>0)?planned.phases.map(phase=>({...phase,work:phase.work!==false})):[];}
    const s=planned?.structure;
    if(!s || !Number.isInteger(number(s.reps)) || s.reps<1 || s.reps>30 || !(number(s.workMin)>0))return [];
    if(['warmupMin','recoveryMin','cooldownMin'].some(k=>!Number.isFinite(number(s[k])) || number(s[k])<0))return [];
    const blocks=[];
    const add=(id,name,minutes,work=false)=>{if(minutes>0)blocks.push({id,name,seconds:minutes*60,work});};
    add('warmup','Échauffement',s.warmupMin);
    for(let i=0;i<s.reps;i++){
      add(`work-${i+1}`,'Travail',s.workMin,true);
      if(i<s.reps-1)add(`recovery-${i+1}`,'Récupération',s.recoveryMin);
    }
    add('cooldown','Retour au calme',s.cooldownMin);
    return blocks;
  }
  function interpret(item, planned, criteria={}) {
    const bounded=(v,f,min,max)=>Number.isFinite(number(v))&&number(v)>=min&&number(v)<=max?number(v):f;
    const tolerance=bounded(criteria.tolerance,15,1,100),paceTolerance=bounded(criteria.paceTolerance,5,1,100);
    const effort=bounded(criteria.effort,8,1,10),checks=[],missing=[];
    const compare=(id,name,actual,expected,limit)=>{
      if(!Number.isFinite(number(actual)) || !Number.isFinite(number(expected)) || !(number(actual)>0) || !(number(expected)>0)){missing.push(`${name} : données insuffisantes.`);return;}
      const delta=(actual-expected)/expected*100;
      checks.push({id,name,actual,expected,delta,status:Math.abs(delta)>limit?'outside':'within',limit});
    };
    if(planned)compare('duration','Durée totale',item.seconds,number(planned.duration)*60,tolerance);
    else missing.push('Aucune séance prévue associée.');
    const blocks=plannedBlocks(planned),phases=Array.isArray(item.phases)?item.phases:[];
    const mapping=item.phaseMapping || {};
    const match=/^\s*(\d{1,2})[:′’'](\d{2})\s*\/km\s*$/.exec(planned?.target || '');
    const targetPace=match&&Number(match[2])<60?Number(match[1])*60+Number(match[2]):null;
    const mapped=new Set();
    for(const block of blocks){
      const matches=phases.filter((phase,i)=>mapping[String(i)]===block.id);
      if(matches.length!==1){missing.push(`${block.name} : ${matches.length?'association ambiguë':'phase non associée'}.`);continue;}
      const phase=matches[0];mapped.add(block.id);
      compare(block.id+'-duration',block.name+' · durée',phase.seconds,block.seconds,tolerance);
      if(block.work){
        const blockMatch=/^\s*(\d{1,2})[:′’'](\d{2})/.exec(block.target || '');const blockPace=blockMatch?Number(blockMatch[1])*60+Number(blockMatch[2]):targetPace;
        if(blockPace>0)compare(block.id+'-pace',block.name+' · allure (s/km)',number(phase.seconds)/number(phase.km),blockPace,paceTolerance);
        else missing.push(`${block.name} : objectif d’allure numérique indisponible.`);
      }
    }
    if(planned&&!blocks.length)missing.push('Structure des blocs indisponible ou invalide.');
    if(phases.some((phase,i)=>!blocks.some(b=>b.id===mapping[String(i)])))missing.push('Certaines phases importées ne sont pas associées.');
    const signals=[];
    const rpe=number(item.feedback?.rpe);
    if(rpe>=effort&&rpe<=10)signals.push(`Effort perçu élevé : ${rpe}/10 (seuil ${effort}/10).`);
    if(item.feedback?.feeling==='difficile')signals.push('Séance vécue comme difficile.');
    const outside=checks.filter(c=>c.status==='outside');
    const reasons=[...outside.map(c=>`${c.name} : écart ${c.delta>0?'+':''}${fmt(c.delta,1)} % (tolérance ±${c.limit} %).`),...signals];
    const review=reasons.length>0;
    const label=review?'À réexaminer':!planned?'Séance non associée':!checks.length?'Données insuffisantes':missing.length?'Analyse partielle · critères mesurés respectés':'Critères mesurés respectés';
    return {version:1,checks,missing,reasons,review,label,blocks,mappedCount:mapped.size,
      suggestion:review?'Examiner les écarts et le ressenti avant de modifier les prochaines séances.':'Conserver le plan sous réserve des éléments non évalués.'};
  }
  function assess(item, planned, criteria={}) {
    const tolerance=Number(criteria.tolerance) || 15, effort=Number(criteria.effort) || 8;
    const delta=planned?.duration>0 && item.seconds>0 ? (item.seconds/60-planned.duration)/planned.duration*100 : null;
    const reasons=[];
    if(delta!==null && Math.abs(delta)>tolerance) reasons.push(`Écart de durée : ${delta>0?'+':''}${fmt(delta,1)} % (seuil ±${tolerance} %).`);
    if(Number(item.feedback?.rpe)>=effort) reasons.push(`Effort perçu élevé : ${item.feedback.rpe}/10 (seuil ${effort}/10).`);
    if(item.feedback?.feeling==='difficile') reasons.push('Séance vécue comme difficile.');
    return {delta,reasons,review:reasons.length>0,label:!planned?'Séance non associée':delta===null?'Données insuffisantes':reasons.length?'À réexaminer':'Durée conforme aux critères'};
  }
  function llmContext(item, assessment, planned, profile={}) {
    return {version:1,readingVersion:2,coaching:{sessionName:planned?.name || '',target:planned?.target || '',goal:profile.goal || '',level:profile.level || ''},label:assessment.label,checks:assessment.checks,missing:assessment.missing,
      reasons:assessment.reasons,feedback:{feeling:item.feedback?.feeling || '',rpe:item.feedback?.rpe ?? null,note:item.feedback?.note || ''}};
  }
  function bindLocalLLM(section, item, assessment, planned) {
    const panel=document.createElement('section');panel.className='feedback-local-llm';
    const profile=typeof loadProfile==='function'?loadProfile():{};
    const input=llmContext(item,assessment,planned,profile),fingerprint=JSON.stringify(input);
    const conversations=Array.isArray(item.llmConversations)?item.llmConversations.slice():[];
    if(item.llmReading && !conversations.some(c=>c.createdAt===item.llmReading.createdAt)){
      conversations.push({...item.llmReading,id:item.llmReading.createdAt || 'legacy',messages:[],context:null});
    }
    let active=conversations.slice().reverse().find(c=>c.fingerprint===fingerprint),busy=false;
    panel.innerHTML='<div class="llm-heading"><div><span class="llm-eyebrow">COACH LOCAL</span><h3>Le dialogue de ta séance</h3></div><span class="llm-save-label">Enregistré avec la séance</span></div><p>Comprends ta séance, apporte une précision et approfondis les conseils.</p><div class="llm-controls"><button type="button" class="secondary-button" data-llm-connect>Connecter au LLM du Mac</button><label>Modèle local<select data-llm-model disabled><option value="">Connexion nécessaire</option></select></label><button type="button" class="primary-button" data-llm-analyze disabled>Nouvelle lecture</button></div><p data-llm-status role="status"></p><div data-llm-result></div><form class="llm-compose"><label for="llm-message">Poursuivre l’échange</label><textarea id="llm-message" rows="3" maxlength="2000" placeholder="Une question, une précision sur ton ressenti…"></textarea><div class="llm-suggestions"><button type="button">Explique le point principal de ta lecture.</button><button type="button">Que retenir pour la prochaine séance ?</button><button type="button">Quelles informations te manquent ?</button></div><div class="llm-compose-footer"><small>Les précisions restent dans le dialogue. Ton ressenti enregistré ne change pas.</small><button type="submit" class="primary-button" disabled>Envoyer</button></div></form><div data-llm-archives></div>';
    section.append(panel);
    const connect=panel.querySelector('[data-llm-connect]'),button=panel.querySelector('[data-llm-analyze]'),select=panel.querySelector('[data-llm-model]'),status=panel.querySelector('[data-llm-status]'),output=panel.querySelector('[data-llm-result]'),form=panel.querySelector('form'),textarea=form.querySelector('textarea'),send=form.querySelector('[type="submit"]'),archives=panel.querySelector('[data-llm-archives]');
    const date=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'});};
    const analysisHTML=(a,checks)=>`<p class="llm-summary">${esc(a.summary)}</p>${a.observations.length?`<details class="llm-evidence"><summary>Observations et mesures</summary><ul>${a.observations.map(o=>`<li>${esc(o.text)}${o.checkIds.length?`<small>${o.checkIds.map(id=>esc(checks.find(c=>c.id===id)?.name || id)).join(' · ')}</small>`:''}</li>`).join('')}</ul></details>`:''}${a.limits.length?`<div class="llm-limits"><strong>À garder en tête</strong><ul>${a.limits.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`:''}${a.nextSteps.length?`<div class="llm-next"><strong>Pour avancer</strong><ul>${a.nextSteps.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`:''}`;
    const conversationHTML=c=>{
      const checks=c.context?.checks || (c.fingerprint===fingerprint?assessment.checks:[]);
      return `<div class="llm-thread"><article class="llm-bubble llm-coach"><header><strong>Coach · Lecture initiale</strong><time>${esc(date(c.createdAt))}</time></header>${analysisHTML(c.analysis,checks)}</article>${(c.messages || []).map(m=>`<article class="llm-bubble ${m.role==='user'?'llm-user':'llm-coach'}"><header><strong>${m.role==='user'?'Toi':'Coach'}</strong><time>${esc(date(m.createdAt))}</time></header>${m.role==='user'?`<p class="llm-summary">${esc(m.content)}</p>`:analysisHTML(m.content,checks)}</article>`).join('')}</div><p class="llm-model-note">${esc(c.provider)} · ${esc(c.model)} · Lecture qualitative à confronter aux mesures.</p>`;
    };
    const updateControls=()=>{
      connect.disabled=busy;select.disabled=busy || !select.value;button.disabled=busy || !select.value;
      textarea.disabled=busy || !active;
      send.disabled=busy || !active || !select.value || !textarea.value.trim() || (active.messages || []).length>=40;
      form.querySelectorAll('.llm-suggestions button').forEach(b=>b.disabled=busy || !active);
    };
    const show=()=>{
      output.innerHTML=active?conversationHTML(active):'<div class="llm-empty"><strong>Un regard sur ta séance</strong><p>Demande une première lecture pour ouvrir le dialogue.</p></div>';
      archives.innerHTML=conversations.filter(c=>c!==active).slice().reverse().map(c=>`<details class="llm-archive"><summary>Conversation du ${esc(date(c.createdAt))} <span>${c.fingerprint===fingerprint?'Lecture précédente':'Contexte antérieur'}</span></summary>${conversationHTML(c)}</details>`).join('');
      updateControls();
    };
    const persist=(store=context)=>{
      store.write(storageKey,JSON.stringify(read().map(e=>e.id===item.id?{...e,llmConversations:conversations,llmDraft:textarea.value,llmReading:active?{version:active.version,readingVersion:active.readingVersion,provider:active.provider,model:active.model,analysis:active.analysis,fingerprint:active.fingerprint,createdAt:active.createdAt}:e.llmReading}:e)));
      item.llmConversations=conversations;item.llmDraft=textarea.value;
    };
    textarea.value=item.llmDraft || '';
    textarea.oninput=()=>{persist();updateControls();};
    form.querySelectorAll('.llm-suggestions button').forEach(b=>b.onclick=()=>{textarea.value=b.textContent;persist();updateControls();textarea.focus();});
    select.onchange=()=>{if(active && select.value!==active.model)status.textContent='Le suivi utilise le modèle de cette conversation : '+active.model+'. Le choix ci-dessus s’applique à une nouvelle lecture.';updateControls();};
    show();
    if(!active && conversations.length)status.textContent='Le contexte a changé. Les conversations précédentes restent consultables ci-dessous.';
    connect.onclick=async()=>{
      busy=true;updateControls();status.textContent='Connexion au LLM du Mac…';
      try{
        const result=await context.requestLLM('/api/llm/models');
        select.innerHTML=result.models.map(model=>`<option value="${esc(model)}" ${model===(active?.model || result.defaultModel)?'selected':''}>${esc(model)}</option>`).join('');
        status.textContent=result.models.length?'Connecté. Tu peux demander une lecture ou poursuivre le dialogue.':'Aucun modèle local disponible.';
      }catch(error){status.textContent=error.message;}
      finally{busy=false;updateControls();}
    };
    const generate=async(followup)=>{
      if(busy || !select.value || (followup && (!active || !textarea.value.trim() || (active.messages || []).length>=40)))return;
      const owner=context.athleteId,request=context.requestLLM,store=context,base=active;
      const question=textarea.value.trim(),linkedId=JSON.stringify(item.planLink || null);
      const history=followup?[{role:'assistant',content:base.analysis},...(base.messages || []).map(m=>({role:m.role,content:m.content})),{role:'user',content:question}]:[];
      busy=true;updateControls();status.textContent='Le coach prépare sa réponse… Cela peut prendre jusqu’à deux minutes.';panel.setAttribute('aria-busy','true');
      try{
        const result=await request('/api/llm/analyze',{model:followup?base.model:select.value,context:input,history});
        if(context.athleteId!==owner)return;
        const current=read().find(e=>e.id===item.id);
        const linked=loadPlans().find(p=>p.id===current?.planLink?.planId)?.weeks.flatMap(w=>w.sessions).find(s=>s.id===current?.planLink?.sessionId);
        if(!current || JSON.stringify(current.planLink || null)!==linkedId || JSON.stringify(llmContext(current,interpret(current,linked,current.criteria),linked,typeof loadProfile==='function'?loadProfile():{}))!==fingerprint){status.textContent='Les données ont changé. La réponse n’a pas été enregistrée; ouvre la séance à nouveau pour actualiser son contexte.';return;}
        const now=new Date().toISOString();
        if(followup){base.messages=[...(base.messages || []),{role:'user',content:question,createdAt:now},{role:'assistant',content:result.analysis,createdAt:now}];textarea.value='';}
        else{active={...result,id:now,fingerprint,context:input,createdAt:now,messages:[]};conversations.push(active);}
        persist(store);show();status.textContent=active.messages.length>=40?'Conversation enregistrée. Démarre une nouvelle lecture pour continuer.':'Échange enregistré avec la séance.';
        if(followup)output.querySelector('.llm-bubble:last-of-type')?.scrollIntoView({behavior:'smooth',block:'nearest'});
      }catch(error){status.textContent=error.message;}
      finally{busy=false;panel.removeAttribute('aria-busy');updateControls();}
    };
    button.onclick=()=>generate(false);
    form.onsubmit=event=>{event.preventDefault();generate(true);};
  }
  function comparisonSteps(item, planned) {
    const blocks=plannedBlocks(planned),phases=item.phases || [];
    return blocks.map(block=>{
      const matches=phases.filter((phase,i)=>item.phaseMapping?.[String(i)]===block.id);
      const phase=matches.length===1?matches[0]:null;
      // A continuous session has no intermediate boundary to guess.
      const actual=phase || (blocks.length===1&&matches.length===0?{seconds:item.seconds,km:item.km}:null);
      const match=/^\s*(\d{1,2})[:′’'](\d{2})/.exec(block.target || planned?.target || '');const targetPace=match?Number(match[1])*60+Number(match[2]):null;
      return {...block,targetPace,actual,ambiguous:matches.length>1};
    });
  }
  function comparisonGauge(actual, expected, format, unit, label) {
    const available=Number.isFinite(actual)&&actual>0;
    const max=Math.max(expected,available?actual:0)*1.15;
    const delta=available?(actual-expected)/expected*100:null;
    return `<div class="comparison-measure"><div class="comparison-values"><span>Attendu <b>${esc(format(expected))} ${unit}</b></span><span>Réalisé <b>${available?esc(format(actual))+' '+unit:'—'}</b></span></div><div class="comparison-gauge" role="img" aria-label="${esc(label)} : attendu ${esc(format(expected))} ${unit}, réalisé ${available?esc(format(actual))+' '+unit:'indisponible'}"><span class="gauge-expected" style="width:${expected/max*100}%"></span>${available?`<span class="gauge-actual" style="width:${actual/max*100}%"></span>`:''}<i style="left:${expected/max*100}%" aria-hidden="true"></i></div><p class="comparison-delta">${available?(delta>0?'+':'')+fmt(delta,1)+' % · '+esc(label)+(unit==='/km'?(delta<0?' · plus rapide':delta>0?' · plus lente':' · identique'):''):'Donnée réalisée indisponible'}</p></div>`;
  }
  function comparisonHtml(item, planned) {
    if(!planned)return '<div class="comparison-empty"><h3>Choisis la séance attendue</h3><p>Associe cet exercice à une séance du plan pour afficher ses étapes et les jauges de comparaison.</p></div>';
    const steps=comparisonSteps(item,planned),targetMatch=/^\s*(\d{1,2})[:′’'](\d{2})\s*\/km/.exec(planned.target || '');
    const target=targetMatch&&Number(targetMatch[2])<60?Number(targetMatch[1])*60+Number(targetMatch[2]):null;
    return `<div class="comparison-overview"><h3>${esc(planned.name)}</h3><p>${esc(planned.target || '')}</p>${planned.duration>0?comparisonGauge(item.seconds,planned.duration*60,clock,'','Durée totale'):''}</div><p class="gauge-key"><span>━ Attendu</span><span>━ Réalisé</span><span>│ Repère de l’attendu</span></p><div class="comparison-steps">${steps.map((step,i)=>`<article class="comparison-step"><h3><span class="step-number">${i+1}</span>${esc(steps.length===1?planned.name:step.name)}</h3>${comparisonGauge(step.actual?.seconds,step.seconds,clock,'','Durée')}${step.work&&step.targetPace>0?comparisonGauge(step.actual?.km>0?step.actual.seconds/step.actual.km:null,step.targetPace,pace,'/km','Allure moyenne'):''}${!step.actual?`<p class="comparison-missing">${step.ambiguous?'Plusieurs phases associées : choisis une seule phase.':'Associe une phase enregistrée à cette étape pour afficher le réalisé.'}</p>`:''}</article>`).join('')}</div>${!steps.length?'<p>Ce plan ne contient pas encore de découpage en étapes.</p>':''}`;
  }
  function feedbackPanel(item) {
    const entries=loadPlans().flatMap(plan=>plan.weeks.flatMap(week=>week.sessions.map(session=>({plan,session:typeof normalizeWorkout==='function'?normalizeWorkout({...session,structure:session.structure?{...session.structure}:undefined}):session}))));
    const linked=entries.find(e=>e.plan.id===item.planLink?.planId && e.session.id===item.planLink?.sessionId);
    const f=item.feedback || {}, criteria=item.criteria || {tolerance:15,effort:8};
    const assessment={...assess(item,linked?.session,criteria),...interpret(item,linked?.session,criteria)};
    const section=document.createElement('section');section.className='panel exercise-feedback';
    section.innerHTML=`<h2>Feedback et progression</h2><form id="exercise-feedback-form"><label>Séance prévue<select name="session"><option value="">Exercice libre / aucune association</option>${entries.map((e,i)=>`<option value="${i}" ${e===linked?'selected':''}>${esc(e.plan.settings?.goal || 'Plan')} · ${esc(e.session.scheduledDate)} · ${esc(e.session.name)}</option>`).join('')}</select></label><fieldset class="feedback-scale" data-scale="feeling"><legend>Sensations pendant la séance <small>facultatif</small></legend><p>Le plaisir et les sensations, indépendamment de l’intensité de l’effort.</p><input type="hidden" name="feeling" value="${esc(f.feeling || '')}"><div class="feeling-buttons">${[['difficile','☹','Mauvaises'],['bien','☺','Bonnes'],['facile','☀','Très bonnes']].map(([value,icon,label])=>`<button type="button" data-value="${value}" aria-pressed="false"><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</div><button type="button" class="scale-clear">Effacer</button></fieldset><fieldset class="feedback-scale" data-scale="rpe"><legend>Effort perçu · RPE <small>facultatif</small></legend><p>Quelle intensité as-tu ressentie sur l’ensemble de la séance ?</p><input type="hidden" name="rpe" value="${esc(f.rpe || '')}"><div class="rpe-buttons">${Array.from({length:10},(_,i)=>`<button type="button" data-value="${i+1}" style="--effort-color:hsl(${120-i*120/9} 65% 38%)" aria-label="RPE ${i+1} sur 10" aria-pressed="false">${i+1}</button>`).join('')}</div><div class="scale-endpoints"><span>1 · Très facile</span><span>10 · Maximal</span></div><output class="scale-value"></output><button type="button" class="scale-clear">Effacer</button></fieldset><label>Ton commentaire<textarea name="note" maxlength="2000">${esc(f.note || '')}</textarea></label>${linked&&item.phases?.length?`<details><summary>Associer les phases aux blocs prévus</summary><p>Choisis le bloc correspondant à chaque phase. Une seule phase par bloc; les associations ambiguës ne sont pas évaluées.</p>${item.phases.map((phase,i)=>`<label>${esc(phase.name)} · ${clock(phase.seconds)}<select name="phase-${i}"><option value="">Non associée</option>${assessment.blocks.map(block=>`<option value="${esc(block.id)}" ${item.phaseMapping?.[String(i)]===block.id?'selected':''}>${esc(block.name)}</option>`).join('')}</select></label>`).join('')}</details>`:''}<button class="primary-button" type="submit">Enregistrer et interpréter</button></form><div class="feedback-analysis comparison-visual" aria-live="polite">${comparisonHtml(item,linked?.session)}</div>`;
    el('exercise-detail').children[0].after(section);
    const persist=()=>{context.write(storageKey,JSON.stringify(read().map(e=>e.id===item.id?item:e)));};
    section.querySelector('form').onsubmit=event=>{
      event.preventDefault();event.target.dataset.dirty='false';
      exerciseDrafts.delete(context.athleteId+':'+item.id+':'+event.target.id);
      const data=new FormData(event.target),entry=entries[Number(data.get('session'))];
      if(event.target.id==='exercise-feedback-form') {
        item.feedback={feeling:data.get('feeling'),rpe:data.get('rpe')?Number(data.get('rpe')):null,note:data.get('note'),updatedAt:new Date().toISOString()};
        delete item.planDecision;persist();render(context);return;
      }
      item.planLink=data.get('session')!==''&&entry?{planId:entry.plan.id,sessionId:entry.session.id}:null;
      item.phaseMapping=item.planLink?.planId===linked?.plan.id&&item.planLink?.sessionId===linked?.session.id?Object.fromEntries((item.phases || []).map((phase,i)=>[String(i),data.get(`phase-${i}`) || ''])):{};
      delete item.planDecision;
      persist();render(context);
    };
    bindLocalLLM(section,item,assessment,linked?.session);
    const keep=section.querySelector('#feedback-keep'),review=section.querySelector('#feedback-review');
    if(keep)keep.onclick=()=>{item.planDecision='keep';persist();render(context);};
    if(review)review.onclick=()=>{item.planDecision='review';persist();selectPlan(linked.plan.id);location.hash='#plan';};
  }
  const exerciseTypes=[{id:'footing',label:'Footing',color:'#2876bc'},{id:'long',label:'Sortie longue',color:'#348357'},{id:'tempo',label:'Tempo',color:'#d77a20'},{id:'vma',label:'VMA',color:'#cc4147'}];
  function typeChoices(selected='') {
    return '<fieldset class="exercise-type-field"><legend>Type d’exercice</legend><div class="exercise-type-choices">'+exerciseTypes.map(type=>`<label style="--exercise-color:${type.color}"><input type="radio" name="exerciseType" value="${type.id}" required ${selected===type.id?'checked':''}><span><i aria-hidden="true"></i>${type.label}</span></label>`).join('')+'</div></fieldset>';
  }
  function chooseImportType(selected='') {
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='exercise-type-dialog';dialog.setAttribute('aria-labelledby','import-type-title');
      dialog.innerHTML='<form><h2 id="import-type-title">Quel type d’exercice ?</h2>'+typeChoices(selected)+'<div class="type-dialog-actions"><button type="button" class="secondary-button" data-cancel>Annuler</button><button type="submit" class="primary-button">Importer l’exercice</button></div></form>';
      document.body.append(dialog);let choice=null;
      dialog.querySelector('form').onsubmit=event=>{event.preventDefault();choice=new FormData(event.target).get('exerciseType');dialog.close();};
      dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
      dialog.addEventListener('close',()=>{dialog.remove();resolve(choice);},{once:true});dialog.showModal();
    });
  }
  function mergeImportedExercise(incoming, previous) {
    if(!previous)return incoming;
    return {...incoming,title:previous.customTitle || incoming.title,customTitle:previous.customTitle,
      exerciseType:previous.exerciseType || incoming.exerciseType,phaseMapping:undefined,feedback:previous.feedback,planLink:previous.planLink,criteria:previous.criteria,
      planDecision:previous.planDecision,llmReading:previous.llmReading,llmConversations:previous.llmConversations,llmDraft:previous.llmDraft};
  }
  function bindExerciseRename(item) {
    const form=el('exercise-rename-form'),input=form.elements.title,open=el('exercise-rename');
    open.onclick=()=>{form.hidden=false;open.hidden=true;input.focus();input.select();};
    form.querySelector('[data-cancel-rename]').onclick=()=>{form.hidden=true;open.hidden=false;form.reset();input.value=item.title;input.setCustomValidity('');open.focus();};
    input.oninput=()=>input.setCustomValidity('');
    form.onsubmit=event=>{
      event.preventDefault();const title=input.value.trim(),exerciseType=new FormData(form).get('exerciseType');
      if(!title){input.setCustomValidity('Indique un nom pour cet exercice.');input.reportValidity();return;}
      context.write(storageKey,JSON.stringify(read().map(existing=>existing.id===item.id?{...existing,title,customTitle:title,exerciseType}:existing)));
      render(context);el('exercise-message').textContent='Exercice modifié.';el('exercise-rename').focus();
    };
  }
  function organizeExerciseTabs(item, charts) {
    const detail=el('exercise-detail'),summary=detail.querySelector('.exercise-summary'),feedback=detail.querySelector('.exercise-feedback');
    const form=feedback.querySelector('form'),analysis=feedback.querySelector('.feedback-analysis'),llm=feedback.querySelector('.feedback-local-llm');
    feedback.querySelector('h2').textContent='Ton ressenti';
    const comparison=document.createElement('section');comparison.className='panel exercise-feedback exercise-comparison';
    comparison.innerHTML='<h2>Attendu / réalisé</h2><form id="exercise-comparison-form"></form>';
    const compareForm=comparison.querySelector('form');compareForm.onsubmit=form.onsubmit;
    [...form.children].forEach(child=>{
      if(child.matches('button') || child.querySelector('[name=feeling],[name=rpe],[name=note]'))return;
      compareForm.append(child);
    });
    const compareSave=document.createElement('button');compareSave.className='primary-button';compareSave.type='submit';compareSave.textContent='Enregistrer les associations';compareForm.append(compareSave);
    form.querySelector('button[type=submit]').textContent='Enregistrer mon ressenti';
    const sessionLabel=compareForm.querySelector('label:has([name=session])');
    if(sessionLabel){const disclosure=document.createElement('details');disclosure.className='comparison-associations';disclosure.innerHTML='<summary>Choisir ou changer la séance attendue</summary>';sessionLabel.before(disclosure);disclosure.append(sessionLabel);}
    compareForm.querySelectorAll('select').forEach(select=>{
      const picker=document.createElement('div');picker.className='comparison-picker';
      const input=document.createElement('input');input.type='hidden';input.name=select.name;input.value=select.value;picker.append(input);
      [...select.options].forEach(option=>{const button=document.createElement('button');button.type='button';button.dataset.choice=option.value;button.textContent=option.textContent;button.setAttribute('aria-pressed',String(option.value===input.value));button.onclick=()=>{input.value=option.value;picker.querySelectorAll('button').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.choice===input.value)));input.dispatchEvent(new Event('input',{bubbles:true}));};picker.append(button);});const label=select.closest('label');if(label){const title=document.createElement('p');title.textContent=label.firstChild.textContent.trim();picker.setAttribute('role','group');picker.setAttribute('aria-label',title.textContent);picker.prepend(title);label.replaceWith(picker);}else select.replaceWith(picker);
    });
    comparison.querySelector('h2').after(analysis);
    llm.classList.add('panel','exercise-llm');
    const definitions=[['feeling','Ressenti'],['llm','Dialogue LLM'],['charts','Graphiques'],['comparison','Attendu / réalisé']];
    const nav=document.createElement('div');nav.className='exercise-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Détails de l’exercice');
    const panels=new Map();
    definitions.forEach(([id,label])=>{
      const tab=document.createElement('button');tab.type='button';tab.id='exercise-tab-'+id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','exercise-panel-'+id);tab.textContent=label;nav.append(tab);
      const panel=document.createElement('section');panel.id='exercise-panel-'+id;panel.className='exercise-tab-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panels.set(id,panel);
    });
    panels.get('feeling').append(feedback);panels.get('llm').append(llm);panels.get('comparison').append(comparison);
    const graphics=panels.get('charts');
    const cursor=el('exercise-selected-time');graphics.append(cursor);
    const measures=document.createElement('p');measures.className='exercise-extra-measures';
    const mean=item.heart.length?item.heart.reduce((sum,p)=>sum+p.v,0)/item.heart.length:NaN;
    measures.textContent='FC moyenne : '+fmt(mean)+' bpm · Dénivelé GPS : '+(item.gain==null?'indisponible':'+'+fmt(item.gain)+' / −'+fmt(item.loss)+' m');graphics.append(measures);
    const metric=document.createElement('section');metric.className='exercise-data-controls';
    const iconPaths={heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',pace:'M9 2h6 M12 2v3 M18 5l2-2 M12 9v5l3 2 M21 14a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',cadence:'M8 3c-3 0-4 5-3 7s4 2 5 0S11 3 8 3Z M7 14c-2 0-3 3-2 5s3 2 4 0-1-5-2-5Z M17 7c-3 0-4 5-3 7s4 2 5 0-1-7-2-7Z M16 18c-2 0-2 3-1 4s3 0 3-1-1-3-2-3Z',elevation:'M2 20 9 6l5 9 3-5 5 10Z M6 12l3 2 3-2',grade:'M3 20h18 M4 17 20 4 M13 4h7v7'};
    const icons=Object.fromEntries(Object.entries(iconPaths).map(([key,path])=>[key,'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>']));
    metric.innerHTML='<h3>Données</h3><p>Choisis les données à comparer.</p><div class="metric-buttons">'+charts.map(def=>`<button type="button" data-metric="${def.key}" aria-pressed="false" ${def.series.length?'':'disabled'}><span aria-hidden="true">${icons[def.key]}</span>${esc(def.title)}</button>`).join('')+'</div><div class="chart-layout-buttons" role="group" aria-label="Disposition des courbes"><button type="button" data-layout="overlay" aria-pressed="true">Superposées</button><button type="button" data-layout="separate" aria-pressed="false">Séparées</button></div>';
    graphics.append(metric);
    const chartGrid=detail.querySelector('.exercise-charts');graphics.append(chartGrid);
    detail.querySelectorAll('.exercise-map,.exercise-phases,.exercise-warnings').forEach(node=>graphics.append(node));
    // Keep phase details available without making the graph page unnecessarily long.
    const phases=graphics.querySelector('.exercise-phases');
    if(phases){const list=phases.querySelector('.exercise-phase-list');const disclosure=document.createElement('details');disclosure.innerHTML='<summary>Détail des phases</summary>';disclosure.append(list);phases.append(disclosure);}
    summary.after(nav);definitions.forEach(([id])=>detail.append(panels.get(id)));
    const chosen=new Set(charts.filter(def=>def.series.length).slice(0,2).map(def=>def.key));let layout='overlay';
    const selectMetric=()=>{
      metric.querySelectorAll('[data-metric]').forEach(button=>button.setAttribute('aria-pressed',String(chosen.has(button.dataset.metric))));
      metric.querySelectorAll('[data-layout]').forEach(button=>button.setAttribute('aria-pressed',String(layout===button.dataset.layout)));
      chartGrid.classList.toggle('single-chart',layout==='overlay' || chosen.size===1);
      chartGrid.querySelectorAll('[data-chart-key]').forEach(node=>node.hidden=layout==='overlay' || !chosen.has(node.dataset.chartKey));
      const overlay=chartGrid.querySelector('.exercise-overlay');overlay.hidden=layout!=='overlay';
      overlay.querySelectorAll('[data-overlay-key]').forEach(node=>node.toggleAttribute('hidden',!chosen.has(node.dataset.overlayKey)));
    };
    metric.querySelectorAll('[data-metric]').forEach(button=>button.onclick=()=>{const key=button.dataset.metric;if(chosen.has(key)){if(chosen.size>1)chosen.delete(key);}else chosen.add(key);selectMetric();});
    metric.querySelectorAll('[data-layout]').forEach(button=>button.onclick=()=>{layout=button.dataset.layout;selectMetric();});selectMetric();
    const memoryKey=context.athleteId+':'+item.id;let mapBound=false;
    [form,compareForm].forEach(current=>{
      const draft=exerciseDrafts.get(memoryKey+':'+current.id);
      if(draft){Object.entries(draft).forEach(([name,value])=>{const field=current.elements.namedItem(name);if(field)field.value=value;});current.dataset.dirty='true';}
      current.addEventListener('input',()=>current.dataset.dirty='true');
      current.addEventListener('change',()=>current.dataset.dirty='true');
    });
    compareForm.querySelectorAll('.comparison-picker').forEach(picker=>{const value=picker.querySelector('input').value;picker.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.choice===value)));});
    form.querySelectorAll('[data-scale]').forEach(scale=>{
      const input=scale.querySelector('input');
      const update=()=>{scale.querySelectorAll('[data-value]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.value===input.value)));const output=scale.querySelector('output');if(output)output.textContent=input.value?'Effort sélectionné : '+input.value+' / 10':'Non renseigné';};
      scale.querySelectorAll('[data-value]').forEach(button=>button.onclick=()=>{input.value=button.dataset.value;input.dispatchEvent(new Event('input',{bubbles:true}));update();});
      scale.querySelector('.scale-clear').onclick=()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));update();};update();
    });
    const activate=id=>{
      exerciseTabs.set(memoryKey,id);
      definitions.forEach(([key])=>{const tab=el('exercise-tab-'+key),selected=key===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;panels.get(key).hidden=!selected;});
      if(id==='charts' && !mapBound){bindMapNavigation();mapBound=true;}
    };
    definitions.forEach(([id],index)=>{
      const tab=el('exercise-tab-'+id);tab.onclick=()=>activate(id);
      tab.onkeydown=event=>{
        let next;
        if(event.key==='ArrowRight')next=(index+1)%definitions.length;
        else if(event.key==='ArrowLeft')next=(index+definitions.length-1)%definitions.length;
        else if(event.key==='Home')next=0;
        else if(event.key==='End')next=definitions.length-1;
        else return;
        event.preventDefault();const id=definitions[next][0];activate(id);el('exercise-tab-'+id).focus();
      };
    });
    activate(exerciseTabs.get(memoryKey) || 'feeling');
  }
  function render(nextContext) {
    const previousDetail=el('exercise-detail');
    if(previousDetail.dataset.exerciseOwner && previousDetail.dataset.exerciseId){
      previousDetail.querySelectorAll('form[data-dirty=true]').forEach(form=>exerciseDrafts.set(previousDetail.dataset.exerciseOwner+':'+previousDetail.dataset.exerciseId+':'+form.id,Object.fromEntries(new FormData(form))));
    }
    basemapCleanup?.();basemapCleanup=null;mapResizeObserver?.disconnect();
    context=nextContext;
    if(selectedAthlete!==context.athleteId){selectedId='';selectedAthlete=context.athleteId;el('exercise-message').textContent='';}
    if(nextContext.exerciseId)selectedId=nextContext.exerciseId;
    const items=read(); if(!items.some(item=>item.id===selectedId)) selectedId=items[0]?.id || '';
    el('exercise-list').innerHTML=items.length?items.map(item=>`<button type="button" class="exercise-choice ${item.id===selectedId?'selected':''}" data-id="${esc(item.id)}" aria-pressed="${item.id===selectedId}"><b>${esc(item.title)}</b><span>${esc(new Date(item.date).toLocaleString('fr-FR'))}</span><span>${fmt(item.km,2)} km · ${fmt(item.seconds/60,1)} min</span></button>`).join(''):'<p class="exercise-missing">Aucun exercice importé pour ce profil.</p>';
    el('exercise-list').querySelectorAll('button').forEach(button=>button.onclick=()=>{selectedId=button.dataset.id;render(context);});
    const item=items.find(item=>item.id===selectedId);
    el('exercise-detail').dataset.exerciseOwner=context.athleteId;el('exercise-detail').dataset.exerciseId=item?.id || '';
    if(!item){el('exercise-detail').innerHTML='<div class="panel empty-state"><h3>Les détails apparaîtront ici.</h3><p>Importe un exercice pour consulter son parcours et ses mesures.</p></div>';return;}
    const mean=item.heart.length?item.heart.reduce((s,p)=>s+p.v,0)/item.heart.length:NaN;
    const grade=calculateGrade(item.points);
    const signedPercent=value=>`${value>0?'+':''}${fmt(value,1)}`;
    const charts=[
      {key:'heart',title:'Rythme cardiaque',series:item.heart,unit:'bpm',color:'#d35365',format:fmt,note:''},
      {key:'pace',title:'Allure',series:item.paces,unit:'min/km',color:'#1760a7',format:pace,inverted:true,note:'Les allures rapides sont en haut. Calculée depuis la vitesse enregistrée; les vitesses nulles sont exclues.'},
      {key:'cadence',title:'Pas par minute',series:item.cadence,unit:'pas/min',color:'#8b64bf',format:fmt,note:'Calculés sur l’intervalle de chaque mesure du nombre de pas.'},
      {key:'elevation',title:'Dénivelé · altitude',series:item.elevation,unit:'m',color:'#588bc4',format:fmt,note:'D+ et D− estimés par cumul des variations GPS, sensibles au bruit de mesure.'},
      {key:'grade',title:'Pente du parcours',series:grade,unit:'%',color:'#be7934',format:signedPercent,note:'Variation d’altitude ÷ distance horizontale × 100, sur les 100 derniers mètres. + = montée, − = descente. Estimation GPS; aucune valeur sur les 100 premiers mètres ni sans altitude valide.',empty:'Pas assez de points GPS avec altitude pour calculer la pente sur 100 mètres.'}
    ].map(def=>({...def,end:item.end}));
    el('exercise-detail').innerHTML=`<section class="panel exercise-summary"><div class="exercise-title-row"><div><h2>${esc(item.title)}</h2><p>${esc(new Date(item.date).toLocaleString('fr-FR'))}</p><span class="exercise-type-badge" style="--exercise-color:${exerciseTypes.find(type=>type.id===item.exerciseType)?.color || '#77817a'}">${esc(exerciseTypes.find(type=>type.id===item.exerciseType)?.label || 'Type à renseigner')}</span></div><button type="button" id="exercise-rename" class="secondary-button">Modifier</button></div><form id="exercise-rename-form" class="exercise-rename-form" hidden><label for="exercise-title-input">Nom de l’exercice</label><input id="exercise-title-input" name="title" maxlength="120" required value="${esc(item.title)}">${typeChoices(item.exerciseType)}<div><button type="submit" class="primary-button">Enregistrer</button><button type="button" class="secondary-button" data-cancel-rename>Annuler</button></div></form><div class="exercise-stats">${[['Distance',`${fmt(item.km,2)} km`],['Durée',item.seconds>0?clock(item.seconds):'—'],['Allure moyenne',`${pace(item.km>0?item.seconds/item.km:NaN)} /km`],].map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join('')}</div><output id="exercise-selected-time" class="exercise-chart-readout" aria-live="polite">Clique sur une courbe pour explorer la séance à un instant précis.</output><details class="exercise-manage"><summary>Autres actions</summary><button id="exercise-delete" type="button" class="secondary-button">Retirer cet exercice</button></details></section>${map(item.points)}<div class="exercise-charts">${charts.map(def=>chart(def.title,def.series,def.unit,def.color,def.end,def.format,def.note,def)).join('')}</div>${item.warnings.length?`<section class="panel exercise-warnings"><h3>Informations de l’export</h3>${item.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</section>`:''}`;
    feedbackPanel(item);
    bindPhases(item);
    bindInspection(item,charts);
    organizeExerciseTabs(item,charts);
    bindExerciseRename(item);
    el('exercise-delete').onclick=()=>{context.write(storageKey,JSON.stringify(read().filter(existing=>existing.id!==item.id)));selectedId='';render(context);el('exercise-message').textContent='Exercice retiré de la bibliothèque. Tu peux le réimporter depuis son fichier JSON.';};
  }
  function confirmImport(file) {
    return file.size<=100_000_000 || window.confirm(`Le fichier « ${file.name} » fait ${fmt(file.size/1_000_000,1)} Mo et dépasse 100 Mo. Son import peut prendre du temps. Continuer l’import ?`);
  }
  async function importFile(event) {
    const file=event.target.files?.[0];event.target.value='';if(!file || !context) return;
    if(!confirmImport(file)) {el('exercise-message').textContent='Import annulé.';return;}
    const owner=context.athleteId;
    el('exercise-import').disabled=true;
    el('exercise-message').textContent='Lecture et analyse du fichier…';
    try {
      const payload=JSON.parse(await file.text());
      if(context.athleteId!==owner || el('exercise-page').hidden) return;
      const athlete=readAthletes().find(a=>a.id===owner);
      if(payload.athleteId && payload.athleteId!==owner && !(athlete?.sourceIds || []).includes(payload.athleteId)) throw new Error('Ce fichier concerne un autre profil. Sélectionne son espace avant de l’importer.');
      const item=normalize(payload);
      const previous=read().find(existing=>existing.id===item.id);
      const exerciseType=await chooseImportType(previous?.exerciseType || payload.exerciseType || '');
      if(!exerciseType){el('exercise-message').textContent='Import annulé.';return;}
      if(context.athleteId!==owner || el('exercise-page').hidden)return;
      item.exerciseType=exerciseType;
      const items=read(),index=items.findIndex(existing=>existing.id===item.id);if(index>=0){items[index]=mergeImportedExercise(item,items[index]);items[index].exerciseType=exerciseType;}else items.unshift(item);
      const data=JSON.stringify(items);
      context.write(storageKey,data);selectedId=item.id;render(context);el('exercise-message').textContent=index>=0?'Exercice déjà présent : données mises à jour.':'Exercice importé dans ce profil.';
    } catch(error) {el('exercise-message').textContent=error instanceof SyntaxError?'JSON invalide : vérifie le contenu du fichier.':error.name==='QuotaExceededError'?'Le stockage de ce navigateur est plein. Retire un ancien exercice avant de réessayer.':error.message;}
    finally {el('exercise-import').disabled=false;}
  }
  if(typeof document !== 'undefined') document.addEventListener('DOMContentLoaded',()=>{
    el('exercise-import').addEventListener('click',()=>el('exercise-file').click());el('exercise-file').addEventListener('change',importFile);
  });
  return {storageKey,exerciseTypes,mergeImportedExercise,normalize,normalizePhases,phaseRoutes,render,assess,interpret,plannedBlocks,comparisonSteps,comparisonGauge,llmContext,calculateGrade,chartGeometry,chartSamples,nearestSample,confirmImport,sampleAtTime,gpsAtTime};
})();
