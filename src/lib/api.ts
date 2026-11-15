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
  return { id: r.id, name: r.name, types: ['项目经理'], createdAt: Number(r.created_at) }
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
    attachments: Array.isArray(r.attachments) ? r.attachments : undefined,
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

export async function fetchSpaces(): Promise<Space[]> {
  const { data, error } = await supabase.from('spaces').select('*').order('created_at')
  if (error) { console.error('fetchSpaces', error); return [] }
  return (data || []).map(toSpace)
}

export async function insertSpace(s: Space) {
  const { error } = await supabase.from('spaces').insert({
    id: s.id, name: s.name, types: s.types, created_at: s.createdAt,
  })
  if (error) console.error('insertSpace', error)
}

export async function updateSpaceName(id: string, name: string) {
  const { error } = await supabase.from('spaces').update({ name }).eq('id', id)
  if (error) console.error('updateSpaceName', error)
}

export async function deleteSpaceRow(id: string) {
  await supabase.from('requirements').delete().eq('space_id', id)
  await supabase.from('competitors').delete().eq('space_id', id)
  const { error } = await supabase.from('spaces').delete().eq('id', id)
  if (error) console.error('deleteSpace', error)
}

// ---------- 需求 ----------

export async function fetchRequirements(): Promise<Requirement[]> {
  const { data, error } = await supabase.from('requirements').select('*').order('created_at')
  if (error) { console.error('fetchRequirements', error); return [] }
  return (data || []).map(toReq)
}

export async function insertRequirement(r: Requirement) {
  const { error } = await supabase.from('requirements').insert({
    id: r.id, space_id: r.spaceId, version: r.version, name: r.name,
    content: r.content, priority: r.priority, status: r.status, created_at: r.createdAt,
    attachments: r.attachments || [],
  })
  if (error) console.error('insertRequirement', error)
}

export async function updateRequirementAttachments(id: string, attachments: Requirement['attachments']) {
  const { error } = await supabase.from('requirements').update({ attachments: attachments || [] }).eq('id', id)
  if (error) console.error('updateRequirementAttachments', error)
}

export async function updateRequirementStatus(id: string, status: RequirementStatus) {
  const { error } = await supabase.from('requirements').update({ status }).eq('id', id)
  if (error) console.error('updateRequirementStatus', error)
}

export async function deleteRequirementRow(id: string) {
  const { error: retroError } = await supabase.from('retros').delete().eq('req_id', id)
  if (retroError) console.error('deleteRequirementRetros', retroError)
  const { error } = await supabase.from('requirements').delete().eq('id', id)
  if (error) console.error('deleteRequirement', error)
}

// ---------- 竞品 ----------

export async function fetchCompetitors(): Promise<Competitor[]> {
  const { data, error } = await supabase.from('competitors').select('*').order('created_at')
  if (error) { console.error('fetchCompetitors', error); return [] }
  return (data || []).map(toComp)
}

export async function insertCompetitor(c: Competitor) {
  const { error } = await supabase.from('competitors').insert({
    id: c.id, space_id: c.spaceId, name: c.name, url: c.url, created_at: c.createdAt,
  })
  if (error) console.error('insertCompetitor', error)
}

// ---------- 复盘 ----------

export async function fetchRetros(): Promise<Retro[]> {
  const { data, error } = await supabase.from('retros').select('*').order('created_at')
  if (error) { console.error('fetchRetros', error); return [] }
  return (data || []).map(toRetro)
}

export async function insertRetro(r: Retro) {
  const { error } = await supabase.from('retros').insert({
    id: r.id, req_id: r.reqId, content: r.content, created_at: r.createdAt,
  })
  if (error) console.error('insertRetro', error)
}
