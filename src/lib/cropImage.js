const OUTPUT_SIZE = 256

/**
 * Crops an image file to a 256×256 JPEG Blob.
 *
 * @param {File|Blob} file
 * @param {{ offsetX: number, offsetY: number, scale: number, cropSize: number }} state
 *   offsetX/Y: how far the image center has been panned from the crop circle center (CSS px)
 *   scale: user zoom level (1 = fills crop circle)
 *   cropSize: the displayed crop circle diameter in CSS pixels
 */
export function cropImageToBlob(file, { offsetX, offsetY, scale, cropSize }) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const { naturalWidth: nw, naturalHeight: nh } = img

        // baseScale makes the shorter edge fill the crop circle
        const baseScale = cropSize / Math.min(nw, nh)
        const totalScale = baseScale * scale

        // Source rectangle in original image coordinates
        const srcWidth  = cropSize / totalScale
        const srcHeight = cropSize / totalScale
        const srcX = nw / 2 - offsetX / totalScale - srcWidth  / 2
        const srcY = nh / 2 - offsetY / totalScale - srcHeight / 2

        const canvas = document.createElement('canvas')
        canvas.width  = OUTPUT_SIZE
        canvas.height = OUTPUT_SIZE
        const ctx = canvas.getContext('2d')

        // Circular clip
        ctx.beginPath()
        ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2)
        ctx.clip()

        ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

        canvas.toBlob(blob => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob returned null'))
        }, 'image/jpeg', 0.88)
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}
