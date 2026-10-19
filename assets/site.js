var motionQuery=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false,addEventListener:function(){}};
var nav=document.getElementById('nav');
var menuBtn=document.getElementById('menuBtn');
var navLinks=document.getElementById('navLinks');
var lightbox=document.getElementById('lightbox');
var lightboxClose=document.getElementById('lightboxClose');
var lightboxImage=document.getElementById('lbImg');
var lightboxPrev=document.getElementById('lightboxPrev');
var lightboxNext=document.getElementById('lightboxNext');
var lightboxCaption=document.getElementById('lightboxCaption');
var lightboxItems=[];
var lightboxIndex=0;
var lastLightboxTrigger=null;
var lastY=window.scrollY;
var pageRegions=[nav,document.querySelector('main'),document.querySelector('footer')];
var UI_MOTION={base:280};

function isStaticMotionMode(){
  var tier=document.documentElement.dataset.motionProfile;
  if(!tier&&window.siteMotion&&typeof window.siteMotion.getProfile==='function'){
    try{
      var profile=window.siteMotion.getProfile();
      tier=profile&&profile.tier;
    }catch(error){}
  }
  return tier==='static'||document.body.classList.contains('motion-static');
}

function setupRevealOnce(nodes,activeClass){
  var items=Array.prototype.slice.call(nodes);
  if(!items.length)return;
  var observer=null;
  var preferenceObserver=null;
  var remaining=items.filter(function(item){return !item.classList.contains(activeClass);}).length;

  function cleanup(){
    if(observer)observer.disconnect();
    if(preferenceObserver)preferenceObserver.disconnect();
    if(motionQuery.removeEventListener)motionQuery.removeEventListener('change',handlePreferenceChange);
  }

  function reveal(item){
    if(item.classList.contains(activeClass))return;
    item.classList.add(activeClass);
    remaining-=1;
    if(observer)observer.unobserve(item);
    if(remaining<=0)cleanup();
  }

  function revealAll(){items.forEach(reveal);cleanup();}

  function handlePreferenceChange(){
    if(motionQuery.matches||isStaticMotionMode())revealAll();
  }

  if(remaining<=0){cleanup();return;}
  if(motionQuery.matches||isStaticMotionMode()||!('IntersectionObserver' in window)){
    revealAll();
    return;
  }

  observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){if(entry.isIntersecting)reveal(entry.target);});
  },{threshold:.18,rootMargin:'0px 0px -18% 0px'});
  items.forEach(function(item){if(!item.classList.contains(activeClass))observer.observe(item);});

  if(motionQuery.addEventListener)motionQuery.addEventListener('change',handlePreferenceChange);
  if('MutationObserver' in window){
    preferenceObserver=new MutationObserver(handlePreferenceChange);
    preferenceObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion-profile']});
    preferenceObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  }
}

function setupDeferredReveals(){
  setupRevealOnce(document.querySelectorAll('.tl-item'),'active');
  setupRevealOnce(document.querySelectorAll('[data-reveal]'),'is-revealed');
}

function setPageInert(inert){
  pageRegions.forEach(function(region){if(region)region.toggleAttribute('inert',Boolean(inert));});
}

function getFocusableElements(root){
  var nodes=root.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])');
  return Array.prototype.filter.call(nodes,function(node){return !node.hidden&&node.getClientRects().length>0;});
}

function trapFocus(root,event){
  var focusable=getFocusableElements(root);
  if(!focusable.length)return;
  var first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}

function setMenu(open,restoreFocus){
  var shouldOpen=Boolean(open)&&window.innerWidth<=900;
  navLinks.classList.toggle('open',shouldOpen);
  menuBtn.classList.toggle('open',shouldOpen);
  nav.classList.toggle('menu-open',shouldOpen);
  document.body.classList.toggle('menu-open',shouldOpen);
  menuBtn.setAttribute('aria-expanded',String(shouldOpen));
  menuBtn.setAttribute('aria-label',shouldOpen?'Close navigation':'Open navigation');
  if(shouldOpen){
    nav.classList.remove('hide');
    window.setTimeout(function(){var first=navLinks.querySelector('a');if(first)first.focus();},0);
  }else if(restoreFocus){
    menuBtn.focus();
  }
}

menuBtn.addEventListener('click',function(){
  setMenu(menuBtn.getAttribute('aria-expanded')!=='true',false);
});

