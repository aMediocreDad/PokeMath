<script>
	// The teacher's tools for one child in a class game: kick out, ask for a new name, or set one.
	// The server handles these the same way for every class game.
	/** @typedef {{ uuid?: string, name?: string }} Player */
	/**
	 * @type {{
	 *   menu: { player: Player, x: number, y: number },
	 *   code: string,
	 *   send: (message: any) => void,
	 *   onClose: () => void
	 * }}
	 */
	let { menu, code, send, onClose } = $props();

	const name = $derived(menu.player.name || 'Ash');

	/** @param {'kick' | 'rename' | 'setName'} action */
	function act(action) {
		// Read everything first: closing unmounts this menu, and its props with it.
		const { uuid } = menu.player;
		const name = menu.player.name || 'Ash';
		onClose();
		if (!uuid) return;
		if (action === 'kick') {
			if (confirm(`Kaste ut ${name}?`)) send({ type: 'hostKickPlayer', code, uuid });
		} else if (action === 'rename') {
			send({ type: 'hostForceRename', code, uuid });
		} else {
			const newName = prompt(`Nytt navn for ${name}:`, name);
			if (newName && newName.trim()) send({ type: 'hostSetName', code, uuid, name: newName.trim() });
		}
	}

	$effect(() => {
		addEventListener('click', onClose);
		return () => removeEventListener('click', onClose);
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	id="bingo-player-menu"
	role="menu"
	tabindex="-1"
	style:left="{Math.min(menu.x, innerWidth - 270)}px"
	style:top="{Math.min(menu.y, innerHeight - 170)}px"
	onclick={(e) => e.stopPropagation()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<button role="menuitem" class="danger" onclick={() => act('kick')}>Kast ut {name}</button>
	<button role="menuitem" onclick={() => act('rename')}>Be {name} endre navn</button>
	<button role="menuitem" onclick={() => act('setName')}>Gi {name} nytt navn…</button>
</div>

<style>
	#bingo-player-menu {
		position: fixed;
		z-index: 1100;
		display: grid;
		min-width: 240px;
		padding: 6px;
		border-radius: 14px;
		background: var(--pm-paper);
		box-shadow: var(--pm-shadow), 0 0 0 1px var(--pm-line);
	}
	button {
		min-height: 44px;
		padding: 0 12px;
		border: 0;
		border-radius: 10px;
		background: none;
		color: var(--pm-ink);
		font: 600 15px/1.2 var(--pm-body);
		text-align: left;
		cursor: pointer;
	}
	button:hover {
		background: var(--pm-cream);
	}
	button.danger {
		color: var(--pm-red-deep);
	}
</style>
