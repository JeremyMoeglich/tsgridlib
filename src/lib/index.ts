import { hasProperty } from 'functional-utilities';
import { deepClone } from 'lodash-es';
export interface vector {
	x: number;
	y: number;
}

export interface area {
	p1: vector;
	p2: vector;
}

function is_vector(v: unknown): v is vector {
	return hasProperty(v, 'x') && hasProperty(v, 'y');
}

export class Grid<T> {
	public content: T[][];
	constructor(content: T[][] | vector | undefined = undefined) {
		if (content === undefined) {
			this.content = [];
		} else if (is_vector(content)) {
			this.content = [];
			for (let i = 0; i < content.x; i++) {
				this.content[i] = [];
				for (let j = 0; j < content.y; j++) {
					this.content[i][j] = undefined;
				}
			}
		} else {
			this.content = content;
		}
	}
	neighbours(position: vector, filter: (value: T, position: vector) => boolean): Set<vector> {
		if (!this.content[position.x] || !this.content[position.x][position.y]) {
			throw new RangeError(`Not a valid position ${position.x}, ${position.y}`);
		}
		const offsets = [
			[0, 1],
			[1, 0],
			[0, -1],
			[-1, 0]
		];
		return new Set(
			offsets
				.filter((offset) => {
					return (
						this.content[position.x + offset[0]] &&
						this.content[position.x + offset[0]][position.y + offset[1]] &&
						filter(this.content[position.x + offset[0]][position.y + offset[1]], {
							x: position.x + offset[0],
							y: position.y + offset[1]
						})
					);
				})
				.map((offset) => {
					return { x: position.x + offset[0], y: position.y + offset[1] };
				})
		);
	}
	crop(area: area): Grid<T> {
		const minX = Math.max(area.p1.x, 0);
		const minY = Math.max(area.p1.y, 0);
		const maxX = Math.min(area.p2.x, this.width());
		const maxY = Math.min(area.p2.y, this.height());
		return new Grid<T>(
			this.content.slice(minX, maxX + 1).map((row) => {
				return row.slice(minY, maxY + 1);
			})
		);
	}
	get(position: vector): T {
		if (this.contains_position(position)) {
			return this.content[position.x][position.y];
		} else {
			throw new RangeError(`Not a valid position ${position.x}, ${position.y}`);
		}
	}
	set(position: vector, value: T): void {
		if (this.contains_position(position)) {
			this.content[position.x][position.y] = value;
		} else {
			throw new RangeError(`Not a valid position ${position.x}, ${position.y}`);
		}
	}
	map(callback: (value: T, position: vector) => T): Grid<T> {
		return new Grid<T>(
			this.content.map((row, x) => {
				return row.map((value, y) => {
					return callback(value, { x, y });
				});
			})
		);
	}
	width(): number {
		return this.content.length;
	}
	height(): number {
		if (this.content.length > 0) {
			return this.content[0].length;
		} else {
			return 0;
		}
	}
	dimensions(): vector {
		return {
			x: this.width(),
			y: this.height()
		};
	}
	area(): number {
		return this.width() * this.height();
	}
	forEach(callback: (value: T, position: vector) => unknown): void {
		this.content.forEach((row, x) => {
			row.forEach((value, y) => {
				callback(value, { x, y });
			});
		});
	}
	toString(): string {
		return this.content
			.map((row) => {
				return row
					.map((value) => {
						return value === undefined ? '.' : '#';
					})
					.join('');
			})
			.join('\n');
	}
	contains(value: T): boolean {
		return this.content.some((row) => {
			return row.some((v) => {
				return v === value;
			});
		});
	}
	find(value: T): vector | undefined {
		for (let x = 0; x < this.content.length; x++) {
			for (let y = 0; y < this.content[x].length; y++) {
				if (this.content[x][y] === value) {
					return { x, y };
				}
			}
		}
		return undefined;
	}
	extend(new_size: vector, value: T): Grid<T> {
		return new Grid<T>(
			this.content
				.map((row) => {
					return row.map((v) => {
						return v;
					});
				})
				.concat(new Array(new_size.x - this.width()).fill(new Array(new_size.y).fill(value)))
		);
	}
	flip_x(): Grid<T> {
		return new Grid<T>(
			this.content.map((row) => {
				return row.reverse();
			})
		);
	}
	flip_y(): Grid<T> {
		return new Grid<T>(this.content.reverse());
	}
	fill_undefined(value: T): Grid<T> {
		return new Grid<T>(
			this.content.map((row) => {
				return row.map((v) => {
					return v === undefined ? value : v;
				});
			})
		);
	}
	fill_all(value: T): Grid<T> {
		return new Grid<T>(
			this.content.map((row) => {
				return row.map(() => {
					return value;
				});
			})
		);
	}
	overlay(position: vector, grid: Grid<T>): Grid<T> {
		return new Grid<T>(
			this.content.map((row, x) => {
				return row.map((value, y) => {
					return value === undefined ? grid.get({ x: x + position.x, y: y + position.y }) : value;
				});
			})
		);
	}
	map_area(area: area, callback: (value: T, position: vector) => T): Grid<T> {
		return this.overlay({ x: area.p1.x, y: area.p1.y }, this.crop(area).map(callback));
	}
	fill_area(area: area, value: T): Grid<T> {
		return this.map_area(area, () => value);
	}
	pathfind(start: vector, end: vector, allowed: (value: T, position: vector) => boolean): vector[] {
		const path: vector[] = [];
		const visited: Set<vector> = new Set();
		const frontier: Set<vector> = new Set([start]);
		while (frontier.size > 0) {
			const current = Array.from(frontier)[0];
			frontier.delete(current);
			if (current === end) {
				break;
			}
			visited.add(current);
			for (const neighbour of this.neighbours(current, allowed)) {
				if (visited.has(neighbour)) {
					continue;
				}
				if (frontier.has(neighbour)) {
					continue;
				}
				frontier.add(neighbour);
				path.push(neighbour);
			}
		}
		if (visited.has(end)) {
			return path;
		} else {
			throw new Error(`No path from ${start} to ${end}`);
		}
	}
	contains_position(position: vector): boolean {
		return (
			position.x >= 0 && position.y >= 0 && position.x < this.width() && position.y < this.height()
		);
	}
	clone(): Grid<T> {
		return new Grid<T>(this.content);
	}
	deep_clone(): Grid<T> {
		return new Grid<T>(deepClone(this.content));
	}
	difference(other: Grid<T>): Array<vector> {
		const diff: Array<vector> = [];
		this.forEach((value, position) => {
			if (other.get(position) !== value) {
				diff.push(position);
			}
		});
		return diff;
	}
}