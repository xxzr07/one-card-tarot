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
- 78枚共通のCARD COREと、デッキ固有の表示コンテンツの分離
- 新規ドローは、表示した文章をversion 2 snapshotとして履歴へ保存
- 既存のversion 1履歴も削除・変換せず表示

## 現在のカード構成

抽選対象はDeck 01の全78枚です。

`data/rws-cards.json` はCARD COREとして、カードID、番号、英語名、スート、ランクと、正位置／逆位置それぞれの中立的な `themes` だけを持ちます。ここにはユーザー表示用のキーワードや意味文を置きません。

Deck 01では、画像・Visual Motif・TODAY'S QUESTIONを `decks/deck-01/deck.json`、正逆のKEYWORDSとMEANINGを `decks/deck-01/content.json` に保存しています。表示文章はすべてDeck固有で、CARD COREからの表示fallbackはありません。同じ日は引き直せません。

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
2. `deck.json`へメタデータ、Visual Motif、正逆のQUESTIONを記入し、`cards/`へ78枚、同じ階層へ`back.png`を置きます。
3. `content.json`へ78枚すべての正逆KEYWORDSとMEANINGを記入します。
4. `decks/index.json`へ1件登録します。
5. 次のvalidatorを実行します。

```bash
node tools/validate-deck.cjs deck-02
```

新しいDeckの文章はCARD COREの `themes` をsemantic guardrailとして参照しつつ、そのDeck独自の焦点・語り口で制作します。共有表示文章によるfallbackはないため、有効化する前に78枚すべての表示コンテンツを完成させます。

HTML、CSS、アプリ本体、Service WorkerへDeck 02のパスを追記する必要はありません。現行のデータ契約は`decks/_template/README.md`を参照してください。`NEW_DECK_TEMPLATE.md`はDeck 02の制作方針を決める際にCARD CORE方式へ全面更新する予定です。

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
