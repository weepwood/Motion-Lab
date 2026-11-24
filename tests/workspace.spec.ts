import { test, expect } from '@playwright/test'
test('workspace navigation, preview, presets, A/B, export and persistence',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)))
  await page.goto('/?workspace=1')
  await expect(page.getByRole('heading',{name:'滑动转场'})).toBeVisible()
  await page.getByRole('textbox',{name:'搜索动效'}).fill('spring')
  await page.getByRole('button',{name:'阻尼弹簧',exact:true}).click()
  await expect(page.getByRole('heading',{name:'阻尼弹簧'})).toBeVisible()
  await page.getByRole('button',{name:'固定为 B 对比'}).click()
  await expect(page.getByLabel('B · 快照')).toBeVisible()
  await page.getByRole('button',{name:'下一帧'}).click()
  await expect(page.getByLabel('时间轴',{exact:true})).not.toHaveValue('0')
  await page.getByRole('button',{name:'资产',exact:true}).click()
  await page.getByLabel('预设名称').fill('弹簧测试')
  await page.getByRole('button',{name:'保存新预设'}).click()
  await expect(page.getByText('弹簧测试',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'导出',exact:true}).click()
  await page.getByLabel('导出格式').selectOption('CSS')
  await expect(page.getByLabel('生成代码')).toHaveValue(/@keyframes motion/)
  await page.reload()
  await page.getByRole('button',{name:'资产',exact:true}).click()
  await expect(page.getByText('弹簧测试',{exact:true})).toBeVisible()
  expect(errors).toEqual([])
})
test('layout reorder and mobile workspace',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/?workspace=1')
  await page.getByRole('button',{name:'切换资源面板'}).click()
  await page.getByRole('button',{name:'FLIP 列表重排',exact:true}).click()
  const cards=page.locator('.ws-tiles .ws-object')
  await expect(cards.first()).toHaveText('1')
  await page.getByRole('button',{name:'执行布局转场'}).click()
  await expect(cards.first()).toHaveText('2')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy()
})

test('keyframe selection and move; interaction export includes runtime and cleanup',async({page})=>{
  await page.goto('/?workspace=1')
  await page.getByRole('button',{name:'添加关键帧 50%'}).click()
  await page.getByRole('button',{name:'关键帧 50%',exact:true}).click()
  await expect(page.getByLabel('时间轴',{exact:true})).toHaveValue('160')
  await page.getByRole('button',{name:'关键帧 50%',exact:true}).press('ArrowRight')
  await expect(page.getByRole('button',{name:'关键帧 51%',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'FLIP 列表重排',exact:true}).click()
  await page.getByRole('button',{name:'导出',exact:true}).click()
  await page.getByLabel('导出格式').selectOption('JavaScript')
  await expect(page.getByLabel('生成代码')).toHaveValue(/captureLayout\(items\)/)
  await expect(page.getByLabel('生成代码')).toHaveValue(/export const dispose/)
  await page.getByRole('button',{name:'拖拽与复位',exact:true}).click()
  await expect(page.getByLabel('生成代码')).toHaveValue(/detach = attachSpringDrag/)
})

test('generated JavaScript layout and drag can mount, interact and dispose',async({page})=>{
  await page.goto('/?workspace=1')
  await page.getByRole('button',{name:'FLIP 列表重排',exact:true}).click()
  await page.getByRole('button',{name:'导出',exact:true}).click()
  await page.getByLabel('导出格式').selectOption('JavaScript')
  const flipCode=await page.getByLabel('生成代码').inputValue()
  await page.getByRole('button',{name:'拖拽与复位',exact:true}).click()
  const dragCode=await page.getByLabel('生成代码').inputValue()
  const result=await page.evaluate(async ({flipCode,dragCode})=>{
    const root=document.createElement('div');root.dataset.motionRoot='';document.body.append(root)
    const load=async(code:string)=>{
      const path=new URL('./packages/motion/index.js',location.href).href
      const url=URL.createObjectURL(new Blob([code.replace('./motion-kit/index.js',path)],{type:'text/javascript'}))
      try{return await import(/* @vite-ignore */ url)}finally{URL.revokeObjectURL(url)}
    }
    try{
      const flip=await load(flipCode)
      const before=root.querySelector('[data-motion-item]')?.textContent
      root.querySelector('button')?.click()
      const after=root.querySelector('[data-motion-item]')?.textContent
      flip.dispose()
      const flipClean=root.children.length===0
      const drag=await load(dragCode)
      const el=root.querySelector<HTMLElement>('[data-motion-item]')!
      const evt=(type:string,x:number)=>el.dispatchEvent(new PointerEvent(type,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:10}))
      evt('pointerdown',10);evt('pointermove',70)
      const moved=new DOMMatrixReadOnly(getComputedStyle(el).transform).m41
      evt('pointerup',70)
      drag.dispose()
      return {before,after,flipClean,moved,dragClean:root.children.length===0}
    }finally{root.remove()}
  },{flipCode,dragCode})
  expect(result).toEqual({before:'1',after:'2',flipClean:true,moved:60,dragClean:true})
})

