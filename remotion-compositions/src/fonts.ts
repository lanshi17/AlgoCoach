/**
 * Mono font stack shared by every composition.
 *
 * Remotion rasterizes inside Chromium. On the Docker renderer the only fonts
 * available are the ones baked into the image, so without an explicit CJK
 * family Chinese labels render blank. Keep `monospace` first (Latin and digits
 * stay pixel-identical) and list CJK fallbacks after it: the browser walks the
 * list per character, so Chinese text finds a CJK family while Latin keeps the
 * original mono look. The renderer image installs `fonts-noto-cjk`.
 */
export const MONO_FONT_STACK =
  "'JetBrains Mono', monospace, 'Noto Sans CJK SC', 'Noto Sans Mono CJK SC', " +
  "'PingFang SC', 'Microsoft YaHei', 'WenQuanYi Zen Hei'"