navLinks.addEventListener('click',function(event){
  var link=event.target.closest('a');
  if(link&&!link.getAttribute('href').startsWith('#'))setMenu(false,false);
});

window.addEventListener('scroll',function(){
  if(document.body.classList.contains('menu-open'))return;
  var y=window.scrollY;
  nav.classList.toggle('hide',y>lastY&&y>80);
  lastY=y;
},{passive:true});

window.addEventListener('resize',function(){
  if(window.innerWidth>900)setMenu(false,false);
});

// Initialize reveals after all deferred scripts have established the motion profile.
if(document.readyState==='complete')setupDeferredReveals();
else document.addEventListener('DOMContentLoaded',setupDeferredReveals,{once:true});

// Signal Lab uses an accessible single-select tablist. Hover remains CSS-only.
(function(){
  var labs=document.querySelectorAll('[data-signal-lab]');
  Array.prototype.forEach.call(labs,function(lab){
    var steps=Array.prototype.slice.call(lab.querySelectorAll('[data-signal-step]'));
    var panels=Array.prototype.slice.call(lab.querySelectorAll('[data-signal-panel]'));
    var stage=lab.querySelector('.signal-stage')||lab;
    if(!steps.length)return;

    function selectStep(index,moveFocus){
      index=(index+steps.length)%steps.length;
      var activeStep=steps[index].dataset.signalStep;
      lab.dataset.activeStep=activeStep;
      stage.dataset.activeStep=activeStep;
      steps.forEach(function(step,stepIndex){
        var selected=stepIndex===index;
        step.setAttribute('aria-selected',String(selected));
        step.tabIndex=selected?0:-1;
        step.classList.toggle('is-selected',selected);
      });
      panels.forEach(function(panel){
        var selected=panel.dataset.signalPanel===activeStep;
        panel.hidden=!selected;
        panel.classList.toggle('is-selected',selected);
      });
      if(moveFocus)steps[index].focus();
    }

    var initialStep=lab.dataset.activeStep;
    var initialIndex=steps.findIndex(function(step){return step.dataset.signalStep===initialStep;});
    if(initialIndex<0)initialIndex=steps.findIndex(function(step){return step.getAttribute('aria-selected')==='true';});
    selectStep(initialIndex<0?0:initialIndex,false);

    steps.forEach(function(step,index){
      step.addEventListener('focus',function(){selectStep(index,false);});
      step.addEventListener('click',function(){selectStep(index,false);});
      step.addEventListener('keydown',function(event){
        var nextIndex=null;
        if(event.key==='ArrowLeft'||event.key==='ArrowUp')nextIndex=index-1;
        else if(event.key==='ArrowRight'||event.key==='ArrowDown')nextIndex=index+1;
        else if(event.key==='Home')nextIndex=0;
        else if(event.key==='End')nextIndex=steps.length-1;
        else if(event.key==='Enter'||event.key===' '||event.key==='Spacebar')nextIndex=index;
        if(nextIndex===null)return;
        event.preventDefault();
        selectStep(nextIndex,nextIndex!==index);
      });
    });
  });
})();

// Anchored navigation with the fixed-header offset
var anchors=document.querySelectorAll('a[href^="#"]');
anchors.forEach(function(anchor){
  anchor.addEventListener('click',function(event){
    var href=this.getAttribute('href');
    var target=document.querySelector(href);
    if(!target)return;
    var fromMenu=Boolean(this.closest('.nav-links'));
    var keyboardActivation=event.detail===0;
    event.preventDefault();
    if(fromMenu)setMenu(false,false);
    var navHeight=nav.getBoundingClientRect().height||80;
    var top=target.getBoundingClientRect().top+window.scrollY-navHeight;
    var smoothScroll=!motionQuery.matches;
    var handled=Boolean(window.siteEnhance&&typeof window.siteEnhance.scrollTo==='function'&&window.siteEnhance.scrollTo(Math.max(0,top),smoothScroll));
    if(!handled)window.scrollTo({top:Math.max(0,top),behavior:smoothScroll?'smooth':'auto'});
    history.pushState(null,'',href);
    if(this.classList.contains('skip-link'))target.focus({preventScroll:true});
    else if(fromMenu&&keyboardActivation){
      var heading=target.querySelector('h1,h2')||target;
      if(!heading.hasAttribute('tabindex'))heading.setAttribute('tabindex','-1');
      window.setTimeout(function(){heading.focus({preventScroll:true});},0);
    }
  });
});

