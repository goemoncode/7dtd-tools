import { parseXml } from './parseXml.ts';

interface LootXml {
  lootcontainers: {
    lootprobtemplates: {
      lootprobtemplate: {
        $: { name: string };
        loot: { $: { level: string | number; prob: number } }[];
      }[];
    }[];
    lootgroup: {
      $: Omit<LootGroup, 'items'>;
      item?: LootXmlItem[];
    }[];
    lootcontainer: {
      $: Omit<LootContainer, 'items'>;
      item?: LootXmlItem[];
    }[];
  };
}

type LootXmlItem = LootXmlItemGroup | LootXmlLootItem;
type LootXmlItemGroup = { $: LootItemGroup };
type LootXmlLootItem = { $: Omit<LootItem, 'requirements'>; requirement?: LootXmlRequirement[] };
type LootXmlRequirement = { $: RandomRollRequirement | ProgressionRequirement | BiomeRequirement };

export interface LootProbTemplate {
  name: string;
  probs: LootProbEntry[];
}

export interface LootProbEntry {
  maxLevel: number;
  prob: number;
}

export interface LootGroup {
  name: string;
  count?: number | string;
  loot_quality_template?: string;
  abundance_type?: string;
  items?: LootTableItem[];
}

export interface LootContainer {
  name: string;
  count?: number | string;
  loot_quality_template?: string;
  items?: LootTableItem[];
}

export type LootTableItem = LootItemGroup | LootItem;

export type LootItemGroup = {
  group: string;
} & LootTableItemBase;

export type LootItem = {
  name: string;
  requirements?: LootRequirement[];
} & LootTableItemBase;

interface LootTableItemBase {
  count?: number | string;
  prob?: number;
  loot_prob_template?: string;
  force_prob?: boolean;
  buffs?: string;
}

export type LootRequirement = RandomRollRequirement | ProgressionRequirement | BiomeRequirement;

export interface RandomRollRequirement {
  class: 'RandomRoll';
  seed_type: 'Random';
  min_max: string;
  operation: string;
  value: string;
}

export interface ProgressionRequirement {
  class: 'Progression';
  name: string;
  operation: string;
  value: string;
}

export interface BiomeRequirement {
  class: 'Biome';
  biomes: string;
}

function parseMinMax(value: string | number) {
  return typeof value === 'string' ? value.split(',').map((s) => parseInt(s.trim(), 10)) : [value, value];
}

function parseLootXml(lootXml: LootXml) {
  const lootProbTemplates: LootProbTemplate[] = lootXml.lootcontainers.lootprobtemplates[0].lootprobtemplate.map((lootProbTemplate) => {
    return {
      ...lootProbTemplate.$,
      probs: lootProbTemplate.loot.map((entry) => {
        const level = entry.$.level;
        const prob = entry.$.prob;
        const [, maxLevel] = parseMinMax(level);
        return { maxLevel, prob };
      }),
    };
  });
  const groups: LootGroup[] = lootXml.lootcontainers.lootgroup.map(({ $, item }) => ({
    ...$,
    items: item?.map((item) => {
      if ('requirement' in item) {
        return { ...item.$, requirements: item.requirement?.map((req) => req.$) } as LootItem;
      }
      return item.$;
    }),
  }));
  const containers: LootContainer[] = lootXml.lootcontainers.lootcontainer.map(({ $: { name, count, loot_quality_template }, item }) => ({
    name,
    count,
    loot_quality_template,
    items: item?.map((item) => item.$),
  }));
  return { lootProbTemplates, groups, containers };
}

export type LootTreeRoot = { type: 'container'; rollCount?: number | string; children: LootTreeNode[] } & Omit<LootContainer, 'count'>;

export type LootTreeNode =
  // | ({ type: 'container'; rollCount?: number | string; children: LootTreeNode[] } & Omit<LootContainer, 'count'>)
  | ({ type: 'group'; name: string; rollCount?: number | string; children: LootTreeNode[] } & LootTableItemBase)
  | ({ type: 'item' } & LootItem);

function isLootItem(obj: LootTableItemBase): obj is LootItem {
  return obj !== undefined && 'type' in obj && obj.type == 'item' && 'requirements' in obj;
}

export type CalculatedLootTreeNode = LootTreeNode & {
  rollProb: number; // その階層（親要素の中）で単体当選する確率
  absoluteProb: number; // コンテナからここまでの累積確率
};

export interface PlayerState {
  lootStage: number;
  cvars?: Record<string, number>; // $perkBookwormChance などの動的変数を保持
  biomeStandingOn?: string;
  poiTier?: number;
}

type ItemNameMatcher = string | RegExp;

function isMatch(name: string, matcher: ItemNameMatcher) {
  return typeof matcher === 'string' ? name.startsWith(matcher) : matcher.test(name);
}

