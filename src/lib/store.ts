export type TypeName = '产品经理' | '项目经理' | '独立站电商运营'

export const ALL_TYPES: TypeName[] = ['产品经理', '项目经理', '独立站电商运营']

export type RequirementStatus = '调研中' | '已评审' | '开发中' | '测试中' | '已上线'

export const REQ_STATUSES: RequirementStatus[] = ['调研中', '已评审', '开发中', '测试中', '已上线']

export type Priority = 'P0' | 'P1' | 'P2' | 'P3'

export const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3']

export interface Space {
  id: string
  name: string
  types: TypeName[]
  createdAt: number
}

export interface Entry {
  id: string
  spaceId: string
  type: TypeName
  menuKey: string
  title: string
  status: string
  createdAt: number
}

export interface Requirement {
  id: string
  spaceId: string
  version: string
  name: string
  content: string
  priority: Priority
  status: RequirementStatus
  createdAt: number
  attachments?: RequirementAttachment[]
  prd?: RequirementPrd
  competitorIds?: string[]
  meetings?: MeetingRecord[]
}

export interface MeetingRecord {
  id: string
  title: string
  date: string
  content: string
}

export interface Project {
  id: string
  spaceId: string
  name: string
  createdAt: number
  archivedAt?: number
}

export type ProjectIssueStatus = '待处理' | '处理中' | '已解决'

export interface ProjectIssue {
  id: string
  taskId: string
  title: string
  description: string
  status: ProjectIssueStatus
  createdAt: number
}

export interface ProjectTaskAttachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  kind: 'image' | 'file'
}

export interface ProjectTask {
  id: string
  projectId: string
  name: string
  content: string
  priority: Priority
  status: RequirementStatus
  createdAt: number
  detail: string
  startDate?: string
  endDate?: string
  attachments?: ProjectTaskAttachment[]
}

export interface ProjectStore {
  projects: Project[]
  tasks: ProjectTask[]
  issues: ProjectIssue[]
}

export interface PrdTableRow {
  id: string
  module: string
  change: string
  note: string
}

export type PrdOptionalSection = 'competitor' | 'business-flow' | 'system-flow' | 'state-machine'

export interface RequirementPrd {
  background: string
  explanation: string
  contentRows: PrdTableRow[]
  changeLog: string
  optionalSections: PrdOptionalSection[]
  optionalContent: Partial<Record<PrdOptionalSection, string>>
  updatedAt: number
}

export interface RequirementAttachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  kind: 'image' | 'file'
}

export interface Competitor {
  id: string
  spaceId: string
  name: string
  url: string
  description?: string
  createdAt: number
}

export interface Retro {
  id: string
  reqId: string
  content: string
  createdAt: number
}

export interface MenuDef {
  key: string
  label: string
  icon: string
}

export const MENUS: Record<TypeName, MenuDef[]> = {
  产品经理: [
    { key: 'req', label: '需求池', icon: 'doc' },
    { key: 'comp', label: '竞品分析', icon: 'trend' },
  ],
  项目经理: [
    { key: 'proj', label: '项目列表', icon: 'grid' },
    { key: 'risk', label: '风险登记', icon: 'alert' },
    { key: 'mile', label: '里程碑', icon: 'flag' },
    { key: 'res', label: '资源安排', icon: 'clock' },
  ],
  独立站电商运营: [
    { key: 'prod', label: '选品记录', icon: 'tag' },
    { key: 'ads', label: '流量投放', icon: 'trend' },
    { key: 'order', label: '订单跟踪', icon: 'doc' },
    { key: 'ship', label: '物流发货', icon: 'box' },
    { key: 'fin', label: '成本核算', icon: 'calc' },
  ],
}

const SESSION_KEY = 'ws.session.v1'

export const ALLOWED_PHONES = ['15913504623', '13610392041']

export function loadSession(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function saveSession(phone: string | null) {
  if (phone) localStorage.setItem(SESSION_KEY, phone)
  else localStorage.removeItem(SESSION_KEY)
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
