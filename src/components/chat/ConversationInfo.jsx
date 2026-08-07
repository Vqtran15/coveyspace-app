import { Users, PencilSimple, Camera, Trash, Check, X, ShieldCheck } from '@phosphor-icons/react'
import { AvatarIcon, avatarColor } from '../../lib/avatarIcons.jsx'
import { initials } from '../../utils/format.js'
import { useChatContext } from './ChatContext.jsx'

export default function ConversationInfo() {
  const {
    infoOpen, infoClosing, closeInfo,
    conversation, convImageUrl, title,
    members, myId, canEditGroupInfo,
    dmOtherMember,
    renamingGroup, setRenamingGroup,
    renameValue, setRenameValue, renameSaving,
    uploadingGroupIcon,
    handleRenameGroup, uploadGroupIcon, removeGroupIcon,
    groupIconFileRef,
  } = useChatContext()

  if (!infoOpen) return null

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-end z-50 ${infoClosing ? 'animate-backdrop-out' : 'animate-overlay-in'}`}
      onClick={closeInfo}
    >
      <div
        className={`bg-white rounded-t-2xl w-full max-w-lg mx-auto max-h-[70vh] overflow-y-auto ${infoClosing ? 'animate-sheet-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-lg font-bold text-stone-800">
            {conversation.type === 'group' ? 'Group Info' : 'Contact Info'}
          </h2>
          <button
            onClick={closeInfo}
            className="text-stone-400 hover:text-stone-600 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>

        {/* Avatar + name */}
        <div className="flex flex-col items-center py-5 px-5">
          <div className="relative mb-3">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center overflow-hidden ${conversation.type === 'group' ? (convImageUrl ? 'bg-stone-200 shadow-md' : 'bg-ember') : dmOtherMember?.avatar_image_url ? 'bg-stone-200 shadow-md' : avatarColor(dmOtherMember?.user_id ?? '', dmOtherMember?.avatar_color)}`}>
              {conversation.type === 'group'
                ? convImageUrl
                  ? <img src={convImageUrl} alt="" className="w-full h-full object-cover" />
                  : <Users size={40} weight="fill" className="text-white" />
                : dmOtherMember?.avatar_image_url
                  ? <img src={dmOtherMember.avatar_image_url} alt={title} className="w-full h-full object-cover" />
                  : dmOtherMember?.avatar_icon
                    ? <AvatarIcon name={dmOtherMember.avatar_icon} size={40} />
                    : <span className="text-white text-2xl font-bold">{initials(title)}</span>
              }
              {uploadingGroupIcon && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
              )}
            </div>
            {canEditGroupInfo && (
              <button
                onClick={() => groupIconFileRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-ember rounded-full flex items-center justify-center shadow-md border-2 border-white"
              >
                <Camera size={14} className="text-white" weight="fill" />
              </button>
            )}
            {canEditGroupInfo && convImageUrl && (
              <button
                onClick={removeGroupIcon}
                className="absolute bottom-0 left-0 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md border-2 border-white"
              >
                <Trash size={14} className="text-red-500" weight="fill" />
              </button>
            )}
          </div>
          <input
            ref={groupIconFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadGroupIcon(f) }}
          />
          {renamingGroup ? (
            <form onSubmit={handleRenameGroup} className="flex items-center gap-2 w-full max-w-xs">
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                className="flex-1 border border-stone-200 rounded-xl px-3 py-1.5 text-base font-bold text-stone-800 text-center focus:outline-none focus:ring-2 focus:ring-ember"
              />
              <button type="submit" disabled={renameSaving} className="text-ember disabled:opacity-40">
                <Check size={18} weight="bold" />
              </button>
              <button type="button" onClick={() => setRenamingGroup(false)} className="text-stone-400">
                <X size={18} weight="bold" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-stone-800 text-center">{title}</h3>
              {canEditGroupInfo && (
                <button
                  onClick={() => { setRenameValue(title); setRenamingGroup(true) }}
                  className="text-stone-400 hover:text-stone-600 transition-colors"
                >
                  <PencilSimple size={15} />
                </button>
              )}
            </div>
          )}
          <p className="text-sm text-stone-400 mt-1">
            {conversation.type === 'group' ? `${members.length} member${members.length !== 1 ? 's' : ''}` : 'Direct Message'}
          </p>
        </div>

        {/* Member list (group only) */}
        {conversation.type === 'group' && (
          <div className="px-5 pb-8">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Members</p>
            <div className="space-y-1">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3 py-2">
                  <div className={`w-10 h-10 rounded-full shrink-0 overflow-hidden ${m.avatar_image_url ? 'bg-stone-200 shadow-md' : `flex items-center justify-center ${avatarColor(m.user_id, m.avatar_color)}`}`}>
                    {m.avatar_image_url
                      ? <img src={m.avatar_image_url} alt={m.display_name} className="w-full h-full object-cover" />
                      : m.avatar_icon
                        ? <AvatarIcon name={m.avatar_icon} size={20} />
                        : <span className="text-white text-sm font-bold">{initials(m.display_name)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-stone-800 truncate">{m.display_name}</span>
                      {m.role === 'admin' && (
                        <ShieldCheck size={12} weight="fill" className="text-ember shrink-0" />
                      )}
                      {m.user_id === myId && (
                        <span className="text-stone-400 text-xs shrink-0">(You)</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
