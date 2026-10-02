import test from 'node:test';
import assert from 'node:assert/strict';
import {placeMapLabels} from '../app/map-labels.ts';
test('crowded and edge region labels remain separate and within the viewBox',()=>{
 const labels=placeMapLabels(Array.from({length:60},(_,i)=>({id:String(i),x:i<3?0:360,y:i<3?0:260,text:['경기도','세종특별자치시','대전광역시'][i%3]})));
 assert.equal(labels.length,60);
 for(let i=0;i<labels.length;i++){const a=labels[i];assert.ok(a.x-a.width/2>=0&&a.x+a.width/2<=720&&a.y>=13);for(const b of labels.slice(i+1)){assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2+6||Math.abs(a.y-b.y)>=24);}}
});
