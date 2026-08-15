# 新規デッキ雛形

このフォルダを `decks/deck-02/` のような新しいDeck IDへコピーして使用します。

1. `deck.json` の `id`、名前、説明、代表カード、文章を編集します。
2. `cards/` に、`cardId.png` という名前で612×1206pxのPNGを78枚置きます。
3. この階層に612×1206pxの共通裏面を `back.png` として置きます。
4. `decks/index.json` の `decks` に1件登録します。
5. リポジトリのルートで `node tools/validate-deck.cjs deck-02` を実行します。

`deck.json` にはRWS 78 IDがすべて記入済みです。各カードの正位置／逆位置にはデッキ固有の `question` を持たせます。`keywords` と `meaning` は `deck.json` に直接置くことも、同じDeckフォルダの `content.json` から上書きすることもできます。

```json
"upright": {
  "question": "..."
}
```

`content.json` を使用する場合は、ユーザー向け表示文章をカード単位で分離できます。各カードの正位置／逆位置には `keywords` と `meaning` を記入してください。`question` は `deck.json` の値をそのまま使用でき、特別に上書きしたい場合だけ `content.json` に指定できます。

```json
"upright": {
  "keywords": ["...", "..."],
  "meaning": "..."
}
```

移行中または未完成のデッキでは、デッキ固有の `keywords` / `meaning` がないカードに限り `data/rws-cards.json` の旧共通文章へfallbackします。このfallbackは互換用であり、新しく完成させるデッキでは78枚すべてにデッキ固有文章を用意することを推奨します。

Deck 01は `deck.json` にQUESTIONとVisual Motifを置き、`content.json` に78枚すべてのデッキ固有 `keywords` / `meaning` を置く構成です。

`cards/` には説明用のこのファイル以外、雛形画像を置いていません。
