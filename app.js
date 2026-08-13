(function exposeTowerSimulator(root, factory) {
  "use strict";

  const data =
    typeof module !== "undefined" && module.exports
      ? require("./tower-data.js")
      : root.TowerData;
  const api = factory(data);

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.TowerSimulator = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", api.boot, { once: true });
    } else {
      api.boot();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTowerSimulator(data) {
  "use strict";

  if (!data) throw new Error("tower-data.js must be loaded before app.js");

  const {
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
  } = data;

  const STORAGE_KEY = "hebiboueki.time-saving-tower.simulation.v3";
  const SCORE_MAXIMUM = 10_000;
  const SCORE_MINIMUM = -99_999;
  const HISTORY_LIMIT = 100;
  const GATE_TYPES = new Set(["gate", "key-gate"]);
  const DIRECTIONS = Object.freeze({
    up: Object.freeze({ row: -1, column: 0, key: "W", arrow: "▲" }),
    left: Object.freeze({ row: 0, column: -1, key: "A", arrow: "◀" }),
    down: Object.freeze({ row: 1, column: 0, key: "S", arrow: "▼" }),
    right: Object.freeze({ row: 0, column: 1, key: "D", arrow: "▶" }),
  });

  function coordinateKey(row, column) {
    return `${row}:${column}`;
  }

  function isInsideTower(row, column) {
    return row >= 1 && row <= TOWER_ROWS && column >= 1 && column <= TOWER_COLUMNS;
  }

  function floorBandForRow(row) {
    return FLOOR_BANDS.find((band) => row >= band.startRow && row <= band.endRow);
  }

  const ROUTE_CELL_KEYS = new Set();
  for (let row = 1; row <= TOWER_ROWS; row += 1) {
    for (let column = 1; column <= TOWER_COLUMNS; column += 1) {
      if (MAP_SHAPE[row - 1][column - 1] === ".") {
        ROUTE_CELL_KEYS.add(coordinateKey(row, column));
      }
    }
  }

  function normalizedPosition(rawPosition, resolved = {}) {
    const row = sanitizeInteger(rawPosition && rawPosition.row, 1, TOWER_ROWS, START_POSITION.row);
    const column = sanitizeInteger(rawPosition && rawPosition.column, 1, TOWER_COLUMNS, START_POSITION.column);
    const key = coordinateKey(row, column);
    const node = GLOBAL_NODE_BY_COORDINATE[key];
    if (
      ROUTE_CELL_KEYS.has(key)
      && (!node || (node.type !== "wall" && Boolean(resolved[node.id])))
    ) {
      return { row, column };
    }
    return { ...START_POSITION };
  }

  function isPassableCell(state, row, column) {
    const key = coordinateKey(row, column);
    if (!isInsideTower(row, column) || !ROUTE_CELL_KEYS.has(key)) return false;
    const node = GLOBAL_NODE_BY_COORDINATE[key];
    if (!node) return true;
    if (node.type === "wall") return false;
    return Boolean(state.resolved && state.resolved[node.id]);
  }

  function neighboringKeys(row, column) {
    return [
      [row - 1, column],
      [row + 1, column],
      [row, column - 1],
      [row, column + 1],
    ]
      .filter(([nextRow, nextColumn]) => isInsideTower(nextRow, nextColumn))
      .map(([nextRow, nextColumn]) => coordinateKey(nextRow, nextColumn));
  }

  function directionBetween(from, to) {
    for (const [direction, delta] of Object.entries(DIRECTIONS)) {
      if (from.row + delta.row === to.row && from.column + delta.column === to.column) return direction;
    }
    return null;
  }

  function attemptMove(state, direction) {
    const delta = DIRECTIONS[direction];
    if (!delta) throw new RangeError("unknown movement direction");
    const next = cloneState(state);
    next.facing = direction;
    const position = normalizedPosition(next.position, next.resolved);
    next.position = position;
    const target = { row: position.row + delta.row, column: position.column + delta.column };
    if (!isInsideTower(target.row, target.column) || !ROUTE_CELL_KEYS.has(coordinateKey(target.row, target.column))) {
      return { moved: false, reason: "wall", state: next, target };
    }
    const node = GLOBAL_NODE_BY_COORDINATE[coordinateKey(target.row, target.column)];
    if (node && (node.type === "wall" || !next.resolved[node.id])) {
      return {
        moved: false,
        reason: node.type === "wall" ? "wall" : "interaction",
        nodeId: node.type === "wall" ? null : node.id,
        state: next,
        target,
      };
    }
    next.position = target;
    return { moved: true, reason: null, state: next, target };
  }

  function computeReachability(state) {
    const normalizedState = state && typeof state === "object" ? state : createInitialState();
    const resolved = normalizedState.resolved && typeof normalizedState.resolved === "object"
      ? normalizedState.resolved
      : {};
    const blocked = new Set(
      GLOBAL_NODES
        .filter((node) => node.type === "wall" || !resolved[node.id])
        .map((node) => coordinateKey(node.globalRow, node.globalColumn)),
    );
    const reachableCellKeys = new Set();
    const position = normalizedPosition(normalizedState.position, resolved);
    const startKey = coordinateKey(position.row, position.column);
    const queue = blocked.has(startKey) || !ROUTE_CELL_KEYS.has(startKey) ? [] : [startKey];
    if (queue.length > 0) reachableCellKeys.add(startKey);

    for (let index = 0; index < queue.length; index += 1) {
      const [row, column] = queue[index].split(":").map(Number);
      for (const neighbor of neighboringKeys(row, column)) {
        if (!ROUTE_CELL_KEYS.has(neighbor) || blocked.has(neighbor) || reachableCellKeys.has(neighbor)) continue;
        reachableCellKeys.add(neighbor);
        queue.push(neighbor);
      }
    }

    const actionableNodeIds = new Set();
    const frontierNodeIds = new Set();
    for (const node of GLOBAL_NODES) {
      if (node.type === "wall" || resolved[node.id]) continue;
      const neighborKeys = neighboringKeys(node.globalRow, node.globalColumn);
      if (neighborKeys.some((neighbor) => reachableCellKeys.has(neighbor))) {
        frontierNodeIds.add(node.id);
      }
      if (neighborKeys.includes(startKey)) actionableNodeIds.add(node.id);
    }

    return { actionableNodeIds, frontierNodeIds, reachableCellKeys };
  }

  function canInteractWithNode(state, nodeOrId) {
    const nodeId = typeof nodeOrId === "string" ? nodeOrId : nodeOrId && nodeOrId.id;
    return Boolean(nodeId && computeReachability(state).actionableNodeIds.has(nodeId));
  }

  function shortestPathToAny(state, destinationKeys) {
    const destinations = destinationKeys instanceof Set ? destinationKeys : new Set(destinationKeys || []);
    const start = normalizedPosition(state.position, state.resolved);
    const startKey = coordinateKey(start.row, start.column);
    if (destinations.has(startKey)) return [startKey];
    const queue = [startKey];
    const parent = new Map([[startKey, null]]);

    for (let index = 0; index < queue.length; index += 1) {
      const currentKey = queue[index];
      const [row, column] = currentKey.split(":").map(Number);
      for (const neighbor of neighboringKeys(row, column)) {
        if (parent.has(neighbor)) continue;
        const [nextRow, nextColumn] = neighbor.split(":").map(Number);
        if (!isPassableCell(state, nextRow, nextColumn)) continue;
        parent.set(neighbor, currentKey);
        if (destinations.has(neighbor)) {
          const path = [neighbor];
          let cursor = currentKey;
          while (cursor) {
            path.push(cursor);
            cursor = parent.get(cursor);
          }
          return path.reverse();
        }
        queue.push(neighbor);
      }
    }
    return null;
  }

  function pathCommands(path) {
    if (!Array.isArray(path)) return [];
    const commands = [];
    for (let index = 1; index < path.length; index += 1) {
      const [fromRow, fromColumn] = path[index - 1].split(":").map(Number);
      const [toRow, toColumn] = path[index].split(":").map(Number);
      const direction = directionBetween(
        { row: fromRow, column: fromColumn },
        { row: toRow, column: toColumn },
      );
      if (direction) commands.push(DIRECTIONS[direction].key);
    }
    return commands;
  }

  function sanitizeInteger(value, minimum, maximum, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
  }

  function normalizeScores(rawScores) {
    const source = rawScores && typeof rawScores === "object" ? rawScores : {};
    return Object.fromEntries(
      SCORE_KEYS.map((key) => [
        key,
        sanitizeInteger(source[key], SCORE_MINIMUM, SCORE_MAXIMUM, 0),
      ]),
    );
  }

  function getRandomBand(randomWidth) {
    const width = sanitizeInteger(randomWidth, 0, 999, 0);
    if (width <= 1) return "stable";
    if (width <= 4) return "normal";
    return "wide";
  }

  function getRandomBandText(randomWidth) {
    const band = getRandomBand(randomWidth);
    if (band === "stable") return "固定幅：ボックスの結果が安定";
    if (band === "normal") return "通常幅：ボックスの結果がランダム";
    return "全幅：マイナス結果と激レア候補あり";
  }

  function getScoreBoxRange(size, randomWidth) {
    const band = getRandomBand(randomWidth);
    if (size !== "small" && size !== "large") throw new RangeError("unknown box size");

    if (size === "small") {
      if (band === "stable") return { minimum: 10, maximum: 10 };
      if (band === "normal") return { minimum: 0, maximum: 23 };
      return { minimum: -10, maximum: 35 };
    }

    if (band === "stable") return { minimum: 20, maximum: 20 };
    if (band === "normal") return { minimum: 0, maximum: 46 };
    return { minimum: -20, maximum: 70 };
  }

  function getAssetBoxRange(randomWidth) {
    const band = getRandomBand(randomWidth);
    if (band === "stable") return { minimum: 500, maximum: 500 };
    if (band === "normal") return { minimum: 300, maximum: 750 };
    return { minimum: 100, maximum: 1000 };
  }

  function randomInteger(minimum, maximum, rng = Math.random) {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || maximum < minimum) {
      throw new RangeError("invalid random integer range");
    }
    const sample = Number(rng());
    const normalized = Number.isFinite(sample) ? Math.min(0.999999999999, Math.max(0, sample)) : 0;
    return minimum + Math.floor(normalized * (maximum - minimum + 1));
  }

  function rollScoreBox(size, randomWidth, rng = Math.random) {
    const range = getScoreBoxRange(size, randomWidth);
    return Object.fromEntries(
      SCORE_KEYS.map((key) => [key, randomInteger(range.minimum, range.maximum, rng)]),
    );
  }

  function rollAssetBox(randomWidth, rng = Math.random) {
    const range = getAssetBoxRange(randomWidth);
    return randomInteger(range.minimum, range.maximum, rng);
  }

  function pick(list, rng = Math.random) {
    return list[randomInteger(0, list.length - 1, rng)];
  }

  function rollOreBox(randomWidth, options = {}) {
    const rng = options.rng || Math.random;
    const rareResult = Boolean(options.rareResult);
    const width = sanitizeInteger(randomWidth, 0, 999, 0);

    if (rareResult) {
      if (width < 4) throw new RangeError("rare ore result requires random width 4 or more");
      return [pick(HIGH_WIDTH_RARE_ORES, rng)];
    }

    if (width <= 3) {
      const results = [];
      let upperOreUsed = false;
      while (results.length < 4) {
        const candidates = upperOreUsed
          ? LOW_WIDTH_ORES.filter((ore) => !LOW_WIDTH_UPPER_ORES.includes(ore))
          : LOW_WIDTH_ORES;
        const candidate = pick(candidates, rng);
        const isUpper = LOW_WIDTH_UPPER_ORES.includes(candidate);
        results.push(candidate);
        if (isUpper) upperOreUsed = true;
      }
      return results;
    }

    return Array.from({ length: 5 }, () => pick(HIGH_WIDTH_ORES, rng));
  }

  function addScoreDeltas(scores, deltas) {
    const next = normalizeScores(scores);
    const applied = {};
    const capped = [];

    for (const key of SCORE_KEYS) {
      const delta = sanitizeInteger(deltas && deltas[key], SCORE_MINIMUM, SCORE_MAXIMUM, 0);
      const raw = next[key] + delta;
      const result = Math.min(SCORE_MAXIMUM, Math.max(SCORE_MINIMUM, raw));
      next[key] = result;
      applied[key] = result - normalizeScores(scores)[key];
      if (result !== raw) capped.push(key);
    }

    return { scores: next, applied, capped };
  }

  function convertScore(scores, sourceKey, amount) {
    const sourceIndex = CONVERSION_ORDER.indexOf(sourceKey);
    if (sourceIndex < 0) throw new RangeError("this score cannot be converted");
    const conversionAmount = sanitizeInteger(amount, 1, 100, 1);
    const targetKey = CONVERSION_ORDER[(sourceIndex + 1) % CONVERSION_ORDER.length];
    const next = normalizeScores(scores);
    next[sourceKey] = Math.max(SCORE_MINIMUM, next[sourceKey] - conversionAmount);
    next[targetKey] = Math.min(SCORE_MAXIMUM, next[targetKey] + conversionAmount);
    return { scores: next, sourceKey, targetKey, amount: conversionAmount };
  }

  function canPayGate(scores, scoreKey, cost) {
    if (!SCORE_KEYS.includes(scoreKey)) return false;
    const required = sanitizeInteger(cost, 0, SCORE_MAXIMUM, 0);
    return normalizeScores(scores)[scoreKey] >= required;
  }

  function addInventory(inventory, item, amount = 1) {
    const next = { ...(inventory || {}) };
    const quantity = sanitizeInteger(amount, 1, 999_999, 1);
    next[item] = sanitizeInteger(next[item], 0, 999_999, 0) + quantity;
    return next;
  }

  function addInventoryList(inventory, items) {
    return items.reduce((next, item) => addInventory(next, item, 1), inventory || {});
  }

  function createInitialState(options = {}) {
    const scores = normalizeScores(options.scores);
    return {
      version: 3,
      randomWidth: sanitizeInteger(options.randomWidth, 0, 999, 0),
      initialScores: { ...scores },
      initialMasterKeys: sanitizeInteger(options.masterKeys, 0, 99, 0),
      scores: { ...scores },
      masterKeys: sanitizeInteger(options.masterKeys, 0, 99, 0),
      totalAssets: 0,
      inventory: {},
      resolved: {},
      history: [],
      position: { ...START_POSITION },
      facing: "up",
    };
  }

  function normalizeState(rawState) {
    const fallback = createInitialState();
    if (!rawState || typeof rawState !== "object" || rawState.version !== 3) return fallback;
    const resolved = {};
    if (rawState.resolved && typeof rawState.resolved === "object") {
      for (const [id, result] of Object.entries(rawState.resolved)) {
        if (NODE_BY_ID[id] && result && typeof result === "object") resolved[id] = result;
      }
    }
    const inventory = {};
    if (rawState.inventory && typeof rawState.inventory === "object") {
      for (const [item, amount] of Object.entries(rawState.inventory)) {
        const safeAmount = sanitizeInteger(amount, 0, 999_999, 0);
        if (safeAmount > 0) inventory[String(item)] = safeAmount;
      }
    }
    const position = normalizedPosition(rawState.position, resolved);
    return {
      version: 3,
      randomWidth: sanitizeInteger(rawState.randomWidth, 0, 999, 0),
      initialScores: normalizeScores(rawState.initialScores || rawState.scores),
      initialMasterKeys: sanitizeInteger(rawState.initialMasterKeys, 0, 99, 0),
      scores: normalizeScores(rawState.scores),
      masterKeys: sanitizeInteger(rawState.masterKeys, 0, 999, 0),
      totalAssets: sanitizeInteger(rawState.totalAssets, 0, 999_999_999, 0),
      inventory,
      resolved,
      position,
      facing: DIRECTIONS[rawState.facing] ? rawState.facing : "up",
      history: Array.isArray(rawState.history)
        ? rawState.history
            .filter((entry) => entry && typeof entry.text === "string")
            .slice(-HISTORY_LIMIT)
            .map((entry) => ({ text: entry.text, floor: sanitizeInteger(entry.floor, 1, 7, 1) }))
        : [],
    };
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function floorForNode(nodeId) {
    const towerFloor = FLOORS.find((candidate) => candidate.nodes.some((node) => node.id === nodeId));
    return towerFloor ? towerFloor.number : 1;
  }

  function markResolved(state, node, result, historyText) {
    const next = cloneState(state);
    next.resolved[node.id] = { ...result };
    next.history.push({ floor: floorForNode(node.id), text: historyText });
    next.history = next.history.slice(-HISTORY_LIMIT);
    return next;
  }

  function resolveNode(state, node, choice, rng = Math.random) {
    if (!node || !NODE_BY_ID[node.id]) throw new RangeError("unknown map node");
    if (state.resolved[node.id]) return { ok: false, reason: "already-resolved", state };
    let next = cloneState(state);
    let text = "";
    let result = { choice: choice || null };

    if (node.type === "gate") {
      if (!canPayGate(next.scores, node.score, node.cost)) {
        return { ok: false, reason: "insufficient-score", state };
      }
      next.scores[node.score] -= node.cost;
      text = `${SCORE_META[node.score].label}スコアを${node.cost}使って結界を解除`;
      result = { cost: node.cost, score: node.score };
      if (node.rewardItem) {
        next.inventory = addInventory(next.inventory, node.rewardItem, node.rewardAmount);
        result.rewardItem = node.rewardItem;
        result.rewardAmount = node.rewardAmount;
        text += `／${node.rewardItem} ×${node.rewardAmount}を取得`;
      }
    } else if (node.type === "key-gate") {
      if (next.masterKeys < node.cost) return { ok: false, reason: "insufficient-key", state };
      next.masterKeys -= node.cost;
      result = { cost: node.cost };
      text = `マスターキーを${node.cost}個使って扉を解除`;
    } else if (node.type === "reward") {
      next.inventory = addInventory(next.inventory, node.item, node.amount);
      result = { item: node.item, amount: node.amount };
      text = `${node.item} ×${node.amount}を取得`;
    } else if (node.type === "key-reward") {
      next.masterKeys += node.amount;
      result = { amount: node.amount };
      text = `マスターキー ×${node.amount}を取得`;
    } else if (node.type === "asset") {
      next.totalAssets += node.amount;
      result = { amount: node.amount };
      text = `総資産 +${node.amount}`;
    } else if (node.type === "converter") {
      if (!CONVERSION_ORDER.includes(choice)) return { ok: false, reason: "invalid-choice", state };
      const conversion = convertScore(next.scores, choice, node.amount);
      next.scores = conversion.scores;
      result = { source: conversion.sourceKey, target: conversion.targetKey, amount: node.amount };
      text = `${SCORE_META[conversion.sourceKey].label} → ${SCORE_META[conversion.targetKey].label}へ${node.amount}変換`;
    } else if (node.type === "box-small") {
      const deltas = rollScoreBox("small", next.randomWidth, rng);
      const applied = addScoreDeltas(next.scores, deltas);
      next.scores = applied.scores;
      result = { deltas, applied: applied.applied, capped: applied.capped };
      text = `小型Sボックス：${formatScoreDeltas(applied.applied)}`;
    } else if (node.type === "box-large") {
      if (choice === "score") {
        const deltas = rollScoreBox("large", next.randomWidth, rng);
        const applied = addScoreDeltas(next.scores, deltas);
        next.scores = applied.scores;
        result = { choice, deltas, applied: applied.applied, capped: applied.capped };
        text = `大型Sボックス（スコア）：${formatScoreDeltas(applied.applied)}`;
      } else if (choice === "assets") {
        const amount = rollAssetBox(next.randomWidth, rng);
        next.totalAssets += amount;
        result = { choice, amount };
        text = `大型Sボックス（総資産）：+${amount}`;
      } else if (choice === "ores" || choice === "rare-ore") {
        const rareResult = choice === "rare-ore";
        if (rareResult && next.randomWidth < 4) return { ok: false, reason: "invalid-choice", state };
        const ores = rollOreBox(next.randomWidth, { rng, rareResult });
        next.inventory = addInventoryList(next.inventory, ores);
        result = { choice, ores };
        text = `大型Sボックス（鉱石）：${summarizeItems(ores)}`;
      } else {
        return { ok: false, reason: "invalid-choice", state };
      }
    } else if (node.type === "choice-reward") {
      if (!node.choices.includes(choice)) return { ok: false, reason: "invalid-choice", state };
      next.inventory = addInventory(next.inventory, choice, 1);
      result = { choice, amount: 1 };
      text = `${choice} ×1を取得`;
    } else if (node.type === "destination") {
      result = { destination: node.destination };
      text = `${node.destination}への到達を記録`;
    } else {
      return { ok: false, reason: "not-interactive", state };
    }

    next = markResolved(next, node, result, text);
    return { ok: true, state: next, result, text };
  }

  function resolveMapNode(state, node, choice, rng = Math.random) {
    if (!canInteractWithNode(state, node)) {
      return { ok: false, reason: "unreachable", state };
    }
    return resolveNode(state, node, choice, rng);
  }

  function guaranteedScoreBoxDelta(size, randomWidth) {
    return getScoreBoxRange(size, randomWidth).minimum;
  }

  function plannerActionText(node, choice, state) {
    if (node.type === "gate") return `${node.label}を解除`;
    if (node.type === "key-gate") return `${node.label}を開錠`;
    if (node.type === "converter") {
      const sourceIndex = CONVERSION_ORDER.indexOf(choice);
      const target = CONVERSION_ORDER[(sourceIndex + 1) % CONVERSION_ORDER.length];
      return `${node.label}：${SCORE_META[choice].label} → ${SCORE_META[target].label}`;
    }
    if (node.type === "box-small") {
      const minimum = guaranteedScoreBoxDelta("small", state.randomWidth);
      return `${node.label}を最悪値（各${formatSigned(minimum)}）で処理`;
    }
    if (node.type === "box-large" && choice === "guaranteed-score") {
      const minimum = guaranteedScoreBoxDelta("large", state.randomWidth);
      return `${node.label}を最悪値（各${formatSigned(minimum)}）のスコアで処理`;
    }
    if (node.type === "box-large") return `${node.label}で総資産を選択（スコア変動なし）`;
    if (node.type === "destination") return `${node.label}へ進む`;
    return `${node.label}を取得`;
  }

  function plannerChoices(state, node) {
    if (node.type === "gate") return canPayGate(state.scores, node.score, node.cost) ? [null] : [];
    if (node.type === "key-gate") return state.masterKeys >= node.cost ? [null] : [];
    if (node.type === "converter") return [...CONVERSION_ORDER];
    if (node.type === "box-small") return ["guaranteed-score"];
    if (node.type === "box-large") {
      return [guaranteedScoreBoxDelta("large", state.randomWidth) > 0 ? "guaranteed-score" : "safe-assets"];
    }
    if (["reward", "key-reward", "asset", "choice-reward", "destination"].includes(node.type)) return [null];
    return [];
  }

  function applyPlannerAction(state, node, choice) {
    const choices = plannerChoices(state, node);
    if (!choices.some((candidate) => candidate === choice)) return null;
    const next = cloneState(state);
    if (node.type === "gate") {
      next.scores[node.score] -= node.cost;
    } else if (node.type === "key-gate") {
      next.masterKeys -= node.cost;
    } else if (node.type === "key-reward") {
      next.masterKeys += node.amount;
    } else if (node.type === "converter") {
      next.scores = convertScore(next.scores, choice, node.amount).scores;
    } else if (node.type === "box-small") {
      const minimum = guaranteedScoreBoxDelta("small", next.randomWidth);
      const deltas = Object.fromEntries(SCORE_KEYS.map((key) => [key, minimum]));
      next.scores = addScoreDeltas(next.scores, deltas).scores;
    } else if (node.type === "box-large" && choice === "guaranteed-score") {
      const minimum = guaranteedScoreBoxDelta("large", next.randomWidth);
      const deltas = Object.fromEntries(SCORE_KEYS.map((key) => [key, minimum]));
      next.scores = addScoreDeltas(next.scores, deltas).scores;
    }
    next.resolved[node.id] = { solver: true, choice: choice || null };
    return {
      state: next,
      action: {
        nodeId: node.id,
        choice: choice || null,
        text: plannerActionText(node, choice, state),
      },
    };
  }

  function isSafeAutomaticAction(state, node) {
    if (["reward", "key-reward", "asset", "choice-reward", "destination", "box-large"].includes(node.type)) {
      return true;
    }
    return node.type === "box-small" && guaranteedScoreBoxDelta("small", state.randomWidth) >= 0;
  }

  function automaticChoice(state, node) {
    return plannerChoices(state, node)[0] ?? null;
  }

  function isUsefulSafeAction(state, node, targetId) {
    if (node.id === targetId || node.type === "key-reward") return true;
    if (node.type === "box-small" && guaranteedScoreBoxDelta("small", state.randomWidth) > 0) return true;
    if (node.type === "box-large" && guaranteedScoreBoxDelta("large", state.randomWidth) > 0) return true;

    const before = computeReachability(state);
    const applied = applyPlannerAction(state, node, automaticChoice(state, node));
    if (!applied) return false;
    const after = computeReachability(applied.state);
    const nodeKey = coordinateKey(GLOBAL_NODE_BY_ID[node.id].globalRow, GLOBAL_NODE_BY_ID[node.id].globalColumn);
    if ([...after.reachableCellKeys].some((key) => key !== nodeKey && !before.reachableCellKeys.has(key))) return true;
    return [...after.frontierNodeIds].some((id) => id !== node.id && !before.frontierNodeIds.has(id));
  }

  function isStructurallyReachable(state, targetNode) {
    const position = normalizedPosition(state.position, state.resolved);
    const startKey = coordinateKey(position.row, position.column);
    const targetKey = coordinateKey(targetNode.globalRow, targetNode.globalColumn);
    const visited = new Set([startKey]);
    const queue = [startKey];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current === targetKey) return true;
      const [row, column] = current.split(":").map(Number);
      for (const neighbor of neighboringKeys(row, column)) {
        if (visited.has(neighbor) || !ROUTE_CELL_KEYS.has(neighbor)) continue;
        const node = GLOBAL_NODE_BY_COORDINATE[neighbor];
        if (node && node.type === "wall") continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    return false;
  }

  function plannerStateSignature(state) {
    const resolvedBits = GLOBAL_NODES.map((node) => (state.resolved[node.id] ? "1" : "0")).join("");
    return `${resolvedBits}|${SCORE_KEYS.map((key) => state.scores[key]).join(",")}|${state.masterKeys}`;
  }

  function closeSafePlannerActions(state, plan, targetId) {
    let next = cloneState(state);
    const nextPlan = [...plan];
    while (true) {
      const frontier = [...computeReachability(next).frontierNodeIds]
        .map((id) => NODE_BY_ID[id])
        .filter((node) => isSafeAutomaticAction(next, node) && isUsefulSafeAction(next, node, targetId))
        .sort((left, right) => Number(right.id === targetId) - Number(left.id === targetId));
      if (frontier.length === 0) return { state: next, plan: nextPlan, found: false };
      const node = frontier[0];
      const choice = automaticChoice(next, node);
      const applied = applyPlannerAction(next, node, choice);
      if (!applied) return { state: next, plan: nextPlan, found: false };
      next = applied.state;
      nextPlan.push(applied.action);
      if (node.id === targetId) return { state: next, plan: nextPlan, found: true };
    }
  }

  function compressCommands(commands) {
    if (!commands || commands.length === 0) return "その場";
    const groups = [];
    for (const command of commands) {
      const previous = groups[groups.length - 1];
      if (previous && previous.command === command) previous.count += 1;
      else groups.push({ command, count: 1 });
    }
    return groups.map(({ command, count }) => count === 1 ? command : `${command}×${count}`).join(" → ");
  }

  function reconstructSolverRoute(state, actions) {
    let simulation = cloneState(state);
    const segments = [];
    const routeCellKeys = [];
    for (const action of actions) {
      const globalNode = GLOBAL_NODE_BY_ID[action.nodeId];
      const node = NODE_BY_ID[action.nodeId];
      const destinationKeys = new Set(
        neighboringKeys(globalNode.globalRow, globalNode.globalColumn).filter((key) => {
          const [row, column] = key.split(":").map(Number);
          return isPassableCell(simulation, row, column);
        }),
      );
      const path = shortestPathToAny(simulation, destinationKeys);
      if (!path) return null;
      const commands = pathCommands(path);
      routeCellKeys.push(...path);
      const [endRow, endColumn] = path[path.length - 1].split(":").map(Number);
      simulation.position = { row: endRow, column: endColumn };
      simulation.facing = directionBetween(
        simulation.position,
        { row: globalNode.globalRow, column: globalNode.globalColumn },
      ) || simulation.facing;
      const applied = applyPlannerAction(simulation, node, action.choice);
      if (!applied) return null;
      simulation = applied.state;
      segments.push({
        ...action,
        commands,
        commandText: compressCommands(commands),
        path,
      });
    }
    return { finalState: simulation, routeCellKeys, segments };
  }

  function solveGuaranteedRoute(state, targetId, options = {}) {
    const target = GLOBAL_NODE_BY_ID[targetId];
    const maxStates = sanitizeInteger(options.maxStates, 100, 200_000, 40_000);
    if (!target || target.type === "wall") {
      return { possible: false, reason: "invalid-target", exploredStates: 0, plan: [], segments: [] };
    }
    if (state.resolved[targetId]) {
      return { possible: true, reason: "already-resolved", exploredStates: 0, plan: [], segments: [], routeCellKeys: [] };
    }
    if (!isStructurallyReachable(state, target)) {
      return { possible: false, reason: "blocked-by-map", exploredStates: 0, plan: [], segments: [] };
    }

    let exploredStates = 0;
    let cutoff = false;
    const visited = new Set();
    const targetDistance = (node) => Math.abs(node.globalRow - target.globalRow) + Math.abs(node.globalColumn - target.globalColumn);

    function search(currentState, currentPlan) {
      exploredStates += 1;
      if (exploredStates > maxStates) {
        cutoff = true;
        return null;
      }
      const closure = closeSafePlannerActions(currentState, currentPlan, targetId);
      if (closure.found) return closure.plan;
      const signature = plannerStateSignature(closure.state);
      if (visited.has(signature)) return false;
      visited.add(signature);

      const candidates = [];
      for (const nodeId of computeReachability(closure.state).frontierNodeIds) {
        const node = NODE_BY_ID[nodeId];
        if (isSafeAutomaticAction(closure.state, node)) continue;
        for (const choice of plannerChoices(closure.state, node)) {
          candidates.push({ node, choice });
        }
      }
      candidates.sort((left, right) => {
        const targetPriority = Number(right.node.id === targetId) - Number(left.node.id === targetId);
        if (targetPriority) return targetPriority;
        const leftGlobal = GLOBAL_NODE_BY_ID[left.node.id];
        const rightGlobal = GLOBAL_NODE_BY_ID[right.node.id];
        return targetDistance(leftGlobal) - targetDistance(rightGlobal);
      });

      for (const candidate of candidates) {
        const applied = applyPlannerAction(closure.state, candidate.node, candidate.choice);
        if (!applied) continue;
        const nextPlan = [...closure.plan, applied.action];
        if (candidate.node.id === targetId) return nextPlan;
        const result = search(applied.state, nextPlan);
        if (Array.isArray(result)) return result;
        if (cutoff) return null;
      }
      return false;
    }

    const plan = search(cloneState(state), []);
    if (!Array.isArray(plan)) {
      return {
        possible: cutoff ? null : false,
        reason: cutoff ? "search-limit" : "insufficient-resources",
        exploredStates,
        plan: [],
        segments: [],
      };
    }
    const reconstruction = reconstructSolverRoute(state, plan);
    if (!reconstruction) {
      return { possible: null, reason: "route-reconstruction-failed", exploredStates, plan, segments: [] };
    }
    return {
      possible: true,
      reason: "route-found",
      exploredStates,
      plan,
      segments: reconstruction.segments,
      routeCellKeys: reconstruction.routeCellKeys,
      finalScores: reconstruction.finalState.scores,
      finalMasterKeys: reconstruction.finalState.masterKeys,
    };
  }

  function formatSigned(number) {
    return number >= 0 ? `+${number}` : String(number);
  }

  function formatScoreDeltas(deltas) {
    return SCORE_KEYS.map((key) => `${SCORE_META[key].label}${formatSigned(deltas[key] || 0)}`).join(" / ");
  }

  function summarizeItems(items) {
    const counts = {};
    for (const item of items) counts[item] = (counts[item] || 0) + 1;
    return Object.entries(counts)
      .map(([item, amount]) => `${item} ×${amount}`)
      .join("、");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function boot() {
    const elements = {
      actionConsole: document.querySelector("#action-console"),
      assetsStatus: document.querySelector("#assets-status"),
      consoleClose: document.querySelector("#console-close"),
      consoleContent: document.querySelector("#console-content"),
      consoleKicker: document.querySelector("#console-kicker"),
      consoleTitle: document.querySelector("#console-title"),
      floorNav: document.querySelector("#floor-nav"),
      gateColorLegend: document.querySelector("#gate-color-legend"),
      historyList: document.querySelector("#history-list"),
      inventoryContent: document.querySelector("#inventory-content"),
      itemCountStatus: document.querySelector("#item-count-status"),
      keysStatus: document.querySelector("#keys-status"),
      loadExampleButton: document.querySelector("#load-example-button"),
      masterKeyInput: document.querySelector("#master-key-input"),
      movementControls: document.querySelector("#movement-controls"),
      playerPositionStatus: document.querySelector("#player-position-status"),
      randomBandPreview: document.querySelector("#random-band-preview"),
      randomWidthInput: document.querySelector("#random-width-input"),
      reachableStatus: document.querySelector("#reachable-status"),
      resetProgressButton: document.querySelector("#reset-progress-button"),
      resolvedStatus: document.querySelector("#resolved-status"),
      scoreInputs: document.querySelector("#score-inputs"),
      scoreStatus: document.querySelector("#score-status"),
      solverClearButton: document.querySelector("#solver-clear-button"),
      solverModeButton: document.querySelector("#solver-mode-button"),
      solverResult: document.querySelector("#solver-result"),
      startButton: document.querySelector("#start-button"),
      towerMap: document.querySelector("#tower-map"),
      undoButton: document.querySelector("#undo-button"),
    };

    let state = loadState();
    let undoStack = [];
    let selectedNodeId = null;
    let solverMode = false;
    let solverTargetId = null;
    let solverRoute = null;

    renderInputFields();
    renderFloorNavigation();
    renderGateLegend();
    renderMap();
    syncInputsFromState();
    renderAll();

    elements.randomWidthInput.addEventListener("input", () => {
      elements.randomBandPreview.textContent = getRandomBandText(elements.randomWidthInput.value);
    });

    elements.startButton.addEventListener("click", () => {
      const scores = Object.fromEntries(
        SCORE_KEYS.map((key) => [key, document.querySelector(`#score-input-${key}`).value]),
      );
      state = createInitialState({
        scores,
        randomWidth: elements.randomWidthInput.value,
        masterKeys: elements.masterKeyInput.value,
      });
      undoStack = [];
      selectedNodeId = null;
      clearSolverResult();
      saveState();
      renderAll();
      closeConsole();
      document.querySelector("#floor-1").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    elements.loadExampleButton.addEventListener("click", () => {
      for (const key of SCORE_KEYS) document.querySelector(`#score-input-${key}`).value = "100";
      elements.randomWidthInput.value = "0";
      elements.masterKeyInput.value = "0";
      elements.randomBandPreview.textContent = getRandomBandText(0);
    });

    elements.resetProgressButton.addEventListener("click", () => {
      pushUndo();
      state = createInitialState({
        scores: state.initialScores,
        randomWidth: state.randomWidth,
        masterKeys: state.initialMasterKeys,
      });
      selectedNodeId = null;
      clearSolverResult();
      saveState();
      renderAll();
      closeConsole();
    });

    elements.undoButton.addEventListener("click", () => {
      if (undoStack.length === 0) return;
      state = normalizeState(undoStack.pop());
      selectedNodeId = null;
      clearSolverResult();
      saveState();
      renderAll();
      closeConsole();
    });

    elements.consoleClose.addEventListener("click", closeConsole);

    elements.movementControls.addEventListener("click", (event) => {
      const button = event.target.closest("[data-move]");
      if (button) handleMove(button.dataset.move);
    });

    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, button, [contenteditable='true']")) return;
      const direction = {
        w: "up",
        arrowup: "up",
        a: "left",
        arrowleft: "left",
        s: "down",
        arrowdown: "down",
        d: "right",
        arrowright: "right",
      }[event.key.toLowerCase()];
      if (!direction) return;
      event.preventDefault();
      handleMove(direction);
    });

    elements.solverModeButton.addEventListener("click", () => {
      solverMode = !solverMode;
      elements.solverResult.innerHTML = solverMode
        ? "<p>欲しいアイテムまたは目的地のマスをクリックしてください。</p>"
        : "<p>ソルバの選択をキャンセルしました。</p>";
      renderNodeStates();
      renderSolverState();
    });

    elements.solverClearButton.addEventListener("click", () => {
      clearSolverResult();
      renderAll();
    });

    elements.towerMap.addEventListener("click", (event) => {
      const button = event.target.closest("[data-node-id]");
      if (!button) return;
      const node = NODE_BY_ID[button.dataset.nodeId];
      if (!node) return;
      if (solverMode) {
        runSolver(node.id);
        return;
      }
      if (button.disabled) return;
      faceNode(node.id);
      selectedNodeId = node.id;
      renderConsole(node);
    });

    elements.consoleContent.addEventListener("click", (event) => {
      const action = event.target.closest("[data-resolve-choice]");
      if (!action || !selectedNodeId) return;
      const node = NODE_BY_ID[selectedNodeId];
      const choice = action.dataset.resolveChoice || null;
      if (!canInteractWithNode(state, node)) {
        renderConsole(node, "unreachable");
        return;
      }
      pushUndo();
      const outcome = resolveMapNode(state, node, choice);
      if (!outcome.ok) {
        undoStack.pop();
        renderConsole(node, outcome.reason);
        return;
      }
      state = outcome.state;
      clearSolverResult();
      saveState();
      renderAll();
      renderConsole(node);
    });

    function renderInputFields() {
      elements.scoreInputs.innerHTML = SCORE_KEYS.map((key) => {
        const meta = SCORE_META[key];
        return `
          <label class="input-card score-input-card" for="score-input-${key}" style="--score-color:${meta.color}">
            <span class="input-label">${escapeHtml(meta.label)}スコア</span>
            <input id="score-input-${key}" type="number" min="${SCORE_MINIMUM}" max="${SCORE_MAXIMUM}" step="1" value="0" inputmode="numeric" />
            <span class="input-help">上限 +${SCORE_MAXIMUM.toLocaleString("ja-JP")}</span>
          </label>`;
      }).join("");
    }

    function renderFloorNavigation() {
      elements.floorNav.innerHTML = [...FLOORS].reverse().map(
        (towerFloor) => `<a href="#floor-${towerFloor.number}">${towerFloor.number}F</a>`,
      ).join("");
    }

    function renderGateLegend() {
      const colorOrder = ["exploration", "materials", "level", "ore", "recovery", "amplification", "funds"];
      elements.gateColorLegend.innerHTML = colorOrder.map((key) => {
        const meta = SCORE_META[key];
        return `<span style="--legend-color:${meta.color}"><i aria-hidden="true"></i>${escapeHtml(meta.colorName)}：${escapeHtml(meta.label)}</span>`;
      }).join("");
    }

    function renderMap() {
      const labels = FLOOR_BANDS.map((band) => `
        <div id="floor-${band.floor}" class="floor-band-label" style="--band-row:${band.startRow};--band-rows:${band.rows}" title="${escapeHtml(band.note)}">
          <strong>${band.floor}</strong><span>F</span>
        </div>`).join("");
      const cells = [];
      for (let row = 1; row <= TOWER_ROWS; row += 1) {
        const band = floorBandForRow(row);
        for (let column = 1; column <= TOWER_COLUMNS; column += 1) {
          const key = coordinateKey(row, column);
          const node = GLOBAL_NODE_BY_COORDINATE[key];
          const isRoute = ROUTE_CELL_KEYS.has(key);
          const isStart = row === START_POSITION.row && column === START_POSITION.column;
          const boundaryClass = row === band.startRow ? " floor-boundary" : "";
          cells.push(node
            ? renderMapNode(node, key, isRoute, boundaryClass)
            : `<div class="map-cell ${isRoute ? "route-cell" : "void-cell"}${boundaryClass}${isStart ? " start-cell" : ""}" data-cell-key="${key}" style="--grid-row:${row};--grid-column:${column + 1}" aria-hidden="true">${isStart ? '<span class="start-marker"><b>START</b><i>ヘビ</i></span>' : ""}</div>`);
        }
      }
      elements.towerMap.innerHTML = `
        <div class="continuous-map-scroll" tabindex="0" aria-label="左下のSTARTから上へつながる時短の巨塔38行15列マップ">
          <div class="continuous-grid" style="--tower-rows:${TOWER_ROWS};--tower-columns:${TOWER_COLUMNS}">
            ${labels}
            ${cells.join("")}
            <div id="player-marker" class="player-marker" role="img" aria-label="ヘビの現在位置">
              <span class="player-direction">▲</span><b>ヘビ</b>
            </div>
          </div>
        </div>`;
    }

    function renderMapNode(node, key, isRoute, boundaryClass) {
      const interactive = node.type !== "wall";
      const tag = interactive ? "button" : "div";
      const attributes = interactive
        ? `type="button" data-node-id="${node.id}" aria-label="${escapeHtml(node.label)}"`
        : 'aria-hidden="true"';
      const gateColor = node.type === "gate" ? `--gate-color:${SCORE_META[node.score].color};` : "";
      return `<${tag} class="map-cell map-node ${isRoute ? "route-cell" : "void-cell"} node-${node.type}${boundaryClass}" ${attributes} data-cell-key="${key}" style="--grid-row:${node.globalRow};--grid-column:${node.globalColumn + 1};${gateColor}">
        <span class="node-symbol">${nodeSymbol(node.type)}</span>
        <span class="node-label">${escapeHtml(node.label)}</span>
      </${tag}>`;
    }

    function faceNode(nodeId) {
      const globalNode = GLOBAL_NODE_BY_ID[nodeId];
      const direction = directionBetween(state.position, {
        row: globalNode.globalRow,
        column: globalNode.globalColumn,
      });
      if (!direction) return;
      state = { ...state, facing: direction };
      saveState();
      renderPlayer();
    }

    function nodeInFront() {
      const delta = DIRECTIONS[state.facing] || DIRECTIONS.up;
      return GLOBAL_NODE_BY_COORDINATE[
        coordinateKey(state.position.row + delta.row, state.position.column + delta.column)
      ] || null;
    }

    function handleMove(direction) {
      closeConsole();
      clearSolverResult("ヘビを動かしたため、以前のソルバ結果を消去しました。");
      const movement = attemptMove(state, direction);
      state = movement.state;
      saveState();
      renderAll();

      const facingNode = movement.nodeId ? NODE_BY_ID[movement.nodeId] : nodeInFront();
      if (facingNode && !state.resolved[facingNode.id] && canInteractWithNode(state, facingNode)) {
        selectedNodeId = facingNode.id;
        renderConsole(facingNode);
      }
      if (movement.moved) {
        document.querySelector("#player-marker").scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }
    }

    function clearSolverResult(message) {
      solverMode = false;
      solverTargetId = null;
      solverRoute = null;
      if (elements.solverResult) {
        elements.solverResult.innerHTML = `<p>${escapeHtml(message || "「欲しいものをクリック」を押してから、マップ上のアイテムを選んでください。")}</p>`;
      }
      if (elements.solverClearButton) elements.solverClearButton.disabled = true;
    }

    function runSolver(targetId) {
      solverMode = false;
      solverTargetId = targetId;
      solverRoute = solveGuaranteedRoute(state, targetId);
      renderAll();
      const node = NODE_BY_ID[targetId];

      if (solverRoute.possible === true && solverRoute.reason === "already-resolved") {
        elements.solverResult.innerHTML = `<div class="solver-success"><strong>${escapeHtml(node.label)}は取得・処理済みです。</strong></div>`;
      } else if (solverRoute.possible === true) {
        const steps = solverRoute.segments.map((segment, index) => `
          <li>
            <span>${index + 1}</span>
            <div><code>${escapeHtml(segment.commandText)}</code><p>${escapeHtml(segment.text)}</p></div>
          </li>`).join("");
        elements.solverResult.innerHTML = `
          <div class="solver-success">
            <strong>確実に到達できます：${escapeHtml(node.label)}</strong>
            <p>マップ上に復元ルートを表示しました。スコア箱は最悪結果で計算しています。</p>
          </div>
          <ol class="solver-steps">${steps}</ol>
          <p class="solver-meta">探索状態 ${solverRoute.exploredStates.toLocaleString("ja-JP")}件</p>`;
      } else if (solverRoute.possible === false) {
        const reason = solverRoute.reason === "blocked-by-map"
          ? "黒壁または通行止めで通常移動できません。"
          : "現在のスコア・マスターキーでは、確実に通れる手順がありません。";
        elements.solverResult.innerHTML = `
          <div class="solver-failure"><strong>確実なルートなし：${escapeHtml(node.label)}</strong><p>${escapeHtml(reason)}</p></div>`;
      } else {
        elements.solverResult.innerHTML = `
          <div class="solver-unknown"><strong>判定保留：${escapeHtml(node.label)}</strong><p>探索上限に達しました。現在値を変えて再実行してください。</p></div>`;
      }
      elements.solverClearButton.disabled = false;
      renderSolverState();
    }

    function renderPlayer() {
      const marker = document.querySelector("#player-marker");
      if (!marker) return;
      marker.style.setProperty("--player-row", state.position.row);
      marker.style.setProperty("--player-column", state.position.column + 1);
      marker.dataset.facing = state.facing;
      marker.querySelector(".player-direction").textContent = DIRECTIONS[state.facing].arrow;
      const band = floorBandForRow(state.position.row);
      const localRow = state.position.row - band.startRow + 1;
      marker.setAttribute("aria-label", `ヘビ：${band.floor}階、上から${localRow}行、左から${state.position.column}列`);
      elements.playerPositionStatus.textContent = `${band.floor}F・上から${localRow}行・左から${state.position.column}列`;
    }

    function renderSolverState() {
      elements.towerMap.classList.toggle("is-solver-selecting", solverMode);
      elements.solverModeButton.classList.toggle("is-active", solverMode);
      elements.solverModeButton.textContent = solverMode ? "選択をキャンセル" : "欲しいものをクリック";
      document.querySelectorAll("[data-cell-key]").forEach((element) => {
        element.classList.remove("is-solver-route");
      });
      document.querySelectorAll("[data-node-id]").forEach((element) => {
        element.classList.remove("is-solver-action", "is-solver-target");
      });
      if (!solverRoute) return;
      for (const key of solverRoute.routeCellKeys || []) {
        document.querySelector(`[data-cell-key="${key}"]`)?.classList.add("is-solver-route");
      }
      for (const segment of solverRoute.segments || []) {
        document.querySelector(`[data-node-id="${segment.nodeId}"]`)?.classList.add("is-solver-action");
      }
      if (solverTargetId) {
        document.querySelector(`[data-node-id="${solverTargetId}"]`)?.classList.add("is-solver-target");
      }
    }

    function renderAll() {
      renderStatus();
      renderInventory();
      renderHistory();
      renderNodeStates();
      renderPlayer();
      renderSolverState();
      elements.undoButton.disabled = undoStack.length === 0;
    }

    function renderStatus() {
      elements.scoreStatus.innerHTML = SCORE_KEYS.map((key) => {
        const value = state.scores[key];
        return `<div class="score-status-card ${value < 0 ? "negative" : ""}" style="--score-color:${SCORE_META[key].color}">
          <span>${escapeHtml(SCORE_META[key].label)}</span><strong>${value.toLocaleString("ja-JP")}</strong>
        </div>`;
      }).join("");
      elements.assetsStatus.textContent = state.totalAssets.toLocaleString("ja-JP");
      elements.keysStatus.textContent = state.masterKeys.toLocaleString("ja-JP");
      elements.itemCountStatus.textContent = Object.values(state.inventory)
        .reduce((sum, amount) => sum + amount, 0)
        .toLocaleString("ja-JP");
      elements.resolvedStatus.textContent = Object.keys(state.resolved).length.toLocaleString("ja-JP");
      elements.reachableStatus.textContent = computeReachability(state).actionableNodeIds.size.toLocaleString("ja-JP");
    }

    function renderInventory() {
      const entries = Object.entries(state.inventory).sort((left, right) => left[0].localeCompare(right[0], "ja"));
      if (entries.length === 0) {
        elements.inventoryContent.className = "empty-content";
        elements.inventoryContent.textContent = "まだ取得していません。";
        return;
      }
      elements.inventoryContent.className = "inventory-list";
      elements.inventoryContent.innerHTML = entries
        .map(([item, amount]) => `<div><span>${escapeHtml(item)}</span><strong>×${amount}</strong></div>`)
        .join("");
    }

    function renderHistory() {
      if (state.history.length === 0) {
        elements.historyList.innerHTML = '<li class="empty-content">まだ操作していません。</li>';
        return;
      }
      elements.historyList.innerHTML = [...state.history]
        .reverse()
        .map((entry) => `<li><span>${entry.floor}F</span><p>${escapeHtml(entry.text)}</p></li>`)
        .join("");
    }

    function renderNodeStates() {
      const reachability = computeReachability(state);
      document.querySelectorAll("[data-cell-key]").forEach((element) => {
        element.classList.toggle("is-reachable-route", reachability.reachableCellKeys.has(element.dataset.cellKey));
      });
      document.querySelectorAll("[data-node-id]").forEach((element) => {
        const node = NODE_BY_ID[element.dataset.nodeId];
        const result = state.resolved[node.id];
        const isActionable = reachability.actionableNodeIds.has(node.id);
        element.classList.toggle("is-resolved", Boolean(result));
        element.classList.toggle("is-actionable", isActionable);
        element.classList.toggle("is-frontier", reachability.frontierNodeIds.has(node.id));
        element.classList.toggle("is-locked", !result && !isActionable);
        element.classList.toggle("is-solver-targetable", solverMode);
        element.disabled = solverMode ? false : Boolean(result) || !isActionable;
        if (result) {
          element.setAttribute("aria-label", `${node.label}（操作済み）`);
          element.title = `${node.label}（操作済み）`;
        } else if (!isActionable) {
          element.setAttribute("aria-label", `${node.label}（ヘビと隣接していません）`);
          element.title = `${node.label}（ヘビと隣接していません）`;
        } else {
          element.setAttribute("aria-label", node.label);
          element.title = node.label;
        }
      });
    }

    function renderConsole(node, errorReason) {
      elements.actionConsole.classList.add("is-open");
      elements.consoleKicker.textContent = `${floorForNode(node.id)}F · ${consoleTypeLabel(node.type)}`;
      elements.consoleTitle.textContent = node.label;

      if (state.resolved[node.id]) {
        elements.consoleContent.innerHTML = `<div class="console-result"><strong>操作済み</strong><p>${escapeHtml(resultDescription(state.resolved[node.id], node))}</p></div>`;
        return;
      }

      let html = errorReason ? `<p class="console-error">${escapeHtml(errorText(errorReason))}</p>` : "";
      if (node.type === "gate") {
        const current = state.scores[node.score];
        const shortage = Math.max(0, node.cost - current);
        html += `<div class="cost-comparison"><div><span>現在</span><strong>${current}</strong></div><div><span>必要</span><strong>${node.cost}</strong></div></div>`;
        if (node.rewardItem) html += `<p class="console-note">解除すると ${escapeHtml(node.rewardItem)} ×${node.rewardAmount} も記録します。</p>`;
        if (shortage > 0) html += `<p class="console-error">${escapeHtml(SCORE_META[node.score].label)}スコアがあと${shortage}必要です。</p>`;
        html += `<button class="console-primary" type="button" data-resolve-choice="" ${shortage > 0 ? "disabled" : ""}>${node.cost}使って解除</button>`;
      } else if (node.type === "key-gate") {
        const disabled = state.masterKeys < node.cost;
        html += `<p>現在のマスターキー：<strong>${state.masterKeys}</strong></p>`;
        if (disabled) html += '<p class="console-error">マスターキーが足りません。</p>';
        html += `<button class="console-primary" type="button" data-resolve-choice="" ${disabled ? "disabled" : ""}>マスターキーを使う</button>`;
      } else if (node.type === "reward" || node.type === "key-reward" || node.type === "asset") {
        html += `<p>${escapeHtml(rewardPreview(node))}</p><button class="console-primary" type="button" data-resolve-choice="">取得を記録</button>`;
      } else if (node.type === "destination") {
        html += `<p>${escapeHtml(node.destination)}へ進む出口です。</p><button class="console-primary" type="button" data-resolve-choice="">到達を記録</button>`;
      } else if (node.type === "converter") {
        html += `<p>左のスコアを${node.amount}減らし、右のスコアを${node.amount}増やします。変換元はマイナスになっても実行できます。</p><div class="conversion-list">`;
        for (let index = 0; index < CONVERSION_ORDER.length; index += 1) {
          const source = CONVERSION_ORDER[index];
          const target = CONVERSION_ORDER[(index + 1) % CONVERSION_ORDER.length];
          html += `<button type="button" data-resolve-choice="${source}"><span>${escapeHtml(SCORE_META[source].label)}</span><b>→</b><span>${escapeHtml(SCORE_META[target].label)}</span></button>`;
        }
        html += "</div>";
      } else if (node.type === "box-small") {
        const range = getScoreBoxRange("small", state.randomWidth);
        html += `<p>ランダム幅 <strong>${state.randomWidth}</strong>：7スコアそれぞれ ${formatRange(range)}。</p><button class="console-primary" type="button" data-resolve-choice="">スコアを抽選</button>`;
      } else if (node.type === "box-large") {
        const scoreRange = getScoreBoxRange("large", state.randomWidth);
        const assetRange = getAssetBoxRange(state.randomWidth);
        html += `<p>ランダム幅 <strong>${state.randomWidth}</strong>。欲しいものを選択します。</p><div class="large-box-choices">
          <button type="button" data-resolve-choice="score"><strong>スコア</strong><span>各 ${formatRange(scoreRange)}</span></button>
          <button type="button" data-resolve-choice="assets"><strong>総資産</strong><span>${formatRange(assetRange)}</span></button>
          <button type="button" data-resolve-choice="ores"><strong>鉱石</strong><span>${state.randomWidth <= 3 ? "4個を抽選" : "通常結果5個"}</span></button>
          ${state.randomWidth >= 4 ? '<button type="button" data-resolve-choice="rare-ore"><strong>激レア結果</strong><span>低確率を引いた場合の1個</span></button>' : ""}
        </div>`;
        if (state.randomWidth >= 4) html += '<p class="console-note">激レアになる正確な確率は資料にないため、通常結果と激レア結果を分けています。</p>';
      } else if (node.type === "choice-reward") {
        html += `<p>ゲーム内で出た方を選んで記録してください。</p><div class="large-box-choices">${node.choices.map((choice) => `<button type="button" data-resolve-choice="${escapeHtml(choice)}"><strong>${escapeHtml(choice)}</strong></button>`).join("")}</div>`;
      }
      elements.consoleContent.innerHTML = html;
    }

    function pushUndo() {
      undoStack.push(cloneState(state));
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    }

    function closeConsole() {
      elements.actionConsole.classList.remove("is-open");
      selectedNodeId = null;
    }

    function syncInputsFromState() {
      elements.randomWidthInput.value = String(state.randomWidth);
      elements.masterKeyInput.value = String(state.initialMasterKeys);
      elements.randomBandPreview.textContent = getRandomBandText(state.randomWidth);
      for (const key of SCORE_KEYS) document.querySelector(`#score-input-${key}`).value = String(state.initialScores[key]);
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? normalizeState(JSON.parse(raw)) : createInitialState();
      } catch (_error) {
        return createInitialState();
      }
    }

    function saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (_error) {
        // The simulator remains usable when storage is blocked.
      }
    }
  }

  function nodeSymbol(type) {
    const symbols = {
      asset: "+",
      "box-large": "大",
      "box-small": "小",
      "choice-reward": "?",
      converter: "⇄",
      destination: "↑",
      gate: "−",
      "key-gate": "鍵",
      "key-reward": "鍵",
      reward: "◆",
      wall: "×",
    };
    return symbols[type] || "·";
  }

  function consoleTypeLabel(type) {
    const labels = {
      asset: "総資産",
      "box-large": "大型スコアボックス",
      "box-small": "小型スコアボックス",
      "choice-reward": "選択報酬",
      converter: "スコア変換器",
      destination: "出口",
      gate: "スコア結界",
      "key-gate": "鍵扉",
      "key-reward": "報酬",
      reward: "報酬",
    };
    return labels[type] || "MAP";
  }

  function rewardPreview(node) {
    if (node.type === "asset") return `総資産を${node.amount}取得します。`;
    if (node.type === "key-reward") return `マスターキーを${node.amount}個取得します。`;
    return `${node.item}を${node.amount}個取得します。`;
  }

  function resultDescription(result, node) {
    if (node.type === "gate") {
      const reward = result.rewardItem ? `、${result.rewardItem} ×${result.rewardAmount}取得` : "";
      return `${SCORE_META[result.score].label}スコア −${result.cost}${reward}`;
    }
    if (node.type === "converter") return `${SCORE_META[result.source].label} → ${SCORE_META[result.target].label}へ${result.amount}`;
    if (node.type === "box-small" || (node.type === "box-large" && result.choice === "score")) return formatScoreDeltas(result.applied);
    if (node.type === "box-large" && result.choice === "assets") return `総資産 +${result.amount}`;
    if (node.type === "box-large" && result.ores) return summarizeItems(result.ores);
    if (node.type === "asset") return `総資産 +${result.amount}`;
    if (node.type === "key-gate") return `マスターキー −${result.cost}`;
    if (node.type === "key-reward") return `マスターキー +${result.amount}`;
    if (node.type === "destination") return `${result.destination}へ到達`;
    if (result.item) return `${result.item} ×${result.amount}`;
    if (result.choice) return `${result.choice} ×${result.amount || 1}`;
    return "記録済み";
  }

  function formatRange(range) {
    if (range.minimum === range.maximum) return formatSigned(range.minimum);
    return `${formatSigned(range.minimum)}〜${formatSigned(range.maximum)}`;
  }

  function errorText(reason) {
    const errors = {
      "already-resolved": "このマスは操作済みです。",
      "insufficient-key": "マスターキーが足りません。",
      "insufficient-score": "必要なスコアが足りません。",
      "invalid-choice": "この選択は現在の条件では使えません。",
      unreachable: "このマスはヘビの正面にありません。隣の通路まで移動してください。",
    };
    return errors[reason] || "操作できませんでした。";
  }

  return Object.freeze({
    ROUTE_CELL_KEYS,
    SCORE_MAXIMUM,
    SCORE_MINIMUM,
    STORAGE_KEY,
    addInventory,
    addScoreDeltas,
    attemptMove,
    boot,
    canInteractWithNode,
    canPayGate,
    computeReachability,
    coordinateKey,
    convertScore,
    createInitialState,
    getAssetBoxRange,
    getRandomBand,
    getRandomBandText,
    getScoreBoxRange,
    normalizeScores,
    normalizeState,
    pathCommands,
    randomInteger,
    resolveNode,
    resolveMapNode,
    rollAssetBox,
    rollOreBox,
    rollScoreBox,
    sanitizeInteger,
    shortestPathToAny,
    solveGuaranteedRoute,
    summarizeItems,
  });
});
