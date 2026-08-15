# 新規デッキ雛形

このフォルダを `decks/deck-02/` のような新しいDeck IDへコピーして使用します。

1. `deck.json` の `id`、名前、説明、代表カード、QUESTION、Visual Motifを編集します。
2. `content.json` に78枚すべての正位置／逆位置 `keywords` と `meaning` を用意します。
3. `cards/` に、`cardId.png` という名前で612×1206pxのPNGを78枚置きます。
4. この階層に612×1206pxの共通裏面を `back.png` として置きます。
5. `decks/index.json` の `decks` に1件登録します。
6. リポジトリのルートで `node tools/validate-deck.cjs deck-02` を実行します。

## CARD COREとDeckの役割

`data/rws-cards.json` は78枚共通のCARD COREです。カードID、番号、英名、suit、rankと、正位置／逆位置それぞれの中立的な `themes` だけを持ちます。

CARD COREの `themes` は「そのカードをどこまでの意味として解釈してよいか」を固定するためのsemantic guardrailです。ユーザーへ直接表示する文章ではありません。CARD COREに `keywords` や `meaning` を追加しないでください。

ユーザー向けの表示内容は各Deckが所有します。

- `deck.json`: 画像、Visual Motif、QUESTION
- `content.json`: KEYWORDS、MEANING

`deck.json` の各カードには正位置／逆位置の `question` を記入します。

```json
"upright": {
  "question": "..."
}
```

`content.json` には78枚すべてについて、正位置／逆位置の `keywords` と `meaning` が必須です。

```json
"upright": {
  "keywords": ["...", "..."],
  "meaning": "..."
}
```

`question` は通常 `deck.json` の値を使用します。特殊な理由でDeck内の表示文章と一緒に管理したい場合は `content.json` から上書きできますが、同じ文を二重管理しないでください。

共有表示文章へのfallbackはありません。新しいDeckを有効化する前に、78枚すべてのDeck固有 `keywords` / `meaning` とQUESTIONを完成させてください。

Deck 01は `deck.json` にQUESTIONとVisual Motif、`content.json` に78枚すべてのDeck固有 `keywords` / `meaning` を置く構成です。

`cards/` には説明用のこのファイル以外、雛形画像を置いていません。
