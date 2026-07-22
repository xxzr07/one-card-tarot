# ONE CARD — Daily Tarot PWA

Deck 01の大アルカナ22枚と小アルカナ56枚、合計78枚を収録した完成版です。アプリの基本機能も本番仕様で実装済みです。

## 現在使える機能

- 端末に設定された現地時間の0:00基準の1日1ドロー
- カード、正逆位置、最初に選んだデッキの端末内保存
- 静かなカードフリップ
- デッキごとに設定できる共通裏面（Deck 01は「天体の軌跡」）
- 抽選結果の正逆に関係なく、カードを引く前の裏面は常に上向きで表示
- 月間カレンダー形式の履歴
- 履歴カードの再表示
- JSON形式のエクスポート／インポート
- PWA、オフラインキャッシュ、iPhoneのsafe area対応
- カード共通データとデッキ固有データ（画像・TODAY'S QUESTION）の分離

## 現在のカード構成

抽選対象はDeck 01の全78枚です。各カードに正位置・逆位置の共通キーワードと意味、Deck 01の視覚モチーフを反映した固有のTODAY'S QUESTIONを収録しています。同じ日は引き直せません。

裏面画像は各カードではなくデッキ定義の`backImage`に設定します。同じデッキ内の全カードで共通となり、今後別デッキを追加する場合は、そのデッキ固有の裏面画像を指定できます。

- 大アルカナ：22枚
- WANDS：14枚
- CUPS：14枚
- SWORDS：14枚
- PENTACLES：14枚

## ローカルで開く

`index.html`を直接ダブルクリックせず、簡単なローカルサーバーを使います。WSLのUbuntuを開き、次を1行ずつ入力してください。

```bash
cd /mnt/c/ここにこのフォルダを置いた場所/tarot-pwa
python3 -m http.server 8000
```

Windows側のFirefoxまたはChromeで `http://localhost:8000` を開きます。終了するときはUbuntuの画面で `Ctrl` + `C` を押します。

## GitHub Pagesへの公開とiPhoneへの追加

GitHubへこのフォルダの中身をそのまま置けば動作する構成です。公開後はiPhoneのSafariでページを開き、共有メニューから「ホーム画面に追加」を選びます。

## カード画像と確認用一覧の再生成

小アルカナを再生成するときは、プロジェクトフォルダで次を順番に実行します。

```bash
node tools/generate-minor.cjs
node tools/finalize-major-corners.cjs
node tools/generate-contact-sheets.cjs
node tests/validate.cjs
node tests/verify-face-final.cjs
node tests/verify-card-back.cjs
```

小アルカナ56枚はいったん空の一時領域へ全枚生成され、成功後にのみ`assets/deck-01`へ反映されます。全78枚の最終出力には共通の30px角丸マスクを使用します。通常背景カードの台紙色は`#f2eee6`で統一され、明度差も検査されます。確認用一覧にはカード一式のハッシュを含む固有名が付くため、以前の一覧がキャッシュから表示されることはありません。生成元と各画像のハッシュは`assets/deck-01/minor-build-manifest.json`と`tests/minor-source-audit-*.json`で確認できます。
