import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import ReqTrack from './ReqTrack'
import ReqPrd from './ReqPrd'
import RetroDialog from './RetroDialog'
import type { Competitor, MeetingRecord, Requirement, RequirementAttachment, RequirementPrd, RequirementStatus, Retro } from '../lib/store'

type DetailTab = 'progress' | 'prd' | 'retro'

interface Props {
  requirement: Requirement
  requirements: Requirement[]
  competitors: Competitor[]
  retros: Retro[]
  onStatusChange: (reqId: string, status: RequirementStatus) => void
  onSavePrd: (reqId: string, prd: RequirementPrd) => void
  onAddRetro: (retro: Retro) => void
  onUpdateMeetings: (reqId: string, meetings: MeetingRecord[]) => void
  onUpdateAttachments: (reqId: string, attachments: RequirementAttachment[]) => void
  onClose: () => void
}

export default function RequirementDetailPage({ requirement, requirements, competitors, retros, onStatusChange, onSavePrd, onAddRetro, onUpdateMeetings, onUpdateAttachments, onClose }: Props) {
  const [tab, setTab] = useState<DetailTab>('progress')
  const bodyRef = useRef<HTMLElement>(null)
  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: 'progress', label: '需求进度' },
    { key: 'prd', label: 'PRD' },
    { key: 'retro', label: '复盘' },
  ]

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [tab])

  return (
    <div className="requirement-detail-page">
      <header className="requirement-detail-page__head">
        <div className="requirement-detail-page__head-main">
          <button className="icon-btn requirement-detail-page__back" type="button" onClick={onClose} title="返回需求池" aria-label="返回需求池">
            <Icon name="arrowLeft" size={16} />
          </button>
          <div className="requirement-detail-page__identity">
            <div className="requirement-detail-page__eyebrow">需求详情</div>
            <h1>
              <span className="requirement-detail-page__version">{requirement.version}</span>
              <span className="requirement-detail-page__name">{requirement.name}</span>
              <span className={`pri pri--${requirement.priority.toLowerCase()}`}>{requirement.priority}</span>
            </h1>
          </div>
        </div>
        <div className="requirement-detail-page__tabs" role="tablist" aria-label="需求详情模块">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`detail-tab${tab === item.key ? ' detail-tab--active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="requirement-detail-page__body" ref={bodyRef}>
        {tab === 'progress' && (
          <ReqTrack
            spaceId={requirement.spaceId}
            requirements={requirements}
            competitors={competitors}
            onStatusChange={onStatusChange}
            focusId={requirement.id}
            onUpdateMeetings={onUpdateMeetings}
            onUpdateAttachments={onUpdateAttachments}
          />
        )}
        {tab === 'prd' && (
          <ReqPrd
            requirement={requirement}
            mode="view"
            embedded
            onClose={onClose}
            onSave={(prd) => onSavePrd(requirement.id, prd)}
          />
        )}
        {tab === 'retro' && (
          <RetroDialog
            requirement={requirement}
            retros={retros}
            embedded
            onAdd={onAddRetro}
            onClose={onClose}
          />
        )}
      </main>
    </div>
  )
}
