import { supabase } from './supabase'
import type {
  Space,
  Requirement,
  Competitor,
  Retro,
  TypeName,
  RequirementStatus,
  Priority,
} from './store'

// ---------- 映射：DB 行 -> 前端对象 ----------

function toSpace(r: any): Space {
  const savedTypes = Array.isArray(r.types) ? r.types : []
  const types = savedTypes.filter((type: unknown): type is TypeName => (
    type === '产品经理' || type === '项目经理' || type === '独立站电商运营'
  ))
  return { id: r.id, name: r.name, types: types.length > 0 ? types : ['项目经理'], createdAt: Number(r.created_at) }
}

function toReq(r: any): Requirement {
  return {
    id: r.id,
    spaceId: r.space_id,
    version: r.version || 'V',
    name: r.name,
    content: r.content || '',
    priority: (r.priority || 'P1') as Priority,
    status: (r.status || '调研中') as RequirementStatus,
    createdAt: Number(r.created_at),
    launchDate: r.launch_date || undefined,
    competitorIds: Array.isArray(r.competitor_ids) ? r.competitor_ids : undefined,
    prd: r.prd || undefined,
  }
}

function toComp(r: any): Competitor {
  return { id: r.id, spaceId: r.space_id, name: r.name, url: r.url || '', description: r.description || '', createdAt: Number(r.created_at) }
}

function toRetro(r: any): Retro {
  return { id: r.id, reqId: r.req_id, content: r.content, createdAt: Number(r.created_at) }
}

// ---------- 空间 ----------

export async function fetchSpaces(ownerPhone: string): Promise<Space[]> {
  const { data, error } = await supabase.from('spaces').select('*').eq('owner_phone', ownerPhone).order('created_at')
  if (error) {
    // 迁移 SQL 尚未执行时，兼容旧库：已有数据暂归 136；159 不读取旧数据。
    if (ownerPhone === '13610392041') {
      const legacy = await supabase.from('spaces').select('*').order('created_at')
      if (!legacy.error) return (legacy.data || []).map(toSpace)
    }
    console.error('fetchSpaces', error)
    return []
  }
  return (data || []).map(toSpace)
}

export async function insertSpace(s: Space, ownerPhone: string) {
  const { error } = await supabase.from('spaces').insert({
    id: s.id, name: s.name, types: s.types, owner_phone: ownerPhone, created_at: s.createdAt,
  })
  if (error) console.error('insertSpace', error)
}

export async function updateSpaceName(id: string, name: string, ownerPhone: string) {
  const { error } = await supabase.from('spaces').update({ name }).eq('id', id).eq('owner_phone', ownerPhone)
  if (error && ownerPhone === '13610392041') {
    const legacy = await supabase.from('spaces').update({ name }).eq('id', id)
    if (legacy.error) console.error('updateSpaceName', legacy.error)
  } else if (error) console.error('updateSpaceName', error)
}

export async function deleteSpaceRow(id: string, ownerPhone: string) {
  const { data: ownedSpace, error: lookupError } = await supabase.from('spaces').select('id').eq('id', id).eq('owner_phone', ownerPhone).maybeSingle()
  if (lookupError) {
    if (ownerPhone !== '13610392041') {
      throw new Error(lookupError.message)
    }
    await removeSpaceContents(id)
    const legacy = await supabase.from('spaces').delete().eq('id', id)
    if (legacy.error) throw new Error(legacy.error.message)
    return
  }
  if (!ownedSpace) return
  await removeSpaceContents(id)
  const { error } = await supabase.from('spaces').delete().eq('id', id).eq('owner_phone', ownerPhone)
  if (error) throw new Error(error.message)
}

async function removeSpaceContents(id: string) {
  const requirements = await supabase.from('requirements').delete().eq('space_id', id)
  if (requirements.error) throw new Error(requirements.error.message)
  const competitors = await supabase.from('competitors').delete().eq('space_id', id)
  if (competitors.error) throw new Error(competitors.error.message)
}

// ---------- 需求 ----------

export async function fetchRequirements(spaceId?: string): Promise<Requirement[]> {
  let query = supabase.from('requirements').select('*').order('created_at')
  if (spaceId) query = query.eq('space_id', spaceId)
  const { data, error } = await query
  if (error) { console.error('fetchRequirements', error); return [] }
  return (data || []).map(toReq)
}

