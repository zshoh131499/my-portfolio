(function(){
  'use strict';

  var reduceQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointerQuery=window.matchMedia('(hover: hover) and (pointer: fine)');
  var coarsePointerQuery=window.matchMedia('(pointer: coarse)');
  var connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  var saveData=Boolean(connection&&connection.saveData);
  var subscribers=[];
  var userPaused=false;
  var storageKey='toby-portfolio-motion-paused';

  try{userPaused=window.localStorage.getItem(storageKey)==='true';}catch(error){}

  function motionAllowed(){
    return !reduceQuery.matches&&!userPaused&&!document.hidden&&!document.body.classList.contains('menu-open')&&!document.body.classList.contains('lightbox-open');
  }

  function notifyMotion(){
    subscribers.slice().forEach(function(callback){callback(motionAllowed(),reduceQuery.matches);});
  }

  function subscribeMotion(callback){
    subscribers.push(callback);
    callback(motionAllowed(),reduceQuery.matches);
    return function(){subscribers=subscribers.filter(function(item){return item!==callback;});};
  }

  function setUserPaused(paused){
    userPaused=Boolean(paused);
    try{window.localStorage.setItem(storageKey,String(userPaused));}catch(error){}
    syncMotionButton();
    notifyMotion();
  }

  var motionButton=document.getElementById('motionToggle');
  function syncMotionButton(){
    var systemReduced=reduceQuery.matches;
    document.body.classList.toggle('motion-paused',userPaused||systemReduced);
    if(!motionButton)return;
    motionButton.disabled=systemReduced;
    motionButton.setAttribute('aria-disabled',String(systemReduced));
    motionButton.setAttribute('aria-pressed',String(userPaused||systemReduced));
    motionButton.textContent=systemReduced?'Motion reduced':(userPaused?'Play motion':'Pause motion');
    motionButton.title=reduceQuery.matches?'Your system reduced-motion preference is active.':'Pause or resume decorative motion.';
  }
  if(motionButton){
    motionButton.addEventListener('click',function(){setUserPaused(!userPaused);});
    syncMotionButton();
  }

  reduceQuery.addEventListener('change',function(){syncMotionButton();notifyMotion();});
  document.addEventListener('visibilitychange',notifyMotion);
  new MutationObserver(notifyMotion).observe(document.body,{attributes:true,attributeFilter:['class']});

  window.siteMotion={
    isAllowed:motionAllowed,
    isPaused:function(){return userPaused;},
    setPaused:setUserPaused,
    subscribe:subscribeMotion
  };

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function lerp(a,b,t){return a+(b-a)*t;}
  function easeOut(t){return 1-Math.pow(1-t,3);}
  function smoothstep(min,max,value){
    var t=clamp((value-min)/(max-min),0,1);
    return t*t*(3-2*t);
  }
  function seeded(index,salt){
    var value=Math.sin((index+1)*12.9898+(salt||0)*78.233)*43758.5453;
    return value-Math.floor(value);
  }
  function canvasScale(canvas,context,maxDpr){
    var rect=canvas.getBoundingClientRect();
    var dpr=Math.min(window.devicePixelRatio||1,maxDpr||1.5);
    var width=Math.max(1,Math.round(rect.width));
    var height=Math.max(1,Math.round(rect.height));
    var pixelWidth=Math.round(width*dpr);
    var pixelHeight=Math.round(height*dpr);
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){
      canvas.width=pixelWidth;
      canvas.height=pixelHeight;
    }
    context.setTransform(dpr,0,0,dpr,0,0);
    return {width:width,height:height,dpr:dpr,rect:rect};
  }

  // Keep the pixel-city footage inside the same global motion contract.
  (function manageHeroVideo(){
    var video=document.querySelector('.hero-video');
    if(!video)return;
    var initialRect=video.getBoundingClientRect();
    var visible=initialRect.bottom>0&&initialRect.top<window.innerHeight;
    function ensureSource(){
      if(video.getAttribute('src'))return;
      var source=video.dataset.src;
      if(!source)return;
      video.src=source;
      video.load();
    }
    function sync(allowed){
      if(allowed&&visible&&!saveData){
        ensureSource();
        var playPromise=video.play();
        if(playPromise&&playPromise.catch)playPromise.catch(function(){});
      }else video.pause();
    }
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        visible=entries[0]?entries[0].isIntersecting:true;
        sync(motionAllowed());
      },{threshold:.04}).observe(video);
    }
    subscribeMotion(sync);
  })();

  // Hero signature: an open field that can become Product, UX, Game, or VFX.
  (function heroFlowField(){
    var canvas=document.getElementById('heroParticleField');
    var hero=document.getElementById('hero');
    var bridge=document.getElementById('particleBridge');
    var featured=document.getElementById('proj-bizsim');
    if(!canvas||!hero)return;
    var ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)return;

    var metrics={width:1,height:1,dpr:1,rect:canvas.getBoundingClientRect()};
    var particles=[];
    var selectedMode='product';
    var previewMode=null;
    var modeFrom='product';
    var modeTo='product';
    var modeStarted=0;
    var modeDuration=1050;
    var pointer={active:false,x:0,y:0,targetX:0,targetY:0,influence:0};
    var focusPoint={active:false,x:0,y:0,influence:0};
    var ripple=null;
    var contract=0;
    var landingAnchor={x:0,y:0};
    var scrollDirty=true;
    var initialHeroRect=hero.getBoundingClientRect();
    var visible=initialHeroRect.bottom>-80&&initialHeroRect.top<window.innerHeight+80;
    var frameId=0;
    var lastTime=0;
    var lastMobileFrame=0;
    var lowQuality=false;
    var colors=['#fff5eb','#00d4ff','#fff5eb','#5eead4','#fff5eb','#00d4ff','#c084fc'];

    function chooseParticleCount(){
      lowQuality=window.innerWidth<650||saveData||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
      if(lowQuality)return 38;
      if(window.innerWidth<1000)return 88;
      return 150;
    }

    function resetParticles(count){
      count=count||chooseParticleCount();
      particles=[];
      for(var i=0;i<count;i++){
        var x=metrics.width*(.42+seeded(i,1)*.56);
        var y=metrics.height*(.1+seeded(i,2)*.78);
        particles.push({
          x:x,
          y:y,
          vx:0,
          vy:0,
          size:.72+seeded(i,3)*1.38,
          seed:seeded(i,4),
          phase:seeded(i,5)*Math.PI*2,
          driftRate:.72+seeded(i,6)*.55,
          contractStart:seeded(i,9)*.28,
          contractEnd:.68+seeded(i,10)*.28,
          color:colors[i%colors.length]
        });
      }
    }

    function resize(){
      var count=chooseParticleCount();
      metrics=canvasScale(canvas,ctx,lowQuality?1:1.5);
      resetParticles(count);
      refreshLandingAnchor();
      updateContract(true);
      if(reduceQuery.matches)drawReduced();
      else schedule();
    }

    function flowPoint(mode,index,count){
      var w=metrics.width,h=metrics.height;
      var t=count>1?index/(count-1):0;
      var scatterX=(seeded(index,11)-.5);
      var scatterY=(seeded(index,12)-.5);
      if(mode==='ux'){
        var uxX=w*(.5+t*.45)+scatterX*w*.025;
        var uxY=h*(.33+t*.3+Math.sin(t*Math.PI*2.15)*.115)+scatterY*h*.1;
        return {x:uxX,y:uxY};
      }
      if(mode==='game'){
        var cluster=index%3;
        var centers=[[.66,.38],[.82,.49],[.71,.67]];
        var clusterIndex=Math.floor(index/3);
        var clusterCount=Math.ceil(count/3);
        var clusterT=(clusterIndex+.5)/clusterCount;
        var orbitAngle=clusterIndex*2.3999632297+cluster*.72+scatterX*.65;
        var orbitRadius=Math.sqrt(clusterT);
        return {
          x:w*centers[cluster][0]+Math.cos(orbitAngle)*w*(.075+.035*cluster)*orbitRadius+scatterX*w*.018,
          y:h*centers[cluster][1]+Math.sin(orbitAngle)*h*(.11+.018*cluster)*orbitRadius+scatterY*h*.025
        };
      }
      if(mode==='vfx'){
        var spiralAngle=t*Math.PI*4.2+scatterX*.9;
        var spiralRadius=Math.sqrt(t)*Math.min(w*.23,h*.34);
        return {
          x:w*.74+Math.cos(spiralAngle)*spiralRadius+Math.sin(spiralAngle*.47)*w*.018+scatterX*w*.025,
          y:h*.5+Math.sin(spiralAngle)*spiralRadius*.72+Math.cos(spiralAngle*.38)*h*.022+scatterY*h*.035
        };
      }
      var cloudAngle=index*2.3999632297+scatterX*.82;
      var cloudRadius=Math.sqrt((index+.5)/count);
      return {
        x:w*.76+Math.cos(cloudAngle)*w*.205*cloudRadius+Math.sin(cloudAngle*1.7)*w*.018+scatterX*w*.025,
        y:h*.48+Math.sin(cloudAngle)*h*.285*cloudRadius+Math.cos(cloudAngle*1.3)*h*.02+scatterY*h*.035
      };
    }

    function refreshLandingAnchor(){
      var x=metrics.width*.82;
      if(bridge){
        var bridgeRect=bridge.getBoundingClientRect();
        var heroRect=hero.getBoundingClientRect();
        x=clamp(bridgeRect.left+bridgeRect.width*.5-heroRect.left,20,metrics.width-20);
      }
      landingAnchor.x=x;
      landingAnchor.y=metrics.height-5;
    }

    function landingPoint(index){
      return {
        x:landingAnchor.x+(seeded(index,8)-.5)*58,
        y:landingAnchor.y-8-seeded(index,13)*56
      };
    }

    function updateContract(force){
      if(!force&&!scrollDirty)return;
      scrollDirty=false;
      var rect=hero.getBoundingClientRect();
      var raw=clamp(-rect.top/Math.max(1,rect.height*.82),0,1);
      var nextContract=smoothstep(.12,.96,raw);
      if(!force&&Math.abs(nextContract-contract)<.002)return;
      contract=nextContract;
      if(bridge)bridge.style.setProperty('--bridge-energy',contract.toFixed(3));
      if(featured)featured.style.setProperty('--flow-arrival',contract.toFixed(3));
    }

    function smootherstep(value){
      var t=clamp(value,0,1);
      return t*t*t*(t*(t*6-15)+10);
    }

    function setFlowMode(mode){
      if(!mode||mode===modeTo)return;
      modeFrom=modeTo;
      modeTo=mode;
      modeStarted=performance.now();
      schedule();
    }

    function desiredPoint(particle,index,time){
      var modeMix=modeFrom===modeTo?1:smootherstep((time-modeStarted)/modeDuration);
      if(modeMix>=1)modeFrom=modeTo;
      var fromPoint=flowPoint(modeFrom,index,particles.length);
      var toPoint=modeFrom===modeTo?fromPoint:flowPoint(modeTo,index,particles.length);
      var formation={x:lerp(fromPoint.x,toPoint.x,modeMix),y:lerp(fromPoint.y,toPoint.y,modeMix)};
      var landing=landingPoint(index);
      var localContract=smoothstep(particle.contractStart,particle.contractEnd,contract);
      var breath=(1-localContract)*(7+particle.seed*8);
      var driftTime=time*.00018*particle.driftRate;
      var x=lerp(formation.x,landing.x,localContract)+Math.sin(driftTime*3.1+particle.phase)*breath;
      var y=lerp(formation.y,landing.y,localContract)+Math.cos(driftTime*2.35+particle.phase*.83)*breath*.72;
      if(focusPoint.influence>.01&&contract<.6){
        var focusBlend=.035*focusPoint.influence*(1-contract);
        x=lerp(x,focusPoint.x,focusBlend);
        y=lerp(y,focusPoint.y,focusBlend);
      }
      return {x:x,y:y,contract:localContract};
    }

    function applyCurrent(particle,source,radius,strength){
      var dx=particle.x-source.x;
      var dy=particle.y-source.y;
      var distance=Math.sqrt(dx*dx+dy*dy)||1;
      if(distance>=radius)return;
      var falloff=1-distance/radius;
      var force=falloff*falloff*strength;
      var outwardX=dx/distance;
      var outwardY=dy/distance;
      particle.vx+=(outwardX*.28-outwardY*.72)*force;
      particle.vy+=(outwardY*.28+outwardX*.72)*force;
    }

    function render(time){
      frameId=0;
      if(!visible||!motionAllowed())return;
      if(lowQuality&&time-lastMobileFrame<33){frameId=requestAnimationFrame(render);return;}
      lastMobileFrame=time;
      var delta=lastTime?clamp((time-lastTime)/16.67,.5,2):1;
      lastTime=time;
      updateContract(false);
      ctx.clearRect(0,0,metrics.width,metrics.height);
      var rippleAge=ripple?(time-ripple.start)/1380:2;

      pointer.x+=(pointer.targetX-pointer.x)*.075*delta;
      pointer.y+=(pointer.targetY-pointer.y)*.075*delta;
      pointer.influence=lerp(pointer.influence,pointer.active?1:0,Math.min(1,.055*delta));
      focusPoint.influence=lerp(focusPoint.influence,focusPoint.active?1:0,Math.min(1,.07*delta));

      particles.forEach(function(particle,index){
        var target=desiredPoint(particle,index,time);
        var spring=target.contract>.65?.013:.0065;
        particle.vx+=(target.x-particle.x)*spring*delta;
        particle.vy+=(target.y-particle.y)*spring*delta;
        if(pointer.influence>.01&&contract<.88)applyCurrent(particle,pointer,190,.42*pointer.influence*delta*(1-contract));
        if(focusPoint.influence>.01&&contract<.72)applyCurrent(particle,focusPoint,120,.18*focusPoint.influence*delta);
        if(ripple&&rippleAge<1){
          var expanding={x:ripple.x,y:ripple.y};
          var dx=particle.x-expanding.x;
          var dy=particle.y-expanding.y;
          var distance=Math.sqrt(dx*dx+dy*dy)||1;
          var waveRadius=24+rippleAge*220;
          var proximity=Math.max(0,1-Math.abs(distance-waveRadius)/76);
          var waveStrength=Math.sin(rippleAge*Math.PI)*(1-rippleAge)*.52;
          particle.vx+=(dx/distance)*proximity*waveStrength;
          particle.vy+=(dy/distance)*proximity*waveStrength;
        }
        var damping=Math.pow(target.contract>.72?.86:.91,delta);
        particle.vx*=damping;particle.vy*=damping;
        var speed=Math.sqrt(particle.vx*particle.vx+particle.vy*particle.vy)||0;
        if(speed>1.45){particle.vx=particle.vx/speed*1.45;particle.vy=particle.vy/speed*1.45;}
        particle.x+=particle.vx*delta;particle.y+=particle.vy*delta;
      });

      particles.forEach(function(particle,index){
        var pulse=.94+Math.sin(time*.00085*particle.driftRate+particle.phase)*.06;
        var size=particle.size*(1+contract*.22)*pulse;
        if(index%3===0){
          ctx.globalAlpha=.05*(1-contract*.45);
          ctx.fillStyle=particle.color;
          ctx.beginPath();ctx.arc(particle.x,particle.y,size*3.8,0,Math.PI*2);ctx.fill();
        }
        ctx.globalAlpha=clamp(.36+particle.seed*.24+contract*.06,0,.66);
        ctx.fillStyle=particle.color;
        ctx.beginPath();ctx.arc(particle.x,particle.y,size,0,Math.PI*2);ctx.fill();
      });
      ctx.globalAlpha=1;
      if(rippleAge>=1)ripple=null;
      frameId=requestAnimationFrame(render);
    }

    function schedule(){
      if(!frameId&&visible&&motionAllowed()){
        lastTime=0;
        frameId=requestAnimationFrame(render);
      }
    }

    function stop(){
      if(frameId)cancelAnimationFrame(frameId);
      frameId=0;
      lastTime=0;
    }

    function drawReduced(){
      stop();
      metrics=canvasScale(canvas,ctx,1);
      ctx.clearRect(0,0,metrics.width,metrics.height);
      var count=32;
      for(var i=0;i<count;i++){
        var point=flowPoint('product',i,count);
        ctx.globalAlpha=.32;
        ctx.fillStyle=colors[i%colors.length];
        ctx.beginPath();ctx.arc(point.x,point.y,.85+seeded(i,14)*.65,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
    }

    function localPoint(event){
      var rect=hero.getBoundingClientRect();
      return {x:event.clientX-rect.left,y:event.clientY-rect.top};
    }

    hero.addEventListener('pointermove',function(event){
      if(event.pointerType==='touch')return;
      var point=localPoint(event);
      pointer.active=true;
      pointer.targetX=point.x;
      pointer.targetY=point.y;
      if(pointer.influence<.02){pointer.x=point.x;pointer.y=point.y;}
      schedule();
    },{passive:true});
    hero.addEventListener('pointerleave',function(){pointer.active=false;});
    hero.addEventListener('pointerdown',function(event){
      if(event.pointerType!=='touch')return;
      var point=localPoint(event);
      ripple={x:point.x,y:point.y,start:performance.now()};
      schedule();
    },{passive:true});

    var roleButtons=Array.prototype.slice.call(hero.querySelectorAll('[data-flow-mode]'));
    function setPressed(mode){
      roleButtons.forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.flowMode===mode));});
    }
    roleButtons.forEach(function(button){
      button.addEventListener('pointerenter',function(){if(finePointerQuery.matches){previewMode=button.dataset.flowMode;setFlowMode(previewMode);}});
      button.addEventListener('pointerleave',function(){previewMode=null;setFlowMode(selectedMode);});
      button.addEventListener('focus',function(){previewMode=button.dataset.flowMode;setFlowMode(previewMode);});
      button.addEventListener('blur',function(){previewMode=null;setFlowMode(selectedMode);});
      button.addEventListener('click',function(){selectedMode=button.dataset.flowMode;previewMode=null;setFlowMode(selectedMode);setPressed(selectedMode);schedule();});
    });
    setPressed(selectedMode);

    hero.addEventListener('focusin',function(event){
      var target=event.target.closest('a,button');
      if(!target)return;
      var targetRect=target.getBoundingClientRect();
      var heroRect=hero.getBoundingClientRect();
      focusPoint.active=true;
      focusPoint.x=targetRect.left+targetRect.width*.5-heroRect.left;
      focusPoint.y=targetRect.top+targetRect.height*.5-heroRect.top;
      schedule();
    });
    hero.addEventListener('focusout',function(){
      window.setTimeout(function(){if(!hero.contains(document.activeElement))focusPoint.active=false;},0);
    });

    window.addEventListener('scroll',function(){
      scrollDirty=true;
      if(visible&&motionAllowed())schedule();
    },{passive:true});
    if('ResizeObserver' in window)new ResizeObserver(resize).observe(hero);
    else window.addEventListener('resize',resize);
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        visible=entries[0]?entries[0].isIntersecting:true;
        if(visible){scrollDirty=true;schedule();}else stop();
      },{threshold:0,rootMargin:'80px 0px'}).observe(hero);
    }
    subscribeMotion(function(allowed,reduced){
      if(reduced)drawReduced();
      else if(allowed){scrollDirty=true;schedule();}
      else stop();
    });
    resize();
  })();

  // Expertise uses a single, event-driven Canvas. Each discipline owns a visual grammar.
  (function expertiseField(){
    var canvas=document.getElementById('expertiseVfx');
    var section=document.getElementById('expertise');
    if(!canvas||!section)return;
    var ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)return;
    var metrics={width:1,height:1,rect:canvas.getBoundingClientRect()};
    var frameId=0;
    var active=null;
    var activeCard=null;
    var visible=false;
    var releaseTimer=0;
    var lastFrame=0;

    function resize(){
      metrics=canvasScale(canvas,ctx,window.innerWidth<650?1:1.5);
      if(active&&activeCard){
        active.origin=cardPoint(activeCard);
        if(reduceQuery.matches){ctx.clearRect(0,0,metrics.width,metrics.height);drawMode(active.mode,active.origin,1);}
      }else drawIdle(reduceQuery.matches);
    }

    function cardPoint(card){
      var cardRect=card.getBoundingClientRect();
      var canvasRect=canvas.getBoundingClientRect();
      return {x:cardRect.left+cardRect.width*.5-canvasRect.left,y:cardRect.top+cardRect.height*.36-canvasRect.top,w:cardRect.width,h:cardRect.height};
    }

    function drawIdle(reduced){
      ctx.clearRect(0,0,metrics.width,metrics.height);
      if(reduced){
        var productCard=section.querySelector('[data-expertise-mode="grid"]');
        if(productCard)drawGrid(cardPoint(productCard),1);
        return;
      }
      ctx.globalAlpha=.08;
      ctx.fillStyle='#00d4ff';
      for(var i=0;i<18;i++){
        var x=metrics.width*(.08+seeded(i,20)*.84);
        var y=metrics.height*(.16+seeded(i,21)*.68);
        ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=1;
    }

    function drawGrid(origin,progress){
      var spread=easeOut(progress);
      var extent=Math.min(230,origin.w*.74)*spread;
      ctx.strokeStyle='rgba(94,234,212,'+(.12+.2*(1-progress*.35))+')';
      ctx.lineWidth=1;
      for(var i=-5;i<=5;i++){
        var offset=i*extent/5;
        ctx.beginPath();ctx.moveTo(origin.x+offset,origin.y-extent*.58);ctx.lineTo(origin.x+offset,origin.y+extent*.58);ctx.stroke();
        ctx.beginPath();ctx.moveTo(origin.x-extent,origin.y+offset*.58);ctx.lineTo(origin.x+extent,origin.y+offset*.58);ctx.stroke();
      }
      ctx.fillStyle='rgba(0,212,255,.8)';
      for(var n=0;n<15;n++){
        var nx=origin.x+(seeded(n,30)-.5)*extent*1.8;
        var ny=origin.y+(seeded(n,31)-.5)*extent;
        ctx.beginPath();ctx.arc(nx,ny,1.3+progress,0,Math.PI*2);ctx.fill();
      }
    }

    function drawNodes(origin,progress){
      var points=[[-.34,-.12],[-.15,.26],[.1,-.28],[.36,.08],[.2,.3],[-.02,0]];
      var scale=Math.min(origin.w*.86,310)*easeOut(progress);
      var positions=points.map(function(point){return {x:origin.x+point[0]*scale,y:origin.y+point[1]*scale};});
      ctx.strokeStyle='rgba(0,212,255,.3)';ctx.lineWidth=1;
      [[0,5],[1,5],[2,5],[3,5],[4,5],[1,4],[2,3]].forEach(function(edge){
        ctx.beginPath();ctx.moveTo(positions[edge[0]].x,positions[edge[0]].y);ctx.lineTo(positions[edge[1]].x,positions[edge[1]].y);ctx.stroke();
      });
      positions.forEach(function(point,index){
        var pulse=2.5+(index===5?5:2)*Math.sin(progress*Math.PI);
        ctx.fillStyle=index===5?'rgba(94,234,212,.9)':'rgba(0,212,255,.75)';
        ctx.beginPath();ctx.arc(point.x,point.y,3+pulse*.25,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(94,234,212,.24)';ctx.beginPath();ctx.arc(point.x,point.y,6+pulse,0,Math.PI*2);ctx.stroke();
      });
    }

    function drawTrails(origin,progress){
      var extent=Math.min(origin.w,360)*easeOut(progress);
      var palette=['rgba(192,132,252,.66)','rgba(0,212,255,.52)','rgba(255,107,127,.48)'];
      for(var i=0;i<3;i++){
        var startX=origin.x-extent*.48;
        var startY=origin.y+(i-1)*34;
        var endX=origin.x-extent*.48+extent*progress;
        var endY=origin.y+(i-1)*34+Math.sin(progress*Math.PI+i)*42;
        ctx.strokeStyle=palette[i];ctx.lineWidth=i===0?1.6:1;
        ctx.beginPath();ctx.moveTo(startX,startY);ctx.quadraticCurveTo(origin.x,origin.y-75+i*42,endX,endY);ctx.stroke();
        ctx.fillStyle=palette[i];ctx.beginPath();ctx.arc(endX,endY,2.5,0,Math.PI*2);ctx.fill();
      }
    }

    function drawRipple(origin,progress){
      for(var i=0;i<4;i++){
        var local=clamp(progress-i*.09,0,1);
        var radius=easeOut(local)*(42+i*34);
        ctx.strokeStyle='rgba('+(i%2?'192,132,252':'255,107,127')+','+(Math.max(.08,.48-local*.34))+')';
        ctx.lineWidth=i===0?1.8:1;
        ctx.beginPath();ctx.ellipse(origin.x,origin.y,radius*1.35,radius*.72,0,0,Math.PI*2);ctx.stroke();
      }
      ctx.fillStyle='rgba(255,107,127,'+(.16+.22*(1-progress))+')';
      ctx.beginPath();ctx.arc(origin.x,origin.y,3+8*Math.sin(progress*Math.PI),0,Math.PI*2);ctx.fill();
    }

    function drawMode(mode,origin,progress){
      if(mode==='nodes')drawNodes(origin,progress);
      else if(mode==='trails')drawTrails(origin,progress);
      else if(mode==='ripple')drawRipple(origin,progress);
      else drawGrid(origin,progress);
    }

    function render(time){
      frameId=0;
      if(!active||!visible||!motionAllowed())return;
      if(window.innerWidth<650&&time-lastFrame<33){frameId=requestAnimationFrame(render);return;}
      lastFrame=time;
      var progress=clamp((time-active.start)/active.duration,0,1);
      ctx.clearRect(0,0,metrics.width,metrics.height);
      drawMode(active.mode,active.origin,progress);
      if(progress<1)frameId=requestAnimationFrame(render);
    }

    function activate(card){
      if(!card||!visible)return false;
      if(!reduceQuery.matches&&!motionAllowed())return false;
      if(activeCard===card&&active&&performance.now()-active.start<140)return true;
      window.clearTimeout(releaseTimer);
      if(activeCard)activeCard.classList.remove('is-motion-active');
      activeCard=card;activeCard.classList.add('is-motion-active');
      active={mode:card.dataset.expertiseMode||'grid',origin:cardPoint(card),start:performance.now(),duration:activeCard.dataset.expertiseMode==='ripple'?820:720};
      if(frameId)cancelAnimationFrame(frameId);
      frameId=0;
      if(reduceQuery.matches){
        ctx.clearRect(0,0,metrics.width,metrics.height);
        drawMode(active.mode,active.origin,1);
        return true;
      }
      lastFrame=0;
      frameId=requestAnimationFrame(render);
      return true;
    }

    function release(card,delay,force){
      window.clearTimeout(releaseTimer);
      releaseTimer=window.setTimeout(function(){
        if(!force&&card&&card.matches(':focus-within'))return;
        if(activeCard)activeCard.classList.remove('is-motion-active');
        activeCard=null;active=null;
        drawIdle(reduceQuery.matches);
      },typeof delay==='number'?delay:360);
    }

    Array.prototype.slice.call(section.querySelectorAll('[data-expertise-mode]')).forEach(function(card){
      var trigger=card.querySelector('.exp-motion-trigger');
      var touchStart=null;
      var lastTouchAt=0;
      card.addEventListener('pointerenter',function(){if(finePointerQuery.matches)activate(card);});
      card.addEventListener('pointerleave',function(){if(finePointerQuery.matches)release(card);});
      if(trigger){
        trigger.addEventListener('focus',function(){activate(card);});
        trigger.addEventListener('blur',function(){release(card);});
        trigger.addEventListener('click',function(){
          if(activate(card)&&Date.now()-lastTouchAt<500)release(card,1800,true);
        });
        trigger.addEventListener('pointerdown',function(event){if(event.pointerType==='touch')touchStart={x:event.clientX,y:event.clientY};},{passive:true});
        trigger.addEventListener('pointerup',function(event){
          if(event.pointerType!=='touch'||!touchStart)return;
          if(Math.hypot(event.clientX-touchStart.x,event.clientY-touchStart.y)<8)lastTouchAt=Date.now();
          touchStart=null;
        },{passive:true});
        trigger.addEventListener('pointercancel',function(){touchStart=null;},{passive:true});
      }
    });

    if('ResizeObserver' in window)new ResizeObserver(resize).observe(section);
    else window.addEventListener('resize',resize);
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        visible=entries[0]?entries[0].isIntersecting:true;
        if(!visible){
          if(frameId)cancelAnimationFrame(frameId);
          frameId=0;window.clearTimeout(releaseTimer);
          if(activeCard)activeCard.classList.remove('is-motion-active');
          active=null;activeCard=null;
          ctx.clearRect(0,0,metrics.width,metrics.height);
        }else drawIdle(reduceQuery.matches);
      },{threshold:.05,rootMargin:'100px 0px'}).observe(section);
    }else visible=true;
    subscribeMotion(function(allowed,reduced){
      if(!allowed&&frameId){cancelAnimationFrame(frameId);frameId=0;}
      if(reduced||!allowed){active=null;if(activeCard)activeCard.classList.remove('is-motion-active');activeCard=null;drawIdle(reduced);}
    });
    resize();
  })();

  // Project micro-motion shares one scheduler so only one thumbnail animates at a time.
  (function projectEffects(){
    var definitions=[
      {id:'proj-bizsim',effect:'nodes',duration:760},
      {id:'proj-exile',effect:'sparks',duration:680},
      {id:'proj-dream',effect:'shockwave',duration:560},
      {id:'proj-calli',effect:'ink',duration:960}
    ];
    var entries=[];
    var active=null;
    var frameId=0;
    var clearTimer=0;
    var previewQueue=[];

    definitions.forEach(function(definition){
      var project=document.getElementById(definition.id);
      var thumb=project?project.querySelector('.proj-thumb'):null;
      if(!project||!thumb)return;
      var canvas=document.createElement('canvas');
      canvas.className='project-fx fx-'+definition.effect;
      canvas.setAttribute('aria-hidden','true');
      thumb.appendChild(canvas);
      var context=canvas.getContext('2d',{alpha:true});
      if(!context)return;
      var entry={project:project,thumb:thumb,canvas:canvas,ctx:context,effect:definition.effect,duration:definition.duration,metrics:null,previewed:false,visible:true,touchStart:null};
      entries.push(entry);
      project.addEventListener('pointerenter',function(){if(finePointerQuery.matches)activate(entry);});
      project.addEventListener('focusin',function(event){
        if(!event.relatedTarget||!project.contains(event.relatedTarget))activate(entry);
      });
      project.addEventListener('pointerdown',function(event){
        if(event.pointerType==='touch')entry.touchStart={x:event.clientX,y:event.clientY};
      },{passive:true});
      project.addEventListener('pointerup',function(event){
        if(event.pointerType!=='touch'||!entry.touchStart)return;
        if(Math.hypot(event.clientX-entry.touchStart.x,event.clientY-entry.touchStart.y)<8)activate(entry);
        entry.touchStart=null;
      },{passive:true});
      project.addEventListener('pointercancel',function(){entry.touchStart=null;},{passive:true});
    });

    function sizeEntry(entry){entry.metrics=canvasScale(entry.canvas,entry.ctx,window.innerWidth<650?1:1.5);}
    function clearEntry(entry){
      if(!entry)return;
      if(entry.metrics)entry.ctx.clearRect(0,0,entry.metrics.width,entry.metrics.height);
      entry.project.classList.remove('is-fx-active');
    }

    function drawAgentNodes(entry,progress){
      var ctx=entry.ctx,w=entry.metrics.width,h=entry.metrics.height;
      var envelope=Math.sin(Math.PI*progress);
      var center={x:w*.52,y:h*.55};
      var agents=[{x:w*.23,y:h*.25},{x:w*.78,y:h*.26},{x:w*.82,y:h*.72},{x:w*.2,y:h*.75}];
      ctx.lineWidth=1;
      agents.forEach(function(agent,index){
        ctx.strokeStyle='rgba(94,234,212,'+(.46*envelope)+')';
        ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(agent.x,agent.y);ctx.stroke();
        var travel=clamp(progress*1.4-index*.08,0,1);
        var dotX=lerp(center.x,agent.x,travel),dotY=lerp(center.y,agent.y,travel);
        ctx.fillStyle='rgba(0,212,255,'+(.86*envelope)+')';ctx.beginPath();ctx.arc(dotX,dotY,2.2,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(0,212,255,'+(.35*envelope)+')';ctx.beginPath();ctx.arc(agent.x,agent.y,4+5*envelope,0,Math.PI*2);ctx.stroke();
      });
      ctx.fillStyle='rgba(94,234,212,'+(.92*envelope)+')';ctx.beginPath();ctx.arc(center.x,center.y,4+4*envelope,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(94,234,212,'+(.38*envelope)+')';ctx.beginPath();ctx.arc(center.x,center.y,12+progress*12,0,Math.PI*2);ctx.stroke();
    }

    function drawSparks(entry,progress){
      var ctx=entry.ctx,w=entry.metrics.width,h=entry.metrics.height;
      for(var i=0;i<9;i++){
        var delay=i*.035;
        var local=clamp((progress-delay)/(1-delay),0,1);
        var originX=w*(.38+seeded(i,40)*.28);
        var x=originX+(seeded(i,41)-.5)*w*.28*local;
        var y=h*.82-local*h*(.28+seeded(i,42)*.42);
        var alpha=(1-local)*.8;
        ctx.strokeStyle=i%3===0?'rgba(192,132,252,'+alpha+')':'rgba(255,107,127,'+alpha+')';
        ctx.lineWidth=1.2;
        ctx.beginPath();ctx.moveTo(x,y+8+local*14);ctx.lineTo(x,y);ctx.stroke();
        ctx.fillStyle='rgba(255,245,235,'+alpha+')';ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();
      }
    }

    function drawShockwave(entry,progress){
      var ctx=entry.ctx,w=entry.metrics.width,h=entry.metrics.height;
      var alpha=Math.max(0,1-progress);
      for(var i=0;i<3;i++){
        var local=clamp(progress-i*.1,0,1);
        var radius=easeOut(local)*Math.min(w,h)*(.34+i*.09);
        ctx.strokeStyle=i===0?'rgba(255,107,127,'+(alpha*.8)+')':'rgba(192,132,252,'+(alpha*.52)+')';
        ctx.lineWidth=i===0?2:1;
        ctx.beginPath();ctx.ellipse(w*.5,h*.53,radius*1.65,radius*.56,-.08,0,Math.PI*2);ctx.stroke();
      }
      ctx.fillStyle='rgba(255,245,235,'+(alpha*.7)+')';ctx.beginPath();ctx.arc(w*.5,h*.53,2+8*Math.sin(progress*Math.PI),0,Math.PI*2);ctx.fill();
    }

    function drawInk(entry,progress){
      var ctx=entry.ctx,w=entry.metrics.width,h=entry.metrics.height;
      var envelope=Math.sin(Math.PI*progress);
      var blooms=[{x:.36,y:.54,r:.2},{x:.62,y:.46,r:.16},{x:.52,y:.68,r:.12}];
      blooms.forEach(function(bloom,index){
        var local=clamp((progress-index*.12)/(1-index*.12),0,1);
        var radius=easeOut(local)*Math.min(w,h)*bloom.r;
        var gradient=ctx.createRadialGradient(w*bloom.x,h*bloom.y,0,w*bloom.x,h*bloom.y,Math.max(1,radius));
        gradient.addColorStop(0,'rgba(5,9,28,'+(.5*(1-local*.34)*envelope)+')');
        gradient.addColorStop(.68,'rgba(5,9,28,'+(.28*(1-local*.5)*envelope)+')');
        gradient.addColorStop(1,'rgba(5,9,28,0)');
        ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(w*bloom.x,h*bloom.y,radius,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(94,234,212,'+(.2*(1-local*.5)*envelope)+')';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(w*bloom.x,h*bloom.y,radius*.82,0,Math.PI*2);ctx.stroke();
      });
    }

    function drawActive(progress){
      var entry=active.entry;
      var ctx=entry.ctx;
      ctx.clearRect(0,0,entry.metrics.width,entry.metrics.height);
      if(entry.effect==='sparks')drawSparks(entry,progress);
      else if(entry.effect==='shockwave')drawShockwave(entry,progress);
      else if(entry.effect==='ink')drawInk(entry,progress);
      else drawAgentNodes(entry,progress);
    }

    function render(time){
      frameId=0;
      if(!active||!motionAllowed())return;
      var progress=clamp((time-active.start)/active.entry.duration,0,1);
      drawActive(progress);
      if(progress<1)frameId=requestAnimationFrame(render);
      else clearTimer=window.setTimeout(function(){
        if(active){clearEntry(active.entry);active=null;}
        pumpPreviewQueue();
      },120);
    }

    function activate(entry){
      if(!entry||!entry.visible||!motionAllowed()||reduceQuery.matches)return false;
      if(active&&active.entry===entry)return false;
      window.clearTimeout(clearTimer);
      if(active&&active.entry!==entry)clearEntry(active.entry);
      if(frameId)cancelAnimationFrame(frameId);
      sizeEntry(entry);
      entry.project.classList.add('is-fx-active');
      active={entry:entry,start:performance.now()};
      if(coarsePointerQuery.matches)entry.previewed=true;
      frameId=requestAnimationFrame(render);
      return true;
    }

    function stopActive(){
      if(frameId)cancelAnimationFrame(frameId);
      frameId=0;
      window.clearTimeout(clearTimer);
      if(active)clearEntry(active.entry);
      active=null;
    }

    function queuePreview(entry){
      if(!entry||entry.previewed||!entry.visible||previewQueue.indexOf(entry)!==-1)return;
      previewQueue.push(entry);
      pumpPreviewQueue();
    }

    function pumpPreviewQueue(){
      if(active||!motionAllowed()||reduceQuery.matches)return;
      while(previewQueue.length){
        var next=previewQueue.shift();
        if(next.visible&&!next.previewed&&activate(next))return;
      }
    }

    if('IntersectionObserver' in window){
      var observer=new IntersectionObserver(function(observations){
        observations.forEach(function(observation){
          var entry=entries.find(function(candidate){return candidate.project===observation.target;});
          if(!entry)return;
          entry.visible=observation.isIntersecting;
          if(!entry.visible){
            previewQueue=previewQueue.filter(function(candidate){return candidate!==entry;});
            if(active&&active.entry===entry){stopActive();pumpPreviewQueue();}
          }else if(coarsePointerQuery.matches&&observation.intersectionRatio>=.62)queuePreview(entry);
        });
      },{threshold:[0,.62]});
      entries.forEach(function(entry){observer.observe(entry.project);});
    }

    if('ResizeObserver' in window){
      var projectResizeObserver=new ResizeObserver(function(records){
        records.forEach(function(record){
          var entry=entries.find(function(candidate){return candidate.thumb===record.target;});
          if(entry&&entry.metrics)sizeEntry(entry);
        });
      });
      entries.forEach(function(entry){projectResizeObserver.observe(entry.thumb);});
    }else window.addEventListener('resize',function(){entries.forEach(function(entry){if(entry.metrics)sizeEntry(entry);});},{passive:true});
    subscribeMotion(function(allowed){
      if(!allowed){
        stopActive();
        entries.forEach(clearEntry);
      }else pumpPreviewQueue();
    });
  })();
})();
