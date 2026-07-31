var motionQuery=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false,addEventListener:function(){}};
var nav=document.getElementById('nav');
var menuBtn=document.getElementById('menuBtn');
var navLinks=document.getElementById('navLinks');
var lightbox=document.getElementById('lightbox');
var lightboxClose=document.getElementById('lightboxClose');
var lightboxImage=document.getElementById('lbImg');
var lastLightboxTrigger=null;
var lastY=window.scrollY;

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

// Timeline reveal
(function(){
  var items=document.querySelectorAll('.tl-item');
  if(!items.length)return;
  if(motionQuery.matches){items.forEach(function(item){item.classList.add('active');});return;}
  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){entry.target.classList.toggle('active',entry.isIntersecting);});
  },{threshold:.2,rootMargin:'0px 0px -20% 0px'});
  items.forEach(function(item){observer.observe(item);});
})();

// About-card glow, paused for reduced motion or hidden tabs
(function(){
  var card=document.querySelector('.about-card');
  if(!card)return;
  var angle=0,frame=0;
  function tick(){
    frame=0;
    if(motionQuery.matches||document.hidden){card.style.setProperty('--card-angle','0deg');return;}
    angle=(angle+.5)%360;
    card.style.setProperty('--card-angle',angle+'deg');
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    if(frame){cancelAnimationFrame(frame);frame=0;}
    if(motionQuery.matches||document.hidden){card.style.setProperty('--card-angle','0deg');}
    else{frame=requestAnimationFrame(tick);}
  }
  motionQuery.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  sync();
})();

