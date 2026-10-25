// What the class games (worker/bingo.js, raid.js, memory.js) share about the children in a room:
// what counts as a child's id, how to find a child without meeting Object.prototype, and how much
// of a child's play a prize pays for.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A child's id, as the game page makes it (crypto.randomUUID()). Anything else is not a child. @param {unknown} value */
export const isUuid = (value) => typeof value === 'string' && UUID.test(value);

/**
 * The room's record of a child, or undefined. A child's id is a key in a plain object, so
 * "__proto__" and "constructor" must not find the object's own prototype and methods.
 * @param {{ players: Record<string, any> }} room @param {unknown} uuid
 */
export const playerOf = (room, uuid) => (typeof uuid === 'string' && Object.hasOwn(room.players, uuid) ? room.players[uuid] : undefined);

/** A room holds this many children; a class is about 30. */
export const MAX_PLAYERS = 60;

/**
 * A prize pays for this many catches (bingo) or answers (raid, memory) from one child. A child
 * plays about 4 answers a minute and catches one Pokémon in 3 to 5 answers, so a lesson stays well
 * under both; the cap only bites on a client that sends more than a child can play.
 */
export const MAX_PAID_CATCHES = 150;
export const MAX_PAID_ANSWERS = 300;

/** What a child's count is worth in a prize. @param {unknown} count @param {number} cap */
export const paidCount = (count, cap) => Math.min(cap, Math.max(0, Number(count) || 0));
