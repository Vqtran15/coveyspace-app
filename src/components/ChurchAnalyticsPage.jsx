import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UsersThree, Buildings } from '@phosphor-icons/react'
import { useAppContext } from '../contexts/AppContext.jsx'
import { db } from '../lib/db.js'

export default function ChurchAnalyticsPage() {
  const navigate = useNavigate()
  const { churchId, churchName } = useAppContext()
  const [groups, setGroups] = useState(null)

  useEffect(() => {
    if (!churchId) { setGroups([]); return }
    db.churches.fetchGroupsForChurch(churchId).then(({ data }) => {
      setGroups(data ?? [])
    })
  }, [churchId])

  const totalMembers = groups
    ? groups.reduce((sum, g) => sum + Number(g.profiles?.[0]?.count ?? 0), 0)
    : 0

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-16">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-1 -ml-2">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="text-3xl font-bold text-stone-800">Church Analytics</h1>
        </div>
        {churchName && (
          <p className="text-sm text-stone-500 mt-1 ml-1">{churchName}</p>
        )}
      </div>

      {/* Summary card */}
      {groups !== null && (
        <div className="bg-white border border-stone-100 rounded-2xl shadow p-4 mb-6 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">Groups</p>
            <p className="text-3xl font-bold text-stone-800">{groups.length}</p>
          </div>
          <div className="w-px h-10 bg-stone-100 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">Total Members</p>
            <p className="text-3xl font-bold text-stone-800">{totalMembers}</p>
          </div>
        </div>
      )}

      {/* Group list */}
      {groups === null ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-stone-100 rounded-2xl shadow px-4 py-4">
              <div className="h-4 w-36 bg-stone-100 rounded animate-pulse mb-2" />
              <div className="h-3 w-20 bg-stone-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Buildings size={32} className="text-stone-300 mb-3" />
          <p className="text-sm font-medium text-stone-500">No groups linked yet</p>
          <p className="text-sm text-stone-400 mt-1">Groups will appear here once they join this church.</p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 px-1">Groups</p>
          <div className="bg-white border border-stone-100 rounded-2xl shadow overflow-hidden">
            {groups.map((group, idx) => {
              const memberCount = Number(group.profiles?.[0]?.count ?? 0)
              return (
                <div
                  key={group.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${idx < groups.length - 1 ? 'border-b border-stone-100' : ''}`}
                >
                  <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                    <UsersThree size={16} weight="fill" className="text-stone-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{group.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
