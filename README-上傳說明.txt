私人帳本 — GitHub 覆蓋更新檔案包
================================

資料夾路徑（本機）：
  /Users/cfrong/Downloads/stitch/github-pages-upload-bundle

使用方式
--------
1. 將此資料夾「裡面的檔案」複製到你的 GitHub 專案根目錄（與 index.html 同層），覆蓋既有檔案。
   （若使用 gh-pages 分支，則貼到該分支的根目錄。）

2. 內含檔案說明：
   • index.html      — 單頁應用主程式（必備）
   • manifest.webmanifest — PWA 設定（必備）
   • sw.js           — Service Worker 快取（必備；每次改版請一併上傳，且專案內會提高快取版本號，否則瀏覽器可能一直顯示舊版 index.html）
   • assets/stitch-themes.css — 主題樣式（若專案其它頁面有引用請一併保留路徑）

3. 若上傳後畫面「完全沒變」：
   • 請確認同一次有上傳「新的 sw.js」（與 index.html 一起覆蓋）。
   • 用 Chrome：F12 → Application → Service Workers → Unregister，再「清除網站資料」，或強制重新整理（Ctrl+Shift+R / Cmd+Shift+R）。
   • 或關閉該網站所有分頁後再開一次。

4. 圖示（若倉庫尚無請自行補上）
   manifest 內有引用 icon.png（根目錄）與 assets/icon.png。
   若你的倉庫還沒有這兩個檔案，請從你本機備份複製進 repo，或更新 manifest 中的路徑。

5. 若你會在本機用腳本重新合併頁面，原始片段請保留在倉庫中的：
   add/code.html、history/code.html、invoice/code.html、home/code.html、profile/code.html
   以及 tools/merge-single-index.py（此壓縮包未附，請以你完整專案為準）。

提交後推送至 GitHub 即可完成更新。