test('assets can rename, archive and restore without losing revisions',async({page})=>{
  await page.goto('/?workspace=1')
  await page.getByRole('button',{name:'资产',exact:true}).click()
  await page.getByLabel('预设名称').fill('资产验收')
  await page.getByRole('button',{name:'保存新预设'}).click()
  await page.getByLabel('预设名称').fill('新名称')
  await page.getByRole('button',{name:'重命名'}).click()
  await page.getByRole('button',{name:'保存新版本'}).click()
  await page.getByLabel('选择 新名称').check()
  await page.getByRole('button',{name:'删除所选'}).click()
  await page.getByRole('button',{name:'回收站'}).click()
  await page.getByLabel('选择 新名称').check()
  await page.getByRole('button',{name:'恢复所选'}).click()
  await page.getByRole('button',{name:'预设',exact:true}).click()
  await expect(page.getByRole('button',{name:/版本 2 ·/})).toBeVisible()
})
test('visual evidence and interactive pressure cleanup',async({page,browserName},testInfo)=>{
  await page.goto('/?workspace=1')
  await page.setViewportSize({width:1440,height:900})
  await expect(page.getByRole('heading',{name:'滑动转场'})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath(browserName+'-desktop.png')})
  await page.getByRole('button',{name:'80 元素压力测试'}).click()
  await expect(page.locator('.ws-object')).toHaveCount(80)
  await page.getByRole('button',{name:'循环播放'}).click()
  await page.getByRole('button',{name:'播放',exact:true}).click()
  await page.getByRole('button',{name:'采样 2 秒'}).click()
  await expect(page.getByText(/中位帧时间/)).toBeVisible({timeout:8000})
  await page.getByRole('button',{name:'结束压力测试'}).click()
  await expect(page.locator('.ws-object')).toHaveCount(1)
  await page.getByRole('button',{name:'暂停',exact:true}).click()
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:testInfo.outputPath(browserName+'-mobile.png'),fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy()
})

test('standalone HTML layout works without external modules',async({page})=>{
  await page.goto('/?workspace=1')
  await page.getByRole('button',{name:'FLIP 列表重排',exact:true}).click()
  await page.getByRole('button',{name:'导出',exact:true}).click()
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'独立 HTML',exact:true}).click()])
  const path=await download.path()
  const {readFile}=await import('node:fs/promises')
  const html=await readFile(path,'utf8')
  // Open the standalone file in a fresh page; do not reuse the Vite HMR document.
  const standalone=await page.context().newPage()
  try {
    await standalone.goto('data:text/html;charset=utf-8,'+encodeURIComponent(html))
    const items=standalone.locator('[data-motion-item]')
    await expect(items.first()).toHaveText('1')
    await standalone.getByRole('button',{name:'运行布局转场'}).click()
    await expect(items.first()).toHaveText('2')
  } finally { await standalone.close() }
})

