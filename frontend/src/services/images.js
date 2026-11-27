/**
 * Shrinks a photo picked by the user to a JPEG data URL before upload, so product
 * photos stay around 100–300 KB and several fit in one request.
 */
export const resizeImage = (file, maxSide = 1280, quality = 0.82) =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not-an-image'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      // JPEG has no transparency: put transparent PNGs on white
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });

/** A data URL (as made by resizeImage) back to a Blob, for direct uploads */
export const dataUrlToBlob = (dataUrl) => {
  const [head, base64] = dataUrl.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
};

/**
 * A still from a video file (about one second in), as a JPEG Blob, used as the video's
 * poster on the map. Resolves with null when the browser cannot decode the video.
 */
export const videoPoster = (file, maxSide = 1280) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (blob) => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) / 2);
    };
    video.onseeked = () => {
      const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      if (!canvas.width || !canvas.height) return done(null);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toBlob((blob) => done(blob), 'image/jpeg', 0.82);
    };
    video.onerror = () => done(null);
    setTimeout(() => done(null), 15000);
    video.src = url;
  });
