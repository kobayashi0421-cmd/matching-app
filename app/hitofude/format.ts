/** 結果表示用: 1:23.45 */
export const formatDuration = (ms?: number): string => {
  if (!ms) return '--:--.--';
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${min}:${sec < 10 ? '0' : ''}${sec}.${hundredths < 10 ? '0' : ''}${hundredths}`;
};

/** ストップウォッチ表示用: 01:23.45 */
export const formatTimer = (ms: number): string => {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}.${hundredths < 10 ? '0' : ''}${hundredths}`;
};
