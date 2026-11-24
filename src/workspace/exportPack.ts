import { codeFor,extensionFor,type Format } from './export'
import { htmlFor } from './htmlExport'
import type { Config } from './model'
const sources=import.meta.glob('../../packages/motion/*.{js,css,md,json,ts}',{query:'?raw',import:'default',eager:true}) as Record<string,string>
const encoder=new TextEncoder()
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
export function zipFiles(files:Record<string,string>):Blob{
 const entries=Object.entries(files).map(([name,text])=>({name:encoder.encode(name),data:encoder.encode(text),offset:0,crc:0}))
 let local=0,central=0
 for(const e of entries){e.offset=local;e.crc=crc32(e.data);local+=30+e.name.length+e.data.length;central+=46+e.name.length}
 const bytes=new Uint8Array(local+central+22),v=new DataView(bytes.buffer)
 const u16=(p:number,n:number)=>v.setUint16(p,n,true),u32=(p:number,n:number)=>v.setUint32(p,n,true)
 let p=0
 for(const e of entries){u32(p,0x04034b50);u16(p+4,20);u16(p+6,0x800);u32(p+14,e.crc);u32(p+18,e.data.length);u32(p+22,e.data.length);u16(p+26,e.name.length);bytes.set(e.name,p+30);bytes.set(e.data,p+30+e.name.length);p+=30+e.name.length+e.data.length}
 for(const e of entries){u32(p,0x02014b50);u16(p+4,20);u16(p+6,20);u16(p+8,0x800);u32(p+16,e.crc);u32(p+20,e.data.length);u32(p+24,e.data.length);u16(p+28,e.name.length);u32(p+42,e.offset);bytes.set(e.name,p+46);p+=46+e.name.length}
 u32(p,0x06054b50);u16(p+8,entries.length);u16(p+10,entries.length);u32(p+12,central);u32(p+16,local)
 return new Blob([bytes.buffer],{type:'application/zip'})
}
export function exportPack(c:Config){
 const files:Record<string,string>={'index.html':htmlFor(c),'config.json':JSON.stringify(c,null,2),'README.md':'# Motion Lab export\n\nOpen index.html directly. For Vue or React, copy the component and motion-kit directory into your app; imports are relative. JavaScript requires a data-motion-root element and module loading. CSS is supplementary for layout/gesture effects.\n'}
 for(const format of ['Vue','React','JavaScript','CSS','Tokens','AI'] as Format[])files['motion.'+extensionFor(format)]=codeFor(c,format)
 for(const [path,source] of Object.entries(sources))files['motion-kit/'+path.split('/').at(-1)]=source
 return zipFiles(files)
}