test('timeline marker drag and full export zip',async({page})=>{
  await page.goto('/?workspace=1')
  await page.getByRole('button',{name:'添加关键帧 50%'}).click()
  const marker=page.getByRole('button',{name:'关键帧 50%',exact:true})
  const box=await marker.boundingBox(),track=await page.locator('.ws-track').first().boundingBox()
  if(!box||!track)throw Error('marker not visible')
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2)
  await page.mouse.down();await page.mouse.move(track.x+track.width*.7,box.y+box.height/2,{steps:8});await page.mouse.up()
  await expect(page.getByRole('button',{name:'关键帧 70%',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'导出',exact:true}).click()
  const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'完整 ZIP'}).click()])
  const {readFile}=await import('node:fs/promises')
  const bytes=await readFile(await file.path())
  expect(bytes.readUInt32LE(0)).toBe(0x04034b50)
  expect(bytes.includes(Buffer.from('motion-kit/index.js'))).toBeTruthy()
  expect(bytes.includes(Buffer.from('index.html'))).toBeTruthy()
})

test('physical spring has finite endpoints and gesture replay cleans up',async({page})=>{
 await page.goto('/?workspace=1')
 const result=await page.evaluate(async()=>{
   const url=new URL('./packages/motion/index.js',location.href).href
   const {physicalSpringFrames}=await import(/* @vite-ignore */ url)
   return [8,26.83281573,60].map(damping=>{const f=physicalSpringFrames(100,0,{mass:1,stiffness:180,damping,velocity:-200,duration:500});return {first:f[0].value,last:f.at(-1).value,finite:f.every(x=>Number.isFinite(x.value))}})
 })
 for(const item of result){expect(item.first).toBeCloseTo(100);expect(item.last).toBe(0);expect(item.finite).toBeTruthy()}
 await page.getByRole('button',{name:'拖拽与复位',exact:true}).click()
 const el=page.locator('.ws-object').first();await expect(el).toBeVisible()
 const box=await el.boundingBox();if(!box)throw Error('drag preview missing')
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down()
 await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2,{steps:5});await page.mouse.up()
 await expect(page.getByRole('button',{name:'回放手势'})).toBeEnabled()
 await page.getByRole('button',{name:'回放手势'}).click()
 await page.getByRole('button',{name:'滑动转场',exact:true}).click()
 await expect(page.locator('.ws-gesture-controls')).toHaveCount(0)
})

test('independent composition tracks, snap and reload',async({page})=>{
 await page.goto('/?workspace=1')
 await page.getByRole('button',{name:'多轨道',exact:true}).click()
 await page.getByRole('button',{name:'新增轨道'}).click()
 await page.getByLabel('轨道名称').fill('第一轨')
 await page.getByLabel('轨道延迟').fill('133');await page.getByLabel('轨道延迟').press('Tab')
 await expect(page.getByLabel('轨道延迟')).toHaveValue('140')
 await page.getByRole('button',{name:'新增轨道'}).click()
 await page.getByLabel('轨道动效').selectOption('fade')
 await page.getByLabel('轨道时长').fill('500');await page.getByLabel('轨道时长').press('Tab')
 await expect(page.locator('.ws-composition-row')).toHaveCount(2)
 await page.getByRole('button',{name:'第一轨',exact:true}).click()
 await expect(page.getByLabel('轨道延迟')).toHaveValue('140')
 await expect(page.getByLabel('轨道时长')).toHaveValue('320')
 await page.reload();await page.getByRole('button',{name:'多轨道',exact:true}).click()
 await expect(page.locator('.ws-composition-row')).toHaveCount(2)
})

test('repeat interaction benchmark and resource cleanup',async({page,browserName},testInfo)=>{
 await page.goto('/?workspace=1')
 const results=await page.evaluate(async()=>{
  const {captureLayout,animateLayout,cancelLayout}=await import(/* @vite-ignore */ new URL('./packages/motion/index.js',location.href).href)
  const root=document.createElement('div');root.style.cssText='display:flex;flex-wrap:wrap;position:fixed;inset:0;pointer-events:none'
  document.body.append(root)
  const items=Array.from({length:80},()=>{const el=document.createElement('div');el.style.cssText='width:24px;height:24px;margin:2px';root.append(el);return el})
  const times:number[]=[];let last=performance.now()
  for(let i=0;i<30;i++){
   const before=captureLayout(items);root.append(root.firstElementChild!)
   animateLayout(before,{duration:100})
   await new Promise<void>(resolve=>requestAnimationFrame(()=>{const now=performance.now();times.push(now-last);last=now;resolve()}))
  }
  cancelLayout(items);const remaining=items.reduce((sum,el)=>sum+el.getAnimations().length,0)
  root.remove();const detached=items.every(el=>!el.isConnected);times.sort((a,b)=>a-b)
  return {samples:times.length,p50:times[Math.floor(times.length/2)],p95:times[Math.floor((times.length-1)*.95)],remaining,detached}
 })
 expect(results.samples).toBe(30);expect(results.remaining).toBe(0);expect(results.detached).toBeTruthy()
 const {writeFile}=await import('node:fs/promises')
 await writeFile(testInfo.outputPath('benchmark.json'),JSON.stringify({browser:browserName,...results},null,2))
})

