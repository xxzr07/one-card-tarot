# 新規Deckパッケージ雛形

このフォルダは、新しいDeckを追加するときの実ファイル雛形です。

制作方針・文章設計・QAの詳細は、リポジトリ直下の `NEW_DECK_TEMPLATE.md` を先に確認してください。

## 含まれるもの

```text
_template/
├─ deck.json       # 78枚の画像参照 / Visual Motif / QUESTION
├─ content.json    # 78枚のKEYWORDS / MEANING
├─ cards/          # 612×1206px PNGを78枚置く
└─ README.md
```

`back.png` は新Deck固有のものを制作して、この階層へ追加します。

## CARD COREとの関係

`data/rws-cards.json` は78枚共通のCARD COREです。

CARD COREには、カードID・番号・英名・suit・rankと、正逆それぞれの中立的な `themes` だけがあります。

`themes` はsemantic guardrailであり、ユーザーへ直接表示する文章ではありません。

新Deckでは、その意味範囲を守りながら独自の表示内容を制作します。

```text
CARD CORE
= そのカードとして解釈できる範囲

Deck
= その範囲のどこを、どう表現するか
```

## `deck.json`

78 IDがすでに入っています。

各カードについて埋めるもの:

- `visualMotif`
- `upright.question`
- `reversed.question`

画像パスは `./cards/<cardId>.png` の形で設定済みです。

例:

```json
"major-00": {
  "image": "./cards/major-00.png",
  "visualMotif": "...",
  "upright": {
    "question": "..."
  },
  "reversed": {
    "question": "..."
  }
}
```

Deck全体では次も変更します。

- `id`
- `contentVersion`
- `name`
- `subtitle`
- `description`
- `previewCardId`

## `content.json`

78 IDがすでに入っています。

各カードの正位置／逆位置について、空の `keywords` と `meaning` をDeck固有文章で埋めます。

例:

```json
"major-00": {
  "upright": {
    "keywords": ["...", "...", "..."],
    "meaning": "..."
  },
  "reversed": {
    "keywords": ["...", "...", "..."],
    "meaning": "..."
  }
}
```

共有表示文章へのfallbackはありません。

そのため、Deckを `enabled: true` で登録する前に78枚すべてを完成させます。

QUESTIONは通常 `deck.json` だけで管理します。同じQUESTIONを `content.json` に重複保存しません。

## 画像

`cards/` には次の仕様で78枚置きます。

- 612×1206px
- PNG
- ファイル名 = `cardId.png`

例:

```text
major-00.png
major-21.png
wands-ace.png
cups-05.png
swords-10.png
pentacles-king.png
```

裏面は同じ612×1206px PNGで `back.png` とします。

## 新Deck作成手順

1. `_template/` を `decks/deck-02/` のようにコピーする。
2. `deck.json` のDeckメタデータを変更する。
3. CARD COREを参照しながら代表カードを試作する。
4. `deck.json` のVisual Motif / QUESTIONを埋める。
5. `content.json` のKEYWORDS / MEANINGを埋める。
6. `cards/`へ78枚を置く。
7. `back.png`を置く。
8. `decks/index.json`へ登録する。
9. validatorを実行する。

```bash
node tools/validate-deck.cjs deck-02
```

新Deck追加だけで通常は `app.js`、`index.html`、`styles.css`、`service-worker.js` を変更しません。

## 完成条件

validatorが次を満たす必要があります。

- CARD COREと同じ78 ID
- Visual Motif 78件
- QUESTION 156件
- KEYWORDS 156件
- MEANING 156件
- 表面画像78枚
- 裏面1枚
- 画像寸法・形式一致
- ファイル名とcardId一致

Deck 01の文章・画像・QUESTIONを新Deckのfallbackとして使用しないでください。
