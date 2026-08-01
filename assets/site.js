var motionQuery=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false,addEventListener:function(){}};
var nav=document.getElementById('nav');
var menuBtn=document.getElementById('menuBtn');
var navLinks=document.getElementById('navLinks');
var lightbox=document.getElementById('lightbox');
var lightboxClose=document.getElementById('lightboxClose');
var lightboxImage=document.getElementById('lbImg');
var lastLightboxTrigger=null;
var lastY=window.scrollY;
var pageRegions=[nav,document.querySelector('main'),document.querySelector('footer')];

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
    window.scrollTo({top:Math.max(0,top),behavior:motionQuery.matches?'auto':'smooth'});
    history.pushState(null,'',href);
    if(this.classList.contains('skip-link'))target.focus({preventScroll:true});
    else if(fromMenu&&keyboardActivation){
      var heading=target.querySelector('h1,h2')||target;
      if(!heading.hasAttribute('tabindex'))heading.setAttribute('tabindex','-1');
      window.setTimeout(function(){heading.focus({preventScroll:true});},0);
    }
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
  setPageInert(true);
  window.setTimeout(function(){lightboxClose.focus();},0);
}

function closeLightbox(restoreFocus){
  if(lightbox.hidden)return;
  lightbox.classList.remove('show');
  lightbox.hidden=true;
  lightboxImage.removeAttribute('src');
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
      heroImage.style.transition='opacity .3s,transform .3s';
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