test('composition project merge, track keyframes and grouped delay',async({page})=>{
 await page.goto('/?workspace=1')
 await page.getByRole('button',{name:'多轨道',exact:true}).click()
 await page.getByRole('button',{name:'新增轨道',exact:true}).click()
 await page.getByRole('button',{name:'添加关键帧 50%'}).click()
 await expect(page.getByRole('button',{name:'轨道 1 关键帧 50%'})).toBeVisible()
 await page.getByLabel('轨道分组').fill('group')
 await page.getByRole('button',{name:'组后移'}).click()
 await expect(page.getByLabel('轨道延迟')).toHaveValue('20')
 const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出编排 JSON'}).click()])
 await page.getByLabel('导入编排项目').setInputFiles(await file.path())
 await expect(page.locator('.ws-composition-row')).toHaveCount(2)
 await page.getByRole('button',{name:'新增手势轨道'}).click()
 await expect(page.getByRole('button',{name:'录制轨迹'})).toBeVisible()
 const [html]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出编排 HTML'}).click()])
 const {readFile}=await import('node:fs/promises');const standalone=await page.context().newPage()
 try{await standalone.goto('data:text/html;charset=utf-8,'+encodeURIComponent(await readFile(await html.path(),'utf8')));await expect(standalone.locator('main section')).toHaveCount(3);await standalone.getByRole('button',{name:'播放编排'}).click()}finally{await standalone.close()}
})
test('editor panels collapse and keyboard resize',async({page})=>{
 await page.goto('/?workspace=1')
 const handle=page.getByRole('separator',{name:'调整资源面板宽度'})
 await handle.focus();await handle.press('ArrowRight')
 await expect(handle).toHaveAttribute('aria-valuenow','254')
 await page.getByRole('button',{name:'切换资源面板'}).click()
 await expect(page.getByLabel('搜索动效')).not.toBeVisible()
 await page.getByRole('button',{name:'切换资源面板'}).click()
 await expect(page.getByLabel('搜索动效')).toBeVisible()
})

test('physical layout retarget retains visual position and clears animation',async({page})=>{
 await page.goto('/?workspace=1')
 const result=await page.evaluate(async()=>{
  const {captureLayout,animateLayout,cancelLayout}=await import(/* @vite-ignore */ new URL('./packages/motion/index.js',location.href).href)
  const el=document.createElement('div');el.style.cssText='position:fixed;left:10px;top:10px;width:50px;height:50px';document.body.append(el)
  const opts={duration:500,physics:{mass:1,stiffness:180,damping:18}}
  try{
   let before=captureLayout([el]);el.style.left='200px';const first=animateLayout(before,opts)[0];first.pause();first.currentTime=100
   const visual=el.getBoundingClientRect().left;before=captureLayout([el]);el.style.left='80px'
   const next=animateLayout(before,opts)[0];next.pause();next.currentTime=0
   const after=el.getBoundingClientRect().left;next.currentTime=500;const end=el.getBoundingClientRect().left
   cancelLayout([el]);return {jump:Math.abs(visual-after),end,remaining:el.getAnimations().length}
  }finally{el.remove()}
 })
 expect(result.jump).toBeLessThan(1);expect(result.end).toBeCloseTo(80);expect(result.remaining).toBe(0)
})

