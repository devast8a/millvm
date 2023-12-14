import { assert } from './util';
import * as util from 'util';

export class Type {
    readonly name: string;
    readonly signed: boolean;
    readonly mask: bigint;
    readonly bias: bigint;

    readonly bits: number;
    readonly bytes: number;

    constructor(name: string, signed: boolean, bits: number) {
        this.name = name;
        this.signed = signed;
        this.mask = (1n << BigInt(bits)) - 1n;
        this.bias = signed ? 1n << BigInt(bits - 1) : 0n;
        this.bits = bits;
        this.bytes = Math.ceil(bits / 8);
    }

    round(value: bigint) {
        return ((value + this.bias) & this.mask) - this.bias;
    }
}

export const Types = {
    Bool: new Type('Bool', true, 1),

    U8: new Type('U8', false, 8),
    U16: new Type('U16', false, 16),
    U32: new Type('U32', false, 32),
    U64: new Type('U64', false, 64),

    S8: new Type('S8', true, 8),
    S16: new Type('S16', true, 16),
    S32: new Type('S32', true, 32),
    S64: new Type('S64', true, 64),
}

export enum Meta {
    Value   = 0b00,
    None    = 0b01,
    Error   = 0b11,
}

export namespace Meta {
    export function merge(left: Meta, right: Meta) {
        return (left | right) as Meta;
    }
}

export class Value {
    constructor(
        readonly value: bigint,
        readonly meta: Meta,
    ) { }

    static readonly None = new Value(0n, Meta.None);
}


export class Vector {
    constructor(
        readonly type: Type,
        readonly values: ReadonlyArray<Value>,
    ) { }

    get length() {
        return this.values.length;
    }

    [util.inspect.custom]() {
        const values = this.values.map(({ value, meta }) => {
            switch (meta) {
                case Meta.Value: {
                    if (this.type === Types.Bool) {
                        return value === -1n ? 'T' : '_';
                    }
                    return `${value}`;
                };
                case Meta.None: return 'None';
                case Meta.Error: return 'Error';
            }
        }).map(x => x.padStart(4)).join(' ');

        return `Vec<${this.type.name}>`.padEnd(10) + values;
    }

    toString() {
        return this[util.inspect.custom]();
    }
}