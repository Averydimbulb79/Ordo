import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TRANSITIONS,FONT_NAMES,ADJUSTMENTS,newText,parseTexts,importCaptions,captionsToSrt,validateAdjustments} from '../src/creative-model.ts';
import {fresh,parseProject,duration} from '../src/model.ts';
import {cropPreset,validateCrop} from '../src/crop.ts';
import {exportDimensions} from '../src/export-settings.ts';
import {adjustPixels} from '../src/adjustments.ts';

test('title/caption styles, transition, crop and grading survive project saves',()=>{
 const p={...fresh(),assets:[{id:'a',name:'a.webm',size:10,modified:0,duration:3,kind:'video',width:320,height:180}],clips:[{id:'c',assetId:'a',inFrame:0,frames:90,volume:1,transition:'wipe-left',transitionFrames:15,crop:cropPreset('1:1',320,180),adjustments:{highlights:-20,shadows:30,sharpen:20}}],texts:[{...newText('title',15),fontFamily:'Lato',bold:true,italic:true,underline:true,strike:true,rotation:32,color:'#12abcd'}]};
 assert.deepEqual(parseProject(JSON.stringify(p)),p);assert.equal(TRANSITIONS.length,13);assert.equal(new Set(TRANSITIONS.map(t=>t[0])).size,13);
 const textOnly={...fresh(),texts:[newText('caption',60)]};assert.equal(duration(textOnly),150);
 for(const patch of [{fontFamily:'<script>'},{fontSize:0},{rotation:Infinity},{frames:-1},{color:'red'},{bold:'true'}])assert.throws(()=>parseTexts([{...p.texts[0],...patch}],FONT_NAMES));
 assert.throws(()=>validateAdjustments({brightness:101}));assert.throws(()=>validateAdjustments({exposure:3}));
});
test('SRT and VTT caption timing imports and round trips within a timeline frame',()=>{
 const items=importCaptions('1\n00:00:01,250 --> 00:00:02,750\nHello\nworld\n\n2\n00:00:03,000 --> 00:00:04,000\nSecond');
 assert.equal(items.length,2);assert.equal(items[0].startFrame,38);assert.equal(items[0].frames,45);assert.equal(items[0].text,'Hello\nworld');
 assert.equal(importCaptions(captionsToSrt(items))[0].frames,45);
 assert.equal(importCaptions('WEBVTT\n\n00:01.000 --> 00:02.000\nCaption')[0].startFrame,30);
 assert.throws(()=>importCaptions('1\n00:00:03,000 --> 00:00:01,000\nBad'));
});
test('crop presets preserve source-space aspect ratio and free boxes stay bounded',()=>{
 for(const ratio of ['16:9','9:16','1:1','4:3','3:4','4:5','21:9']){
  const c=validateCrop(cropPreset(ratio,1920,1080)),[w,h]=ratio.split(':').map(Number);assert.ok(Math.abs(1920*c.width/(1080*c.height)-w/h)<1e-6);
 }
 assert.deepEqual(validateCrop({x:.1,y:.2,width:.4,height:.6}),{x:.1,y:.2,width:.4,height:.6});assert.throws(()=>validateCrop({x:.8,y:0,width:.4,height:1}));
});
test('export sizes preserve canvas orientation and frame-rate choices',()=>{
 for(const fps of [24,25,30,50,60])assert.equal(exportDimensions({width:1280,height:720},{resolution:1080,fps,quality:'standard'}).fps,fps);
 assert.deepEqual(exportDimensions({width:720,height:1280},{resolution:1080,fps:30,quality:'standard'}),{width:1080,height:1920,fps:30,bitrate:8000000});
 assert.equal(exportDimensions({width:1280,height:720},{resolution:2160,fps:60,quality:'high'}).width,3840);
 assert.throws(()=>exportDimensions(fresh(),{resolution:123,fps:30,quality:'standard'}));
});
test('all grading controls change pixels and neutral grading is lossless',()=>{
 const neutral=new Uint8ClampedArray([64,128,192,255]);adjustPixels(neutral,1,1,{});assert.deepEqual([...neutral],[64,128,192,255]);
 for(const [key,,,max] of ADJUSTMENTS){const pixels=new Uint8ClampedArray(Array.from({length:25},(_,i)=>[i===12?130:80,50,160,255]).flat());const before=pixels.slice();adjustPixels(pixels,5,5,{[key]:max});assert.notDeepEqual(pixels,before,key);}
 const gray=new Uint8ClampedArray([200,20,50,255]);adjustPixels(gray,1,1,{saturation:-100});assert.equal(gray[0],gray[1]);assert.equal(gray[1],gray[2]);
});
