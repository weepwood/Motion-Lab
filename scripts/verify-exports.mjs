import { createServer, build, preview } from 'vite'
import { chromium } from '@playwright/test'
import { strict as assert } from 'node:assert'
import { crc32 } from 'node:zlib'
import vue from '@vitejs/plugin-vue'
import { mkdtemp, mkdir, writeFile, cp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const root=await mkdtemp(join(process.cwd(),'.motion-export-check-'))
const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'})
try{
 const {codeFor}=await server.ssrLoadModule('/src/workspace/export.ts')
 const {catalog,defaults}=await server.ssrLoadModule('/src/workspace/model.ts')
 const {exportPack}=await server.ssrLoadModule('/src/workspace/exportPack.ts')
 const {projectCode,projectZip}=await server.ssrLoadModule('/src/workspace/projectExport.ts')
 const project={version:1,tracks:['slide','flip','shared','drag'].map((effect,i)=>({id:'test-'+i,name:'Track '+i,delay:i*40,muted:false,config:defaults(effect),gesture:effect==='drag'?[{t:0,x:0,y:0},{t:100,x:20,y:10}]:[]}))}
 function unpack(zip){
 const extracted=new Map();let cursor=0
 while(zip.readUInt32LE(cursor)===0x04034b50){const size=zip.readUInt32LE(cursor+18),nameLen=zip.readUInt16LE(cursor+26),extra=zip.readUInt16LE(cursor+28),name=zip.subarray(cursor+30,cursor+30+nameLen).toString();const start=cursor+30+nameLen+extra;const data=zip.subarray(start,start+size);assert.equal(crc32(data),zip.readUInt32LE(cursor+14));extracted.set(name,data.toString());cursor=start+size}
 assert.equal(zip.readUInt32LE(cursor),0x02014b50);assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);assert.equal(zip.readUInt16LE(zip.length-12),extracted.size)
 return extracted
 }
 const extracted=unpack(Buffer.from(await exportPack(defaults('flip')).arrayBuffer()))
 for(const name of ['index.html','motion.vue','motion.jsx','motion.js','config.json','motion-kit/index.js','motion-kit/layout.js'])assert.ok(extracted.has(name),name)
 console.log('ZIP extraction and CRC validation passed: '+extracted.size+' entries')
 const projectFiles=unpack(Buffer.from(await projectZip(project).arrayBuffer()))
 for(const name of ['index.html','project.json','Composition.vue','Composition.jsx','motion-kit/composition.js','motion-kit/layout.js','motion-kit/easing.js'])assert.ok(projectFiles.has(name),name)
 console.log('Composition ZIP CRC validation passed: '+projectFiles.size+' entries')
 await writeFile(join(root,'package.json'),JSON.stringify({private:true,type:'module'}))
 execFileSync(process.platform==='win32'?'npm.cmd':'npm',['install','--prefix',root,'--no-audit','--no-fund','--save-exact','react@19.1.1','react-dom@19.1.1'],{stdio:'inherit'})
 for(const framework of ['Vue','React']){
  const dir=join(root,framework.toLowerCase());await mkdir(join(dir,'src'),{recursive:true})
  await cp('packages/motion',join(dir,'src','motion-kit'),{recursive:true})
  const ext=framework==='Vue'?'vue':'jsx',imports=[]
  for(const [i,e] of catalog.entries()){
   const file='effect-'+i+'.'+ext
   await writeFile(join(dir,'src',file),codeFor(defaults(e.id),framework));imports.push('import E'+i+' from "./'+file+'"')
  }
  await writeFile(join(dir,'src','Composition.'+ext),projectCode(project,framework));imports.push('import Composition from "./Composition.'+ext+'"')
  const list=[...catalog.map((_,i)=>'E'+i),'Composition'].join(',')
  const main='main.'+(framework==='Vue'?'js':'jsx')
  await writeFile(join(dir,'index.html'),'<div id="app"></div><script type="module" src="/src/'+main+'"></script>')
  const entry=framework==='Vue'?'import {createApp,h} from "vue"\n'+imports.join('\n')+'\ncreateApp({render:()=>h("main",['+list+'].map(E=>h(E)))}).mount("#app")':'import React from "react"\nimport {createRoot} from "react-dom/client"\n'+imports.join('\n')+'\ncreateRoot(document.getElementById("app")).render(React.createElement("main",null,['+list+'].map((E,i)=>React.createElement(E,{key:i}))))'
  await writeFile(join(dir,'src',main),entry)
  await build({root:dir,configFile:false,base:'./',plugins:framework==='Vue'?[vue()]:[],esbuild:{jsx:'automatic'},build:{outDir:'dist'}})
  console.log(framework+' export build passed: '+catalog.length+' effects')
  const host=await preview({root:dir,configFile:false,preview:{host:'127.0.0.1',port:0,strictPort:true}})
  const browser=await chromium.launch({headless:true})
  try{
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)))
   const port=host.httpServer.address().port;await page.goto('http://127.0.0.1:'+port)
   await page.waitForFunction(()=>document.querySelectorAll('[data-motion-item]').length===6)
   const flip=page.locator('button').first();await flip.click()
   assert.equal(await page.locator('[data-motion-item]').first().textContent(),'2')
   await page.waitForFunction(()=>document.querySelectorAll('[data-composition-track]').length===4)
   await page.getByRole('button',{name:'播放编排',exact:true}).click()
   assert.equal(await page.locator('[data-composition-item]').count(),7)
   assert.deepEqual(errors,[]);console.log(framework+' export browser runtime passed; composition runtime passed')
  }finally{await browser.close();await new Promise(resolve=>host.httpServer.close(resolve))}
 }
}finally{await server.close();await rm(root,{recursive:true,force:true})}
