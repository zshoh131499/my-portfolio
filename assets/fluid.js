/* Hero fluid ink: a small WebGL stable-fluids solver layered over the hero.
   Pointer movement injects velocity and brand-colored dye, the dye swirls and
   dissolves, and the loop sleeps a few seconds after the last input. Runs only
   in the Full motion profile on fine-pointer devices and defers to Pause
   Motion, the Static profile and prefers-reduced-motion. */
(function(){
  'use strict';

  var hero=document.getElementById('hero');
  var canvas=document.getElementById('heroFluid');
  if(!hero||!canvas)return;

  var siteMotion=window.siteMotion||null;
  var finePointer=window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduceQuery=window.matchMedia('(prefers-reduced-motion: reduce)');

  var CONFIG={
    SIM_RES:128,
    DYE_RES:720,
    PRESSURE_ITERATIONS:14,
    CURL:18,
    VELOCITY_DISSIPATION:.55,
    DENSITY_DISSIPATION:.72,
    PRESSURE:.8,
    SPLAT_RADIUS:.0017,
    SPLAT_FORCE:3000,
    INK:1.25,
    OPACITY:.42,
    EXPOSURE:1.0,
    SLEEP_AFTER:9000,
    FRAME_BUDGET:26
  };

  var PALETTES={
    product:['#5eead4','#00d4ff','#2dd4bf'],
    ux:['#00d4ff','#38bdf8','#5eead4'],
    game:['#c084fc','#a855f7','#ff6b7f'],
    vfx:['#ff6b7f','#fb7185','#c084fc']
  };

  var gl=null, ext=null, programs={}, quad=null;
  var dye=null, velocity=null, divergence=null, curl=null, pressure=null;
  var enabled=false, running=false, frameId=0, lastFrame=0, lastInput=0, visible=true;
  var pointer={x:0,y:0,prevX:0,prevY:0,inside:false,moved:false,dx:0,dy:0};
  var palette=PALETTES.product, paletteName='product', colorPhase=0;
  var frameSamples=[], downgraded=false, disabledForPerf=false, introDone=false, lost=false, lastError='';

  /* ---------------- helpers ---------------- */

  function hexToRgb(hex){
    var n=parseInt(hex.slice(1),16);
    return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
  }
  function mixColor(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
  function currentInk(){
    var stops=palette.map(hexToRgb);
    var t=(colorPhase%1)*stops.length;
    var i=Math.floor(t)%stops.length;
    var c=mixColor(stops[i],stops[(i+1)%stops.length],t-Math.floor(t));
    return [c[0]*CONFIG.INK,c[1]*CONFIG.INK,c[2]*CONFIG.INK];
  }
  function tier(){try{return siteMotion?siteMotion.getProfile().tier:'full';}catch(e){return 'full';}}
  function motionAllowed(){try{return siteMotion?siteMotion.isAllowed():!reduceQuery.matches;}catch(e){return true;}}
  function wanted(){return !lost&&!disabledForPerf&&!reduceQuery.matches&&finePointer.matches&&tier()!=='static';}
  var softPaused=false;
  var FULL_RES={SIM_RES:128,DYE_RES:720,PRESSURE_ITERATIONS:14};
  var LITE_RES={SIM_RES:96,DYE_RES:480,PRESSURE_ITERATIONS:10};
  var appliedTier='';
  function applyTierResolution(){
    var current=tier();
    if(current===appliedTier||downgraded)return false;
    appliedTier=current;
    var res=current==='full'?FULL_RES:LITE_RES;
    CONFIG.SIM_RES=res.SIM_RES;CONFIG.DYE_RES=res.DYE_RES;CONFIG.PRESSURE_ITERATIONS=res.PRESSURE_ITERATIONS;
    return true;
  }

  /* ---------------- GL setup ---------------- */

  function compile(type,source){
    var shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
      throw new Error('fluid shader: '+gl.getShaderInfoLog(shader));
    }
    return shader;
  }
  function program(vertex,fragmentSource){
    var fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);
    var prog=gl.createProgram();
    gl.attachShader(prog,vertex);
    gl.attachShader(prog,fragment);
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('fluid link: '+gl.getProgramInfoLog(prog));
    var uniforms={};
    var count=gl.getProgramParameter(prog,gl.ACTIVE_UNIFORMS);
    for(var i=0;i<count;i++){
      var name=gl.getActiveUniform(prog,i).name;
      uniforms[name]=gl.getUniformLocation(prog,name);
    }
    return {prog:prog,uniforms:uniforms,use:function(){gl.useProgram(prog);}};
  }

  var VERTEX=[
    'precision highp float;',
    'attribute vec2 aPosition;',
    'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
    'uniform vec2 texelSize;',
    'void main(){',
    '  vUv=aPosition*0.5+0.5;',
    '  vL=vUv-vec2(texelSize.x,0.0); vR=vUv+vec2(texelSize.x,0.0);',
    '  vT=vUv+vec2(0.0,texelSize.y); vB=vUv-vec2(0.0,texelSize.y);',
    '  gl_Position=vec4(aPosition,0.0,1.0);',
    '}'].join('\n');

  var HEAD='precision highp float; precision highp sampler2D; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;';

  var FRAG={
    clear:HEAD+'uniform sampler2D uTexture; uniform float value; void main(){ gl_FragColor=value*texture2D(uTexture,vUv); }',
    splat:HEAD+'uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;'+
      'void main(){ vec2 p=vUv-point.xy; p.x*=aspectRatio; vec3 splat=exp(-dot(p,p)/radius)*color; vec3 base=texture2D(uTarget,vUv).xyz; gl_FragColor=vec4(base+splat,1.0); }',
    advection:HEAD+'uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform vec2 dyeTexelSize; uniform float dt; uniform float dissipation;'+
      'vec4 bilerp(sampler2D sam, vec2 uv, vec2 tsize){ vec2 st=uv/tsize-0.5; vec2 iuv=floor(st); vec2 fuv=fract(st);'+
      ' vec4 a=texture2D(sam,(iuv+vec2(0.5,0.5))*tsize); vec4 b=texture2D(sam,(iuv+vec2(1.5,0.5))*tsize); vec4 c=texture2D(sam,(iuv+vec2(0.5,1.5))*tsize); vec4 d=texture2D(sam,(iuv+vec2(1.5,1.5))*tsize);'+
      ' return mix(mix(a,b,fuv.x),mix(c,d,fuv.x),fuv.y); }'+
      'void main(){\n'+
      '#ifdef MANUAL_FILTERING\n vec2 coord=vUv-dt*bilerp(uVelocity,vUv,texelSize).xy*texelSize; vec4 result=bilerp(uSource,coord,dyeTexelSize);\n#else\n vec2 coord=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize; vec4 result=texture2D(uSource,coord);\n#endif\n'+
      ' float decay=1.0+dissipation*dt; gl_FragColor=result/decay; }',
    divergence:HEAD+'uniform sampler2D uVelocity; void main(){ float L=texture2D(uVelocity,vL).x; float R=texture2D(uVelocity,vR).x; float T=texture2D(uVelocity,vT).y; float B=texture2D(uVelocity,vB).y; vec2 C=texture2D(uVelocity,vUv).xy;'+
      ' if(vL.x<0.0){L=-C.x;} if(vR.x>1.0){R=-C.x;} if(vT.y>1.0){T=-C.y;} if(vB.y<0.0){B=-C.y;} float div=0.5*(R-L+T-B); gl_FragColor=vec4(div,0.0,0.0,1.0); }',
    curl:HEAD+'uniform sampler2D uVelocity; void main(){ float L=texture2D(uVelocity,vL).y; float R=texture2D(uVelocity,vR).y; float T=texture2D(uVelocity,vT).x; float B=texture2D(uVelocity,vB).x; float vorticity=R-L-T+B; gl_FragColor=vec4(0.5*vorticity,0.0,0.0,1.0); }',
    vorticity:HEAD+'uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;'+
      'void main(){ float L=texture2D(uCurl,vL).x; float R=texture2D(uCurl,vR).x; float T=texture2D(uCurl,vT).x; float B=texture2D(uCurl,vB).x; float C=texture2D(uCurl,vUv).x;'+
      ' vec2 force=0.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); force/=length(force)+0.0001; force*=curl*C; force.y*=-1.0;'+
      ' vec2 vel=texture2D(uVelocity,vUv).xy; vel+=force*dt; vel=min(max(vel,-1000.0),1000.0); gl_FragColor=vec4(vel,0.0,1.0); }',
    pressure:HEAD+'uniform sampler2D uPressure; uniform sampler2D uDivergence; void main(){ float L=texture2D(uPressure,vL).x; float R=texture2D(uPressure,vR).x; float T=texture2D(uPressure,vT).x; float B=texture2D(uPressure,vB).x;'+
      ' float divergence=texture2D(uDivergence,vUv).x; float p=(L+R+B+T-divergence)*0.25; gl_FragColor=vec4(p,0.0,0.0,1.0); }',
    gradient:HEAD+'uniform sampler2D uPressure; uniform sampler2D uVelocity; void main(){ float L=texture2D(uPressure,vL).x; float R=texture2D(uPressure,vR).x; float T=texture2D(uPressure,vT).x; float B=texture2D(uPressure,vB).x;'+
      ' vec2 vel=texture2D(uVelocity,vUv).xy; vel-=vec2(R-L,T-B); gl_FragColor=vec4(vel,0.0,1.0); }',
    display:HEAD+'uniform sampler2D uTexture; uniform vec2 texelSize; uniform float uOpacity; uniform float uExposure;'+
      'void main(){ vec3 c=texture2D(uTexture,vUv).rgb; vec3 lc=texture2D(uTexture,vL).rgb; vec3 rc=texture2D(uTexture,vR).rgb; vec3 tc=texture2D(uTexture,vT).rgb; vec3 bc=texture2D(uTexture,vB).rgb;'+
      ' float dx=length(rc)-length(lc); float dy=length(tc)-length(bc); vec3 n=normalize(vec3(dx,dy,length(texelSize))); float diffuse=clamp(dot(n,vec3(0.0,0.0,1.0))+0.7,0.7,1.0); c*=diffuse;'+
      ' c=vec3(1.0)-exp(-c*uExposure); c*=uOpacity; float a=max(c.r,max(c.g,c.b)); gl_FragColor=vec4(c,a); }'
  };

  function supportsFormat(internalFormat,format,type){
    var texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,internalFormat,4,4,0,format,type,null);
    var fbo=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    var ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(texture);
    return ok;
  }
  function pickFormat(internalFormat,format,type){
    if(supportsFormat(internalFormat,format,type))return {internalFormat:internalFormat,format:format};
    if(internalFormat===gl.R16F)return pickFormat(gl.RG16F,gl.RG,type);
    if(internalFormat===gl.RG16F)return pickFormat(gl.RGBA16F,gl.RGBA,type);
    return null;
  }

  function initGL(){
    var params={alpha:true,depth:false,stencil:false,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power'};
    var context=canvas.getContext('webgl2',params);
    var isWebGL2=Boolean(context);
    if(!context)context=canvas.getContext('webgl',params)||canvas.getContext('experimental-webgl',params);
    if(!context)return false;
    gl=context;
    var halfFloat, linear, rgba, rg, r;
    if(isWebGL2){
      gl.getExtension('EXT_color_buffer_float');
      linear=Boolean(gl.getExtension('OES_texture_float_linear'));
      halfFloat=gl.HALF_FLOAT;
      rgba=pickFormat(gl.RGBA16F,gl.RGBA,halfFloat);
      rg=pickFormat(gl.RG16F,gl.RG,halfFloat);
      r=pickFormat(gl.R16F,gl.RED,halfFloat);
    }else{
      var hf=gl.getExtension('OES_texture_half_float');
      if(!hf)return false;
      halfFloat=hf.HALF_FLOAT_OES;
      linear=Boolean(gl.getExtension('OES_texture_half_float_linear'));
      rgba=supportsFormat(gl.RGBA,gl.RGBA,halfFloat)?{internalFormat:gl.RGBA,format:gl.RGBA}:null;
      rg=rgba;r=rgba;
    }
    if(!rgba)return false;
    ext={halfFloat:halfFloat,linear:linear,rgba:rgba,rg:rg||rgba,r:r||rgba};

    var vertex=compile(gl.VERTEX_SHADER,VERTEX);
    programs.clear=program(vertex,FRAG.clear);
    programs.splat=program(vertex,FRAG.splat);
    programs.advection=program(vertex,(linear?'':'#define MANUAL_FILTERING\n')+FRAG.advection);
    programs.divergence=program(vertex,FRAG.divergence);
    programs.curl=program(vertex,FRAG.curl);
    programs.vorticity=program(vertex,FRAG.vorticity);
    programs.pressure=program(vertex,FRAG.pressure);
    programs.gradient=program(vertex,FRAG.gradient);
    programs.display=program(vertex,FRAG.display);

    quad=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,-1,1,1,1,1,-1]),gl.STATIC_DRAW);
    var index=gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),gl.STATIC_DRAW);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.enableVertexAttribArray(0);
    canvas.addEventListener('webglcontextlost',function(event){event.preventDefault();lost=true;disable();},false);
    return true;
  }

  function createFBO(w,h,internalFormat,format,type,filter){
    gl.activeTexture(gl.TEXTURE0);
    var texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,internalFormat,w,h,0,format,type,null);
    var fbo=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    gl.viewport(0,0,w,h);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {texture:texture,fbo:fbo,width:w,height:h,texelSizeX:1/w,texelSizeY:1/h,
      attach:function(id){gl.activeTexture(gl.TEXTURE0+id);gl.bindTexture(gl.TEXTURE_2D,texture);return id;},
      dispose:function(){gl.deleteTexture(texture);gl.deleteFramebuffer(fbo);}};
  }
  function createDoubleFBO(w,h,internalFormat,format,type,filter){
    var a=createFBO(w,h,internalFormat,format,type,filter);
    var b=createFBO(w,h,internalFormat,format,type,filter);
    return {width:w,height:h,texelSizeX:a.texelSizeX,texelSizeY:a.texelSizeY,read:a,write:b,
      swap:function(){var t=this.read;this.read=this.write;this.write=t;},
      dispose:function(){a.dispose();b.dispose();}};
  }
  function resolution(base){
    var aspect=gl.drawingBufferWidth/Math.max(1,gl.drawingBufferHeight);
    if(aspect<1)aspect=1/aspect;
    var min=Math.round(base), max=Math.round(base*aspect);
    return gl.drawingBufferWidth>gl.drawingBufferHeight?{w:max,h:min}:{w:min,h:max};
  }
  function disposeBuffers(){
    [dye,velocity,divergence,curl,pressure].forEach(function(b){if(b)b.dispose();});
    dye=velocity=divergence=curl=pressure=null;
  }
  /* Resizing copies the old field into the new buffers so a layout shift
     right after load does not wipe the ink that is already on screen. */
  function resizeFBO(target,w,h,internalFormat,format,type,filter){
    var next=createFBO(w,h,internalFormat,format,type,filter);
    var p=programs.clear;
    p.use();
    gl.uniform1i(p.uniforms.uTexture,target.attach(0));
    gl.uniform1f(p.uniforms.value,1);
    blit(next);
    target.dispose();
    return next;
  }
  function resizeDoubleFBO(target,w,h,internalFormat,format,type,filter){
    if(target.width===w&&target.height===h)return target;
    target.read=resizeFBO(target.read,w,h,internalFormat,format,type,filter);
    target.write.dispose();
    target.write=createFBO(w,h,internalFormat,format,type,filter);
    target.width=w;target.height=h;target.texelSizeX=1/w;target.texelSizeY=1/h;
    return target;
  }
  var resizeCount=0;
  function initBuffers(){
    var sim=resolution(CONFIG.SIM_RES), dyeRes=resolution(CONFIG.DYE_RES);
    var filter=ext.linear?gl.LINEAR:gl.NEAREST;
    if(dye)dye=resizeDoubleFBO(dye,dyeRes.w,dyeRes.h,ext.rgba.internalFormat,ext.rgba.format,ext.halfFloat,filter);
    else dye=createDoubleFBO(dyeRes.w,dyeRes.h,ext.rgba.internalFormat,ext.rgba.format,ext.halfFloat,filter);
    if(velocity)velocity=resizeDoubleFBO(velocity,sim.w,sim.h,ext.rg.internalFormat,ext.rg.format,ext.halfFloat,filter);
    else velocity=createDoubleFBO(sim.w,sim.h,ext.rg.internalFormat,ext.rg.format,ext.halfFloat,filter);
    if(!divergence||divergence.width!==sim.w||divergence.height!==sim.h){
      if(divergence)divergence.dispose();
      if(curl)curl.dispose();
      if(pressure)pressure.dispose();
      divergence=createFBO(sim.w,sim.h,ext.r.internalFormat,ext.r.format,ext.halfFloat,gl.NEAREST);
      curl=createFBO(sim.w,sim.h,ext.r.internalFormat,ext.r.format,ext.halfFloat,gl.NEAREST);
      pressure=createDoubleFBO(sim.w,sim.h,ext.r.internalFormat,ext.r.format,ext.halfFloat,gl.NEAREST);
    }
    resizeCount++;
  }

  function blit(target){
    if(target){gl.viewport(0,0,target.width,target.height);gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo);}
    else{gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
    gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);
  }

  function resizeCanvas(){
    var rect=hero.getBoundingClientRect();
    var dpr=Math.min(window.devicePixelRatio||1,1.25);
    var w=Math.max(1,Math.round(rect.width*dpr)), h=Math.max(1,Math.round(rect.height*dpr));
    if(canvas.width===w&&canvas.height===h)return false;
    canvas.width=w;canvas.height=h;
    return true;
  }

  /* ---------------- simulation ---------------- */

  function correctRadius(radius){
    var aspect=canvas.width/canvas.height;
    return aspect>1?radius*aspect:radius;
  }
  function splat(x,y,dx,dy,color){
    var p=programs.splat;
    p.use();
    gl.uniform1i(p.uniforms.uTarget,velocity.read.attach(0));
    gl.uniform1f(p.uniforms.aspectRatio,canvas.width/canvas.height);
    gl.uniform2f(p.uniforms.point,x,y);
    gl.uniform3f(p.uniforms.color,dx,dy,0);
    gl.uniform1f(p.uniforms.radius,correctRadius(CONFIG.SPLAT_RADIUS));
    blit(velocity.write);velocity.swap();
    gl.uniform1i(p.uniforms.uTarget,dye.read.attach(0));
    gl.uniform3f(p.uniforms.color,color[0],color[1],color[2]);
    blit(dye.write);dye.swap();
  }
  function step(dt){
    gl.disable(gl.BLEND);
    var p=programs.curl;
    p.use();
    gl.uniform2f(p.uniforms.texelSize,velocity.texelSizeX,velocity.texelSizeY);
    gl.uniform1i(p.uniforms.uVelocity,velocity.read.attach(0));
    blit(curl);

    p=programs.vorticity;p.use();
    gl.uniform2f(p.uniforms.texelSize,velocity.texelSizeX,velocity.texelSizeY);
    gl.uniform1i(p.uniforms.uVelocity,velocity.read.attach(0));
    gl.uniform1i(p.uniforms.uCurl,curl.attach(1));
    gl.uniform1f(p.uniforms.curl,CONFIG.CURL);
    gl.uniform1f(p.uniforms.dt,dt);
    blit(velocity.write);velocity.swap();

    p=programs.divergence;p.use();
    gl.uniform2f(p.uniforms.texelSize,velocity.texelSizeX,velocity.texelSizeY);
    gl.uniform1i(p.uniforms.uVelocity,velocity.read.attach(0));
    blit(divergence);

    p=programs.clear;p.use();
    gl.uniform1i(p.uniforms.uTexture,pressure.read.attach(0));
    gl.uniform1f(p.uniforms.value,CONFIG.PRESSURE);
    blit(pressure.write);pressure.swap();

    p=programs.pressure;p.use();
    gl.uniform2f(p.uniforms.texelSize,velocity.texelSizeX,velocity.texelSizeY);
    gl.uniform1i(p.uniforms.uDivergence,divergence.attach(0));
    for(var i=0;i<CONFIG.PRESSURE_ITERATIONS;i++){
      gl.uniform1i(p.uniforms.uPressure,pressure.read.attach(1));
      blit(pressure.write);pressure.swap();
    }

    p=programs.gradient;p.use();
    gl.uniform2f(p.uniforms.texelSize,velocity.texelSizeX,velocity.texelSizeY);
    gl.uniform1i(p.uniforms.uPressure,pressure.read.attach(0));
    gl.uniform1i(p.uniforms.uVelocity,velocity.read.attach(1));
    blit(velocity.write);velocity.swap();

    p=programs.advection;p.use();
    gl.uniform2f(p.uniforms.texelSize,velocity.texelSizeX,velocity.texelSizeY);
    if(!ext.linear)gl.uniform2f(p.uniforms.dyeTexelSize,velocity.texelSizeX,velocity.texelSizeY);
    var velocityId=velocity.read.attach(0);
    gl.uniform1i(p.uniforms.uVelocity,velocityId);
    gl.uniform1i(p.uniforms.uSource,velocityId);
    gl.uniform1f(p.uniforms.dt,dt);
    gl.uniform1f(p.uniforms.dissipation,CONFIG.VELOCITY_DISSIPATION);
    blit(velocity.write);velocity.swap();

    if(!ext.linear)gl.uniform2f(p.uniforms.dyeTexelSize,dye.texelSizeX,dye.texelSizeY);
    gl.uniform1i(p.uniforms.uVelocity,velocity.read.attach(0));
    gl.uniform1i(p.uniforms.uSource,dye.read.attach(1));
    gl.uniform1f(p.uniforms.dissipation,CONFIG.DENSITY_DISSIPATION);
    blit(dye.write);dye.swap();
  }
  function render(){
    var p=programs.display;
    p.use();
    gl.uniform2f(p.uniforms.texelSize,1/gl.drawingBufferWidth,1/gl.drawingBufferHeight);
    gl.uniform1f(p.uniforms.uOpacity,CONFIG.OPACITY);
    gl.uniform1f(p.uniforms.uExposure,CONFIG.EXPOSURE);
    gl.uniform1i(p.uniforms.uTexture,dye.read.attach(0));
    gl.disable(gl.BLEND);
    blit(null);
  }
  function clearAll(){
    if(!gl||!dye)return;
    [dye.read,dye.write,velocity.read,velocity.write,pressure.read,pressure.write,divergence,curl].forEach(function(f){
      gl.bindFramebuffer(gl.FRAMEBUFFER,f.fbo);gl.viewport(0,0,f.width,f.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /* ---------------- loop ---------------- */

  function frame(now){
    frameId=0;
    if(!running)return;
    var dt=Math.min((now-(lastFrame||now))/1000,1/30);
    lastFrame=now;
    colorPhase+=dt*.09;
    if(resizeCanvas())initBuffers();
    if(pointer.moved){
      pointer.moved=false;
      /* Cap the impulse per frame so a stalled frame that queued many
         pointer events cannot blast the whole field in one step. */
      var limit=CONFIG.SPLAT_FORCE*.14;
      var dx=Math.max(-limit,Math.min(limit,pointer.dx));
      var dy=Math.max(-limit,Math.min(limit,pointer.dy));
      splat(pointer.x,pointer.y,dx,dy,currentInk());
      pointer.dx=pointer.dy=0;
    }
    var start=performance.now();
    step(dt);
    render();
    watchPerformance(performance.now()-start);
    if(now-lastInput>CONFIG.SLEEP_AFTER){running=false;return;}
    frameId=requestAnimationFrame(frame);
  }
  function wake(){
    lastInput=performance.now();
    if(!enabled||!visible||running||softPaused)return;
    running=true;lastFrame=0;
    frameId=requestAnimationFrame(frame);
  }
  function stopLoop(){
    running=false;
    if(frameId)cancelAnimationFrame(frameId);
    frameId=0;
  }
  function watchPerformance(ms){
    frameSamples.push(ms);
    if(frameSamples.length<90)return;
    var avg=frameSamples.reduce(function(a,b){return a+b;},0)/frameSamples.length;
    frameSamples=[];
    if(avg<=CONFIG.FRAME_BUDGET)return;
    if(!downgraded){
      downgraded=true;
      CONFIG.DYE_RES=440;CONFIG.SIM_RES=96;CONFIG.PRESSURE_ITERATIONS=10;
      initBuffers();
    }else{
      disabledForPerf=true;
      disable();
    }
  }

  /* ---------------- input ---------------- */

  function toLocal(event){
    var rect=hero.getBoundingClientRect();
    return {x:(event.clientX-rect.left)/rect.width,y:1-(event.clientY-rect.top)/rect.height,rect:rect};
  }
  function onPointerMove(event){
    if(!enabled||softPaused||(event.pointerType&&event.pointerType!=='mouse'))return;
    var p=toLocal(event);
    var inside=p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
    if(!inside){pointer.inside=false;return;}
    if(!pointer.inside){pointer.inside=true;pointer.prevX=p.x;pointer.prevY=p.y;}
    var aspect=p.rect.width/p.rect.height;
    var dx=(p.x-pointer.prevX)*aspect, dy=p.y-pointer.prevY;
    pointer.prevX=p.x;pointer.prevY=p.y;
    if(Math.abs(dx)+Math.abs(dy)<.0005)return;
    pointer.x=p.x;pointer.y=p.y;
    pointer.dx+=dx*CONFIG.SPLAT_FORCE;pointer.dy+=dy*CONFIG.SPLAT_FORCE;
    pointer.moved=true;
    wake();
  }
  function burst(cx,cy,count,spread,strength){
    if(!enabled||softPaused||!gl||!dye)return;
    for(var i=0;i<count;i++){
      var angle=Math.random()*Math.PI*2;
      var dist=Math.random()*spread;
      var x=Math.min(.98,Math.max(.02,cx+Math.cos(angle)*dist));
      var y=Math.min(.98,Math.max(.02,cy+Math.sin(angle)*dist*.7));
      colorPhase+=.21;
      splat(x,y,Math.cos(angle)*strength,Math.sin(angle)*strength,currentInk());
    }
    wake();
  }
  var introAt=0;
  function intro(){
    if(introDone||!enabled)return;
    introDone=true;introAt=Math.round(performance.now());
    var rect=hero.getBoundingClientRect();
    var cx=rect.width>900?.68:.5;
    burst(cx,.58,5,.16,560);
    window.setTimeout(function(){burst(cx-.08,.5,3,.13,480);},460);
    window.setTimeout(function(){burst(cx+.05,.64,3,.11,420);},980);
  }

  function setPalette(name,withBurst){
    if(!PALETTES[name])return;
    paletteName=name;palette=PALETTES[name];
    if(withBurst&&enabled){
      var origin=pointer.inside?{x:pointer.x,y:pointer.y}:{x:.3,y:.42};
      burst(origin.x,origin.y,3,.09,460);
    }
  }
  function pressedMode(){
    var pressed=hero.querySelector('.role-pill[aria-pressed="true"]');
    return pressed?pressed.dataset.flowMode:'product';
  }
  function watchPills(){
    var group=hero.querySelector('.hero-roles');
    if(!group)return;
    setPalette(pressedMode(),false);
    new MutationObserver(function(){
      var mode=pressedMode();
      if(mode!==paletteName)setPalette(mode,true);
    }).observe(group,{attributes:true,subtree:true,attributeFilter:['aria-pressed']});
    Array.prototype.forEach.call(group.querySelectorAll('.role-pill'),function(pill){
      pill.addEventListener('pointerenter',function(){if(PALETTES[pill.dataset.flowMode]){palette=PALETTES[pill.dataset.flowMode];}});
      pill.addEventListener('pointerleave',function(){palette=PALETTES[paletteName];});
    });
  }

  /* ---------------- lifecycle ---------------- */

  var initialised=false;
  function enable(){
    if(enabled)return;
    if(!initialised){
      initialised=true;
      try{
        if(!initGL()){lost=true;lastError='unsupported';return;}
      }catch(error){lost=true;lastError=String(error&&error.message||error);return;}
      applyTierResolution();
      resizeCanvas();
      initBuffers();
    }
    enabled=true;
    if(applyTierResolution()&&dye)initBuffers();
    hero.classList.add('has-fluid');
    if(!introDone)window.setTimeout(intro,1400);
    if(!motionAllowed())softPaused=true;
    wake();
  }
  function disable(){
    if(!enabled)return;
    enabled=false;
    stopLoop();
    hero.classList.remove('has-fluid');
    pointer.inside=false;pointer.moved=false;
    if(gl&&dye)clearAll();
  }
  /* Hard conditions (static profile, reduced motion, coarse pointer, lost
     context, slow GPU) tear the layer down and clear the ink. Temporary ones
     (Pause Motion, hidden tab, open menu or lightbox) only freeze the frame. */
  function sync(){
    if(!wanted()){disable();return;}
    enable();
    if(motionAllowed()){
      if(softPaused){softPaused=false;wake();}
    }else if(!softPaused){
      softPaused=true;
      stopLoop();
    }
  }

  window.addEventListener('pointermove',onPointerMove,{passive:true});
  document.documentElement.addEventListener('mouseleave',function(){pointer.inside=false;});
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(entries){
      visible=entries[0]?entries[0].isIntersecting:true;
      if(!visible)stopLoop();
      else if(enabled)wake();
    },{threshold:0,rootMargin:'40px 0px'}).observe(hero);
  }
  var resizeTimer=0;
  window.addEventListener('resize',function(){
    window.clearTimeout(resizeTimer);
    resizeTimer=window.setTimeout(function(){if(enabled&&resizeCanvas())initBuffers();},160);
  });
  if(siteMotion&&typeof siteMotion.subscribe==='function')siteMotion.subscribe(sync);
  else{
    sync();
    if(reduceQuery.addEventListener)reduceQuery.addEventListener('change',sync);
  }
  if(finePointer.addEventListener)finePointer.addEventListener('change',sync);
  watchPills();

  window.siteFluid={
    isActive:function(){return enabled;},
    isRunning:function(){return running;},
    burst:function(x,y,count){burst(typeof x==='number'?x:.5,typeof y==='number'?y:.5,count||4,.14,900);},
    config:CONFIG,
    setPalette:function(name){setPalette(name,true);},
    sampleDye:function(){
      if(!gl||!dye)return null;
      try{
        gl.bindFramebuffer(gl.FRAMEBUFFER,dye.read.fbo);
        var buf=new Float32Array(4), max=0, cells=0;
        for(var i=0;i<12;i++){for(var j=0;j<8;j++){
          gl.readPixels(Math.floor(dye.width*(i+.5)/12),Math.floor(dye.height*(j+.5)/8),1,1,gl.RGBA,gl.FLOAT,buf);
          var v=Math.max(buf[0],buf[1],buf[2]);
          if(v>.02)cells++;
          if(v>max)max=v;
        }}
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);
        return {max:+max.toFixed(3),litCells:cells,of:96,err:gl.getError()};
      }catch(error){return {error:String(error)};}
    },
    debug:function(){return {softPaused:softPaused,lost:lost,lastError:lastError,resizes:resizeCount,canvasW:canvas.width,canvasH:canvas.height,enabled:enabled,running:running,introDone:introDone,introAt:introAt,lastInput:Math.round(lastInput),now:Math.round(performance.now()),disabledForPerf:disabledForPerf,downgraded:downgraded,linear:ext?ext.linear:null,tier:tier(),wanted:wanted()};}
  };
})();
