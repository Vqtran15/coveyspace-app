import { useRef, useState } from 'react'
import { Image, X } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { useModalClose } from '../hooks/useModalClose.js'
import { AVATAR_ICON_LIST, AVATAR_COLOR_OPTIONS, AvatarIcon, avatarColor } from '../lib/avatarIcons.jsx'
import ImageCropModal from './ImageCropModal.jsx'

const BUCKET = 'profile-avatars'

/**
 * Props:
 *   userId          string
 *   currentIcon     string | null
 *   currentColor    string | null
 *   currentImageUrl string | null
 *   onSave({ icon, color, imageUrl })  — called after each save, with updated values
 *   onClose         () => void  — only used when inline=false
 *   inline          bool        — when true, renders content only (no backdrop/header/close)
 */
export default function AvatarPicker({
  userId,
  currentIcon,
  currentColor,
  currentImageUrl,
  onSave,
  onClose,
  inline = false,
}) {
  const toast = useToast()
  const fileInputRef = useRef(null)

  const [tab,         setTab]         = useState(currentImageUrl ? 'photo' : 'icon')
  const [tabDir,      setTabDir]      = useState(null) // 'left' | 'right' — drives enter animation
  const [icon,        setIcon]        = useState(currentIcon)
  const [colorKey,    setColorKey]    = useState(currentColor)
  const [imageUrl,    setImageUrl]    = useState(currentImageUrl)
  const [pendingFile, setPendingFile] = useState(null)
  const [savingIcon,  setSavingIcon]  = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)

  const [closing, animatedClose] = useModalClose(onClose ?? (() => {}))
  const doClose = inline ? () => {} : animatedClose

  function switchTab(t) {
    if (t === tab) return
    setTabDir(t === 'photo' ? 'right' : 'left')
    setTab(t)
  }

  // ── Icon tab handlers ────────────────────────────────────────────────────────

  async function handleSelectIcon(name) {
    setSavingIcon(true)
    const updates = { avatar_icon: name }
    if (imageUrl) {
      updates.avatar_image_url = null
      await deleteStoredPhoto()
      setImageUrl(null)
    }
    const { error } = await supabase.from('profiles').update(updates).eq('user_id', userId)
    if (error) {
      toast('Failed to save avatar', 'error')
    } else {
      setIcon(name)
      onSave?.({ icon: name, color: colorKey, imageUrl: null })
      doClose()
    }
    setSavingIcon(false)
  }

  async function handleSelectColor(key) {
    const prevKey = colorKey
    setColorKey(key)
    const { error } = await supabase.from('profiles').update({ avatar_color: key }).eq('user_id', userId)
    if (error) {
      setColorKey(prevKey)
      toast('Failed to save color', 'error')
    } else {
      onSave?.({ icon, color: key, imageUrl })
    }
  }

  // ── Photo tab handlers ───────────────────────────────────────────────────────

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please choose an image file', 'error'); return }
    if (file.size > 20 * 1024 * 1024) { toast('Image must be under 20 MB', 'error'); return }
    e.target.value = ''
    setPendingFile(file)
  }

  async function handleCropConfirm(blob) {
    setPendingFile(null)
    setSavingPhoto(true)
    try {
      const path = `${userId}/avatar.jpg`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const urlWithBust = `${publicUrl}?t=${Date.now()}`

      const { error: dbError } = await supabase.from('profiles')
        .update({ avatar_image_url: urlWithBust })
        .eq('user_id', userId)
      if (dbError) throw dbError

      setImageUrl(urlWithBust)
      onSave?.({ icon, color: colorKey, imageUrl: urlWithBust })
      toast('Photo saved', 'success')
      doClose()
    } catch (err) {
      toast('Failed to save photo', 'error')
      console.error(err)
    }
    setSavingPhoto(false)
  }

  async function handleRemovePhoto() {
    setSavingPhoto(true)
    await deleteStoredPhoto()
    const { error } = await supabase.from('profiles')
      .update({ avatar_image_url: null })
      .eq('user_id', userId)
    if (error) {
      toast('Failed to remove photo', 'error')
    } else {
      setImageUrl(null)
      onSave?.({ icon, color: colorKey, imageUrl: null })
      toast('Photo removed', 'success')
      doClose()
    }
    setSavingPhoto(false)
  }

  async function deleteStoredPhoto() {
    try {
      await supabase.storage.from(BUCKET).remove([`${userId}/avatar.jpg`])
    } catch { /* best-effort */ }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const tabAnimClass = tabDir === 'right'
    ? 'animate-slide-in-right'
    : tabDir === 'left'
      ? 'animate-slide-in-left'
      : ''

  const content = (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
        {['icon', 'photo'].map(t => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-colors ${
              tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {t === 'icon' ? 'Choose Icon' : 'Upload Photo'}
          </button>
        ))}
      </div>

      {/* Keyed wrapper so the entering panel re-mounts and plays its slide animation */}
      <div className="overflow-hidden">
        <div key={tab} className={tabAnimClass}>

          {/* Icon tab */}
          {tab === 'icon' && (
            <>
              <div>
                <p className="text-xs text-stone-400 font-medium mb-2">Color</p>
                <div className="flex gap-2">
                  {AVATAR_COLOR_OPTIONS.map(({ key, bgClass, label }) => (
                    <button
                      key={key}
                      onClick={() => handleSelectColor(key)}
                      title={label}
                      className={`w-9 h-9 rounded-full ${bgClass} flex items-center justify-center transition-transform active:scale-95 ${
                        colorKey === key ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''
                      }`}
                    >
                      {colorKey === key && <span className="w-2 h-2 rounded-full bg-white/80" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs text-stone-400 font-medium mb-2">Icon</p>
                <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto scrollbar-hide">
                  {AVATAR_ICON_LIST.map(({ name, Icon }) => (
                    <button
                      key={name}
                      onClick={() => handleSelectIcon(name)}
                      disabled={savingIcon}
                      className={`h-11 rounded-xl flex items-center justify-center transition-colors ${
                        icon === name && !imageUrl
                          ? `${avatarColor(userId, colorKey)} ring-2 ring-offset-1 ring-jade`
                          : 'bg-stone-100 hover:bg-stone-200 active:bg-stone-200'
                      }`}
                    >
                      <Icon
                        size={22}
                        weight="fill"
                        className={icon === name && !imageUrl ? 'text-white' : 'text-stone-500'}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Photo tab */}
          {tab === 'photo' && (
            <div className="flex flex-col items-center gap-3 py-2">
              {imageUrl ? (
                <>
                  {/* In sheet mode show a preview circle; in inline mode the AvatarCircle above already serves as the preview */}
                  {!inline && (
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-stone-200 shrink-0">
                      <img src={imageUrl} alt="Current photo" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={savingPhoto}
                    className="px-5 py-2.5 text-sm font-semibold text-jade border border-jade rounded-xl hover:bg-jade/5 active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    Replace photo
                  </button>
                  <button
                    onClick={handleRemovePhoto}
                    disabled={savingPhoto}
                    className="text-xs text-stone-400 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {savingPhoto ? 'Saving…' : 'Remove photo'}
                  </button>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                    <Image size={32} className="text-stone-300" />
                  </div>
                  {savingPhoto ? (
                    <p className="text-sm text-stone-400">Saving…</p>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-jade hover:bg-jade-700 active:scale-[0.98] rounded-xl transition-all"
                    >
                      Choose photo
                    </button>
                  )}
                  <p className="text-xs text-stone-400 text-center max-w-[200px]">
                    You can move and resize the photo to fit.
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  )

  return (
    <>
      {pendingFile && (
        <ImageCropModal
          file={pendingFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setPendingFile(null)}
        />
      )}

      {inline ? (
        content
      ) : (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/40 ${closing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
            onClick={animatedClose}
          />
          {/* Sheet */}
          <div
            className={`relative w-full max-w-sm bg-white rounded-t-2xl p-4 space-y-1 ${closing ? 'animate-sheet-out' : 'animate-sheet-in'}`}
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-stone-700">Edit photo</p>
              <button
                onClick={animatedClose}
                className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
            {content}
          </div>
        </div>
      )}
    </>
  )
}