export async function insertRequirement(r: Requirement) {
  const payload = {
    id: r.id, space_id: r.spaceId, version: r.version, name: r.name,
    content: r.content, priority: r.priority, status: r.status, launch_date: r.launchDate || null, competitor_ids: r.competitorIds || null, created_at: r.createdAt,
  }
  const { error } = await supabase.from('requirements').insert(payload)
  if (error) {
    const competitorFallback = { ...payload, competitor_ids: undefined }
    const fallback = await supabase.from('requirements').insert(competitorFallback)
    if (fallback.error && Object.prototype.hasOwnProperty.call(payload, 'launch_date')) {
      const legacyFallback = { ...competitorFallback, launch_date: undefined }
      const legacyResult = await supabase.from('requirements').insert(legacyFallback)
      if (legacyResult.error) throw new Error(legacyResult.error.message)
    } else if (fallback.error) throw new Error(fallback.error.message)
  }
}

export async function updateRequirementAttachments(id: string, attachments: Requirement['attachments']) {
  void id
  void attachments
}

export async function updateRequirementStatus(id: string, status: RequirementStatus) {
  const { error } = await supabase.from('requirements').update({ status }).eq('id', id)
  if (error) console.error('updateRequirementStatus', error)
}

export async function updateRequirement(id: string, patch: Partial<Requirement>) {
  const payload: Record<string, unknown> = {}
  if (patch.version !== undefined) payload.version = patch.version
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.content !== undefined) payload.content = patch.content
  if (patch.priority !== undefined) payload.priority = patch.priority
  if (patch.status !== undefined) payload.status = patch.status
  if (patch.launchDate !== undefined) payload.launch_date = patch.launchDate || null
  if (patch.competitorIds !== undefined) payload.competitor_ids = patch.competitorIds || null
  if (!Object.keys(payload).length) return
  const { error } = await supabase.from('requirements').update(payload).eq('id', id).select('id').single()
  if (error && Object.prototype.hasOwnProperty.call(payload, 'competitor_ids')) {
    const fallback = { ...payload }
    delete fallback.competitor_ids
    const retry = await supabase.from('requirements').update(fallback).eq('id', id).select('id').single()
    if (retry.error && Object.prototype.hasOwnProperty.call(payload, 'launch_date')) {
      delete fallback.launch_date
      const legacyRetry = await supabase.from('requirements').update(fallback).eq('id', id).select('id').single()
      if (legacyRetry.error) throw new Error(legacyRetry.error.message)
    } else if (retry.error) throw new Error(retry.error.message)
  } else if (error && Object.prototype.hasOwnProperty.call(payload, 'launch_date')) {
    const fallback = { ...payload }
    delete fallback.launch_date
    const retry = await supabase.from('requirements').update(fallback).eq('id', id).select('id').single()
    if (retry.error) throw new Error(retry.error.message)
  } else if (error) throw new Error(error.message)
}

export async function deleteRequirementRow(id: string) {
  const { error: retroError } = await supabase.from('retros').delete().eq('req_id', id)
  if (retroError) throw new Error(retroError.message)
  const { error } = await supabase.from('requirements').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- 竞品 ----------

export async function fetchCompetitors(spaceId?: string): Promise<Competitor[]> {
  let query = supabase.from('competitors').select('*').order('created_at')
  if (spaceId) query = query.eq('space_id', spaceId)
  const { data, error } = await query
  if (error) { console.error('fetchCompetitors', error); return [] }
  return (data || []).map(toComp)
}

export async function insertCompetitor(c: Competitor) {
  const { error } = await supabase.from('competitors').insert({
    id: c.id, space_id: c.spaceId, name: c.name, url: c.url, created_at: c.createdAt,
  })
  if (error) throw new Error(error.message)
}

export async function updateCompetitor(id: string, patch: Partial<Pick<Competitor, 'name' | 'url' | 'description'>>) {
  const { error } = await supabase.from('competitors').update({ ...patch, url: patch.url ?? null }).eq('id', id).select('id').single()
  if (error) throw new Error(error.message)
}

export async function deleteCompetitorRow(id: string) {
  const { error } = await supabase.from('competitors').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- 复盘 ----------

export async function fetchRetros(reqIds?: string[]): Promise<Retro[]> {
  if (reqIds && reqIds.length === 0) return []
  let query = supabase.from('retros').select('*').order('created_at')
  if (reqIds) query = query.in('req_id', reqIds)
  const { data, error } = await query
  if (error) { console.error('fetchRetros', error); return [] }
  return (data || []).map(toRetro)
}

export async function insertRetro(r: Retro) {
  const { error } = await supabase.from('retros').insert({
    id: r.id, req_id: r.reqId, content: r.content, created_at: r.createdAt,
  })
  if (error) console.error('insertRetro', error)
}
