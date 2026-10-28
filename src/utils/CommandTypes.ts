import { ValidationError, type ArgumentValue } from '@cliffy/command';
import { Vector2Int } from './PrefabData.ts';

export function parseVector2IntArg({ label, name, value }: ArgumentValue): Vector2Int {
  try {
    return Vector2Int.parse(value, { throwsOnError: true });
  } catch (err) {
    throw new ValidationError(
      `${label} "${name}" must be a valid size (width,depth), but got "${value}". Reason: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function checkMinTierArg({ label, name, value }: ArgumentValue): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1 || num > 5) {
    throw new ValidationError(`${label} "${name}" must be an integer between 1 and 5, but got "${value}".`);
  }
  return num;
}

export type TierPredicate = (tier: number) => boolean;

export function parseTierQuery({ label, name, value }: ArgumentValue): TierPredicate {
  const trimmed = value.trim();

  // バリデーション用：1〜5の整数かチェックするヘルパー
  const isValidDifficulty = (n: number) => !isNaN(n) && n >= 0 && n <= 5;

  // 1. ハイフン繋ぎ（範囲指定）のパターン（例: "1-3"）
  if (trimmed.includes('-')) {
    const [minStr, maxStr] = trimmed.split('-').map((s) => s.trim());
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);

    if (!isValidDifficulty(min) || !isValidDifficulty(max) || min > max) {
      throw new ValidationError(`${label} "${name}" range must be between 0 and 5 (e.g., "1-3"), but got "${value}".`);
    }
    return (diff: number) => diff >= min && diff <= max;
  }

  // 2. カンマ区切り（個別指定）のパターン（例: "2,4"）
  if (trimmed.includes(',')) {
    const numbers = trimmed.split(',').map((s) => parseInt(s.trim(), 10));
    if (numbers.some((n) => !isValidDifficulty(n))) {
      throw new ValidationError(`${label} "${name}" list must contain integers between 0 and 5 (e.g., "2,4"), but got "${value}".`);
    }
    return (diff: number) => numbers.includes(diff);
  }

  // 3. 単一指定のパターン（例: "3"）
  const singleNum = parseInt(trimmed, 10);
  if (!isValidDifficulty(singleNum)) {
    throw new ValidationError(`${label} "${name}" must be a single number (0-5), a range (1-3), or a list (2,4), but got "${value}".`);
  }
  return (diff: number) => diff === singleNum;
}

export type AxisPredicate = (val: number) => boolean;
export type SizePredicate = (size: { width: number; depth: number }) => boolean;

/**
 * 幅または高さの片方のクエリ文字列（"10", ">10", "10-20" など）をパースするヘルパー
 */
export function parseAxisQuery(axisName: string, query: string, label: string, optionName: string): AxisPredicate {
  const trimmed = query.trim();

  // 1. 範囲指定のパターン（例: "10-20"）
  if (trimmed.includes('-')) {
    const [minStr, maxStr] = trimmed.split('-').map((s) => s.trim());
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);
    if (isNaN(min) || isNaN(max) || min > max) {
      throw new ValidationError(`${label} "${optionName}" has an invalid ${axisName} range: "${query}".`);
    }
    return (val: number) => val >= min && val <= max;
  }

  // 2. 不等号・イコールのパターン（例: ">=10", "<20", "15"）
  const match = trimmed.match(/^([<>=]*)\s*(\d+)$/);
  if (!match) {
    throw new ValidationError(
      `${label} "${optionName}" has an invalid ${axisName} format: "${query}". Expected formats: "10", ">10", "10-20" etc.`,
    );
  }

  const [_, operator, numStr] = match;
  const targetNum = parseInt(numStr, 10);

  switch (operator) {
    case '<':
      return (val: number) => val < targetNum;
    case '<=':
      return (val: number) => val <= targetNum;
    case '>':
      return (val: number) => val > targetNum;
    case '>=':
      return (val: number) => val >= targetNum;
    case '=':
    case '==':
    case '':
      return (val: number) => val === targetNum;
    default:
      throw new ValidationError(`Unsupported operator "${operator}" in ${label} "${optionName}".`);
  }
}

/**
 * Cliffy用のサイズクエリパーサー（"幅のクエリ,高さのクエリ" をパース）
 */
export function parseSizeQuery({ label, name, value }: ArgumentValue): SizePredicate {
  const parts = value.split(',');

  if (parts.length !== 2) {
    throw new ValidationError(`${label} "${name}" must be in "width,depth" format (e.g., ">=10,10-20"), but got "${value}".`);
  }

  // 縦・横それぞれの条件関数を生成
  const widthPredicate = parseAxisQuery('width', parts[0], label, name);
  const depthPredicate = parseAxisQuery('depth', parts[1], label, name);

  // 両方の条件を満たす場合のみ true を返す関数を返す
  return (size: { width: number; depth: number }) => widthPredicate(size.width) && depthPredicate(size.depth);
}

export function parseCVars({ label, name, value }: ArgumentValue): Record<string, number> {
  const cvars: Record<string, number> = {};
  const pairs = value.includes(',') ? value.split(',') : value.split(/\s+/);
  for (const pair of pairs) {
    if (!pair.trim()) continue;
    const [key, valStr] = pair.split('=');
    if (!key || valStr === undefined) {
      throw new Error(`Invalid ${label} "${name}" value "${value}": Invalid cvar format in "${pair}". Expected "key=value".`);
    }
    const num = Number(valStr);
    if (isNaN(num)) {
      throw new Error(`Invalid ${label} "${name}" value "${value}": The value for cvar "${key}" is not a number.`);
    }
    cvars[key.trim()] = num;
  }
  return cvars;
}