export class LootTable {
  static async loadFromXml(lootXmlFileName: string) {
    const lootXml = await parseXml<LootXml>(lootXmlFileName, true);
    let { lootProbTemplates, groups, containers } = parseLootXml(lootXml);
    groups = groups.filter((g) => !g.name.startsWith('twitch_') && g.count !== '0');
    containers = containers.filter((c) => !c.name.startsWith('twitch_') && c.count !== '0');
    const lootProbTemplateMap = new Map<string, LootProbEntry[]>(lootProbTemplates.map((l) => [l.name, l.probs]));
    const groupMap = new Map<string, LootGroup>(groups.map((g) => [g.name, g]));
    return new LootTable(lootProbTemplateMap, groupMap, containers);
  }

  constructor(
    public lootProbTemplateMap: Map<string, LootProbEntry[]>,
    public groupMap: Map<string, LootGroup>,
    public containers: LootContainer[],
  ) {}

  public findLootTree(target: ItemNameMatcher, playerState: PlayerState): LootTreeRoot[] {
    const results: LootTreeRoot[] = [];
    for (const container of this.containers) {
      const tree = this.searchInContainer(container, target);
      if (tree && tree.children) {
        tree.children.forEach((child) => {
          const calculatedChild = child as CalculatedLootTreeNode;
          const rawProb = this.resolveProbability(child as LootTableItemBase, playerState);
          calculatedChild.rollProb = rawProb;
          calculatedChild.absoluteProb = rawProb;
          this.calculateTreeProbabilities(calculatedChild, playerState);
        });
        results.push(tree);
      }
    }
    return results;
  }

  private searchInContainer(container: LootContainer, target: ItemNameMatcher): LootTreeRoot | null {
    if (!container.items) return null;
    const children: LootTreeNode[] = [];
    for (const item of container.items) {
      const childNode = this.searchInItem(item, target, new Set());
      if (childNode) children.push(childNode);
    }
    if (children.length === 0) return null;
    return { type: 'container', ...container, children };
  }

  private searchInItem(item: LootTableItem, target: ItemNameMatcher, visited: Set<string>): LootTreeNode | null {
    if ('name' in item) {
      if (isMatch(item.name, target)) {
        return { type: 'item', ...item };
      }
    } else if ('group' in item) {
      const { group, ...itemRest } = item;
      const groupNode = this.searchInGroup(group, target, visited);
      if (groupNode && groupNode.type === 'group') {
        const { count: rollCount, ...masterRest } = groupNode;
        return { ...masterRest, ...itemRest, rollCount };
      }
    }
    return null;
  }

  private searchInGroup(groupName: string, target: ItemNameMatcher, visited: Set<string>): LootTreeNode | null {
    if (visited.has(groupName)) return null;
    visited.add(groupName);

    const group = this.groupMap.get(groupName);
    if (!group || !group.items) return null;

    const children: LootTreeNode[] = [];
    for (const item of group.items) {
      const childNode = this.searchInItem(item, target, new Set(visited));
      if (childNode) children.push(childNode);
    }

    if (children.length === 0) return null;
    return { type: 'group', ...group, children };
  }

  private calculateTreeProbabilities(node: CalculatedLootTreeNode, playerState: PlayerState) {
    if (node.type !== 'group') return;

    const groupData = this.groupMap.get(node.name);
    if (!groupData || !groupData.items) return;

    if (node.rollCount === 'all') {
      node.children.forEach((child) => {
        const calculatedChild = child as CalculatedLootTreeNode;
        const rawProb = this.resolveProbability(child, playerState);
        calculatedChild.rollProb = rawProb;
        calculatedChild.absoluteProb = node.absoluteProb * calculatedChild.rollProb;
        this.calculateTreeProbabilities(calculatedChild, playerState);
      });
      return;
    }

    let totalGroupWeight = 0;
    for (const item of groupData.items) {
      if (item.force_prob !== true) totalGroupWeight += this.resolveProbability(item, playerState);
    }
    // XMLの上から順に走査し、各アイテムの「1ロールあたりの実質当選率」を算出する
    // 誰かが当たるとbreakするため、下に行くほど「手前が誰も当たらなかった残り枠（生存率）」が掛け算される
    let survivalChance = 1.0;
    for (const item of groupData.items) {
      const rawProb = this.resolveProbability(item, playerState);
      let rollProb = 0;
      if (item.force_prob === true) {
        rollProb = survivalChance * rawProb;
        survivalChance *= 1.0 - rawProb;
      } else {
        const rouletteRatio = totalGroupWeight > 0 ? rawProb / totalGroupWeight : 0;
        rollProb = survivalChance * rouletteRatio;
        survivalChance *= 1.0 - rouletteRatio;
      }
      const targetChild = node.children.find((child) => {
        if (child.type === 'group') return 'group' in item && item.group === child.name;
        if (child.type === 'item') return 'name' in item && item.name === child.name;
        return false;
      });
      if (targetChild) {
        const calculatedChild = targetChild as CalculatedLootTreeNode;

        calculatedChild.rollProb = rollProb;
        // calculatedChild.absoluteProb = node.absoluteProb * rollProb;

        let [, rollCount] = node.count ? parseMinMax(node.count) : [1, 1]; // item要素に定義されたcount（スポーン数）
        const [, groupRollCount] = node.rollCount ? parseMinMax(node.rollCount) : [1, 1]; // lootgroup要素に定義されたcount（グループのロール数）
        rollCount *= groupRollCount;
        const combinedRollProb = 1.0 - Math.pow(1.0 - rollProb, rollCount);
        calculatedChild.absoluteProb = node.absoluteProb * combinedRollProb;

        this.calculateTreeProbabilities(calculatedChild, playerState);
      }
    }
  }