test('long interaction stability and Chromium heap sampling',async({page,browserName},testInfo)=>{
 test.setTimeout(90000)
 await page.goto('/?workspace=1')
 const cdp=browserName==='chromium'?await page.context().newCDPSession(page):null
 async function heap(){if(!cdp)return null;await cdp.send('HeapProfiler.collectGarbage');const h=await cdp.send('Runtime.getHeapUsage');return {usedSize:h.usedSize,totalSize:h.totalSize}}
 async function repeat(count:number){
   return await page.evaluate(async(count)=>{
     const {captureLayout,animateLayout,cancelLayout}=await import(/* @vite-ignore */ new URL('./packages/motion/index.js',location.href).href)
     const root=document.createElement('div');root.style.cssText='position:fixed;inset:0;display:flex;flex-wrap:wrap;pointer-events:none';document.body.append(root)
     const nodes=Array.from({length:80},()=>{const el=document.createElement('div');el.style.cssText='width:24px;height:24px;margin:2px';root.append(el);return el})
     const samples:number[]=[];let last=performance.now()
     try{
       for(let i=0;i<count;i++){
         const before=captureLayout(nodes);root.append(root.firstElementChild!);animateLayout(before,{duration:100})
         await new Promise<void>(resolve=>requestAnimationFrame(()=>{const now=performance.now();samples.push(now-last);last=now;resolve()}))
       }
       cancelLayout(nodes);const residual=nodes.reduce((n,el)=>n+el.getAnimations().length,0);root.remove()
       samples.sort((a,b)=>a-b);return {count,samples:samples.length,p50:samples[Math.floor(samples.length/2)],p95:samples[Math.floor((samples.length-1)*.95)],residual,detached:nodes.every(el=>!el.isConnected)}
     }finally{cancelLayout(nodes);root.remove()}
   },count)
 }
 try{
   await repeat(20);const before=await heap()
   const first=await repeat(120),middle=await heap(),second=await repeat(120),after=await heap()
   for(const result of [first,second]){expect(result.residual).toBe(0);expect(result.detached).toBeTruthy();expect(result.samples).toBe(120)}
   const {writeFile}=await import('node:fs/promises')
   await writeFile(testInfo.outputPath('benchmark.json'),JSON.stringify({browser:browserName,first,second,heap:{before,middle,after},note:'GC heap sample Chromium only; not a proof of absence of leaks'},null,2))
 }finally{await cdp?.detach()}
})
test('composition gesture recording, notification scene and visual evidence',async({page,browserName},testInfo)=>{
 await page.goto('/?workspace=1');await page.setViewportSize({width:1440,height:900})
 await page.getByRole('button',{name:'通知提示',exact:true}).click()
 await expect(page.getByText('任务已完成',{exact:true})).toBeVisible()
 await page.screenshot({path:testInfo.outputPath(browserName+'-notification.png')})
 await page.getByRole('button',{name:'多轨道',exact:true}).click()
 await page.getByRole('button',{name:'新增轨道',exact:true}).click()
 await page.getByRole('button',{name:'新增手势轨道'}).click()
 await page.getByRole('button',{name:'录制轨迹'}).click()
 const el=page.locator('.ws-composition-preview .draggable');await expect(el).toBeVisible()
 const rect=await el.boundingBox();if(!rect)throw Error('gesture preview missing')
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+35,rect.y+rect.height/2,{steps:8});await page.mouse.up()
 await expect(page.getByRole('button',{name:'结束录制'})).toBeVisible()
 await page.getByRole('button',{name:'结束录制'}).click()
 await expect.poll(async()=>page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('motion-lab-composition-v1')||'[]');return data.find((t:any)=>t.config.effect==='drag')?.gesture?.length??0})).toBeGreaterThan(1)
 await page.screenshot({path:testInfo.outputPath(browserName+'-composition.png')})
})

