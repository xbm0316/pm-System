export type TypeName = '产品经理' | '项目经理' | '独立站电商运营'

export const ALL_TYPES: TypeName[] = ['项目经理']

export type RequirementStatus = '调研中' | '已评审' | '开发中' | '测试中' | '已上线'

export const REQ_STATUSES: RequirementStatus[] = ['调研中', '已评审', '开发中', '测试中', '已上线']

export type ProjectStatus = '调研中' | '已启动' | '实施中' | '调试中' | '验收中' | '质保中' | '项目结束'
export const PROJECT_STATUSES: ProjectStatus[] = ['调研中', '已启动', '实施中', '调试中', '验收中', '质保中', '项目结束']

export type TaskStatus = '调研中' | '实施中' | '调试中' | '验收中' | '质保中' | '任务结束'
export const TASK_STATUSES: TaskStatus[] = ['调研中', '实施中', '调试中', '验收中', '质保中', '任务结束']

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
  status: ProjectStatus
  parentId?: string
  description?: string
  startDate?: string
  endDate?: string
  cost?: string
  revenue?: string
  profit?: string
  progress?: number
  createdAt: number
  archivedAt?: number
}

export type ProjectIssueStatus = '待处理' | '处理中' | '已处理'

export interface ProjectIssue {
  id: string
  taskId: string
  title: string
  description: string
  status: ProjectIssueStatus
  createdAt: number
  endDate?: string
  updatedAt?: number
}

export interface ProjectTaskAttachment {
  id: string
  fileId?: string
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
  status: TaskStatus
  createdAt: number
  detail: string
  startDate?: string
  endDate?: string
  attachments?: ProjectTaskAttachment[]
  updatedAt?: number
  progress?: number
}

export interface ProjectStore {
  projects: Project[]
  tasks: ProjectTask[]
  issues: ProjectIssue[]
  retroTypes: WorkspaceCollectionType[]
  retros: WorkspaceRetro[]
  knowledgeTypes: WorkspaceCollectionType[]
  knowledgeResources: KnowledgeResource[]
  meetings: WorkspaceMeeting[]
  summaries: ProjectSummary[]
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
  fileId?: string
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

export interface WorkspaceCollectionType {
  id: string
  spaceId: string
  name: string
  createdAt: number
}

export interface WorkspaceRetro {
  id: string
  spaceId: string
  typeId: string
  title: string
  content: string
  createdAt: number
  updatedAt?: number
  attachments?: ProjectTaskAttachment[]
}

export interface WorkspaceMeeting {
  id: string
  spaceId: string
  title: string
  date: string
  content: string
  taskIds?: string[]
  createdAt: number
  updatedAt?: number
}

export interface ProjectSummaryRow {
  id: string
  name: string
  date: string
  overdueDays?: number
}

export interface ProjectSummary {
  id: string
  projectId: string
  startDate: string
  endDate: string
  projectProgress: string
  projectStatus?: ProjectStatus
  projectProgressPercent?: number
  completedTasks: ProjectSummaryRow[]
  pendingTasks: ProjectSummaryRow[]
  completedIssues: ProjectSummaryRow[]
  pendingIssues: ProjectSummaryRow[]
  createdAt: number
}

export interface KnowledgeResource {
  id: string
  spaceId: string
  typeId: string
  name: string
  fileName: string
  mimeType: string
  size: number
  fileId?: string
  fileUrl?: string
  /** @deprecated Legacy records may still contain a data URL until they are cleared. */
  dataUrl?: string
  createdAt: number
  updatedAt?: number
  rotation?: number
}

export interface MenuDef {
  key: string
  label: string
  icon: string
}

export const WORKSPACE_TABS = [
  { key: 'workbench', label: '项目工作台', icon: 'grid' },
  { key: 'retro', label: '复盘', icon: 'trend' },
  { key: 'knowledge', label: '知识库', icon: 'doc' },
  { key: 'meeting', label: '会议纪要', icon: 'chat' },
] as const
export type WorkspaceTabKey = typeof WORKSPACE_TABS[number]['key']

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
