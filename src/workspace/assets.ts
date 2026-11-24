import { ref, watch } from 'vue'
import { sanitizeConfig, catalog, type Config, type Effect } from './model'
type Revision = { at: string; config: Config }
export type Asset = { id: string; name: string; versions: Revision[] }
type Store = { version: 1; favorites: Effect[]; assets: Asset[] }
const key = 'motion-lab-workspace-v1'
function parse(raw: unknown): Store {
  if (!raw || typeof raw !== 'object') throw Error('无效资产文件')
  const v = raw as Partial<Store>
  if(v.version !== 1 || !Array.isArray(v.assets) || !Array.isArray(v.favorites)) throw Error('不支持的资产版本')
  return {version:1,favorites:[...new Set(v.favorites.filter(x=>catalog.some(e=>e.id===x)))],assets:v.assets.slice(0,200).map(a=>{
    if(!a || typeof a.name!=='string'||typeof a.id!=='string'||!Array.isArray(a.versions)||!a.versions.length) throw Error('无效预设')
    return {id:a.id.slice(0,100),name:a.name.slice(0,80),versions:a.versions.slice(0,30).map(r=>({at:String(r.at).slice(0,40),config:sanitizeConfig(r.config)}))}
  })}
}
export function useAssets() {
  let initial: Store = {version:1,favorites:[],assets:[]}
  const error=ref('')
  try { const raw=localStorage.getItem(key); if(raw) initial=parse(JSON.parse(raw)) } catch { error.value='读取失败；原始存储未被修改' }
  const store=ref(initial)
  watch(store,()=>{try{localStorage.setItem(key,JSON.stringify(store.value));error.value=''}catch{error.value='本地存储失败，请导出备份'}},{deep:true,flush:'sync'})
  function favorite(id: Effect){const a=store.value.favorites;store.value.favorites=a.includes(id)?a.filter(x=>x!==id):[...a,id]}
  function save(name: string,c: Config,id?: string){
    const revision={at:new Date().toISOString(),config:sanitizeConfig(c)}
    const existing=store.value.assets.find(a=>a.id===id)
    if(existing){existing.versions=[revision,...existing.versions].slice(0,30);return}
    if(store.value.assets.length>=200) throw Error('预设已达上限，请先备份')
    store.value.assets.push({id:globalThis.crypto?.randomUUID?.()??String(Date.now())+'-'+Math.random(),name:name.trim().slice(0,80)||'未命名预设',versions:[revision]})
  }
  function importText(text:string){if(text.length>2_000_000)throw Error('文件过大');const next=parse(JSON.parse(text));const known=new Set(store.value.assets.map(x=>x.id));const incoming=next.assets.filter(x=>!known.has(x.id));if(store.value.assets.length+incoming.length>200)throw Error('超出预设上限');store.value={version:1,favorites:[...new Set([...store.value.favorites,...next.favorites])],assets:[...store.value.assets,...incoming]}}
  return {store,error,favorite,save,importText}
}
