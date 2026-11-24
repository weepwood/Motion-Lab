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
  await expect(page.getByLabel('生成代码')).toHaveValue(/detach = drag/)
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
