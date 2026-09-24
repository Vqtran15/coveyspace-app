import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, UsersThree, Buildings } from '@phosphor-icons/react'
import { useAppContext } from '../contexts/AppContext.jsx'
import { db } from '../lib/db.js'


function fmtMonthYear(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function activityStatus(lastActiveAt) {
  if (!lastActiveAt) return 'inactive'
  const days = (Date.now() - new Date(lastActiveAt).getTime()) / 86400000
  if (days <= 7) return 'active'
  if (days <= 30) return 'quiet'
  return 'inactive'
}

const ACTIVITY = {
  active:   { label: 'Active',   cls: 'bg-emerald-50 text-emerald-700' },
  quiet:    { label: 'Quiet',    cls: 'bg-amber-50 text-amber-700'     },
  inactive: { label: 'Inactive', cls: 'bg-stone-100 text-stone-500'    },
}

const ACTIVITY_ORDER = { active: 0, quiet: 1, inactive: 2 }

export default function ChurchAnalyticsPage() {
  const navigate = useNavigate()
  const { churchId, churchName, isChurchAdmin } = useAppContext()
  const [groups, setGroups] = useState(null)
  const [activityMap, setActivityMap] = useState(null)

  useEffect(() => {
    if (!isChurchAdmin) return
    if (!churchId) { setGroups([]); setActivityMap({}); return }
    db.churches.fetchGroupsForChurch(churchId).then(({ data }) => {
      const fetched = data ?? []
      setGroups(fetched)
      if (fetched.length === 0) { setActivityMap({}); return }
      db.churches.fetchGroupLastActivity(fetched.map(g => g.id)).then(({ data: msgs }) => {
        const map = {}
        msgs?.forEach(m => {
          if (!map[m.community_group_id]) map[m.community_group_id] = m.created_at
        })
        setActivityMap(map)
      })
    })
  }, [churchId, isChurchAdmin])

  const loaded = groups !== null
  const activityLoaded = activityMap !== null

  const totalMembers = loaded ? groups.reduce((s, g) => s + Number(g.profiles?.[0]?.count ?? 0), 0) : 0
  const avgSize = loaded && groups.length > 0 ? Math.round(totalMembers / groups.length) : 0
  const activeCount = activityLoaded && groups ? groups.filter(g => activityStatus(activityMap[g.id]) === 'active').length : null

  if (!isChurchAdmin) return <Navigate to="/settings" replace />

  const sortedGroups = loaded && activityLoaded
    ? [...groups].sort((a, b) =>
        ACTIVITY_ORDER[activityStatus(activityMap[a.id])] - ACTIVITY_ORDER[activityStatus(activityMap[b.id])]
      )
    : groups ?? []

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
        {churchName && <p className="text-sm text-stone-500 mt-1 ml-1">{churchName}</p>}
      </div>

      {/* Summary stats */}
      {!loaded ? (
        <div className="bg-white border border-stone-100 rounded-2xl shadow p-4 mb-6 grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div className="h-2.5 w-10 bg-stone-100 rounded animate-pulse mb-2" />
              <div className="h-6 w-8 bg-stone-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-stone-100 rounded-2xl shadow p-4 mb-6 grid grid-cols-4">
          {[
            { label: 'Groups',  value: groups.length     },
            { label: 'Members', value: totalMembers       },
            { label: 'Avg Size', value: avgSize           },
            { label: 'Active',  value: activeCount ?? '—' },
          ].map(({ label, value }, i, arr) => (
            <div key={label} className={`${i < arr.length - 1 ? 'border-r border-stone-100 pr-3 mr-3' : ''}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-1 leading-tight">{label}</p>
              <p className="text-2xl font-bold text-stone-800 tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Group list */}
      {!loaded ? (
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
            {sortedGroups.map((group, idx) => {
              const memberCount = Number(group.profiles?.[0]?.count ?? 0)
              const memberships = group.group_memberships ?? []
              const adminCount = memberships.filter(m => m.role === 'admin').length
              const lastJoined = memberships.length > 0
                ? memberships.reduce((max, m) => (m.joined_at > max ? m.joined_at : max), memberships[0].joined_at)
                : null
              const status = activityLoaded ? activityStatus(activityMap[group.id]) : null
              const activity = status ? ACTIVITY[status] : null
              return (
                <div
                  key={group.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${idx < sortedGroups.length - 1 ? 'border-b border-stone-100' : ''}`}
                >
                  <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                    <UsersThree size={16} weight="fill" className="text-stone-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{group.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {memberCount} {memberCount === 1 ? 'member' : 'members'} · {adminCount} {adminCount === 1 ? 'admin' : 'admins'}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Created {fmtMonthYear(group.created_at)} · Last joined {fmtDate(lastJoined)}
                    </p>
                  </div>
                  {activity && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${activity.cls}`}>
                      {activity.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
