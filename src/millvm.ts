import { Op, Ops } from './operations';
import { assert } from './util';
import { Meta, Type, Types, Value, Vector } from './Vector';

export { Ops } from './operations';
export { Types } from './Vector';

// == Configuration ============================================================
export const BELT_SIZE = 40;
export const MEMORY_SIZE = 128 * 1024 * 1024;  // 128 MB

// The size of registers (in bits)
export const REGISTER_SIZE = 256;

export const EXECUTION_UNITS = [
];

// == Virtual Machine State ====================================================
export class State {
    constructor(
        public pc: number,
        readonly belt: Belt,
        readonly units: Unit[],
        readonly memory: Memory,
    ) { }
}

export class Unit {
    constructor(
        readonly id: number,
    ) { }
}

export function b(index: number) {
    return new BeltIndex(index);
}

export class BeltIndex {
    constructor(readonly index: number) {}
};

export function i(index: number) {
    return new Immediate(index);
}

export class Immediate {
    constructor(readonly value: number) {}
};

export interface Address {
    base:    BeltIndex | number,
    offset?: BeltIndex | number,
    index?:  BeltIndex | number,
    scale?:  BeltIndex | number,
}

export class Memory {
    memory = new Uint8Array(MEMORY_SIZE);

    load(state: State, address: Address, type: Type, count: number): Vector {
        const base = Number(state.belt.get(address.base as BeltIndex).values[0].value);
        const length = type.bytes * count;

        const values = [];
        for (let index = 0; index < length; index++) {
            values.push(new Value(
                BigInt(this.memory[base + index]),
                Meta.Value,
            ));
        }

        return new Vector(type, values)
    }

    store(state: State, address: Address, vector: Vector) {
        const base = Number(state.belt.get(address.base as BeltIndex).values[0].value);
        const length = type.bytes * count;

        const values = [];
        for (let index = 0; index < length; index++) {
            values.push(new Value(
                BigInt(this.memory[base + index]),
                Meta.Value,
            ));
        }

        return new Vector(type, values)
    }
}

export class Belt {
    public index: number;
    private size: number;
    private values: Array<Vector>;

    constructor(size: number) {
        this.index = 0;
        this.size = size * 2;
        this.values = new Array(size * 2).fill(new Vector(Types.Bool, []));
    }

    push(value: Vector) {
        this.index = (this.index + 1) % this.size;
        this.values[this.index] = value;
    }

    get(index: BeltIndex) {
        const offset = (this.size + this.index - index.index) % this.size;
        return this.values[offset];
    }
}

interface Instruction {
    read?: Op[];
    compute?: Op[];
    pick?: Op[];
    write?: Op[];
}

export function Instructions(...instructions: Instruction[]) {
    return instructions;
}

function execute(state: State, ops: Op[] | undefined) {
    if (ops === undefined) {
        return;
    }

    const values = ops.flatMap(op => {
        const result = op.execute(state);

        console.log(op.name.padEnd(20) + ' -> ' + (result[0] ?? '<none>'));

        return result;
    });

    for (const value of values) {
        state.belt.push(value);
    }
}

export function simulate(program: Instruction[]) {
    const state = new State(
        0,
        new Belt(BELT_SIZE),
        [],
        new Memory(),
    )

    for (let i = 10000; i < 15000; i += 4) {
        state.memory.memory[i + 0] = 100 + Math.floor(Math.random() * 100);
        state.memory.memory[i + 1] = 100 + Math.floor(Math.random() * 100);
        state.memory.memory[i + 2] = 100 + Math.floor(Math.random() * 100);
        state.memory.memory[i + 3] = 100 + Math.floor(Math.random() * 100);
    }

    while (state.pc < program.length) {
        console.log('---------------------')
        const ins = program[state.pc++];

        execute(state, ins.read);
        execute(state, ins.compute);
        execute(state, ins.pick);
        execute(state, ins.write);
    }
}