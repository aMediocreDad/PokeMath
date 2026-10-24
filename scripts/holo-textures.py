"""Draw the holo card texture in src/lib/assets/holo/ (HoloCard, PokemonCard).

maze.svg: a seamless tile of short maze walls, for the faint pattern printed on a shiny's white
ground. It is seeded, so running this again gives the same file.
Usage: python3 scripts/holo-textures.py
"""
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'src/lib/assets/holo'
rng = random.Random(573)


def maze(cells=12, cell=12):
    size = cells * cell
    walls = []
    for row in range(cells):
        for col in range(cells):
            x, y = col * cell, row * cell
            # Each cell keeps one of its walls, right or bottom, like a labyrinth printed on a card.
            if rng.random() < 0.5:
                walls.append(f'M{x + cell},{y}v{cell}')
            else:
                walls.append(f'M{x},{y + cell}h{cell}')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">'
        f'<path d="{"".join(walls)}" fill="none" stroke="#8a7d66" stroke-opacity="0.2" stroke-width="1.6" stroke-linecap="square"/>'
        '</svg>\n'
    )


OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'maze.svg').write_text(maze())
print('wrote', OUT / 'maze.svg')
