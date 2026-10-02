export type MapLabel = { id:string; x:number; y:number; text:string };
export type PlacedMapLabel = MapLabel & { anchorX:number; anchorY:number; width:number };
export function placeMapLabels(input:MapLabel[]):PlacedMapLabel[] {
  const placed:PlacedMapLabel[]=[];
  const overlaps=(x:number,y:number,width:number)=>placed.some(p=>Math.abs(p.x-x)<(p.width+width)/2+6 && Math.abs(p.y-y)<24);
  for(const label of input){
    const width=Math.min(680,Math.max(40,[...label.text].reduce((n,c)=>n+(c.charCodeAt(0)<=127?7:12),0)+16));
    let point:{x:number;y:number}|null=null;
    for(let radius=0;radius<=420&&!point;radius+=16){
      const candidates=[];
      for(let dx=-radius;dx<=radius;dx+=16)for(let dy=-radius;dy<=radius;dy+=16){
        if(radius && Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
        const x=Math.max(width/2+8,Math.min(712-width/2,label.x+dx));const y=Math.max(18,Math.min(502,label.y+dy));
        candidates.push({x,y,d:(x-label.x)**2+(y-label.y)**2});
      }
      candidates.sort((a,b)=>a.d-b.d);
      point=candidates.find(p=>!overlaps(p.x,p.y,width))??null;
    }
    if(!point){let y=542;while(overlaps(360,y,width))y+=26;point={x:360,y};}
    placed.push({...label,...point,anchorX:label.x,anchorY:label.y,width});
  }
  return placed;
}
