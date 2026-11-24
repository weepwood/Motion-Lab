import {chromium,expect} from '@playwright/test'
import {readFile,readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const [dist,sha]=process.argv.slice(2)
if(!dist||!/^\w{40}$/.test(sha))throw Error('Usage: verify-production.mjs DIST SHA')
const origin='https://weepwood.github.io/Motion-Lab/'
const hash=b=>createHash('sha256').update(b).digest('hex')
const url=(path='')=>new URL(path,origin)
async function verify(path){
 const local=await readFile(join(dist,path))
 const remote=url(path);remote.searchParams.set('release',sha)
 for(let i=0;i<12;i++){
  try{const response=await fetch(remote,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(response.ok&&hash(Buffer.from(await response.arrayBuffer()))===hash(local)){console.log('Production bytes verified: '+path);return}}catch(e){console.log('Retry production asset: '+path+' '+e.message)}
  if(i<11)await new Promise(resolve=>setTimeout(resolve,5000))
 }
 throw Error('Production artifact mismatch: '+path)
}
await verify('index.html')
await verify('demo/index.html')
await verify('packages/motion/composition.js')
for(const file of await readdir(join(dist,'assets')))if(/\.(js|css)$/.test(file))await verify('assets/'+file)
const browser=await chromium.launch()
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[]
 page.on('pageerror',e=>errors.push(String(e)))
 page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)errors.push(r.status()+' '+r.url())})
 const open=async path=>{const u=url(path);u.searchParams.set('release',sha);const response=await page.goto(u.href);if(!response?.ok())throw Error('Production page load failed: '+path)}
 await open('');await expect(page.locator('.workspace')).toBeVisible()
 const message=page.getByRole('textbox',{name:'消息内容'});await message.fill('Release smoke');await message.press('Enter')
 await expect(page.locator('.message-list .bubble-text').filter({hasText:'Release smoke'})).toBeVisible()
 await open('?workspace=1');await expect(page.getByRole('heading',{name:'滑动转场'})).toBeVisible()
 await page.getByRole('button',{name:'多轨道',exact:true}).click()
 await page.getByRole('button',{name:'新增布局轨道'}).click()
 await page.getByRole('button',{name:'组合预览',exact:true}).click()
 await expect(page.locator('[data-composition-item]')).toHaveCount(4)
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出编排 JSON'}).click()])
 const data=JSON.parse(await readFile(await download.path(),'utf8'))
 if(data.version!==1||data.tracks.length!==1||data.tracks[0].config.effect!=='flip')throw Error('Production project export mismatch')
 await page.getByLabel('导入编排项目').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))})
 await expect(page.locator('.ws-composition-row')).toHaveCount(2)
 await page.reload();await page.getByRole('button',{name:'多轨道',exact:true}).click();await expect(page.locator('.ws-composition-row')).toHaveCount(2)
 await open('demo/');await expect(page.getByRole('heading',{level:1})).toContainText('motion-kit');await expect(page.locator('.card')).toHaveCount(8)
 await page.getByRole('button',{name:'发送（快照飞行）'}).click();await expect(page.locator('#flyTarget.on')).toBeVisible({timeout:8000})
 if(errors.length)throw Error(errors.join('\n'))
 console.log('Production browser smoke passed: chat / workspace / project JSON / persistence / demo')
}finally{await browser.close()}
