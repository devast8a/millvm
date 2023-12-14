import { Address, b, BeltIndex, BELT_SIZE, Immediate, State } from './millvm';
import { assert } from './util';
import { Meta, Type, Types, Value, Vector } from './Vector';

enum Overflow {
    Extend,
    Saturate,
    Trap,
    Wrap,
}

type Result =
    | bigint
    | boolean
    | null
    | number
    ;

function IsTrue(value: bigint) {
    return (value & 1n) === 1n;
}

function CountTotalOnes(value: bigint) {
    let count = 0n;
    while (value > 0n) {
        count += 1n;
        value &= (value - 1n);
    }
    return count;
}

function CountRightOnes(value: bigint) {
    let count = 0n;
    while ((value & 1n) === 1n) {
        count += 1n;
        value = value >> 1n;
    }
    return count;
}

function CountLeftOnes(value: bigint, bits: number) {
    let mask = 1n << BigInt(bits - 1);
    let count = 0n;
    while ((value & mask) > 0n) {
        count += 1n;
        mask = mask >> 1n;
    }
    return count;
}

interface Options {
    latency?: number;
    overflow?: Overflow;
}

export interface Op {
    readonly name: string;
    readonly latency: number;

    execute(state: State): Vector[]
}

export interface OperationConstructor<T extends any[]> {
    (...args: T): Op;
    operationName: string;
}

function convert(result: Result) {
    switch (typeof result) {
        case 'bigint': return result;
        case 'boolean': return result ? -1n : 0n;
        case 'number': return BigInt(result);
        case 'object': return null;
    }
}

function op1(fn: (x: bigint, type: Type) => Result, options?: Options) {
    return op((state, x: BeltIndex) => {
        const xs = state.belt.get(x);

        const { type, length } = xs;

        const values = [];
        for (let i = 0; i < length; i++) {
            const x = xs.values[i];
            const meta = x.meta;

            if (meta !== Meta.Value) {
                values.push(new Value(0n, meta));
                continue;
            }

            const result = convert(fn(x.value, type));
            if (result === null) {
                values.push(Value.None);
                continue;
            }

            values.push(new Value(type.round(result), Meta.Value));
        }

        return [new Vector(type, values)];
    })
}

function constant(xs: Vector, x: Immediate | null) {
    const value = x === null ? new Value(0n, Meta.None) : new Value(BigInt(x.value), Meta.Value);
    return new Vector(xs.type, new Array(xs.length).fill(value));
}

function op2(fn: (x: bigint, y: bigint, type: Type) => Result, options?: Options) {
    return op((state, x: BeltIndex, y: BeltIndex | Immediate | null) => {
        const xs = state.belt.get(x);
        const ys = y instanceof BeltIndex ? state.belt.get(y) : constant(xs, y);

        assert(xs.type === ys.type);
        assert(xs.length === ys.length);

        const type = xs.type;
        const length = xs.length;

        const values = [];
        for (let i = 0; i < length; i++) {
            const x = xs.values[i];
            const y = ys.values[i];
            const meta = Meta.merge(x.meta, y.meta);

            if (meta !== Meta.Value) {
                values.push(new Value(0n, meta));
                continue;
            }

            const result = convert(fn(x.value, y.value, type));
            if (result === null) {
                values.push(Value.None);
                continue;
            }

            values.push(new Value(type.round(result), Meta.Value));
        }

        return [new Vector(type, values)];
    })
}
function reduce1(fn: (xs: bigint[]) => Result, options?: Options) {
    return op(() => { });
}
function meta1(fn: (x: Meta) => Result, options?: Options) {
    return op(() => { });
}
function gang0(fn: (x: Meta) => Result, options?: Options) {
    return op(() => { });
}

function op<T extends any[]>(fn: (state: State, ...parameters: T) => Vector[] | void): OperationConstructor<T> {
    const cons = (...args: T) => {
        return {
            name: cons.operationName,
            latency: 1,
            execute(state: State) {
                return fn(state, ...args) ?? []
            }
        }
    };

    cons.operationName = '';

    return cons;
}

