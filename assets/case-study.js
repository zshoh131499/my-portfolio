/* Case study pages: section navigation (sticky rail on desktop, collapsible bar
   on small screens), scroll-spy for it, and the nav-height custom property the
   sticky offsets depend on. Anchor scrolling itself is handled by site.js. */
(function(){
  'use strict';

  var nav=document.getElementById('nav');
  var toc=document.getElementById('caseToc');
  var root=document.documentElement;

  function navHeight(){
    return nav?(nav.getBoundingClientRect().height||74):74;
  }
  function syncNavHeight(){
    root.style.setProperty('--nav-h',Math.round(navHeight())+'px');
  }
  syncNavHeight();
  window.addEventListener('resize',syncNavHeight);
  window.addEventListener('load',syncNavHeight);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(syncNavHeight,function(){});

  if(!toc)return;

  var toggle=toc.querySelector('.case-toc-toggle');
  var current=toc.querySelector('.case-toc-current');
  var links=Array.prototype.slice.call(toc.querySelectorAll('.case-toc-list a[href^="#"]'));
  var pairs=links.map(function(link){
    return {link:link,target:document.querySelector(link.getAttribute('href'))};
  }).filter(function(pair){return pair.target;});
  var compact=window.matchMedia('(max-width: 1100px)');

  function isOpen(){return toc.getAttribute('data-open')==='true';}
  function setOpen(open){
    toc.setAttribute('data-open',String(Boolean(open)));
    if(toggle)toggle.setAttribute('aria-expanded',String(Boolean(open)));
  }

  if(toggle){
    toggle.addEventListener('click',function(){setOpen(!isOpen());});
    document.addEventListener('keydown',function(event){
      if(event.key==='Escape'&&isOpen()){event.preventDefault();setOpen(false);toggle.focus();}
    });
    document.addEventListener('click',function(event){
      if(isOpen()&&!toc.contains(event.target))setOpen(false);
    });
    if(compact.addEventListener)compact.addEventListener('change',function(){if(!compact.matches)setOpen(false);});
  }
  links.forEach(function(link){
    link.addEventListener('click',function(){if(compact.matches)setOpen(false);});
  });

  // Scroll-spy: the section sitting under the header owns the current marker.
  var frame=0;
  function update(){
    frame=0;
    if(!pairs.length)return;
    var probe=navHeight()+window.innerHeight*.25;
    var atBottom=window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-2;
    var active=null;
    pairs.forEach(function(pair){
      var rect=pair.target.getBoundingClientRect();
      if(rect.top<=probe&&rect.bottom>probe)active=pair;
    });
    if(atBottom)active=pairs[pairs.length-1];
    pairs.forEach(function(pair){
      if(pair===active)pair.link.setAttribute('aria-current','true');
      else pair.link.removeAttribute('aria-current');
    });
    if(current)current.textContent=active?(active.link.getAttribute('data-title')||active.link.textContent):'';
  }
  function schedule(){if(!frame)frame=window.requestAnimationFrame(update);}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  window.addEventListener('load',schedule);
  schedule();
})();
