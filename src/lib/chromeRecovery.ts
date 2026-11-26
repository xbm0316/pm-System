import { normalizeOperationsState } from '../components/OperationsWorkspace'
import { hasLegacyAttachments, importLegacyAttachments } from './localFiles'
import type { Space } from './store'
import { supabase } from './supabase'
import { fetchWorkspaceRows, type WorkspaceModule } from './workspaceSync'

type RecoveryState = 'ready' | 'invalid' | 'used' | 'completed' | 'conflict'
type Snapshot = { space_id: string; module: WorkspaceModule; data: unknown }

const keys: Record<WorkspaceModule, string> = {
  operations: 'jawcat.operations.v4.',
  projects: 'jawcat.project-manager.v4.',
  todos: 'jawcat.workspace-todos.v1.',
}

function hasRecords(data: unknown) {
  return Array.isArray(data) ? data.length > 0 : Boolean(data && Object.values(data).some((value) => Array.isArray(value) && value.length))
}

function snapshotsInBrowser(phone: string, space: Space) {
  const isProduct = space.types.includes('产品经理')
  const isOperations = space.types.includes('独立站电商运营')
  const modules: WorkspaceModule[] = ['todos']
  if (!isProduct) modules.push(isOperations ? 'operations' : 'projects')

  return modules.flatMap((module): Snapshot[] => {
    const key = keys[module]
    const legacy = module === 'projects' && phone === '13610392041' ? localStorage.getItem(key + space.id) : null
    const raw = localStorage.getItem(key + phone + '.' + space.id) ?? legacy
    if (!raw) return []
    let decoded: unknown
    try { decoded = JSON.parse(raw) } catch { return [] }
    const data = module === 'operations' ? normalizeOperationsState(decoded) : decoded
    return hasRecords(data) ? [{ space_id: space.id, module, data }] : []
  })
}

async function redeem(ticket: string, snapshots?: Snapshot[]) {
  const { data, error } = await supabase.rpc('recover_workspace_modules', { ticket, ...(snapshots ? { snapshots } : {}) })
  if (error) throw new Error('暂时无法恢复资料，请重试。')
  return data as RecoveryState
}

interface ChromeNavigator extends Navigator {
  userAgentData?: { brands: { brand: string }[] }
}

export async function restoreChromeWorkspace(ticket: string, phone: string, spaces: Space[]) {
  const brands = (navigator as ChromeNavigator).userAgentData?.brands
  if (!brands?.some(({ brand }) => brand === 'Google Chrome')) {
    throw new Error('请在原来填写资料的 Google Chrome 中打开恢复链接。')
  }

  const status = await redeem(ticket)
  if (status === 'used') return
  if (status !== 'ready') throw new Error('此链接和当前账号不匹配，或已过期。')

  const snapshots = spaces.flatMap((space) => snapshotsInBrowser(phone, space))
  const attachmentSpaces = (await Promise.all(spaces.map(async (space) => (
    await hasLegacyAttachments(space.id) ? space : null
  )))).filter((space) => space !== null)
  if (!snapshots.length && !attachmentSpaces.length) {
    throw new Error('这个 Chrome 窗口里没有找到旧资料。请在原先填写资料的 Chrome 用户或窗口中打开恢复链接。')
  }

  for (const space of attachmentSpaces) {
    const cloud = await fetchWorkspaceRows(space.id)
    const restoring = snapshots.filter((snapshot) => snapshot.space_id === space.id && !cloud[snapshot.module])
    const types = new Set(restoring.map((snapshot) => snapshot.module))
    await importLegacyAttachments(space.id, (type) => (
      type === 'requirement' || type === 'competitor'
        || (['product', 'ops-review'].includes(type) ? types.has('operations') : types.has('projects'))
    ))
  }

  const complete = await redeem(ticket, snapshots)
  if (complete === 'conflict') throw new Error('云端已有同一模块的数据，两份资料已保留。请联系项目管理员核对。')
  if (complete !== 'completed' && complete !== 'used') throw new Error('恢复链接已失效，请重新打开。')
}
