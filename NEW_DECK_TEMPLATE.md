# ONE CARD — NEW DECK TEMPLATE

最終更新: 2026-08-15
対象: `xxzr07/one-card-tarot` の最新 `main`

この文書は、新しい78枚デッキを **企画 → 文章設計 → ビジュアル設計 → 試作 → 量産 → アプリ組み込み → QA** まで進めるための制作仕様兼フォームです。

旧構造の履歴資料ではありません。新規Deck制作では、この文書・`data/rws-cards.json`・`decks/_template/`・`tools/validate-deck.cjs` を現行の基準とします。

---

# 0. 最重要原則

## 0.1 CARD COREとDeckを分ける

ONE CARDでは、78枚共通のCARD COREと各Deckの表現を分離します。

```text
CARD CORE
= そのカードとして解釈できる意味の範囲

Deck
= その範囲のどこへ焦点を当て、どう見せるか
```

`data/rws-cards.json` はCARD COREです。

CARD COREが持つもの:

- `cardId`
- 番号
- 英語名
- suit
- rank
- 正位置／逆位置の `themes`

CARD COREが**持たないもの**:

- ユーザー表示用KEYWORDS
- ユーザー表示用MEANING
- QUESTION
- Deck固有の画像・モチーフ・語り口

CARD COREの `themes` はsemantic guardrailです。ユーザーへ直接表示しません。

## 0.2 ユーザー向け表示内容はDeckが所有する

各Deckは最低限、次を78枚すべてについて持ちます。

```text
deck.json
├─ image
├─ visualMotif
├─ upright.question
└─ reversed.question

content.json
├─ upright.keywords
├─ upright.meaning
├─ reversed.keywords
└─ reversed.meaning
```

共有表示文章へのfallbackはありません。

**有効化するDeckは78枚すべての表示コンテンツを完成させる必要があります。**

## 0.3 Deck 01を自動継承しない

Deck 01 — QUIET GEOMETRYは一つの作品例です。

次の要素は、新しいDeckへ自動継承しません。

- 幾何学中心の画風
- 人物を描かない方針
- 紙・鉱物・金の質感
- Deck 01の文章の抽象度
- Deck 01のQUESTIONの文型
- Deck 01の正逆の捉え方

共通なのはCARD CORE、カードID、画像技術契約、アプリの動作です。

---

# 1. 現行アーキテクチャ

## 1.1 データの責任分離

| 層 | 正本 | 役割 |
|---|---|---|
| CARD CORE | `data/rws-cards.json` | 78枚の識別情報と意味範囲 |
| Deck registry | `decks/index.json` | Deckの登録順・有効化・初期Deck |
| Deck manifest | `decks/deck-XX/deck.json` | メタデータ、画像、Visual Motif、QUESTION |
| Deck copy | `decks/deck-XX/content.json` | 78枚のDeck固有KEYWORDS / MEANING |
| Images | `decks/deck-XX/cards/` | 表面78枚 |
| Back | `decks/deck-XX/back.png` | Deck共通裏面 |

## 1.2 CARD CORE例

```json
{
  "cardId": "major-09",
  "number": "IX",
  "nameEn": "THE HERMIT",
  "suit": "major",
  "rank": "09",
  "core": {
    "upright": ["内省", "探求", "距離", "導き"],
    "reversed": ["孤立", "閉鎖", "遠ざかる導き", "過度な距離"]
  }
}
```

この語群をそのまま表示文として使う必要はありません。

Deckは、この範囲から外れないように独自の焦点・語彙・比喩を設計します。

## 1.3 `deck.json`例

```json
{
  "schemaVersion": 2,
  "id": "deck-02",
  "contentVersion": "1.0.0",
  "name": "DECK 02",
  "subtitle": "SUBTITLE",
  "description": "短い説明",
  "previewCardId": "major-00",
  "backImage": "./back.png",
  "imageSpec": {
    "width": 612,
    "height": 1206,
    "format": "png"
  },
  "cards": {
    "major-00": {
      "image": "./cards/major-00.png",
      "visualMotif": "このDeckでの視覚モチーフ",
      "upright": {
        "question": "このDeck固有の問い"
      },
      "reversed": {
        "question": "このDeck固有の問い"
      }
    }
  }
}
```

## 1.4 `content.json`例

```json
{
  "schemaVersion": 1,
  "contentVersion": "1.0.0",
  "cards": {
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
  }
}
```

QUESTIONは通常 `deck.json` にだけ置きます。同じQUESTIONを `content.json` に二重保存しません。

---

# 2. Deck企画フォーム

新しいDeckを作る前に、まずここを埋めます。

## 2.1 Identity