test('measured layout tracks and combined project zip',async({page})=>{
 await page.goto('/?workspace=1')
 await page.getByRole('button',{name:'多轨道',exact:true}).click()
 await page.getByRole('button',{name:'新增布局轨道'}).click()
 const lane=page.locator('[data-composition-stage]');await expect(lane).toBeVisible();await lane.evaluate(el=>el.setAttribute('data-keep','yes'))
 await page.getByLabel('编排时间轴').fill('160');await expect(lane).toHaveAttribute('data-keep','yes')
 await page.getByRole('button',{name:'新增轨道',exact:true}).click()
 await page.getByLabel('轨道动效').selectOption('shared')
 await page.getByRole('button',{name:'组合预览',exact:true}).click()
 const stage=page.locator('[data-composition-stage]')
 await expect(stage.locator('[data-composition-track]')).toHaveCount(2)
 await expect(stage.locator('[data-composition-item]')).toHaveCount(5)
 // The earlier independent-track seek is at 160 ms; reset to the true start before
 // comparing the same moved DOM item, not the first item in the final DOM order.
 const timeline=page.getByLabel('编排时间轴')
 await timeline.fill('0')
 const moved=stage.locator('[data-composition-item="1"]').first()
 await expect.poll(()=>moved.evaluate(el=>Number(el.getAnimations()[0]?.currentTime))).toBe(0)
 const before=await moved.boundingBox()
 if(!before)throw Error('missing initial layout geometry')
 await timeline.fill('320')
 await expect.poll(async()=>{const after=await moved.boundingBox();return after?Math.abs(before.x-after.x)+Math.abs(before.y-after.y):0}).toBeGreaterThan(10)
 await expect.poll(()=>moved.evaluate(el=>Number(el.getAnimations()[0]?.currentTime))).toBe(320)
 const [zip]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'编排 ZIP'}).click()])
 const {readFile}=await import('node:fs/promises');const bytes=await readFile(await zip.path())
 expect(bytes.includes(Buffer.from('Composition.vue'))).toBeTruthy()
 expect(bytes.includes(Buffer.from('motion-kit/composition.js'))).toBeTruthy()
})

test('shared layout size and position survive repeated retargets',async({page})=>{
 await page.goto('/?workspace=1')
 const result=await page.evaluate(async()=>{
  const {captureLayout,animateLayout,cancelLayout}=await import(/* @vite-ignore */ new URL('./packages/motion/index.js',location.href).href)
  const el=document.createElement('div');el.style.cssText='position:fixed;left:10px;top:10px;width:50px;height:50px';document.body.append(el)
  const opts={duration:500,physics:{mass:1,stiffness:180,damping:18}}
  const jumps:number[]=[],slopeErrors:number[]=[]
  try{
   let before=captureLayout([el]);el.style.left='200px';el.style.width='100px';let a=animateLayout(before,opts)[0];a.pause()
   for(let i=0;i<5;i++){
    a.currentTime=100;const r=el.getBoundingClientRect();a.currentTime=101;const v=(el.getBoundingClientRect().width-r.width)*1000;a.currentTime=100
    before=captureLayout([el]);el.style.left=String(80+i*17)+'px';el.style.width=String(65+i*15)+'px'
    a=animateLayout(before,opts)[0];a.pause();a.currentTime=0;const next=el.getBoundingClientRect()
    jumps.push(Math.abs(r.left-next.left)+Math.abs(r.width-next.width))
    a.currentTime=1;const v2=(el.getBoundingClientRect().width-next.width)*1000;slopeErrors.push(Math.abs(v-v2))
   }
   a.currentTime=500;const final=el.getBoundingClientRect().width;cancelLayout([el]);return {jumps,slopeErrors,final,residual:el.getAnimations().length}
  }finally{el.remove()}
 })
 expect(Math.max(...result.jumps)).toBeLessThan(1);expect(Math.max(...result.slopeErrors)).toBeLessThan(150);expect(result.final).toBeCloseTo(125);expect(result.residual).toBe(0)
})
test('mobile starts with preview and opens one side panel at a time',async({page,browserName},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?workspace=1')
 await expect(page.getByLabel('搜索动效')).not.toBeVisible()
 await expect(page.getByRole('heading',{name:'滑动转场'})).toBeVisible()
 await page.screenshot({path:testInfo.outputPath(browserName+'-mobile-focused.png'),fullPage:true})
 await page.getByRole('button',{name:'切换资源面板'}).click();await expect(page.getByLabel('搜索动效')).toBeVisible()
 await page.getByRole('button',{name:'切换检查器'}).click();await expect(page.getByLabel('搜索动效')).not.toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy()
})
