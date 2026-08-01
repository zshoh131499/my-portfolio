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
    if(!motionButton)return;
    var systemReduced=reduceQuery.matches;
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
    var pointer={active:false,x:0,y:0};
    var focusPoint={active:false,x:0,y:0};
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
    var colors=['#00d4ff','#5eead4','#fff5eb','#c084fc','#ff6b7f'];

    function chooseParticleCount(){
      lowQuality=window.innerWidth<650||saveData||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
      if(lowQuality)return 30;
      if(window.innerWidth<1000)return 52;
      return 80;
    }

    function resetParticles(count){
      count=count||chooseParticleCount();
      particles=[];
      for(var i=0;i<count;i++){
        var x=metrics.width*(.42+seeded(i,1)*.56);
        var y=metrics.height*(.1+seeded(i,2)*.78);
        particles.push({x:x,y:y,vx:0,vy:0,size:.7+seeded(i,3)*1.35,seed:seeded(i,4),color:colors[i%colors.length]});
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
      if(mode==='ux'){
        var uxX=w*(.49+t*.47);
        var uxY=h*(.24+t*.5+Math.sin(t*Math.PI*3.2)*.1);
        return {x:uxX,y:uxY};
      }
      if(mode==='game'){
        var angle=t*Math.PI*2;
        var ring=index%3;
        var radiusX=w*(.09+ring*.055);
        var radiusY=h*(.12+ring*.06);
        return {x:w*.76+Math.cos(angle*2+ring)*radiusX,y:h*.5+Math.sin(angle*3)*radiusY};
      }
      if(mode==='vfx'){
        var spiralAngle=t*Math.PI*5.2;
        var spiralRadius=t*Math.min(w*.28,h*.4);
        return {x:w*.73+Math.cos(spiralAngle)*spiralRadius,y:h*.5+Math.sin(spiralAngle)*spiralRadius*.72};
      }
      var columns=8;
      var rows=Math.ceil(count/columns);
      var column=index%columns;
      var row=Math.floor(index/columns);
      return {x:w*(.55+(column/Math.max(1,columns-1))*.39),y:h*(.21+(row/Math.max(1,rows-1))*.58)};
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
      return {x:landingAnchor.x+(seeded(index,8)-.5)*10,y:landingAnchor.y-(index%8)*1.15};
    }

    function updateContract(force){
      if(!force&&!scrollDirty)return;
      scrollDirty=false;
      var rect=hero.getBoundingClientRect();
      var raw=clamp(-rect.top/Math.max(1,rect.height*.82),0,1);
      var nextContract=smoothstep(.24,.94,raw);
      if(!force&&Math.abs(nextContract-contract)<.002)return;
      contract=nextContract;
      if(bridge)bridge.style.setProperty('--bridge-energy',contract.toFixed(3));
      if(featured)featured.style.setProperty('--flow-arrival',contract.toFixed(3));
    }

    function desiredPoint(particle,index,time){
      var mode=previewMode||selectedMode;
      var formation=flowPoint(mode,index,particles.length);
      var landing=landingPoint(index);
      var wander=(1-contract)*(3+particle.seed*5);
      var x=lerp(formation.x,landing.x,contract)+Math.sin(time*.0007+particle.seed*18)*wander;
      var y=lerp(formation.y,landing.y,contract)+Math.cos(time*.00055+particle.seed*12)*wander;
      if(focusPoint.active&&contract<.6){
        var focusBlend=.075*(1-contract);
        x=lerp(x,focusPoint.x,focusBlend);
        y=lerp(y,focusPoint.y,focusBlend);
      }
      return {x:x,y:y};
    }

    function applyRepulsion(particle,source,radius,strength){
      var dx=particle.x-source.x;
      var dy=particle.y-source.y;
      var distance=Math.sqrt(dx*dx+dy*dy)||1;
      if(distance>=radius)return;
      var force=(1-distance/radius)*strength;
      particle.vx+=(dx/distance)*force;
      particle.vy+=(dy/distance)*force;
    }

    function drawConnections(){
      if(lowQuality||contract>.72)return;
      ctx.lineWidth=.55;
      for(var i=0;i<particles.length;i++){
        for(var j=i+1;j<particles.length;j++){
          var dx=particles[i].x-particles[j].x;
          var dy=particles[i].y-particles[j].y;
          var distance=Math.sqrt(dx*dx+dy*dy);
          if(distance<62){
            ctx.strokeStyle='rgba(0,212,255,'+(Math.max(0,1-distance/62)*.12*(1-contract)).toFixed(3)+')';
            ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.stroke();
          }
        }
      }
    }

    function drawModeGuide(){
      if(contract>.78)return;
      var mode=previewMode||selectedMode;
      var opacity=(1-contract)*(mode==='product'?.17:.11);
      ctx.globalAlpha=opacity;
      ctx.lineWidth=.7;
      ctx.strokeStyle=mode==='vfx'?'#ff6b7f':(mode==='game'?'#c084fc':(mode==='product'?'#5eead4':'#00d4ff'));
      ctx.beginPath();
      if(mode==='product'){
        var columns=8;
        var rows=Math.ceil(particles.length/columns);
        for(var column=0;column<columns;column++){
          var top=flowPoint('product',column,particles.length);
          var bottom=flowPoint('product',(rows-1)*columns+column,particles.length);
          ctx.moveTo(top.x,top.y);ctx.lineTo(bottom.x,bottom.y);
        }
        for(var row=0;row<rows;row++){
          var left=flowPoint('product',row*columns,particles.length);
          var right=flowPoint('product',row*columns+columns-1,particles.length);
          ctx.moveTo(left.x,left.y);ctx.lineTo(right.x,right.y);
        }
      }else{
        var samples=42;
        for(var sample=0;sample<samples;sample++){
          var point=flowPoint(mode,sample,samples);
          if(sample===0)ctx.moveTo(point.x,point.y);else ctx.lineTo(point.x,point.y);
        }
      }
      ctx.stroke();
      ctx.globalAlpha=1;
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
      var rippleAge=ripple?(time-ripple.start)/720:2;

      particles.forEach(function(particle,index){
        var target=desiredPoint(particle,index,time);
        var spring=contract>.65?.026:.014;
        particle.vx+=(target.x-particle.x)*spring*delta;
        particle.vy+=(target.y-particle.y)*spring*delta;
        if(pointer.active&&contract<.88)applyRepulsion(particle,pointer,125,1.4*delta*(1-contract));
        if(focusPoint.active&&contract<.72)applyRepulsion(particle,focusPoint,86,.5*delta);
        if(ripple&&rippleAge<1){
          var expanding={x:ripple.x,y:ripple.y};
          var dx=particle.x-expanding.x;
          var dy=particle.y-expanding.y;
          var distance=Math.sqrt(dx*dx+dy*dy)||1;
          var waveRadius=30+rippleAge*180;
          var proximity=Math.max(0,1-Math.abs(distance-waveRadius)/42);
          particle.vx+=(dx/distance)*proximity*1.8*(1-rippleAge);
          particle.vy+=(dy/distance)*proximity*1.8*(1-rippleAge);
        }
        var damping=Math.pow(contract>.72?.76:.84,delta);
        particle.vx*=damping;particle.vy*=damping;
        particle.x+=particle.vx*delta;particle.y+=particle.vy*delta;
      });

      drawModeGuide();
      drawConnections();
      particles.forEach(function(particle,index){
        var pulse=.78+Math.sin(time*.002+particle.seed*10)*.22;
        var size=particle.size*(1+contract*.5)*pulse;
        ctx.globalAlpha=clamp(.44+contract*.42,0,1);
        ctx.fillStyle=particle.color;
        ctx.beginPath();ctx.arc(particle.x,particle.y,size,0,Math.PI*2);ctx.fill();
        if(index%13===0){
          ctx.globalAlpha=.12*(1-contract);
          ctx.beginPath();ctx.arc(particle.x,particle.y,size*3.4,0,Math.PI*2);ctx.strokeStyle=particle.color;ctx.stroke();
        }
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
        ctx.globalAlpha=.45;
        ctx.fillStyle=colors[i%colors.length];
        ctx.beginPath();ctx.arc(point.x,point.y,1.2,0,Math.PI*2);ctx.fill();
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
      pointer.active=true;pointer.x=point.x;pointer.y=point.y;schedule();
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
      button.addEventListener('pointerenter',function(){if(finePointerQuery.matches){previewMode=button.dataset.flowMode;schedule();}});
      button.addEventListener('pointerleave',function(){previewMode=null;});
      button.addEventListener('focus',function(){previewMode=button.dataset.flowMode;schedule();});
      button.addEventListener('blur',function(){previewMode=null;});
      button.addEventListener('click',function(){selectedMode=button.dataset.flowMode;previewMode=null;setPressed(selectedMode);schedule();});
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