- **Deck ID**: `deck-__`
- **contentVersion**: `1.0.0`
- **表示名**:
- **サブタイトル**:
- **一文コンセプト**:
- **短い説明**:
- **このDeckを使う目的**:
- **使った人に残したい感覚**:
- **代表カード候補**:
- **Deck 01との最も大きな違い**:

## 2.2 Interpretive Lens

- **このDeckがカードを見る角度**:
- **時間軸**: 現在 / 未来 / 過去 / 時間を限定しない
- **主に向ける視点**: 自分 / 状況 / 関係 / 選択 / 身体 / 創作 / その他
- **明るいカードの扱い**:
- **重いカードの扱い**:
- **逆位置の基本思想**:
- **逆位置で使う主な変化**: 内在化 / 過剰 / 不足 / 停滞 / 回復 / 解放 / 再調整 / その他
- **このDeckで扱わない解釈**:

## 2.3 Text Voice

- **KEYWORDSの役割**:
- **KEYWORDSの数**:
- **MEANINGの役割**:
- **MEANINGの長さ**:
- **MEANINGの視点**:
- **QUESTIONの役割**:
- **QUESTIONの抽象度**: 具体 / 中間 / 抽象
- **QUESTIONが向ける対象**:
- **QUESTIONの長さ**:
- **避ける言い回し**:

## 2.4 Visual Identity

- **主要な光景・空間**:
- **基本色**:
- **アクセント色**:
- **明暗レンジ**:
- **光の扱い**:
- **質感**:
- **線**:
- **人物表現**:
- **顔の扱い**:
- **背景**:
- **余白**:
- **反復モチーフ**:
- **枠**:
- **カード内文字**:
- **大アルカナの統一規則**:
- **小アルカナの統一規則**:
- **Courtの区別方法**:
- **避ける表現**:

## 2.5 Suit Language

小アルカナを78枚の後半として扱わず、各Suitに独自の運動を持たせます。

- **WANDS — 何が動くSuitか**:
- **CUPS — 何が満ち引きするSuitか**:
- **SWORDS — 何を切り分けるSuitか**:
- **PENTACLES — 何が蓄積・定着するSuitか**:

各Suitについて次を定義します。

- 素材
- 空間
- 運動
- 色の扱い
- 象徴の置換ルール
- ACE → 10の物語
- PAGE / KNIGHT / QUEEN / KINGの差

## 2.6 Card Back

- **中心モチーフ**:
- **補助モチーフ**:
- **背景**:
- **色**:
- **質感**:
- **枠**:
- **180度回転時の見え方**:
- **縮小表示で残す要素**:
- **表面との共通要素**:

---

# 3. 文章制作ルール

## 3.1 CARD COREからDeck文章を作る

各カードは次の順で設計します。

1. `data/rws-cards.json` の正逆 `core` を確認する。
2. そのカードの意味範囲を一文で言い換える。
3. このDeckがその範囲のどこを照らすか決める。
4. KEYWORDSを作る。
5. MEANINGを作る。
6. Visual Motifを決める。
7. QUESTIONを作る。
8. Core / Keywords / Meaning / Visual / Questionが一本の線で説明できるか確認する。

## 3.2 KEYWORDS

推奨:

- 3〜4語を基本にする。
- 一目でカードの温度が分かる語を置く。
- Deck固有の焦点を反映する。
- 正位置=善、逆位置=悪という単純な分割にしない。

避ける:

- 人格断定
- 未来予言
- 行動指示
- 同じ語の過剰反復
- Coreから意味が逸脱するほどの独自解釈

## 3.3 MEANING

MEANINGは「このカードなら何をすべきか」ではなく、**このDeckから見たカードの現象・状態・力学**を書く場所です。

推奨:

- 未来を断定しない。
- 性格を断定しない。
- 吉凶判定にしない。
- heavy cardの痛み・喪失・制限・崩壊を消さない。
- bright cardの喜び・成功・希望・充足も弱めない。
- 逆位置を必ず悪化として扱わない。

## 3.4 QUESTION

QUESTIONの抽象度はDeckごとに決めます。

Deck 01のような象徴寄りでも、より具体的に日常へ接続しても構いません。

ただし共通して避けるもの:

- 「〜すべきですか」のような正解誘導
- 未来を当てる質問
- 他者の本心を断定させる質問
- 罪悪感を生む問い
- 一枚のカードから答えを決めてしまう問い

良いQUESTIONは、**カードの視点を自分の現実へ向ける入口**になります。

## 3.5 正逆の差

逆位置はDeckの思想として定義します。

使える軸の例:

- 外向き → 内向き
- 流れる → 詰まる
- 適量 → 過剰 / 不足
- 見える → 見えにくい
- 開く → 閉じる
- 動く → 停滞する
- 傷ついている → 回復し始める
- 結ばれている → 解放される

カードごとに最適な軸を選び、全逆位置を同じ「悪い版」にしません。

