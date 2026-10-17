import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { trackEvent } from '../lib/analytics.js'

export function useImageUpload({ convId, groupId, myId, displayName, conversation, setMessages, messagesRef, convImageUrlRef, setConvImageUrl, mountedRef, toast }) {
  const [imagePreviews, setImagePreviews] = useState([])
  const [uploadingGroupIcon, setUploadingGroupIcon] = useState(false)
  const retryingRef = useRef(new Set())

  // Returns { file, width, height }. For non-images and GIFs, dimensions are read from the
  // browser's natural size. For other images, the file is recompressed as JPEG at ≤1200px.
  function compressImage(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      return new Promise(resolve => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload  = () => { URL.revokeObjectURL(url); resolve({ file, width: img.naturalWidth, height: img.naturalHeight }) }
        img.onerror = () => { URL.revokeObjectURL(url); resolve({ file, width: null, height: null }) }
        img.src = url
      })
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)

        function tryEncode(maxDim, quality) {
          const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
          const w = Math.round(img.naturalWidth * scale)
          const h = Math.round(img.naturalHeight * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          canvas.toBlob(blob => {
            if (blob) {
              resolve({ file: new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }), width: w, height: h })
            } else if (maxDim > 600) {
              tryEncode(Math.round(maxDim / 2), quality)
            } else {
              reject(new Error('Image compression failed'))
            }
          }, 'image/jpeg', quality)
        }

        tryEncode(1200, 0.82)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
      img.src = url
    })
  }

  async function sendImage(tempId, file, previewUrl, replyId, textBody = null) {
    try {
      const isVid = file.type.startsWith('video/')
      let uploadFile = file
      let imgWidth = null
      let imgHeight = null
      if (!isVid) {
        const result = await compressImage(file)
        uploadFile = result.file
        imgWidth = result.width
        imgHeight = result.height
      }
      const ext = uploadFile.name.split('.').pop()
      const path = `${myId}/${convId}_${Date.now()}.${ext}`
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('chat-images')
        .upload(path, uploadFile, { contentType: uploadFile.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(uploaded.path)

      const { data: newMsg } = await supabase.from('messages').insert({
        community_group_id: groupId,
        conversation_id: convId,
        user_id: myId,
        display_name: displayName || 'Member',
        body: null,
        image_url: publicUrl,
        reply_to_id: replyId,
        image_width:  imgWidth  ?? null,
        image_height: imgHeight ?? null,
      }).select('*, reply_message:reply_to_id(id, body, display_name, image_url)').single()

      if (newMsg) {
        trackEvent('chat_message_sent', { type: isVid ? 'video' : 'image', conv_type: conversation.type })
        if (!isVid) {
          await new Promise(resolve => {
            const img = new window.Image()
            img.onload = resolve
            img.onerror = resolve
            img.src = publicUrl
          })
        }
        setMessages(prev => {
          const without = prev.filter(m => m._tempId !== tempId)
          return without.some(m => m.id === newMsg.id) ? without : [...without, { ...newMsg, _isNew: true }]
        })
      }
    } catch (err) {
      console.error('Image send failed:', err)
      setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _pending: false, _failed: true } : m))
    }
  }

  async function sendImages(tempMessages, textBody) {
    await Promise.all(tempMessages.map(temp =>
      sendImage(temp._tempId, temp._file, temp.image_url, temp.reply_to_id, null)
    ))
    if (textBody) {
      const { data: textMsg } = await supabase.from('messages').insert({
        community_group_id: groupId,
        conversation_id: convId,
        user_id: myId,
        display_name: displayName || 'Member',
        body: textBody,
        image_url: null,
        reply_to_id: null,
      }).select('*, reply_message:reply_to_id(id, body, display_name, image_url)').single()
      if (textMsg) {
        setMessages(prev => prev.some(m => m.id === textMsg.id) ? prev : [...prev, { ...textMsg, _isNew: true }])
      }
    }
  }

  async function retryMessage(tempId) {
    if (retryingRef.current.has(tempId)) return
    const msg = messagesRef.current.find(m => m._tempId === tempId)
    if (!msg?._file) return
    retryingRef.current.add(tempId)
    setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _pending: true, _failed: false } : m))
    try {
      await sendImage(tempId, msg._file, msg.image_url, msg.reply_to_id, msg._textBody ?? null)
    } finally {
      retryingRef.current.delete(tempId)
    }
  }

  function removePreview(i) {
    setImagePreviews(prev => {
      const p = prev[i]
      if (p?.isVideo && p.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl)
      return prev.filter((_, j) => j !== i)
    })
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    for (const file of files) {
      const isVid = file.type.startsWith('video/')
      const isImg = file.type.startsWith('image/')
      if (!isVid && !isImg) { toast('Only images and videos are supported', 'error'); continue }
      if (isVid) {
        if (file.size > 50 * 1024 * 1024) { toast('Video must be under 50 MB', 'error'); continue }
        const previewUrl = URL.createObjectURL(file)
        setImagePreviews(prev => [...prev, { file, previewUrl, isVideo: true }])
      } else {
        if (file.size > 10 * 1024 * 1024) { toast('Image must be under 10 MB', 'error'); continue }
        const reader = new FileReader()
        reader.onload = ev => setImagePreviews(prev => [...prev, { file, previewUrl: ev.target.result, isVideo: false }])
        reader.readAsDataURL(file)
      }
    }
  }

  async function uploadGroupIcon(file) {
    if (!file || uploadingGroupIcon) return
    setUploadingGroupIcon(true)
    try {
      let compressed = file
      try {
        const result = await compressImage(file)
        compressed = result.file
      } catch {}
      // Always use a fresh timestamped path — the chat-images bucket has no UPDATE policy,
      // so upsert on an existing path is blocked by RLS. A new path is always an INSERT.
      // Prefix with myId so the owner-delete RLS policy allows cleanup later.
      const ext = compressed.name?.split('.').pop() || 'jpg'
      const path = `${myId}/group-icons/${convId}-${Date.now()}.${ext}`
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('chat-images')
        .upload(path, compressed, { contentType: compressed.type || 'image/jpeg' })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(uploaded.path)
      const { error } = await supabase.from('conversations').update({ image_url: publicUrl }).eq('id', convId)
      if (error) throw error
      setConvImageUrl(publicUrl)
    } catch (err) {
      console.error('uploadGroupIcon failed:', err)
      toast('Failed to upload icon', 'error')
    } finally {
      setUploadingGroupIcon(false)
    }
  }

  async function removeGroupIcon() {
    const oldUrl = convImageUrlRef.current
    setConvImageUrl(null)
    const { error } = await supabase.from('conversations').update({ image_url: null }).eq('id', convId)
    if (error) {
      console.error('removeGroupIcon failed:', error)
      setConvImageUrl(oldUrl)
      toast('Failed to remove icon', 'error')
      return
    }
    if (oldUrl) {
      const match = oldUrl.match(/\/chat-images\/(.+)$/)
      if (match) await supabase.storage.from('chat-images').remove([match[1]])
    }
  }

  return {
    imagePreviews, setImagePreviews,
    uploadingGroupIcon,
    compressImage, sendImage, sendImages,
    retryMessage, handleFileChange, removePreview,
    uploadGroupIcon, removeGroupIcon,
  }
}