// Scroll-spy: flag the nav link whose section currently sits under the header
(function(){
  var links=Array.prototype.slice.call(navLinks.querySelectorAll('a[href^="#"]'));
  var pairs=links.map(function(link){return {link:link,target:document.querySelector(link.getAttribute('href'))};}).filter(function(pair){return pair.target;});
  if(!pairs.length)return;
  var frame=0;
  function update(){
    frame=0;
    var navHeight=nav.getBoundingClientRect().height||80;
    var probe=navHeight+window.innerHeight*.25;
    var atBottom=window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-2;
    var current=null;
    pairs.forEach(function(pair){
      var rect=pair.target.getBoundingClientRect();
      if(rect.top<=probe&&rect.bottom>probe)current=pair;
    });
    if(atBottom)current=pairs[pairs.length-1];
    pairs.forEach(function(pair){
      if(pair===current)pair.link.setAttribute('aria-current','true');
      else pair.link.removeAttribute('aria-current');
    });
  }
  function schedule(){if(!frame)frame=window.requestAnimationFrame(update);}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  window.addEventListener('load',schedule);
  schedule();
})();

// Remember each project's original hero image so the lightbox can still page to it
// after a gallery click has swapped the visible hero.
Array.prototype.forEach.call(document.querySelectorAll('.proj .proj-thumb img'),function(image){
  image.dataset.lightboxSrc=image.getAttribute('src');
  image.dataset.lightboxAlt=image.alt;
});

function absoluteUrl(src){
  try{return new URL(src,document.baseURI).href;}catch(error){return src;}
}

function collectLightboxItems(project,image){
  var items=[];
  function add(src,alt){
    if(!src)return;
    var href=absoluteUrl(src);
    if(items.some(function(item){return item.href===href;}))return;
    items.push({href:href,src:src,alt:alt||''});
  }
  if(project){
    var hero=project.querySelector('.proj-thumb img');
    if(hero)add(hero.dataset.lightboxSrc||hero.currentSrc||hero.src,hero.dataset.lightboxAlt||hero.alt);
    Array.prototype.forEach.call(project.querySelectorAll('.gallery-thumb img'),function(thumb){add(thumb.currentSrc||thumb.src,thumb.alt);});
  }
  add(image.currentSrc||image.src,image.alt);
  return items;
}

function showLightboxItem(index){
  var count=lightboxItems.length;
  if(!count)return;
  lightboxIndex=(index+count)%count;
  var item=lightboxItems[lightboxIndex];
  lightboxImage.src=item.src;
  lightboxImage.alt=item.alt||'Project image preview';
  lightboxCaption.textContent=count>1?(item.alt||'Project image')+' \u00b7 '+(lightboxIndex+1)+' / '+count:item.alt;
  lightboxPrev.hidden=count<2;
  lightboxNext.hidden=count<2;
}

function stepLightbox(delta){
  if(lightbox.hidden||lightboxItems.length<2)return;
  showLightboxItem(lightboxIndex+delta);
}

function openLightbox(trigger,image){
  if(!image)return;
  setMenu(false,false);
  lastLightboxTrigger=trigger;
  lightboxItems=collectLightboxItems(trigger.closest('.proj'),image);
  var currentHref=absoluteUrl(image.currentSrc||image.src);
  var startIndex=lightboxItems.findIndex(function(item){return item.href===currentHref;});
  showLightboxItem(startIndex<0?0:startIndex);
  lightbox.hidden=false;
  lightbox.classList.add('show');
  document.body.classList.add('lightbox-open');
  setPageInert(true);
  window.setTimeout(function(){lightboxClose.focus();},0);
}

function closeLightbox(restoreFocus){
  if(lightbox.hidden)return;
  lightbox.classList.remove('show');
  lightbox.hidden=true;
  lightboxImage.removeAttribute('src');
  lightboxCaption.textContent='';
  lightboxItems=[];
  lightboxPrev.hidden=true;
  lightboxNext.hidden=true;
  setPageInert(false);
  if(restoreFocus&&lastLightboxTrigger){lastLightboxTrigger.focus();}
  document.body.classList.remove('lightbox-open');
  lastLightboxTrigger=null;
}