---

# 4. Visual制作ルール

## 4.1 技術契約

全Deck共通:

| 項目 | 仕様 |
|---|---|
| 表面 | 78枚 |
| 裏面 | 1枚 |
| 寸法 | 612×1206px |
| 形式 | PNG |
| ファイル名 | `cardId.png` |
| 逆位置 | アプリ側で表面のみ180度回転 |

## 4.2 cardId命名

大アルカナ:

```text
major-00.png ～ major-21.png
```

小アルカナ:

```text
wands-ace.png
wands-02.png ～ wands-10.png
wands-page.png
wands-knight.png
wands-queen.png
wands-king.png
```

CUPS / SWORDS / PENTACLESも同じ形式です。

## 4.3 Visual Motif

`visualMotif` は単なる画像説明ではありません。

記録するもの:

- そのカードで最も重要な視覚構造
- Coreのどの意味を視覚化したか
- 他カードとの識別点

後からQUESTIONや画像を見直す際の橋渡しとして使います。

## 4.4 生成画像の扱い

画像生成を使う場合も、生成結果をそのまま78枚量産しません。

特に確認するもの:

- 数量
- 円・星・剣などの形
- 中心軸
- 人体
- パース
- 文字
- 左右差
- 余白
- Deck内の描画密度

文字・幾何形・枠など精度が重要な要素は、必要に応じて後工程で合成・補正します。

---

# 5. 制作フロー

## PHASE 0 — 基盤確認

- 最新 `main` を正本にする。
- `data/rws-cards.json` がCARD CORE形式であることを確認する。
- `decks/_template/` を確認する。
- 新Deck IDを決める。

完了条件:

- 旧RWS共通表示文章方式へ戻らないことが確認できている。

## PHASE 1 — Deck identity

2章のフォームを埋める。

この時点では78枚を作らない。

完了条件:

- 「何を見るDeckなのか」が一文で言える。
- Deck 01との差を説明できる。
- TextとVisualの両方に同じ思想が通っている。

## PHASE 2 — Representative Cards

まず6〜10枚で試作します。

推奨構成:

- 明るいMajor
- heavy Major
- 曖昧さを持つMajor
- WANDS 1枚
- CUPS 1枚
- SWORDS 1枚
- PENTACLES 1枚
- Court 1枚

比較に有効な候補:

- THE FOOL
- THE HERMIT
- THE TOWER
- THE STAR
- THE MOON
- THE SUN
- THE WORLD
- EIGHT OF SWORDS
- NINE OF CUPS
- NINE OF PENTACLES

各試作は、画像だけでなく **Core / Keywords / Meaning / Question / Visual Motif** をセットで作ります。

完了条件:

- Deck 01と並べても別Deckに見える。
- 同じCARD COREから別の焦点を作れている。
- QUESTIONの抽象度がこのDeckに合っている。

## PHASE 3 — Major Arcana 22

Major 22枚を先に完成させます。

見るポイント:

- 22枚を通した物語の流れ
- bright / heavy / ambiguousの温度差
- 逆位置の多様性
- Visualの統一性
- QUESTIONの使いやすさ

Major 22枚が成立しない段階でMinor 56枚へ進みません。

## PHASE 4 — Minor Arcana 56

Suitごとに進めます。

推奨順:

1. SuitのACE → 10の物語を決める。
2. ACE〜10のKeywords / Meaning / Visual Motif / Questionを作る。
3. PAGE / KNIGHT / QUEEN / KINGを作る。
4. Suit内QA。
5. 次のSuitへ進む。

4 Suit完成後に横断QAを行います。

## PHASE 5 — Card Back

- 612×1206px PNG。
- Deck固有。
- 表面と同じ作品に見える。
- 裏面から抽選結果や正逆を推測できない。
- 縮小表示でも成立する。

## PHASE 6 — App package

完成形:

```text
decks/deck-XX/
├─ deck.json
├─ content.json
├─ back.png
└─ cards/
   ├─ major-00.png
   └─ ...78枚
```

その後 `decks/index.json` へ登録します。

通常、新Deck追加だけで次を変更しません。

- `app.js`
- `index.html`
- `styles.css`
- `service-worker.js`

## PHASE 7 — Validation

最低限:

```bash
node tools/validate-deck.cjs deck-XX
```

新Deck追加後は既存Deckも壊れていないか確認します。

```bash
node tests/content-resolution.cjs
node tests/service-worker.cjs
node tools/validate-deck.cjs deck-01
node tools/validate-deck.cjs deck-XX
```

## PHASE 8 — Real-device QA

確認するもの:

- Deck picker
- 裏面切替
- 正位置
- 逆位置
- 明るいカード
- 暗いカード
- 長いカード名
- HISTORY
- snapshot
- ALTERNATE VIEW
- export / import
- offline
- iPhone縦画面
- safe area

