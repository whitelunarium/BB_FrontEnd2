// assets/js/chatbot/image.js
// PNEC Helper Bot v3 — Phase 4 image attachments + vision.
//
// Two roles:
//   1. attach(bot, file) — when the user picks an image (e.g. a yard
//      photo for "is this defensible space okay?"), we resize to a
//      reasonable max width (1280px) so we don't blow the proxy's
//      payload limit, then store it as a base64 data URL on the
//      controller's pending message buffer.
//
//   2. enrichSubmit(bot, payload) — called by index.js right before
//      the LLM call. If the controller has an active image, we
//      append it to the prompt as a base64 part so Gemini's vision
//      model can see it. The Flask /api/gemini proxy needs to be
//      updated to pass through `image_base64` — until that ships,
//      this module gracefully no-ops and the image just renders in
//      the user message bubble for the user's reference.

const MAX_DIM = 1280;
const QUALITY = 0.82;

export async function attach(bot, file) {
  if (!file || !/^image\//.test(file.type)) return;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const resized = await resizeImage(dataUrl, MAX_DIM, QUALITY);
    bot.activeImage = { dataUrl: resized, alt: file.name, mime: 'image/jpeg' };
    bot._renderAttachmentTile();
    bot._onInputChange();
  } catch (e) {
    console.warn('[helper-bot] image attach failed:', e);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function resizeImage(dataUrl, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w <= maxDim && h <= maxDim) { resolve(dataUrl); return; }
      const scale = Math.min(maxDim / w, maxDim / h);
      const nw = Math.round(w * scale);
      const nh = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, nw, nh);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Adds image_base64 to the request body if the controller has one
// queued. Phase 4 backend update will consume it; today the field
// is silently ignored if the proxy doesn't recognize it.
export function enrichSubmitPayload(bot, payload) {
  if (!bot || !bot.activeImage) return payload;
  return {
    ...payload,
    image_base64: bot.activeImage.dataUrl.replace(/^data:image\/[^;]+;base64,/, ''),
    image_mime: bot.activeImage.mime || 'image/jpeg',
  };
}