document.addEventListener('click',function(event){
  var galleryButton=event.target.closest('.gallery-thumb');
  if(galleryButton){
    var selectedImage=galleryButton.querySelector('img');
    var project=galleryButton.closest('.proj');
    var heroImage=project?project.querySelector('.proj-thumb img'):null;
    if(heroImage&&selectedImage){
      heroImage.style.transition='opacity var(--motion-base) var(--ease-out),transform var(--motion-base) var(--ease-out)';
      heroImage.style.opacity='0';
      heroImage.style.transform='scale(1.05)';
      window.setTimeout(function(){
        heroImage.src=selectedImage.currentSrc||selectedImage.src;
        heroImage.alt=selectedImage.alt;
        var heroButton=heroImage.closest('.proj-thumb');
        if(heroButton)heroButton.setAttribute('aria-label','Open '+selectedImage.alt+' preview');
        heroImage.width=Number(selectedImage.getAttribute('width'))||selectedImage.naturalWidth;
        heroImage.height=Number(selectedImage.getAttribute('height'))||selectedImage.naturalHeight;
        heroImage.style.opacity='1';
        heroImage.style.transform='scale(1)';
      },motionQuery.matches?0:UI_MOTION.base);
    }
    var gallery=galleryButton.closest('.proj-gallery');
    if(gallery){
      gallery.querySelectorAll('.gallery-thumb').forEach(function(button){
        var active=button===galleryButton;
        button.classList.toggle('active',active);
        button.setAttribute('aria-pressed',String(active));
      });
    }
    openLightbox(galleryButton,selectedImage);
    return;
  }

  var projectImageButton=event.target.closest('.proj-thumb');
  if(projectImageButton){openLightbox(projectImageButton,projectImageButton.querySelector('img'));return;}

  if(event.target.closest('#lightboxPrev')){stepLightbox(-1);return;}
  if(event.target.closest('#lightboxNext')){stepLightbox(1);return;}
  if(event.target===lightbox||event.target.closest('#lightboxClose')){closeLightbox(true);}
});

document.addEventListener('keydown',function(event){
  if(!lightbox.hidden&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
    event.preventDefault();
    stepLightbox(event.key==='ArrowLeft'?-1:1);
    return;
  }
  if(event.key==='Escape'){
    if(!lightbox.hidden){event.preventDefault();closeLightbox(true);return;}
    if(menuBtn.getAttribute('aria-expanded')==='true'){event.preventDefault();setMenu(false,true);return;}
  }
  if(event.key==='Tab'){
    if(!lightbox.hidden){trapFocus(lightbox,event);}
    else if(menuBtn.getAttribute('aria-expanded')==='true'){trapFocus(nav,event);}
  }
});

window.addEventListener('hashchange',function(){
  if(lightbox.hidden)document.body.classList.remove('lightbox-open');
  if(menuBtn.getAttribute('aria-expanded')!=='true')document.body.classList.remove('menu-open');
});

// Contact: local time for the current base, refreshed each minute
(function(){
  var clock=document.getElementById('contactClock');
  var timeEl=clock?clock.querySelector('time'):null;
  if(!clock||!timeEl||typeof Intl==='undefined'||!Intl.DateTimeFormat)return;
  var zone=clock.getAttribute('data-timezone')||'America/New_York';
  var formatter;
  try{formatter=new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone});}
  catch(error){formatter=new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});}
  function tick(){
    var now=new Date();
    timeEl.textContent=formatter.format(now);
    timeEl.setAttribute('datetime',now.toISOString());
  }
  tick();
  window.setInterval(tick,30000);
})();

// Contact: copy the email address with visible and announced feedback
(function(){
  var button=document.getElementById('copyEmail');
  var status=document.getElementById('copyStatus');
  if(!button)return;
  var original=button.textContent;
  var resetTimer=0;
  function announce(message){if(status)status.textContent=message;}
  function fallbackCopy(text){
    var field=document.createElement('textarea');
    field.value=text;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';
    document.body.appendChild(field);field.select();
    var ok=false;
    try{ok=document.execCommand('copy');}catch(error){ok=false;}
    document.body.removeChild(field);
    return ok;
  }
  function done(ok){
    button.textContent=ok?'Copied ✓':'Press ⌘C';
    button.classList.toggle('is-copied',ok);
    announce(ok?'Email address copied to clipboard':'Copy failed, the address is selected');
    window.clearTimeout(resetTimer);
    resetTimer=window.setTimeout(function(){button.textContent=original;button.classList.remove('is-copied');announce('');},1800);
  }
  button.addEventListener('click',function(){
    var text=button.getAttribute('data-copy')||'';
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){done(true);},function(){done(fallbackCopy(text));});
    }else{
      done(fallbackCopy(text));
    }
  });
})();
