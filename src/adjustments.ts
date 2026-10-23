import type { Adjustments } from './creative-model';
const fragment=`precision mediump float;varying vec2 uv;uniform sampler2D image;uniform vec2 texel;
uniform float brightness,contrast,saturation,exposure,highlights,shadows,temperature,tint,sharpen,vignette,fade;
void main(){vec3 c=texture2D(image,uv).rgb;
 c+=sharpen*(4.0*c-texture2D(image,uv+vec2(texel.x,0)).rgb-texture2D(image,uv-vec2(texel.x,0)).rgb-texture2D(image,uv+vec2(0,texel.y)).rgb-texture2D(image,uv-vec2(0,texel.y)).rgb);
 c*=pow(2.0,exposure);float l=dot(c,vec3(.2126,.7152,.0722));c+=vec3(shadows*.35*pow(1.0-clamp(l,0.0,1.0),2.0)+highlights*.35*pow(clamp(l,0.0,1.0),2.0));
 c+=vec3(temperature*.1,-tint*.1,-temperature*.1);c=(c-.5)*(1.0+contrast)+.5+brightness*.25;
 c=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,1.0+saturation);c=mix(c,vec3(.5),fade*.4);
 float r=length(uv-.5),v=smoothstep(.25,.7,r);c*=1.0-vignette*v*.8;gl_FragColor=vec4(clamp(c,0.0,1.0),texture2D(image,uv).a);}`;

/** Conventional colour/edge operations; WebGL is GPU processing, not AI. */
export class ColorProcessor{
 private canvas=document.createElement('canvas');private gl:WebGLRenderingContext|null=null;private program:WebGLProgram|null=null;
 constructor(){
  try{
   const gl=this.canvas.getContext('webgl',{preserveDrawingBuffer:true,alpha:true,premultipliedAlpha:false});if(!gl)return;
   const compile=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Shader unavailable');return s;};
   const program=gl.createProgram()!;gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 point;varying vec2 uv;void main(){uv=(point+1.0)*.5;gl_Position=vec4(point,0,1);}'));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader unavailable');gl.useProgram(program);
   const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const point=gl.getAttribLocation(program,'point');gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,2,gl.FLOAT,false,0,0);
   gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);
   this.gl=gl;this.program=program;
  }catch{this.gl=null;}
 }
 render(source:HTMLCanvasElement,values:Adjustments):HTMLCanvasElement{
  const gl=this.gl;
  if(gl&&!gl.isContextLost()){
   if(this.canvas.width!==source.width||this.canvas.height!==source.height){this.canvas.width=source.width;this.canvas.height=source.height;}
   gl.viewport(0,0,source.width,source.height);gl.useProgram(this.program);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.uniform2f(gl.getUniformLocation(this.program!,'texel'),1/source.width,1/source.height);
   for(const key of ['brightness','contrast','saturation','exposure','highlights','shadows','temperature','tint','sharpen','vignette','fade'] as const)gl.uniform1f(gl.getUniformLocation(this.program!,key),(values[key]??0)/(key==='exposure'?1:100));
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return this.canvas;
  }
  const ctx=source.getContext('2d',{willReadFrequently:true})!,pixels=ctx.getImageData(0,0,source.width,source.height);adjustPixels(pixels.data,source.width,source.height,values);ctx.putImageData(pixels,0,0);return source;
 }
}
export function adjustPixels(data:Uint8ClampedArray,width:number,height:number,a:Adjustments){
 const original=(a.sharpen??0)>0?data.slice():data,clamp=(n:number)=>Math.max(0,Math.min(1,n));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;let c=[0,1,2].map(k=>original[i+k]/255);
  if(a.sharpen){const neighbours=[[Math.max(0,x-1),y],[Math.min(width-1,x+1),y],[x,Math.max(0,y-1)],[x,Math.min(height-1,y+1)]];c=c.map((v,k)=>v+a.sharpen!/100*(4*v-neighbours.reduce((n,[nx,ny])=>n+original[(ny*width+nx)*4+k]/255,0)));}
  c=c.map(v=>v*2**(a.exposure??0));let lum=c[0]*.2126+c[1]*.7152+c[2]*.0722;
  const light=(a.shadows??0)/100*.35*(1-clamp(lum))**2+(a.highlights??0)/100*.35*clamp(lum)**2;
  c=c.map((v,k)=>(v+light+(k===0?(a.temperature??0)/100*.1:k===2?-(a.temperature??0)/100*.1:-(a.tint??0)/100*.1)-.5)*(1+(a.contrast??0)/100)+.5+(a.brightness??0)/100*.25);
  lum=c[0]*.2126+c[1]*.7152+c[2]*.0722;c=c.map(v=>lum+(v-lum)*(1+(a.saturation??0)/100));
  let r=Math.hypot((x+.5)/width-.5,(y+.5)/height-.5),v=clamp((r-.25)/.45);v=v*v*(3-2*v);
  for(let k=0;k<3;k++)data[i+k]=clamp((c[k]*(1-(a.fade??0)/100*.4)+.5*(a.fade??0)/100*.4)*(1-(a.vignette??0)/100*v*.8))*255;
 }
}
