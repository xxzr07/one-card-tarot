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
- RWS共通の識別・キーワード・意味と、デッキ固有コンテンツの分離
- 新規ドローは、表示した文章をversion 2 snapshotとして履歴へ保存
- 既存のversion 1履歴も削除・変換せず表示

## 現在のカード構成

抽選対象はDeck 01の全78枚です。正位置／逆位置のキーワードと意味は`data/rws-cards.json`で全デッキ共通、画像、視覚モチーフ、TODAY'S QUESTIONはDeck 01の`deck.json`に収録しています。同じ日は引き直せません。

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

## 新しいデッキを追加する

1. `decks/_template/` を `decks/deck-02/` のような名前でコピーします。
2. `deck.json`へメタデータ、視覚モチーフ、正逆の問いを記入し、`cards/`へ78枚、同じ階層へ`back.png`を置きます。キーワードと意味は新規制作しません。
3. `decks/index.json`へ1件登録します。
4. 次のvalidatorを実行します。

```bash
node tools/validate-deck.cjs deck-02
```

HTML、CSS、アプリ本体、Service WorkerへDeck 02のパスを追記する必要はありません。詳しい制作・QA仕様は`NEW_DECK_TEMPLATE.md`を参照してください。

## カード画像と確認用一覧の再生成

小アルカナを再生成するときは、プロジェクトフォルダで次を順番に実行します。

```bash
node tools/generate-minor.cjs
node tools/normalize-raster-card-corners.cjs
node tools/generate-contact-sheets.cjs
node tests/validate.cjs
node tests/content-resolution.cjs
node tests/verify-face-final.cjs
node tests/verify-card-back.cjs
node tests/verify-corner-normalization.cjs
```

小アルカナ56枚はいったん空の一時領域へ全枚生成され、成功後にのみ`decks/deck-01/cards`へ反映されます。ラスタ生成された裏面・大アルカナは、外周の旧マットを四隅だけで正規化してから共通の30px角丸マスクを一度適用します。通常背景カードの台紙色は`#f2eee6`で統一され、明度差も検査されます。確認用一覧にはカード一式のハッシュを含む固有名が付くため、以前の一覧がキャッシュから表示されることはありません。生成元と各画像のハッシュは`decks/deck-01/minor-build-manifest.json`と`tests/minor-source-audit-*.json`で確認できます。
