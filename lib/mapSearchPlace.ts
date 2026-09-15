export type MapSearchPlace = {
 id:string;title:string;detail:string;category:string;kind:'organization';point:{lat:number;lng:number};
 sourceUrl:string;retrievedAt:string;pointIsCenter:true;dogAccess:'unknown';
};
/** Validate persisted/HTTP result before it can become a map command. */
export function isMapSearchPlace(value:unknown):value is MapSearchPlace {
 if(!value||typeof value!=='object')return false;
 const p=value as Partial<MapSearchPlace>;
 return typeof p.id==='string'&&p.id.length<=120&&p.id.startsWith('osm-')&&typeof p.title==='string'&&p.title.length>0&&p.title.length<=300&&
 typeof p.detail==='string'&&p.detail.length<=600&&typeof p.category==='string'&&p.category.length<=100&&p.kind==='organization'&&!!p.point&&
 Number.isFinite(p.point.lat)&&p.point.lat>=-90&&p.point.lat<=90&&Number.isFinite(p.point.lng)&&p.point.lng>=-180&&p.point.lng<=180&&
 p.pointIsCenter===true&&p.dogAccess==='unknown'&&typeof p.sourceUrl==='string'&&p.sourceUrl.startsWith('https://www.openstreetmap.org/')&&typeof p.retrievedAt==='string'&&Number.isFinite(Date.parse(p.retrievedAt));
}
