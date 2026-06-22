import { parseXml } from './parseXml';

interface RecipesXmlRoot {
  recipes: {
    recipe: RecipesXmlElement[];
  };
}

interface RecipesXmlElement {
  $: {
    name: string;
    count: number;
    material_based?: boolean;
    craft_area?: string;
    is_trackable?: boolean;
    craft_time?: number;
    craft_exp_gain?: number;
    always_unlocked?: boolean;
    use_ingredient_modifier?: boolean;
    tags?: string;
  };
  wildcard_forge_category?: WildcardForgeCategory;
  ingredient?: RecipesXmlIngredient[];
}

interface WildcardForgeCategory {}

interface RecipesXmlIngredient {
  $: { name: string; count: number };
}

type RecipeName = string;

export interface Recipe {
  name: RecipeName;
  count: number;
  craftTime?: number;
  craftArea?: string;
  tags?: string[];
  ingredients: Ingredient[];
}

export interface Ingredient {
  name: string;
  count: number;
}

export class Recipes {
  constructor(public recipes: Recipe[]) {}

  static async loadFromXml(recipesXmlFileName: string): Promise<Recipes> {
    const recipesXml = await parseXml<RecipesXmlRoot>(recipesXmlFileName);
    const recipes = recipesXml.recipes.recipe.map<Recipe>(({ $, ingredient }) => {
      const ingredients = ingredient?.map<Ingredient>(({ $ }) => ({ name: $.name, count: $.count })) ?? [];
      return { name: $.name, count: $.count, tags: $.tags?.split(',').map((p) => p.trim()), ingredients };
    });
    return new Recipes(Array.from(recipes.values()));
  }

  hasTag(tag: string): Recipes {
    return new Recipes(this.recipes.filter(({ tags }) => tags?.includes(tag)));
  }

  statTags(): Map<string, number> {
    const stats = new Map<string, number>();
    this.recipes.flatMap(({ tags = [] }) => tags).forEach((tag) => stats.set(tag.trim(), (stats.get(tag) ?? 0) + 1));
    return stats;
  }

  find(predicate: (item: Recipe) => boolean): Recipe[] {
    return this.recipes.filter(predicate);
  }
}
