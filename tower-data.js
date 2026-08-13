(function exposeTowerData(root, factory) {
  "use strict";

  const data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  if (root) root.TowerData = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTowerData() {
  "use strict";

  const SCORE_KEYS = Object.freeze([
    "funds",
    "ore",
    "materials",
    "exploration",
    "recovery",
    "amplification",
    "level",
  ]);

  const SCORE_META = Object.freeze({
    funds: Object.freeze({ label: "資金", short: "資金S", color: "#edc84b", colorName: "黄" }),
    ore: Object.freeze({ label: "鉱石", short: "鉱石S", color: "#a8d83e", colorName: "黄緑" }),
    materials: Object.freeze({ label: "資材", short: "資材S", color: "#4f9ee8", colorName: "青" }),
    exploration: Object.freeze({ label: "探索", short: "探索S", color: "#f28b3c", colorName: "橙" }),
    recovery: Object.freeze({ label: "回復", short: "回復S", color: "#43bd72", colorName: "緑" }),
    amplification: Object.freeze({ label: "増幅", short: "増幅S", color: "#9c6ade", colorName: "紫" }),
    level: Object.freeze({ label: "LEVEL", short: "LEVEL S", color: "#f06aa8", colorName: "ピンク" }),
  });

  const CONVERSION_ORDER = Object.freeze([
    "funds",
    "exploration",
    "materials",
    "recovery",
    "amplification",
    "level",
  ]);

  const LOW_WIDTH_ORES = Object.freeze([
    "ヘビーメタル",
    "オリハルコン",
    "飛行石",
    "シューティングスター",
    "ダークマター",
    "ヘビーメタルsec-03",
    "ライデン・クロガネ",
    "ヒヒイロカネ",
    "グラビティ飛行石",
    "ハートブレイク",
    "CAT'S EYE",
    "コスモポータル",
  ]);

  const LOW_WIDTH_UPPER_ORES = Object.freeze([
    "ハートブレイク",
    "CAT'S EYE",
    "コスモポータル",
  ]);

  const HIGH_WIDTH_ORES = Object.freeze([
    "ヘビーメタル",
    "オリハルコン",
    "飛行石",
    "シューティングスター",
    "ヘビーメタルsec-03",
    "ライデン・クロガネ",
    "ヒヒイロカネ",
    "コスモポータル",
    "小さなメタル",
  ]);

  const HIGH_WIDTH_RARE_ORES = Object.freeze([
    "オメガデバイス",
    "ノットエンプティ",
    "エアブレイン",
  ]);

  function freezeNode(node) {
    return Object.freeze({ ...node });
  }

  function floor(number, rows, nodes, note) {
    return Object.freeze({
      number,
      rows,
      columns: 15,
      note,
      nodes: Object.freeze(nodes.map(freezeNode)),
    });
  }

  const FLOORS = Object.freeze([
    floor(
      7,
      4,
      [
        { id: "7f-wall-east", row: 1, column: 12, type: "wall", label: "通行止め" },
        { id: "7f-world-end", row: 1, column: 15, type: "reward", label: "ワールドエンド", item: "ワールドエンド", amount: 1, importance: "ultimate" },
        { id: "7f-wall-center", row: 3, column: 10, type: "wall", label: "通行止め" },
        { id: "7f-ore-1000", row: 4, column: 15, type: "gate", label: "鉱石S −1000", score: "ore", cost: 1000, importance: "ultimate" },
      ],
      "最上階。鉱石スコア1000の先にワールドエンド。",
    ),
    floor(
      6,
      8,
      [
        { id: "6f-small-recovery", row: 2, column: 3, type: "gate", label: "回復S −50", score: "recovery", cost: 50, rewardItem: "小さなメタル", rewardAmount: 1 },
        { id: "6f-small-amplification", row: 2, column: 4, type: "gate", label: "増幅S −50", score: "amplification", cost: 50, rewardItem: "小さなメタル", rewardAmount: 1 },
        { id: "6f-small-level", row: 2, column: 5, type: "gate", label: "LEVEL S −50", score: "level", cost: 50, rewardItem: "小さなメタル", rewardAmount: 1 },
        { id: "6f-small-exploration", row: 3, column: 3, type: "gate", label: "探索S −50", score: "exploration", cost: 50, rewardItem: "小さなメタル", rewardAmount: 1 },
        { id: "6f-small-funds", row: 3, column: 4, type: "gate", label: "資金S −50", score: "funds", cost: 50, rewardItem: "小さなメタル", rewardAmount: 1 },
        { id: "6f-small-materials", row: 3, column: 5, type: "gate", label: "資材S −50", score: "materials", cost: 50, rewardItem: "小さなメタル", rewardAmount: 1 },
        { id: "6f-wall-a", row: 3, column: 6, type: "wall", label: "通行止め" },
        { id: "6f-wall-b", row: 3, column: 7, type: "wall", label: "通行止め" },
        { id: "6f-wall-c", row: 3, column: 8, type: "wall", label: "通行止め" },
        { id: "6f-wall-d", row: 3, column: 9, type: "wall", label: "通行止め" },
        { id: "6f-wall-e", row: 4, column: 1, type: "wall", label: "通行止め" },
        { id: "6f-box-large", row: 4, column: 7, type: "box-large", label: "Sボックス（大）" },
        { id: "6f-converter", row: 4, column: 8, type: "converter", label: "S変換器 100", amount: 100 },
        { id: "6f-wall-f", row: 4, column: 10, type: "wall", label: "通行止め" },
        { id: "6f-wall-g", row: 4, column: 12, type: "wall", label: "通行止め" },
        { id: "6f-ore-100-a", row: 5, column: 1, type: "gate", label: "鉱石S −100", score: "ore", cost: 100 },
        { id: "6f-exploration-100-a", row: 6, column: 1, type: "gate", label: "探索S −100", score: "exploration", cost: 100 },
        { id: "6f-materials-100", row: 7, column: 1, type: "gate", label: "資材S −100", score: "materials", cost: 100 },
        { id: "6f-wall-h", row: 7, column: 15, type: "wall", label: "通行止め" },
        { id: "6f-recovery-100", row: 8, column: 1, type: "gate", label: "回復S −100", score: "recovery", cost: 100 },
        { id: "6f-amplification-100", row: 8, column: 2, type: "gate", label: "増幅S −100", score: "amplification", cost: 100 },
        { id: "6f-funds-100", row: 8, column: 3, type: "gate", label: "資金S −100", score: "funds", cost: 100 },
        { id: "6f-level-100", row: 8, column: 4, type: "gate", label: "LEVEL S −100", score: "level", cost: 100 },
        { id: "6f-scp", row: 8, column: 5, type: "reward", label: "SCP-060F", item: "SCP-060F", amount: 1, importance: "rare" },
        { id: "6f-exploration-100-b", row: 8, column: 7, type: "gate", label: "探索S −100", score: "exploration", cost: 100 },
        { id: "6f-ore-100-b", row: 8, column: 8, type: "gate", label: "鉱石S −100", score: "ore", cost: 100 },
      ],
      "小さなメタル6個、SCP-060F、100点変換器がある階。",
    ),
    floor(
      5,
      5,
      [
        { id: "5f-level-50-a", row: 1, column: 6, type: "gate", label: "LEVEL S −50", score: "level", cost: 50 },
        { id: "5f-ore-challenge", row: 1, column: 9, type: "destination", label: "鉱石チャレンジへ", destination: "鉱石チャレンジ" },
        { id: "5f-master-key", row: 2, column: 2, type: "key-reward", label: "マスターキー", amount: 1 },
        { id: "5f-materials-80", row: 2, column: 3, type: "gate", label: "資材S −80", score: "materials", cost: 80 },
        { id: "5f-omega", row: 2, column: 4, type: "reward", label: "オメガデバイス", item: "オメガデバイス", amount: 1, importance: "rare" },
        { id: "5f-amplification-80", row: 2, column: 5, type: "gate", label: "増幅S −80", score: "amplification", cost: 80 },
        { id: "5f-heartbreak", row: 2, column: 6, type: "reward", label: "ハートブレイク ×4", item: "ハートブレイク", amount: 4 },
        { id: "5f-ore-50-a", row: 2, column: 7, type: "gate", label: "鉱石S −50", score: "ore", cost: 50 },
        { id: "5f-recovery-50", row: 2, column: 8, type: "gate", label: "回復S −50", score: "recovery", cost: 50 },
        { id: "5f-converter", row: 2, column: 9, type: "converter", label: "S変換器 100", amount: 100 },
        { id: "5f-box-large", row: 2, column: 11, type: "box-large", label: "Sボックス（大）" },
        { id: "5f-box-small", row: 2, column: 12, type: "box-small", label: "Sボックス（小）" },
        { id: "5f-mirror", row: 2, column: 14, type: "reward", label: "四次元ミラー", item: "四次元ミラー", amount: 1 },
        { id: "5f-materials-70", row: 3, column: 7, type: "gate", label: "資材S −70", score: "materials", cost: 70 },
        { id: "5f-sec03", row: 3, column: 8, type: "reward", label: "HM sec-03 ×4", item: "ヘビーメタルsec-03", amount: 4 },
        { id: "5f-exploration-50", row: 3, column: 9, type: "gate", label: "探索S −50", score: "exploration", cost: 50 },
        { id: "5f-funds-100", row: 3, column: 10, type: "gate", label: "資金S −100", score: "funds", cost: 100 },
        { id: "5f-key-gate", row: 3, column: 13, type: "key-gate", label: "マスターキー −1", cost: 1 },
        { id: "5f-funds-50", row: 4, column: 2, type: "gate", label: "資金S −50", score: "funds", cost: 50 },
        { id: "5f-ore-80-a", row: 4, column: 4, type: "gate", label: "鉱石S −80", score: "ore", cost: 80 },
        { id: "5f-wall", row: 4, column: 6, type: "wall", label: "通行止め" },
        { id: "5f-level-50-b", row: 4, column: 8, type: "gate", label: "LEVEL S −50", score: "level", cost: 50 },
        { id: "5f-assets-1000", row: 4, column: 9, type: "asset", label: "総資産 +1000", amount: 1000 },
        { id: "5f-recovery-100", row: 4, column: 13, type: "gate", label: "回復S −100", score: "recovery", cost: 100 },
        { id: "5f-exploration-50-b", row: 5, column: 2, type: "gate", label: "探索S −50", score: "exploration", cost: 50 },
        { id: "5f-ore-50-b", row: 5, column: 9, type: "gate", label: "鉱石S −50", score: "ore", cost: 50 },
        { id: "5f-ore-80-b", row: 5, column: 13, type: "gate", label: "鉱石S −80", score: "ore", cost: 80 },
        { id: "5f-wafer", row: 5, column: 15, type: "reward", label: "11次元式ねじれウエハー", item: "11次元式ねじれウエハー", amount: 1, importance: "rare" },
      ],
      "大型・小型スコアボックスと鉱石チャレンジ出口がある階。",
    ),
    floor(
      4,
      5,
      [
        { id: "4f-key-gate", row: 1, column: 7, type: "key-gate", label: "マスターキー −1", cost: 1 },
        { id: "4f-level-60", row: 1, column: 11, type: "gate", label: "LEVEL S −60", score: "level", cost: 60 },
        { id: "4f-amplification-100", row: 1, column: 14, type: "gate", label: "増幅S −100", score: "amplification", cost: 100 },
        { id: "4f-wall-a", row: 2, column: 6, type: "wall", label: "通行止め" },
        { id: "4f-assets-300-a", row: 2, column: 7, type: "asset", label: "総資産 +300", amount: 300 },
        { id: "4f-assets-500-a", row: 2, column: 8, type: "asset", label: "総資産 +500", amount: 500 },
        { id: "4f-recovery-30", row: 2, column: 9, type: "gate", label: "回復S −30", score: "recovery", cost: 30 },
        { id: "4f-dark-matter", row: 2, column: 10, type: "reward", label: "ダークマター ×4", item: "ダークマター", amount: 4 },
        { id: "4f-cosmo", row: 2, column: 11, type: "reward", label: "コスモポータル ×4", item: "コスモポータル", amount: 4 },
        { id: "4f-box-large", row: 2, column: 13, type: "box-large", label: "Sボックス（大）" },
        { id: "4f-assets-500-b", row: 2, column: 14, type: "asset", label: "総資産 +500", amount: 500 },
        { id: "4f-assets-500-c", row: 3, column: 7, type: "asset", label: "総資産 +500", amount: 500 },
        { id: "4f-assets-300-b", row: 3, column: 8, type: "asset", label: "総資産 +300", amount: 300 },
        { id: "4f-shooting-star", row: 3, column: 11, type: "reward", label: "シューティングスター ×4", item: "シューティングスター", amount: 4 },
        { id: "4f-recovery-40", row: 3, column: 12, type: "gate", label: "回復S −40", score: "recovery", cost: 40 },
        { id: "4f-assets-500-d", row: 3, column: 14, type: "asset", label: "総資産 +500", amount: 500 },
        { id: "4f-wall-b", row: 4, column: 4, type: "wall", label: "通行止め" },
        { id: "4f-wall-c", row: 4, column: 5, type: "wall", label: "通行止め" },
        { id: "4f-materials-40", row: 4, column: 7, type: "gate", label: "資材S −40", score: "materials", cost: 40 },
        { id: "4f-level-40-a", row: 4, column: 8, type: "gate", label: "LEVEL S −40", score: "level", cost: 40 },
        { id: "4f-ore-40", row: 4, column: 10, type: "gate", label: "鉱石S −40", score: "ore", cost: 40 },
        { id: "4f-funds-40", row: 4, column: 13, type: "gate", label: "資金S −40", score: "funds", cost: 40 },
        { id: "4f-level-40-b", row: 4, column: 14, type: "gate", label: "LEVEL S −40", score: "level", cost: 40 },
        { id: "4f-exploration-10", row: 5, column: 1, type: "gate", label: "探索S −10", score: "exploration", cost: 10 },
        { id: "4f-level-40-c", row: 5, column: 2, type: "gate", label: "LEVEL S −40", score: "level", cost: 40 },
        { id: "4f-amplification-80", row: 5, column: 11, type: "gate", label: "増幅S −80", score: "amplification", cost: 80 },
        { id: "4f-brain-choice", row: 5, column: 15, type: "choice-reward", label: "ホムンクルスの頭脳 / ノットエンプティ", choices: ["ホムンクルスの頭脳", "ノットエンプティ"] },
      ],
      "総資産が多く、大型スコアボックスと二択報酬がある階。",
    ),
    floor(
      3,
      5,
      [
        { id: "3f-key-gate", row: 1, column: 10, type: "key-gate", label: "マスターキー −1", cost: 1 },
        { id: "3f-ore-70", row: 1, column: 13, type: "gate", label: "鉱石S −70", score: "ore", cost: 70 },
        { id: "3f-orichalcum", row: 2, column: 8, type: "reward", label: "オリハルコン ×4", item: "オリハルコン", amount: 4 },
        { id: "3f-box-small", row: 2, column: 9, type: "box-small", label: "Sボックス（小）" },
        { id: "3f-amplification-40", row: 2, column: 11, type: "gate", label: "増幅S −40", score: "amplification", cost: 40 },
        { id: "3f-assets-300", row: 2, column: 13, type: "asset", label: "総資産 +300", amount: 300 },
        { id: "3f-hihiirokane", row: 2, column: 14, type: "reward", label: "ヒヒイロカネ ×4", item: "ヒヒイロカネ", amount: 4 },
        { id: "3f-flying-stone", row: 3, column: 8, type: "reward", label: "飛行石 ×4", item: "飛行石", amount: 4 },
        { id: "3f-assets-100", row: 3, column: 9, type: "asset", label: "総資産 +100", amount: 100 },
        { id: "3f-level-40", row: 3, column: 11, type: "gate", label: "LEVEL S −40", score: "level", cost: 40 },
        { id: "3f-cats-eye", row: 3, column: 13, type: "reward", label: "CAT'S EYE", item: "CAT'S EYE", amount: 1, importance: "rare" },
        { id: "3f-gravity", row: 3, column: 14, type: "reward", label: "グラビティ飛行石 ×4", item: "グラビティ飛行石", amount: 4 },
        { id: "3f-wall", row: 4, column: 5, type: "wall", label: "通行止め" },
        { id: "3f-amplification-30-a", row: 4, column: 9, type: "gate", label: "増幅S −30", score: "amplification", cost: 30 },
        { id: "3f-recovery-30", row: 4, column: 10, type: "gate", label: "回復S −30", score: "recovery", cost: 30 },
        { id: "3f-exploration-10", row: 5, column: 1, type: "gate", label: "探索S −10", score: "exploration", cost: 10 },
        { id: "3f-amplification-30-b", row: 5, column: 2, type: "gate", label: "増幅S −30", score: "amplification", cost: 30 },
        { id: "3f-materials-70", row: 5, column: 11, type: "gate", label: "資材S −70", score: "materials", cost: 70 },
        { id: "3f-suha", row: 5, column: 15, type: "reward", label: "スイハ", item: "スイハ", amount: 1, importance: "rare" },
      ],
      "小型スコアボックスとCAT'S EYE、スイハがある階。",
    ),
    floor(
      2,
      5,
      [
        { id: "2f-assets-100-a", row: 2, column: 4, type: "asset", label: "総資産 +100", amount: 100 },
        { id: "2f-assets-100-b", row: 2, column: 5, type: "asset", label: "総資産 +100", amount: 100 },
        { id: "2f-shooting-star", row: 2, column: 7, type: "reward", label: "シューティングスター ×4", item: "シューティングスター", amount: 4 },
        { id: "2f-dark-matter", row: 2, column: 8, type: "reward", label: "ダークマター ×4", item: "ダークマター", amount: 4 },
        { id: "2f-sec03", row: 2, column: 10, type: "reward", label: "HM sec-03 ×4", item: "ヘビーメタルsec-03", amount: 4 },
        { id: "2f-heavy-a", row: 2, column: 11, type: "reward", label: "ヘビーメタル ×4", item: "ヘビーメタル", amount: 4 },
        { id: "2f-assets-100-c", row: 3, column: 4, type: "asset", label: "総資産 +100", amount: 100 },
        { id: "2f-assets-100-d", row: 3, column: 5, type: "asset", label: "総資産 +100", amount: 100 },
        { id: "2f-heavy-b", row: 3, column: 10, type: "reward", label: "ヘビーメタル ×4", item: "ヘビーメタル", amount: 4 },
        { id: "2f-ore-20", row: 4, column: 5, type: "gate", label: "鉱石S −20", score: "ore", cost: 20 },
        { id: "2f-funds-20", row: 4, column: 7, type: "gate", label: "資金S −20", score: "funds", cost: 20 },
        { id: "2f-recovery-30", row: 4, column: 10, type: "gate", label: "回復S −30", score: "recovery", cost: 30 },
        { id: "2f-materials-10", row: 4, column: 11, type: "gate", label: "資材S −10", score: "materials", cost: 10 },
        { id: "2f-wall-a", row: 4, column: 13, type: "wall", label: "通行止め" },
        { id: "2f-exploration-10", row: 5, column: 1, type: "gate", label: "探索S −10", score: "exploration", cost: 10 },
        { id: "2f-recovery-20", row: 5, column: 2, type: "gate", label: "回復S −20", score: "recovery", cost: 20 },
        { id: "2f-wall-b", row: 5, column: 14, type: "wall", label: "通行止め" },
        { id: "2f-mystery-box", row: 5, column: 15, type: "reward", label: "謎の箱", item: "謎の箱", amount: 1 },
      ],
      "鉱石と総資産を回収しながら上へ進む階。",
    ),
    floor(
      1,
      6,
      [
        { id: "1f-assets-100", row: 2, column: 4, type: "asset", label: "総資産 +100", amount: 100 },
        { id: "1f-heavy", row: 2, column: 6, type: "reward", label: "ヘビーメタル ×4", item: "ヘビーメタル", amount: 4 },
        { id: "1f-rare-a", row: 2, column: 8, type: "reward", label: "レアメタル ×4", item: "レアメタル", amount: 4 },
        { id: "1f-converter", row: 2, column: 10, type: "converter", label: "S変換器 50", amount: 50 },
        { id: "1f-master-key", row: 2, column: 12, type: "key-reward", label: "マスターキー", amount: 1 },
        { id: "1f-rare-b", row: 3, column: 8, type: "reward", label: "レアメタル ×4", item: "レアメタル", amount: 4 },
        { id: "1f-funds-10", row: 4, column: 4, type: "gate", label: "資金S −10", score: "funds", cost: 10 },
        { id: "1f-ore-10", row: 4, column: 6, type: "gate", label: "鉱石S −10", score: "ore", cost: 10 },
        { id: "1f-level-10", row: 4, column: 8, type: "gate", label: "LEVEL S −10", score: "level", cost: 10 },
        { id: "1f-materials-20", row: 4, column: 10, type: "gate", label: "資材S −20", score: "materials", cost: 20 },
        { id: "1f-exploration-50", row: 4, column: 12, type: "gate", label: "探索S −50", score: "exploration", cost: 50 },
        { id: "1f-wall", row: 4, column: 14, type: "wall", label: "通行止め" },
      ],
      "開始階。50点変換器とマスターキーを回収できる。",
    ),
  ]);

  // Exact black-cell layout from the Wiki map table. `#` is black/impassable;
  // `.` is a floor cell. Rows are ordered 7F top -> 1F entrance bottom.
  const MAP_SHAPE = Object.freeze([
    "#.####..###.##.",
    "#.#..#..#.#.##.",
    "#.#..#..#.#.##.",
    ".............#.",
    ".#####..######.",
    ".#...#..#.#.##.",
    ".#........#.##.",
    ".#.#.#..#.#.##.",
    "...............",
    ".#####..######.",
    ".#####..######.",
    ".....#..#......",
    "#####....######",
    "#........#..#.#",
    "#.#.#.........#",
    "#.#.#....###.##",
    "...............",
    "..####.###.##.#",
    "..#........#..#",
    "..#..#..#.....#",
    "..#..#..#.##..#",
    "...............",
    "..#######.##.##",
    "..#...#.......#",
    "..#...#.......#",
    "..##.###..#####",
    "...............",
    "..#############",
    "..#..#..#..#..#",
    "..#..#..#..#..#",
    "..##.#.##..#..#",
    "...............",
    "..#############",
    "..#.#.#.#.#.#.#",
    "..#.#.#.#.#.#.#",
    "..#.#.#.#.#.#.#",
    "...............",
    "#.#############",
  ]);

  const TOWER_COLUMNS = 15;
  const TOWER_ROWS = FLOORS.reduce((sum, towerFloor) => sum + towerFloor.rows, 0);
  const START_POSITION = Object.freeze({ row: TOWER_ROWS, column: 2 });

  if (MAP_SHAPE.length !== TOWER_ROWS || MAP_SHAPE.some((row) => row.length !== TOWER_COLUMNS)) {
    throw new Error("tower map shape does not match its declared dimensions");
  }

  let nextGlobalRow = 1;
  const FLOOR_BANDS = Object.freeze(
    FLOORS.map((towerFloor) => {
      const band = Object.freeze({
        floor: towerFloor.number,
        startRow: nextGlobalRow,
        endRow: nextGlobalRow + towerFloor.rows - 1,
        rows: towerFloor.rows,
        note: towerFloor.note,
      });
      nextGlobalRow = band.endRow + 1;
      return band;
    }),
  );

  const ALL_NODES = Object.freeze(FLOORS.flatMap((towerFloor) => towerFloor.nodes));
  const NODE_BY_ID = Object.freeze(
    Object.fromEntries(ALL_NODES.map((node) => [node.id, node])),
  );

  const GLOBAL_NODES = Object.freeze(
    FLOORS.flatMap((towerFloor) => {
      const band = FLOOR_BANDS.find((candidate) => candidate.floor === towerFloor.number);
      return towerFloor.nodes.map((node) => Object.freeze({
        ...node,
        floor: towerFloor.number,
        globalRow: band.startRow + node.row - 1,
        globalColumn: node.column,
      }));
    }),
  );
  const GLOBAL_NODE_BY_ID = Object.freeze(
    Object.fromEntries(GLOBAL_NODES.map((node) => [node.id, node])),
  );
  const GLOBAL_NODE_BY_COORDINATE = Object.freeze(
    Object.fromEntries(GLOBAL_NODES.map((node) => [`${node.globalRow}:${node.globalColumn}`, node])),
  );

  return Object.freeze({
    ALL_NODES,
    CONVERSION_ORDER,
    FLOOR_BANDS,
    FLOORS,
    GLOBAL_NODES,
    GLOBAL_NODE_BY_COORDINATE,
    GLOBAL_NODE_BY_ID,
    HIGH_WIDTH_ORES,
    HIGH_WIDTH_RARE_ORES,
    LOW_WIDTH_ORES,
    LOW_WIDTH_UPPER_ORES,
    MAP_SHAPE,
    NODE_BY_ID,
    SCORE_KEYS,
    SCORE_META,
    START_POSITION,
    TOWER_COLUMNS,
    TOWER_ROWS,
  });
});