export const Ops = {
    AddE: op2((x, y) => x + y, { overflow: Overflow.Extend }),
    AddS: op2((x, y) => x + y, { overflow: Overflow.Saturate }),
    AddT: op2((x, y) => x + y, { overflow: Overflow.Trap }),
    AddW: op2((x, y) => x + y, { overflow: Overflow.Wrap }),

    SubE: op2((x, y) => x - y, { overflow: Overflow.Extend }),
    SubS: op2((x, y) => x - y, { overflow: Overflow.Saturate }),
    SubT: op2((x, y) => x - y, { overflow: Overflow.Trap }),
    SubW: op2((x, y) => x - y, { overflow: Overflow.Wrap }),

    MulE: op2((x, y) => x * y, { latency: 3, overflow: Overflow.Extend }),
    MulS: op2((x, y) => x * y, { latency: 3, overflow: Overflow.Saturate }),
    MulT: op2((x, y) => x * y, { latency: 3, overflow: Overflow.Trap }),
    MulW: op2((x, y) => x * y, { latency: 3, overflow: Overflow.Wrap }),

    All:  reduce1((xs) => xs.every(IsTrue)),
    Any:  reduce1((xs) => xs.some(IsTrue)),
    None: reduce1((xs) => !xs.some(IsTrue)),

    GetCarry:       gang0((unit) => unit),
    GetOverflow:    gang0((unit) => unit),

    CountLeftOnes:  op1((x, t) => CountLeftOnes(x, t.bits)),
    CountLeftZeros: op1((x, t) => CountLeftOnes(~x & t.mask, t.bits)),
    CountRightOnes: op1((x, t) => CountRightOnes(x)),
    CountRightZero: op1((x, t) => CountRightOnes(~x & t.mask)),
    CountTotalOnes: op1((x, t) => CountTotalOnes(x)),
    CountTotalZero: op1((x, t) => CountTotalOnes(~x & t.mask)),

    BitwiseAnd:     op2((x, y) => x & y),
    BitwiseNand:    op2((x, y) => ~(x & y)),
    BitwiseNor:     op2((x, y) => ~(x | y)),
    BitwiseNot:     op1((x) => ~x),
    BitwiseNxor:    op2((x, y) => ~(x ^ y)),
    BitwiseOr:      op2((x, y) => x | y),
    BitwiseXor:     op2((x, y) => x ^ y),

    BitClear:  op2((x, y) => x & ~(1n << y)),
    BitSet:    op2((x, y) => x | (1n << y)),
    BitToggle: op2((x, y) => x ^ (1n << y)),
    BitTest:   op2((x, y) => ((x >> y) & 1n) === 1n),

    CompareEQ: op2((x, y) => x === y),
    CompareGE: op2((x, y) => x >=  y),
    CompareGT: op2((x, y) => x >   y),
    CompareLE: op2((x, y) => x <=  y),
    CompareLT: op2((x, y) => x <   y),
    CompareNE: op2((x, y) => x !== y),

    ShiftL: op2((x, y) => x << y),
    ShiftR: op2((x, y) => x >> y),

    IsValue: meta1((x) => x === Meta.Value),
    IsError: meta1((x) => x === Meta.Error),
    IsNone:  meta1((x) => x === Meta.None),

    Load: op((state, address: Address, type: Type, count: number) => [state.memory.load(state, address, type, count)]),
    Store: op((state, address: Address, value: BeltIndex) => state.memory.store(address, state.belt.get(value))),

    Constant: op((state, type: Type, ...values: Result[]) => {
        return [new Vector(type, values.map(value => {
            value = convert(value);
            return value === null ? Value.None : new Value(value, Meta.Value);
        }))];
    }),

    Smear: op((state, x: BeltIndex) => {
        const xs = state.belt.get(x);

        const values = [];

        let previous = false;
        for (let x of xs.values) {
            if (previous) {
                values.push(new Value(-1n, Meta.Value));
            } else {
                previous = x.meta === Meta.Value && IsTrue(x.value);
                values.push(new Value(0n, Meta.Value));
            }
        }

        return [new Vector(Types.Bool, values), new Vector(Types.Bool, [new Value(previous ? -1n : 0n, Meta.Value)])]
    }),

    Pick: op((state, select: BeltIndex, t: BeltIndex | Immediate | null, f: BeltIndex) => {
        const sv = state.belt.get(select);
        const fv = state.belt.get(f);
        const tv = t instanceof BeltIndex ? state.belt.get(t) : constant(fv, t);

        assert(sv.length === fv.length && sv.length === tv.length);
        assert(sv.type === Types.Bool && tv.type === fv.type);

        const values = sv.values.map((value, index) => {
            if (IsTrue(value.value)) {
                return tv.values[index];
            } else {
                return fv.values[index];
            }
        });

        return [new Vector(tv.type, values)]
    }),

    Debug: op(state => {
        for (let i = BELT_SIZE - 1; i >= 0; i--) {
            console.log(`  ${i.toString().padStart(2)} ${state.belt.get(b(i))}`);
        }
    }),

    BranchFalse: op((state, value: BeltIndex, address: number) => {
        //state.pc = address;
    }),
}

for (const name in Ops) {
    const x = ((Ops as any)[name] as OperationConstructor<any>);
    x.operationName = name;
}
