# 新規デッキ雛形

このフォルダを `decks/deck-02/` のような新しいDeck IDへコピーして使用します。

1. `deck.json` の `id`、名前、説明、代表カード、文章を編集します。
2. `cards/` に、`cardId.png` という名前で612×1206pxのPNGを78枚置きます。
3. この階層に612×1206pxの共通裏面を `back.png` として置きます。
4. `decks/index.json` の `decks` に1件登録します。
5. リポジトリのルートで `node tools/validate-deck.cjs deck-02` を実行します。

`deck.json` にはRWS 78 IDがすべて記入済みです。各カードの`question`は
正位置／逆位置とも必須です。Deck 01から自動補完されません。
`keywords`と`meaning`は`data/rws-cards.json`のRWS共通データを使うため、デッキ側には記入しません。

`cards/` には説明用のこのファイル以外、雛形画像を置いていません。
