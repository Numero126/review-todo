# 復習ToDo（固定間隔・内容別セット）v3

## 起動方法
1. Node.js 18+ を用意してください
2. 依存関係をインストール
   - `npm install`
3. 開発サーバー起動
   - `npm run dev`

### PowerShellで `npm` がブロックされる場合
ExecutionPolicyの都合で `npm.ps1` が実行できないことがあります。その場合は以下のいずれかを使ってください。

- `npm.cmd install` / `npm.cmd run dev`（ポリシー変更なし）
- もしくは一時的に許可：
  - `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

## 追加された機能（v3）
- カレンダータブ：日付を選んで、その日の予定（nextDue=当日）と期限切れを確認・リスケ
- 完了済み（今日）に「取り消し」ボタン：直近の完了を元に戻せます
- 一覧タブ：全タスク検索、タグ別フィルタ、期限順、苦手（期限切れ日数）可視化
- 今日タスク/明日タスクに「日付」ボタン：date入力で期限を直接指定

## データ保存
- localStorage に保存されます（このブラウザ内のみ）。
