// Badges ("Merker"), stored in localStorage under 'badges' exactly as static/global.js stores them.
// Every update re-reads the stored list first, so a legacy page writing in between is not lost.
import { notify } from '#lib/toast.svelte.js';

const defaultAchievements = {
	version: '1.0',
	badges: [
		{ id: 1, name: 'Normal-Type Trener', description: 'Fang 250 Normal-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 2, name: 'Fire-Type Trener', description: 'Fang 250 Fire-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 3, name: 'Fighting-Type Trener', description: 'Fang 250 Fighting-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 4, name: 'Water-Type Trener', description: 'Fang 250 Water-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 5, name: 'Flying-Type Trener', description: 'Fang 250 Flying-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 6, name: 'Grass-Type Trener', description: 'Fang 250 Grass-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 7, name: 'Poison-Type Trener', description: 'Fang 250 Poison-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 8, name: 'Electric-Type Trener', description: 'Fang 250 Electric-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 9, name: 'Ground-Type Trener', description: 'Fang 250 Ground-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 10, name: 'Psychic-Type Trener', description: 'Fang 250 Psychic-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 11, name: 'Rock-Type Trener', description: 'Fang 250 Rock-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 12, name: 'Ice-Type Trener', description: 'Fang 250 Ice-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 13, name: 'Bug-Type Trener', description: 'Fang 250 Bug-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 14, name: 'Dragon-Type Trener', description: 'Fang 250 Dragon-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 15, name: 'Ghost-Type Trener', description: 'Fang 250 Ghost-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 16, name: 'Dark-Type Trener', description: 'Fang 250 Dark-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 17, name: 'Steel-Type Trener', description: 'Fang 250 Steel-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 18, name: 'Fairy-Type Trener', description: 'Fang 250 Fairy-type pokemon.', achieved: false, progress: 0, goal: 250 },
		{ id: 19, name: 'Big Earner', description: 'Få 10.000.000 mynter, totalt.', achieved: false, progress: 0, goal: 10000000 },
		{ id: 20, name: 'Big Spender', description: 'Bruk 5.000.000 mynter, totalt.', achieved: false, progress: 0, goal: 5000000 },
		{ id: 21, name: 'Legendarisk Trener', description: 'Fang 25 Legendariske pokemon.', achieved: false, progress: 0, goal: 25 },
		{ id: 22, name: 'Mytisk Trener', description: 'Fang 25 Mytiske pokemon.', achieved: false, progress: 0, goal: 25 },
		{ id: 23, name: 'Shiny Trener', description: 'Fang 100 Shiny pokemon.', achieved: false, progress: 0, goal: 100 },
		{ id: 24, name: 'Nivå 1 Mester', description: 'Løs 1000 oppgaver på Nivå 1.', achieved: false, progress: 0, goal: 1000 },
		{ id: 25, name: 'Nivå 2 Mester', description: 'Løs 1000 oppgaver på Nivå 2.', achieved: false, progress: 0, goal: 1000 },
		{ id: 26, name: 'Nivå 3 Mester', description: 'Løs 1000 oppgaver på Nivå 3.', achieved: false, progress: 0, goal: 1000 },
		{ id: 27, name: 'Nivå 4 Mester', description: 'Løs 1000 oppgaver på Nivå 4.', achieved: false, progress: 0, goal: 1000 },
		{ id: 28, name: 'Nivå 5 Mester', description: 'Løs 1000 oppgaver på Nivå 5.', achieved: false, progress: 0, goal: 1000 },
		{ id: 29, name: 'Rookie Trener', description: 'Fang 100 pokemon.', achieved: false, progress: 0, goal: 100 },
		{ id: 30, name: 'Rising Star', description: 'Fang 500 pokemon.', achieved: false, progress: 0, goal: 500 },
		{ id: 31, name: 'Challenger', description: 'Fang 1500 pokemon.', achieved: false, progress: 0, goal: 1500 },
		{ id: 32, name: 'Gym Leader', description: 'Fang 5000 pokemon.', achieved: false, progress: 0, goal: 5000 },
		{ id: 33, name: 'Pokemon Mester', description: 'Fang 10.000 pokemon.', achieved: false, progress: 0, goal: 10000 }
	]
};

/** @typedef {typeof defaultAchievements} Achievements */

/** @returns {Achievements} */
function read() {
	const stored = JSON.parse(localStorage.getItem('badges') ?? 'null') || JSON.parse(JSON.stringify(defaultAchievements));
	// global.js "migrates" 1.0 to 1.1 on every page load; keep writing the same version.
	if (stored.version === '1.0') stored.version = '1.1';
	return stored;
}

/** What global.js does when it loads: store the (possibly default) badges. */
export function loadAchievements() {
	const achievements = read();
	localStorage.setItem('badges', JSON.stringify(achievements));
	return achievements;
}

/**
 * incrementProgress() from static/global.js.
 * @param {number} id
 * @param {number} [amount]
 */
export function incrementProgress(id, amount = 1) {
	const achievements = read();
	const achievement = achievements.badges.find((a) => a.id === id);
	if (!achievement || achievement.achieved) return;
	achievement.progress += amount;
	if (achievement.progress >= achievement.goal) {
		achievement.achieved = true;
		notify(`/images/badges/${achievement.id}.png`, `Merke Låst Opp: ${achievement.name}`);
	}
	localStorage.setItem('badges', JSON.stringify(achievements));
}

/** Badge ids for "Fang 250 <type>-type pokemon". */
const TYPE_BADGES = {
	normal: 1, fire: 2, fighting: 3, water: 4, flying: 5, grass: 6, poison: 7, electric: 8, ground: 9,
	psychic: 10, rock: 11, ice: 12, bug: 13, dragon: 14, ghost: 15, dark: 16, steel: 17, fairy: 18
};

/** @param {string} type */
export function progressTypeAchievement(type) {
	const id = TYPE_BADGES[/** @type {keyof typeof TYPE_BADGES} */ (type)];
	if (id) incrementProgress(id);
}

/** The five "Fang N pokemon" badges. */
export function progressPokemonTrainerBadge() {
	for (const id of [29, 30, 31, 32, 33]) incrementProgress(id);
}

export const BADGE_IDS = {
	bigEarner: 19,
	bigSpender: 20,
	legendary: 21,
	mythic: 22,
	shiny: 23,
	/** "Nivå N Mester" is 23 + N. */
	stageMaster: (/** @type {number} */ stage) => 23 + stage
};