---

# 6. QAチェックリスト

## 6.1 CARD CORE整合

- [ ] 78枚すべて既存 `cardId` と一致する。
- [ ] Coreの意味範囲から大きく逸脱していない。
- [ ] Coreの語をそのままコピーしただけのDeckになっていない。
- [ ] 正逆の焦点を説明できる。

## 6.2 Text

- [ ] 78枚×正逆のKEYWORDSがある。
- [ ] 78枚×正逆のMEANINGがある。
- [ ] 78枚×正逆のQUESTIONがある。
- [ ] KEYWORDS / MEANING / QUESTIONの役割が混ざっていない。
- [ ] bright cardの喜びが残っている。
- [ ] heavy cardの重さが消えていない。
- [ ] 逆位置が一律に悪い意味になっていない。
- [ ] 予言・診断・命令になっていない。
- [ ] 同じ構文・同じ語の機械的反復が目立たない。
- [ ] QUESTIONがDeckの目的に合った抽象度になっている。

## 6.3 Visual

- [ ] 78枚すべて612×1206px PNG。
- [ ] `cardId` とファイル名が一致する。
- [ ] 数量が正しい。
- [ ] 人体・パース・幾何形に破綻がない。
- [ ] 78枚一覧で色・密度・余白に重大な外れ値がない。
- [ ] MajorとMinorが同じDeckに見える。
- [ ] Suit同士は識別できるが、別Deckには見えない。
- [ ] Visual Motifと完成画像が一致する。

## 6.4 Data

- [ ] `deck.json` に78 IDある。
- [ ] `content.json` に78 IDある。
- [ ] QUESTIONを二重管理していない。
- [ ] CARD COREに表示用KEYWORDS / MEANINGを追加していない。
- [ ] `contentVersion` が適切。
- [ ] `decks/index.json` のDeck IDとmanifestが一致する。
- [ ] validatorが成功する。

## 6.5 Existing history

- [ ] Deck 01の既存version 2履歴がsnapshotで変わらず表示される。
- [ ] Deck 01の画像が新Deck追加によって置き換わらない。
- [ ] Deck IDを変更・再利用していない。
- [ ] ALTERNATE VIEW時だけ別Deckの現在コンテンツが表示される。

---

# 7. contentVersion

`contentVersion` はDeckのユーザー体験に影響する変更を追跡します。

目安:

- typo・意味を変えない軽微修正 → PATCH
- Keywords / Meaning / Question / Visualのまとまった改稿 → MINOR
- Deckの解釈思想やデータ契約を大きく変える → MAJOR

例:

```text
1.0.0 → 初回公開
1.0.1 → 軽微な文章修正
1.1.0 → 複数カードの文章・画像改稿
2.0.0 → Deckの解釈設計を大きく変更
```

version 2履歴ではドロー時点の表示文がsnapshotされるため、後からDeck本文を改稿しても過去の正式な読みは保持されます。

---

# 8. Deck 01から引き継ぐ知見

Deck 01の画風を継承するのではなく、**制作上の知見**を継承します。

- 代表カードを先に試す。
- 画像と文章を別々に完成させず、カード単位で整合を見る。
- 78枚一覧で外れ値を確認する。
- Minorを単なる記号の反復にしない。
- SuitにACE→10の流れを持たせる。
- bright / heavyの温度差を消さない。
- reverseを一律の失敗扱いにしない。
- 画像生成で数量・文字・幾何形を信用しすぎない。
- snapshot互換を壊さない。
- 新しいDeckのためにアプリ本体へDeck固有コードを書かない。

---

# 9. 新しいWorkセッションへの開始指示

新しいDeckを別セッションで制作する場合、最初に次を行います。

1. 最新 `main` を確認する。
2. `NEW_DECK_TEMPLATE.md` を読む。
3. `data/rws-cards.json` のCARD COREを確認する。
4. `decks/_template/` を確認する。
5. いきなり78枚を制作せず、2章の企画フォームから始める。
6. 代表カードを承認してからMajor 22へ進む。
7. Major 22をQAしてからMinor 56へ進む。
8. 新Deck固有のKEYWORDS / MEANING / QUESTIONを78枚すべて完成させる。
9. validatorと既存Deckの回帰テストを通す。
10. 最後に実機・PWA・履歴互換を確認する。

---

# 10. 新Deck開始用の最小フォーム

実際の会話では、まずこの10項目を決めれば開始できます。

```text
Deck ID:
表示名:
サブタイトル:
一文コンセプト:
何を見るためのDeckか:
Deck 01との違い:
文章の語調:
QUESTIONの抽象度:
Visualの中心表現:
避けたい表現:
```

これが固まったら、CARD COREを参照しながら代表カードの設計へ進みます。
