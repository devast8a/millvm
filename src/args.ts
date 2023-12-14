export function p(address: number) {
    return new ProgramAddress(address);
}

export class ProgramAddress {
    constructor(
        readonly address: number,
    ) { }
}

export function b(address: number) {
    return new ProgramAddress(address);
}

export class BeltAddress {
    constructor(
        readonly address: number,
    ) { }
}

export function m(address: number) {
    return new ProgramAddress(address);
}

export class MemoryAddress {
    constructor(
        readonly address: number,
    ) { }
}