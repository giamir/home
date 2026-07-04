import {
	Bed,
	Calendar,
	ChefHat,
	Flower2,
	Hammer,
	House,
	PawPrint,
	Package,
	Car,
	ShoppingCart,
	ShowerHead,
	Shirt,
	Sofa,
	Sparkles,
	Sprout,
	Trash2,
	Utensils,
	Wallet,
	WashingMachine,
	Wrench
} from '@lucide/svelte';

/**
 * Curated icon set for areas (importing the full lucide catalog would bloat
 * the bundle). `icon` columns store these keys.
 */
export const AREA_ICONS = {
	'shopping-cart': ShoppingCart,
	'chef-hat': ChefHat,
	utensils: Utensils,
	sparkles: Sparkles,
	'shower-head': ShowerHead,
	shirt: Shirt,
	'washing-machine': WashingMachine,
	bed: Bed,
	package: Package,
	sprout: Sprout,
	'flower-2': Flower2,
	'trash-2': Trash2,
	wrench: Wrench,
	hammer: Hammer,
	wallet: Wallet,
	calendar: Calendar,
	sofa: Sofa,
	car: Car,
	'paw-print': PawPrint,
	house: House
} as const;

export type AreaIconName = keyof typeof AREA_ICONS;

export function areaIcon(name: string) {
	return AREA_ICONS[name as AreaIconName] ?? House;
}
