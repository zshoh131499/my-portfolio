/* Motion enhancements: smooth scroll, text reveals, scroll-linked parallax,
   cursor follower and magnetic controls. Layered on top of motion.js and
   fully optional: if GSAP fails to load, the page keeps its CSS fallbacks. */
(function(){
  'use strict';

  var root=document.documentElement;
  if(typeof window.gsap==='undefined'){root.classList.add('no-enhance');return;}
  var gsap=window.gsap;
  var ScrollTrigger=window.ScrollTrigger||null;
  var SplitText=window.SplitText||null;
  if(ScrollTrigger)gsap.registerPlugin(ScrollTrigger);
  if(SplitText)gsap.registerPlugin(SplitText);
  if(!ScrollTrigger){root.classList.add('no-enhance');return;}

  var siteMotion=window.siteMotion||null;
  var finePointer=window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduceQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
  var EASE_OUT='power4.out';
  var EASE_SOFT='power3.out';
  var MAIL='taczuishuai@gmail.com';

  var state={
    base:false,rich:false,
    baseTriggers:[],baseTweens:[],baseCleanups:[],
    richTriggers:[],richTweens:[],richCleanups:[],
    lenis:null,lenisTick:null,
    marquee:null,marqueeVisible:false,
    heroMasks:[]
  };

  function profileTier(){
    try{return siteMotion?siteMotion.getProfile().tier:'full';}catch(error){return 'full';}
  }
  function userPaused(){
    try{return siteMotion?siteMotion.isPaused():false;}catch(error){return false;}
  }
  function motionAllowedNow(){
    try{return siteMotion?siteMotion.isAllowed():!reduceQuery.matches;}catch(error){return true;}
  }
  function baseAllowed(){return !reduceQuery.matches&&profileTier()!=='static';}
  function richAllowed(){return baseAllowed()&&!userPaused();}
  function pointerIsFine(){return finePointer.matches;}
  function $(selector,scope){return Array.prototype.slice.call((scope||document).querySelectorAll(selector));}

  /* ------------------------------------------------------------------ */
  /* Base layer: entrance choreography and scroll reveals                 */
  /* ------------------------------------------------------------------ */

  function trackBase(item){
    if(!item)return item;
    if(item.scrollTrigger||item.vars)state.baseTweens.push(item);
    else state.baseTriggers.push(item);
    return item;
  }

  function heroIntro(){
    var hero=document.getElementById('hero');
    if(!hero)return;
    var h1=hero.querySelector('h1');
    var lines=$('h1 .line',hero);
    state.heroMasks=lines.map(function(line){
      var parent=line.parentElement;
      if(parent&&parent.classList.contains('mask'))return parent;
      var mask=document.createElement('span');
      mask.className='mask';
      parent.insertBefore(mask,line);
      mask.appendChild(line);
      return mask;
    });
    var tag=hero.querySelector('.hero-tag');
    var pills=$('.role-pill',hero);
    var desc=hero.querySelector('.hero-desc');
    var ctas=$('.hero-cta .btn',hero);
    var corner=[hero.querySelector('.hero-motion-toggle'),hero.querySelector('.hero-motion-caption')].filter(Boolean);
    var video=hero.querySelector('.hero-video');
    var navItems=$('.nav-logo, .nav-links li, .menu-btn');

    var tl=gsap.timeline({
      defaults:{ease:EASE_OUT},
      onComplete:function(){
        state.heroMasks.forEach(function(mask){mask.classList.add('is-open');});
        gsap.set([tag,desc,pills,ctas,corner,navItems],{clearProps:'transform,opacity'});
      }
    });
    if(video)tl.fromTo(video,{scale:1.06},{scale:1,duration:2.2,ease:'power2.out',clearProps:'transform'},0);
    if(navItems.length)tl.from(navItems,{y:-14,opacity:0,duration:.8,stagger:.05},.1);
    if(tag)tl.from(tag,{y:14,opacity:0,duration:.7},.25);
    if(lines.length)tl.from(lines,{yPercent:112,duration:1.15,stagger:.11},.32);
    if(pills.length)tl.from(pills,{y:12,opacity:0,duration:.6,stagger:.06},.8);
    if(desc)tl.from(desc,{y:16,opacity:0,duration:.7},.95);
    if(ctas.length)tl.from(ctas,{y:16,opacity:0,duration:.7,stagger:.08},1.05);
    if(corner.length)tl.from(corner,{opacity:0,duration:.6},1.25);
    state.baseTweens.push(tl);
    if(h1)h1.setAttribute('data-intro','played');
  }

  function scrollProgress(){
    var bar=document.querySelector('.scroll-progress');
    if(!bar)return;
    trackBase(gsap.to(bar,{scaleX:1,ease:'none',scrollTrigger:{start:0,end:'max',scrub:.35}}));
  }

  /* Section titles: split into masked lines the moment they enter, then
     hand the original markup back so nothing stays wrapped or clipped. */
  function titleReveals(){
    var titles=$('.stitle').filter(function(el){return !el.closest('#hero');});
    titles.forEach(function(title){
      trackBase(ScrollTrigger.create({
        trigger:title,start:'top 88%',once:true,
        onEnter:function(){playTitle(title);}
      }));
    });
  }

  function playTitle(title){
    if(!SplitText||title.dataset.revealed)return;
    title.dataset.revealed='true';
    var split;
    try{
      split=SplitText.create(title,{type:'lines',mask:'lines',linesClass:'st-line'});
    }catch(error){
      gsap.from(title,{y:24,opacity:0,duration:.9,ease:EASE_SOFT,clearProps:'all'});
      return;
    }
    gsap.from(split.lines,{
      yPercent:110,duration:1.05,stagger:.1,ease:EASE_OUT,
      onComplete:function(){split.revert();}
    });
  }

  function fadeGroup(targets,trigger,options){
    targets=targets.filter(Boolean);
    if(!targets.length)return;
    var vars={
      y:options&&options.y!==undefined?options.y:24,
      opacity:0,duration:options&&options.duration||.9,ease:EASE_SOFT,
      stagger:options&&options.stagger!==undefined?options.stagger:.08,
      clearProps:'transform,opacity',
      scrollTrigger:{trigger:trigger||targets[0],start:options&&options.start||'top 88%',once:true}
    };
    trackBase(gsap.from(targets,vars));
  }

  function contentReveals(){
    $('.stag').filter(function(el){return !el.closest('#hero');}).forEach(function(tag){
      fadeGroup([tag],tag,{y:0,x:-10,duration:.7});
    });
    fadeGroup([document.querySelector('.projects .section-note')],null,{});
    fadeGroup($('.about-text p'),document.querySelector('.about-text'),{stagger:.12});
    fadeGroup([document.querySelector('.about-card')],null,{y:36,duration:1});
    fadeGroup($('.exp-card'),document.querySelector('.expertise-cards'),{y:30,stagger:.09});
    fadeGroup($('.edu-card'),document.querySelector('.edu-cards'),{y:30,stagger:.12});
    fadeGroup([document.querySelector('.signal-intro')],null,{});
    var contact=document.querySelector('.contact-inner');
    if(contact){
      fadeGroup($('.contact-desc, .contact-btns a, .contact-row, .contact-meta',contact),contact,{stagger:.1,start:'top 80%'});
    }
  }

  function projectReveals(){
    $('.proj').forEach(function(card){
      var thumb=card.querySelector('.proj-thumb');
      var image=thumb?thumb.querySelector('img'):null;
      var info=$('.proj-info > *',card);
      var gallery=card.querySelector('.proj-gallery');
      var tl=gsap.timeline({
        defaults:{ease:EASE_OUT},
        scrollTrigger:{trigger:card,start:'top 82%',once:true},
        onComplete:function(){
          gsap.set(card,{clearProps:'transform,opacity'});
          if(thumb)gsap.set(thumb,{clearProps:'clipPath'});
          gsap.set(info.concat(gallery||[]),{clearProps:'transform,opacity'});
        }
      });
      tl.from(card,{y:44,opacity:0,duration:1,ease:EASE_SOFT},0);
      if(thumb)tl.fromTo(thumb,{clipPath:'inset(100% 0% 0% 0%)'},{clipPath:'inset(0% 0% 0% 0%)',duration:1.25},.05);
      if(image)tl.fromTo(image,{scale:1.22},{scale:1,duration:1.6,ease:'power2.out'},.05);
      if(info.length)tl.from(info,{y:18,opacity:0,duration:.75,stagger:.06},.3);
      if(gallery)tl.from(gallery,{y:14,opacity:0,duration:.7},.6);
      state.baseTweens.push(tl);
    });
  }

  function timelineDraw(){
    var timeline=document.querySelector('.timeline');
    var progress=timeline?timeline.querySelector('.timeline-progress'):null;
    if(!progress)return;
    trackBase(gsap.to(progress,{scaleY:1,ease:'none',scrollTrigger:{trigger:timeline,start:'top 72%',end:'bottom 72%',scrub:.6}}));
  }

  function buildBase(){
    if(state.base)return;
    state.base=true;
    root.classList.add('is-enhanced');
    heroIntro();
    scrollProgress();
    titleReveals();
    contentReveals();
    projectReveals();
    timelineDraw();
    ScrollTrigger.refresh();
  }

  function teardownBase(){
    if(!state.base)return;
    state.base=false;
    state.baseTweens.forEach(function(tween){
      if(tween.scrollTrigger)tween.scrollTrigger.kill();
      tween.progress(1).kill();
    });
    state.baseTriggers.forEach(function(trigger){trigger.kill();});
    state.baseTweens=[];state.baseTriggers=[];
    state.heroMasks.forEach(function(mask){mask.classList.add('is-open');});
    gsap.set('.hero-tag, .hero h1 .line, .role-pill, .hero-desc, .hero-cta .btn, .hero-motion-toggle, .hero-motion-caption, .nav-logo, .nav-links li, .menu-btn, .proj, .proj-thumb, .proj-thumb img, .proj-info > *, .proj-gallery, .stag, .section-note, .about-text p, .about-card, .exp-card, .edu-card, .signal-intro, .contact-desc, .contact-btns a, .contact-row, .contact-meta, .timeline-progress, .scroll-progress',{clearProps:'all'});
    root.classList.remove('is-enhanced');
  }

  /* ------------------------------------------------------------------ */
  /* Rich layer: smooth scroll, parallax, cursor, magnetism, marquee      */
  /* ------------------------------------------------------------------ */

  function lenisLocked(){
    return document.body.classList.contains('menu-open')||document.body.classList.contains('lightbox-open');
  }

  function syncLenisLock(){
    if(!state.lenis)return;
    if(lenisLocked())state.lenis.stop();
    else state.lenis.start();
  }

  function createLenis(){
    if(state.lenis||typeof window.Lenis==='undefined'||!pointerIsFine())return;
    var lenis=new window.Lenis({lerp:.1,smoothWheel:true,syncTouch:false,anchors:false,autoRaf:false});
    state.lenis=lenis;
    lenis.on('scroll',ScrollTrigger.update);
    state.lenisTick=function(time){lenis.raf(time*1000);};
    gsap.ticker.add(state.lenisTick);
    gsap.ticker.lagSmoothing(0);
    syncLenisLock();
  }

  function destroyLenis(){
    if(!state.lenis)return;
    gsap.ticker.remove(state.lenisTick);
    state.lenis.destroy();
    state.lenis=null;
    state.lenisTick=null;
    gsap.ticker.lagSmoothing(500,33);
  }

  function heroParallax(){
    var hero=document.getElementById('hero');
    var content=hero?hero.querySelector('.hero-content'):null;
    var video=hero?hero.querySelector('.hero-video'):null;
    if(!hero||!content)return;
    var tl=gsap.timeline({scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:true}});
    tl.to(content,{yPercent:22,opacity:.25,ease:'none'},0);
    if(video)tl.to(video,{yPercent:12,ease:'none'},0);
    state.richTweens.push(tl);
  }

  function thumbParallax(){
    root.classList.add('is-rich');
    $('.proj-thumb img').forEach(function(image){
      var thumb=image.closest('.proj-thumb');
      state.richTweens.push(gsap.fromTo(image,{yPercent:-7},{yPercent:7,ease:'none',scrollTrigger:{trigger:thumb,start:'top bottom',end:'bottom top',scrub:true}}));
    });
  }

  function cursorFollower(){
    if(!pointerIsFine())return;
    var cursor=document.querySelector('.cursor');
    if(!cursor){
      cursor=document.createElement('div');
      cursor.className='cursor';
      cursor.setAttribute('aria-hidden','true');
      document.body.appendChild(cursor);
    }
    if(!cursor.querySelector('.cursor-cube')){
      cursor.innerHTML='<div class="cursor-scene"><div class="cursor-spin"><div class="cursor-cube">'+
        ['front','back','right','left','top','bottom'].map(function(side){return '<i class="cursor-face is-'+side+'"></i>';}).join('')+
        '</div></div></div><span class="cursor-label"></span>';
    }
    var label=cursor.querySelector('.cursor-label');
    var spin=cursor.querySelector('.cursor-spin');
    var cube=cursor.querySelector('.cursor-cube');
    var REST={x:-22,y:34};
    var xTo=gsap.quickTo(cursor,'x',{duration:.3,ease:'power3'});
    var yTo=gsap.quickTo(cursor,'y',{duration:.3,ease:'power3'});
    gsap.set(cube,{rotationX:REST.x,rotationY:REST.y});
    gsap.set(spin,{rotationY:0});
    var rxTo=gsap.quickTo(cube,'rotationX',{duration:.55,ease:'power3'});
    var ryTo=gsap.quickTo(cube,'rotationY',{duration:.55,ease:'power3'});
    var spinTween=gsap.to(spin,{rotationY:360,duration:11,ease:'none',repeat:-1,paused:true});
    var last=null;
    var settle=0;
    var labelFor=function(target){
      if(target.closest('.proj-thumb'))return 'View';
      if(target.closest('.gallery-thumb'))return 'Open';
      if(target.closest('.lightbox-nav'))return target.closest('.lightbox-prev')?'Prev':'Next';
      if(target.closest('.lightbox-close'))return 'Close';
      return '';
    };
    var isInteractive=function(target){
      return Boolean(target.closest('a, button, [role="button"], [role="tab"], input, textarea, select, summary'));
    };
    var setSpinning=function(on){
      if(on){
        if(spinTween.paused())spinTween.play();
      }else if(!spinTween.paused()){
        spinTween.pause();
        gsap.to(spin,{rotationY:0,duration:.7,ease:'power2.out',overwrite:true});
      }
    };
    var onMove=function(event){
      if(event.pointerType&&event.pointerType!=='mouse')return;
      xTo(event.clientX);yTo(event.clientY);
      cursor.classList.add('is-visible');
      if(last){
        var vx=gsap.utils.clamp(-42,42,(event.clientX-last.x)*1.3);
        var vy=gsap.utils.clamp(-42,42,(event.clientY-last.y)*1.3);
        ryTo(REST.y+vx);
        rxTo(REST.x-vy);
      }
      last={x:event.clientX,y:event.clientY};
      window.clearTimeout(settle);
      settle=window.setTimeout(function(){rxTo(REST.x);ryTo(REST.y);},150);
    };
    var onOver=function(event){
      var target=event.target;
      if(!(target instanceof Element))return;
      var text=labelFor(target);
      cursor.classList.toggle('has-label',Boolean(text));
      cursor.classList.toggle('is-active',!text&&isInteractive(target));
      if(text)label.textContent=text;
      setSpinning(Boolean(text));
    };
    var onLeave=function(){cursor.classList.remove('is-visible');};
    var onDown=function(){cursor.classList.add('is-down');};
    var onUp=function(){cursor.classList.remove('is-down');};
    document.addEventListener('pointermove',onMove,{passive:true});
    document.addEventListener('pointerover',onOver,{passive:true});
    document.addEventListener('pointerdown',onDown,{passive:true});
    document.addEventListener('pointerup',onUp,{passive:true});
    document.documentElement.addEventListener('mouseleave',onLeave);
    root.classList.add('has-cursor');
    state.richCleanups.push(function(){
      document.removeEventListener('pointermove',onMove);
      document.removeEventListener('pointerover',onOver);
      document.removeEventListener('pointerdown',onDown);
      document.removeEventListener('pointerup',onUp);
      document.documentElement.removeEventListener('mouseleave',onLeave);
      window.clearTimeout(settle);
      spinTween.kill();
      gsap.killTweensOf([cursor,cube,spin]);
      cursor.classList.remove('is-visible','is-active','has-label','is-down');
      root.classList.remove('has-cursor');
    });
  }

  function magneticControls(){
    if(!pointerIsFine())return;
    $('.btn, .c-link, .proj-link.featured-primary, .hero-motion-toggle, .contact-copy, .nav-logo').forEach(function(el){
      var strength=el.classList.contains('nav-logo')?.18:.28;
      var limit=el.classList.contains('btn')?14:10;
      var xTo=gsap.quickTo(el,'x',{duration:.5,ease:'power3'});
      var yTo=gsap.quickTo(el,'y',{duration:.5,ease:'power3'});
      var move=function(event){
        var rect=el.getBoundingClientRect();
        var dx=event.clientX-(rect.left+rect.width/2);
        var dy=event.clientY-(rect.top+rect.height/2);
        xTo(gsap.utils.clamp(-limit,limit,dx*strength));
        yTo(gsap.utils.clamp(-limit,limit,dy*strength));
      };
      var leave=function(){
        gsap.to(el,{x:0,y:0,duration:.9,ease:'elastic.out(1,.45)',overwrite:'auto',onComplete:function(){gsap.set(el,{clearProps:'transform'});}});
      };
      el.addEventListener('pointermove',move,{passive:true});
      el.addEventListener('pointerleave',leave);
      state.richCleanups.push(function(){
        el.removeEventListener('pointermove',move);
        el.removeEventListener('pointerleave',leave);
        gsap.killTweensOf(el);
        gsap.set(el,{clearProps:'transform'});
      });
    });
  }

  function syncMarquee(){
    if(!state.marquee)return;
    if(state.marqueeVisible&&motionAllowedNow())state.marquee.play();
    else state.marquee.pause();
  }

  function velocityMarquee(){
    var section=document.querySelector('.tools-section');
    var track=section?section.querySelector('.tools-track'):null;
    if(!track)return;
    root.classList.add('is-gsap-marquee');
    var loop=gsap.to(track,{xPercent:-50,ease:'none',duration:30,repeat:-1,paused:true});
    state.marquee=loop;
    var settle=0;
    var trigger=ScrollTrigger.create({
      trigger:section,start:'top bottom',end:'bottom top',
      onToggle:function(self){state.marqueeVisible=self.isActive;syncMarquee();},
      onUpdate:function(self){
        var velocity=self.getVelocity();
        var direction=velocity<0?-1:1;
        var boost=gsap.utils.clamp(0,4,Math.abs(velocity)/420);
        gsap.to(loop,{timeScale:direction*(1+boost),duration:.35,overwrite:true});
        window.clearTimeout(settle);
        settle=window.setTimeout(function(){gsap.to(loop,{timeScale:1,duration:1.4,ease:'power2.out',overwrite:true});},140);
      }
    });
    state.richTriggers.push(trigger);
    var hoverIn=function(){gsap.to(loop,{timeScale:.15,duration:.6,overwrite:true});};
    var hoverOut=function(){gsap.to(loop,{timeScale:1,duration:.8,overwrite:true});};
    if(pointerIsFine()){
      track.addEventListener('pointerenter',hoverIn);
      track.addEventListener('pointerleave',hoverOut);
    }
    state.richCleanups.push(function(){
      window.clearTimeout(settle);
      track.removeEventListener('pointerenter',hoverIn);
      track.removeEventListener('pointerleave',hoverOut);
      gsap.killTweensOf(loop);
      loop.kill();
      state.marquee=null;
      gsap.set(track,{clearProps:'transform'});
      root.classList.remove('is-gsap-marquee');
    });
  }

  function buildRich(){
    if(state.rich)return;
    state.rich=true;
    createLenis();
    heroParallax();
    thumbParallax();
    cursorFollower();
    magneticControls();
    velocityMarquee();
    syncMarquee();
    ScrollTrigger.refresh();
  }

  function teardownRich(){
    if(!state.rich)return;
    state.rich=false;
    destroyLenis();
    state.richTweens.forEach(function(tween){
      if(tween.scrollTrigger)tween.scrollTrigger.kill();
      tween.kill();
    });
    state.richTriggers.forEach(function(trigger){trigger.kill();});
    state.richCleanups.forEach(function(cleanup){cleanup();});
    state.richTweens=[];state.richTriggers=[];state.richCleanups=[];
    gsap.set('.hero-content, .hero-video, .proj-thumb img',{clearProps:'transform,opacity'});
    root.classList.remove('is-rich');
    ScrollTrigger.refresh();
  }

  /* ------------------------------------------------------------------ */
  /* Wiring                                                               */
  /* ------------------------------------------------------------------ */

  function sync(){
    var base=baseAllowed();
    var rich=richAllowed();
    if(base&&!state.base)buildBase();
    if(!base&&state.base){teardownRich();teardownBase();}
    if(base&&rich&&!state.rich)buildRich();
    if(!rich&&state.rich)teardownRich();
    syncMarquee();
    syncLenisLock();
  }

  window.siteEnhance={
    scrollTo:function(top,smooth){
      if(!state.lenis||!smooth)return false;
      state.lenis.scrollTo(top,{duration:1.1,easing:function(t){return 1-Math.pow(1-t,4);}});
      return true;
    },
    refresh:function(){ScrollTrigger.refresh();},
    getState:function(){return {base:state.base,rich:state.rich,lenis:Boolean(state.lenis)};},
    lenis:function(){return state.lenis;}
  };

  function start(){
    sync();
    if(siteMotion&&typeof siteMotion.subscribe==='function')siteMotion.subscribe(function(){sync();});
    else if(reduceQuery.addEventListener)reduceQuery.addEventListener('change',sync);
    if(finePointer.addEventListener)finePointer.addEventListener('change',function(){if(state.rich){teardownRich();buildRich();}});
    new MutationObserver(function(){syncLenisLock();syncMarquee();}).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('load',function(){ScrollTrigger.refresh();});
  }

  if(document.fonts&&document.fonts.ready){
    document.fonts.ready.then(start,start);
  }else{
    start();
  }
})();
