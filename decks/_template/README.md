# 新規デッキ雛形

このフォルダを `decks/deck-02/` のような新しいDeck IDへコピーして使用します。

1. `deck.json` の `id`、名前、説明、代表カード、文章を編集します。
2. `cards/` に、`cardId.png` という名前で612×1206pxのPNGを78枚置きます。
3. この階層に612×1206pxの共通裏面を `back.png` として置きます。
4. `decks/index.json` の `decks` に1件登録します。
5. リポジトリのルートで `node tools/validate-deck.cjs deck-02` を実行します。

`deck.json` にはRWS 78 IDがすべて記入済みです。各カードの正位置／逆位置には、デッキ固有の `question` に加えて `keywords` と `meaning` を持たせられます。新しく作るデッキでは3項目すべてをデッキ固有で用意することを推奨します。

```json
"upright": {
  "keywords": ["...", "..."],
  "meaning": "...",
  "question": "..."
}
```

移行中の既存デッキでは、`keywords` / `meaning` がまだないカードに限り `data/rws-cards.json` の旧共通文章へfallbackします。このfallbackは全78枚のデッキ固有文章が完成するまでの一時互換です。

大量の既存 `deck.json` を安全に段階移行する場合は、同じフォルダに `content.json` を置いてカード文章だけを上書きできます。Deck 01はこの方法でMajor Arcanaから移行しています。`content.json` の各カードには正逆とも `keywords` / `meaning` / `question` をすべて記入してください。

`cards/` には説明用のこのファイル以外、雛形画像を置いていません。