  private resolveProbability(item: LootTableItemBase, playerState: PlayerState): number {
    let reqMultiplier = 1.0;
    if (isLootItem(item) && item.requirements && item.requirements.length > 0) {
      reqMultiplier = this.evaluateRequirements(item.requirements, playerState);
      if (reqMultiplier === 0.0) return 0.0;
    }
    let baseProb = item.prob ?? 1.0;
    if (item.loot_prob_template) {
      const entries = this.lootProbTemplateMap.get(item.loot_prob_template);
      if (entries) {
        for (const entry of entries) {
          if (playerState.lootStage <= entry.maxLevel) {
            baseProb = entry.prob;
            break;
          }
        }
      }
    }
    return baseProb * reqMultiplier;
  }

  private evaluateRequirements(requirements: LootRequirement[], player: PlayerState): number {
    let totalMultiplier = 1.0;
    for (const req of requirements) {
      if (req.class === 'RandomRoll') {
        totalMultiplier *= this.evaluateRandomRoll(req, player);
      } else if (req.class === 'Biome') {
        if (player.biomeStandingOn && !req.biomes.includes(player.biomeStandingOn)) {
          totalMultiplier = 0.0;
        }
      }
    }
    return totalMultiplier;
  }

  /**
   * RandomRoll 要件を厳密に確率（0.0 ～ 1.0）に変換する
   */
  private evaluateRandomRoll(req: RandomRollRequirement, player: PlayerState): number {
    // 1. 右辺（閾値）の解決
    const rightSide = this.resolveValue(req.value, player); // 例: 25

    // 2. 左辺（ダイス範囲）の解決 (デフォルトは 0, 100)
    let min = 0;
    let max = 100;
    if (req.min_max) {
      const parts = req.min_max.split(',');
      if (parts.length === 2) {
        min = parseFloat(parts[0]);
        max = parseFloat(parts[1]);
      }
    }

    // ダイスがとり得る範囲の幅
    const range = max - min;
    if (range <= 0) return 0;

    // 3. 演算子（operation）に応じた成功確率の算出
    // LeftSide = min + (max - min) * rand
    // 条件: LeftSide <= RightSide  -->  rand <= (RightSide - min) / (max - min)
    switch (req.operation) {
      case 'LTE': {
        const successRate = (rightSide - min) / range;
        return Math.max(0, Math.min(1, successRate)); // 0.0 ～ 1.0 にクランプ
      }
      case 'LT': {
        // 連続確率分布（実数）のため、未満(<)と以下(<=)の確率は同一視して問題ありません
        const successRate = (rightSide - min) / range;
        return Math.max(0, Math.min(1, successRate));
      }
      case 'GTE': {
        // LeftSide >= RightSide --> rand >= (RightSide - min) / range
        const successRate = 1.0 - (rightSide - min) / range;
        return Math.max(0, Math.min(1, successRate));
      }
      case 'GT': {
        const successRate = 1.0 - (rightSide - min) / range;
        return Math.max(0, Math.min(1, successRate));
      }
      default:
        return 1.0; // 未知の演算子は全通（100%）としてフォールバック
    }
  }

  /**
   * "@$varName" または生数値をパースして具体的な数値を返す
   */
  private resolveValue(valueStr: string | number, playerState: PlayerState): number {
    if (typeof valueStr === 'number') return valueStr;
    if (valueStr.startsWith('@')) {
      const cvarName = valueStr.substring(1); // "@$perkBookwormChance" -> "$perkBookwormChance"
      return playerState.cvars?.[cvarName] ?? 0;
    }
    const parsed = parseFloat(valueStr);
    return isNaN(parsed) ? 0 : parsed;
  }
}
