/**
 * 一次情報 (官公庁) リンクの許可リスト。
 * Allow-list for primary-source (government) links.
 * Daftar izin untuk tautan sumber utama (pemerintah).
 *
 * 出入国在留管理庁・厚労省・総務省・内閣府・農水省・国交省の go.jp のみ許可。
 * Only go.jp hosts for MOJ/MHLW/SOUMU/CAO/MAFF/MLIT are allowed.
 * 行政書士が出典を一次情報で確認する動線を保証するための制約。
 */
export const PRIMARY_SOURCE_URL_REGEXP =
  /^https:\/\/(www\.)?(moj|mhlw|soumu|cao|maff|mlit)\.go\.jp\//;

/**
 * 許可リストに一致すれば URL を、しなければ "#" を返す。
 * Returns the URL when it matches the allow-list, otherwise "#".
 * Mengembalikan URL bila cocok daftar izin, jika tidak "#".
 */
export function safePrimaryHref(url: string): string {
  return PRIMARY_SOURCE_URL_REGEXP.test(url) ? url : "#";
}
