import { createServer, build } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mkdtemp, mkdir, writeFile, cp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const root=await mkdtemp(join(process.cwd(),'.motion-export-check-'))
const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'})
try{
 const {codeFor}=await server.ssrLoadModule('/src/workspace/export.ts')
 const {catalog,defaults}=await server.ssrLoadModule('/src/workspace/model.ts')
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
  const list=catalog.map((_,i)=>'E'+i).join(',')
  const main='main.'+(framework==='Vue'?'js':'jsx')
  await writeFile(join(dir,'index.html'),'<div id="app"></div><script type="module" src="/src/'+main+'"></script>')
  const entry=framework==='Vue'?'import {createApp,h} from "vue"\n'+imports.join('\n')+'\ncreateApp({render:()=>h("main",['+list+'].map(E=>h(E)))}).mount("#app")':'import React from "react"\nimport {createRoot} from "react-dom/client"\n'+imports.join('\n')+'\ncreateRoot(document.getElementById("app")).render(React.createElement("main",null,['+list+'].map((E,i)=>React.createElement(E,{key:i}))))'
  await writeFile(join(dir,'src',main),entry)
  await build({root:dir,configFile:false,base:'./',plugins:framework==='Vue'?[vue()]:[],esbuild:{jsx:'automatic'},build:{outDir:'dist'}})
  console.log(framework+' export build passed: '+catalog.length+' effects')
 }
}finally{await server.close();await rm(root,{recursive:true,force:true})}