// Core Expertise ambient VFX field
(function(){
  var canvas=document.getElementById('expertiseVfx');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  if(!ctx)return;
  var dpr=1,w=0,h=0,particles=[],frame=0;
  var palette=[[0,212,255],[94,234,212],[192,132,252],[255,107,127]];

  function seedParticles(){
    var count=Math.floor(Math.min(48,Math.max(26,w/28)));
    particles=[];
    for(var i=0;i<count;i++){
      particles.push({x:Math.random()*w,y:h*(.16+Math.random()*.68),r:18+Math.random()*56,drift:.18+Math.random()*.42,p:Math.random()*Math.PI*2,z:.35+Math.random()*.65,c:palette[i%palette.length],lastX:null,lastY:null});
    }
  }

  function draw(timestamp,schedule){
    frame=0;
    var t=timestamp*.001;
    ctx.globalCompositeOperation='destination-out';
    ctx.fillStyle='rgba(0,0,0,.065)';
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='lighter';
    for(var i=0;i<particles.length;i++){
      var particle=particles[i];
      var x=(particle.x+t*particle.drift*18)%w;
      var y=particle.y+Math.sin(t*.16+particle.p)*particle.r*.22+Math.cos(t*.11+particle.p)*particle.r*.1;
      var size=(.9+particle.z*1.6)*(1+Math.sin(t*.22+particle.p)*.12);
      if(particle.lastX!==null&&Math.abs(x-particle.lastX)<w*.5){
        ctx.beginPath();
        ctx.strokeStyle='rgba('+particle.c[0]+','+particle.c[1]+','+particle.c[2]+','+(.045+particle.z*.035)+')';
        ctx.lineWidth=.8+particle.z*.35;
        ctx.moveTo(particle.lastX,particle.lastY);
        ctx.lineTo(x,y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.fillStyle='rgba('+particle.c[0]+','+particle.c[1]+','+particle.c[2]+','+(.16+particle.z*.16)+')';
      ctx.arc(x,y,size,0,Math.PI*2);
      ctx.fill();
      if(i%4===0){
        ctx.beginPath();
        ctx.strokeStyle='rgba('+particle.c[0]+','+particle.c[1]+','+particle.c[2]+',.035)';
        ctx.lineWidth=.65;
        ctx.moveTo(x-particle.r*.9,y+Math.sin(t*.12+particle.p)*8);
        ctx.quadraticCurveTo(x,y-particle.r*.22,x+particle.r*1.15,y+Math.cos(t*.1+particle.p)*10);
        ctx.stroke();
      }
      particle.lastX=x;
      particle.lastY=y;
    }
    ctx.globalCompositeOperation='source-over';
    if(schedule&&!motionQuery.matches&&!document.hidden)frame=requestAnimationFrame(function(next){draw(next,true);});
  }

  function resize(){
    var rect=canvas.getBoundingClientRect();
    dpr=Math.min(window.devicePixelRatio||1,1.7);
    w=Math.max(1,rect.width);
    h=Math.max(1,rect.height);
    canvas.width=Math.floor(w*dpr);
    canvas.height=Math.floor(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    seedParticles();
    if(motionQuery.matches)draw(0,false);
  }

  function sync(){
    if(frame){cancelAnimationFrame(frame);frame=0;}
    ctx.clearRect(0,0,w,h);
    particles.forEach(function(particle){particle.lastX=null;particle.lastY=null;});
    if(motionQuery.matches||document.hidden)draw(0,false);
    else frame=requestAnimationFrame(function(next){draw(next,true);});
  }

  window.addEventListener('resize',resize);
  motionQuery.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  resize();
  sync();
})();

// Pause the decorative video when motion is reduced
(function(){
  var video=document.querySelector('.hero-video');
  if(!video)return;
  function sync(){
    if(motionQuery.matches){video.pause();}
    else{var promise=video.play();if(promise&&promise.catch)promise.catch(function(){});}
  }
  motionQuery.addEventListener('change',sync);
  sync();
})();

// Anchored navigation with the fixed-header offset
var anchors=document.querySelectorAll('a[href^="#"]');
anchors.forEach(function(anchor){
  anchor.addEventListener('click',function(event){
    var href=this.getAttribute('href');
    var target=document.querySelector(href);
    if(!target)return;
    event.preventDefault();
    if(this.closest('.nav-links'))setMenu(false,false);
    var navHeight=nav.getBoundingClientRect().height||80;
    var top=target.getBoundingClientRect().top+window.scrollY-navHeight;
    window.scrollTo({top:Math.max(0,top),behavior:motionQuery.matches?'auto':'smooth'});
    history.pushState(null,'',href);
    if(this.classList.contains('skip-link'))target.focus({preventScroll:true});
  });
});

function openLightbox(trigger,image){
  if(!image)return;
  setMenu(false,false);
  lastLightboxTrigger=trigger;
  lightboxImage.src=image.currentSrc||image.src;
  lightboxImage.alt=image.alt||'Project image preview';
  lightbox.hidden=false;
  lightbox.classList.add('show');
  document.body.classList.add('lightbox-open');
  window.setTimeout(function(){lightboxClose.focus();},0);
}

function closeLightbox(restoreFocus){
  if(lightbox.hidden)return;
  lightbox.classList.remove('show');
  lightbox.hidden=true;
  document.body.classList.remove('lightbox-open');
  lightboxImage.removeAttribute('src');
  if(restoreFocus&&lastLightboxTrigger){lastLightboxTrigger.focus();}
  lastLightboxTrigger=null;
}

document.addEventListener('click',function(event){
  var galleryButton=event.target.closest('.gallery-thumb');
  if(galleryButton){
    var selectedImage=galleryButton.querySelector('img');
    var project=galleryButton.closest('.proj');
    var heroImage=project?project.querySelector('.proj-thumb img'):null;
    if(heroImage&&selectedImage){
      heroImage.style.transition='opacity .3s,transform .3s';
      heroImage.style.opacity='0';
      heroImage.style.transform='scale(1.05)';
      window.setTimeout(function(){
        heroImage.src=selectedImage.currentSrc||selectedImage.src;
        heroImage.alt=selectedImage.alt;
        heroImage.width=Number(selectedImage.getAttribute('width'))||selectedImage.naturalWidth;
        heroImage.height=Number(selectedImage.getAttribute('height'))||selectedImage.naturalHeight;
        heroImage.style.opacity='1';
        heroImage.style.transform='scale(1)';
      },motionQuery.matches?0:250);
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

  if(event.target===lightbox||event.target.closest('#lightboxClose')){closeLightbox(true);}
});

document.addEventListener('keydown',function(event){
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
