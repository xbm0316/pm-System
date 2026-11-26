import { Spinner } from '@astryxdesign/core/Spinner'
import { lazy, Suspense, useState, useEffect } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import { loadSession, saveSession, uid, type Space, type TypeName } from './lib/store'
import { fetchSpaces, insertSpace, updateSpaceName, deleteSpaceRow } from './lib/api'
import { deleteLocalFilesForSpace, registerLocalFileServiceWorker } from './lib/localFiles'

const Workspace = lazy(() => import('./pages/Workspace'))
const loadingView = <div className="app-loading"><Spinner label="加载中…" aria-label="加载中" /></div>

export default function App() {
  const [phone, setPhone] = useState<string | null>(() => loadSession())
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [localFilesReady, setLocalFilesReady] = useState(false)

  useEffect(() => {
    void registerLocalFileServiceWorker().finally(() => setLocalFilesReady(true))
  }, [])

  async function reload() {
    if (!phone) return
    const list = await fetchSpaces(phone)
    setSpaces(list)
    setLoading(false)
  }

  useEffect(() => {
    if (phone) reload()
    else setLoading(false)
  }, [phone])

  function handleLogin(p: string) {
    saveSession(p)
    setPhone(p)
  }

  function handleLogout() {
    setActiveSpaceId(null)
    saveSession(null)
    setPhone(null)
  }

  async function createSpace(name: string, types: TypeName[]) {
    const s: Space = { id: uid(), name, types, createdAt: Date.now() }
    setSpaces((prev) => [...prev, s])
    if (phone) await insertSpace(s, phone)
  }

  async function renameSpace(id: string, name: string) {
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
    if (phone) await updateSpaceName(id, name, phone)
  }

  async function deleteSpace(id: string) {
    await deleteLocalFilesForSpace(id)
    if (phone) {
      await deleteSpaceRow(id, phone)
      for (const prefix of ['jawcat.project-manager.v4.', 'jawcat.operations.v4.', 'jawcat.workspace-todos.v1.']) {
        localStorage.removeItem(prefix + phone + '.' + id)
      }
      if (phone === '13610392041') localStorage.removeItem('jawcat.project-manager.v4.' + id)
    }
    setSpaces((prev) => prev.filter((s) => s.id !== id))
  }

  if (!localFilesReady || (phone && loading)) return loadingView

  if (!phone) {
    return <Login onLogin={handleLogin} />
  }

  const activeSpace = spaces.find((s) => s.id === activeSpaceId)

  if (activeSpace) {
    return (
      <Suspense fallback={loadingView}>
        <Workspace
          key={`${phone}:${activeSpace.id}`}
          space={activeSpace}
          ownerPhone={phone}
          onBackToHome={() => setActiveSpaceId(null)}
        />
      </Suspense>
    )
  }

  return (
    <Home
      spaces={spaces}
      onOpen={(s) => setActiveSpaceId(s.id)}
      onCreate={createSpace}
      onRename={renameSpace}
      onDelete={deleteSpace}
      onLogout={handleLogout}
    />
  )
}
