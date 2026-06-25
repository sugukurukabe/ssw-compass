/**
 * ワンクリックコピー (ケースハンドル・書類リスト・URL 用)。
 * One-click copy helper (case handles, document lists, URLs).
 * Pembantu salin satu klik (handle kasus, daftar dokumen, URL).
 *
 * MCP Apps の widget iframe は strict CSP 下にあるが、navigator.clipboard と
 * フォールバックの execCommand はネットワーク取得ではないため CSP に抵触しない。
 * クリップボード権限が無いホストでも落ちないよう、両経路を try/catch で包む。
 */

/**
 * 文字列をクリップボードへコピーし、成功可否を返す。
 * Copies text to the clipboard; resolves true on success, false otherwise.
 * Menyalin teks ke clipboard; mengembalikan true bila berhasil.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    const clip = navigator.clipboard;
    if (clip !== undefined && typeof clip.writeText === "function") {
      await clip.writeText(text);
      return true;
    }
  } catch {
    // クリップボード API が拒否された場合は execCommand にフォールバック。
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * コピーボタンのラベル (アイドル/成功/失敗)。
 * Labels for a copy button (idle / success / failure).
 * Label tombol salin (diam / berhasil / gagal).
 */
export interface CopyButtonLabels {
  idle: string;
  done: string;
  failed: string;
}

/**
 * ボタンにコピー挙動を取り付け、押下時に一時的なフィードバックを表示する。
 * Attaches copy behaviour to a button with transient feedback on press.
 * Memasang perilaku salin ke tombol dengan umpan balik sementara saat ditekan.
 *
 * @param getText コピー対象テキストを返す関数 (render 時点の最新値を遅延取得)。
 */
export function attachCopyButton(
  button: HTMLButtonElement,
  getText: () => string,
  labels: CopyButtonLabels,
): void {
  button.addEventListener("click", async () => {
    const ok = await copyTextToClipboard(getText());
    button.textContent = ok ? labels.done : labels.failed;
    button.setAttribute("data-ssw-copied", ok ? "true" : "false");
    window.setTimeout(() => {
      button.textContent = labels.idle;
      button.removeAttribute("data-ssw-copied");
    }, 1600);
  });
}
