import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import Workspace from './pages/Workspace'
import { loadSession, saveSession, uid, type Space, type TypeName } from './lib/store'
import { fetchSpaces, insertSpace, updateSpaceName, deleteSpaceRow } from './lib/api'

export default function App() {
  const [phone, setPhone] = useState<string | null>(() => loadSession())
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.documentElement.removeAttribute('data-theme')
  }, [])

  async function reload() {
    const list = await fetchSpaces()
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
    await insertSpace(s)
  }

  async function renameSpace(id: string, name: string) {
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
    await updateSpaceName(id, name)
  }

  async function deleteSpace(id: string) {
    setSpaces((prev) => prev.filter((s) => s.id !== id))
    await deleteSpaceRow(id)
  }

  if (!phone) {
    return <Login onLogin={handleLogin} />
  }

  if (loading) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: 'var(--text-3)',
      }}>
        加载中…
      </div>
    )
  }

  const activeSpace = spaces.find((s) => s.id === activeSpaceId)

  if (activeSpace) {
    return (
      <Workspace
        space={activeSpace}
        onBackToHome={() => setActiveSpaceId(null)}
      />
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
