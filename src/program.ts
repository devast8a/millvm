import { b, Instructions, Ops, Types, simulate, i } from './millvm';

function repeat<T>(value: T, count: number) {
    return new Array(count).fill(value);
}

// Create a fake string
const data = [];
for (let i = 0; i < 32; i++) {
    data.push(i + 20);
}

const data2 = [];
for (let i = 0; i < 32; i++) {
    data2.push(i + 50);
}
data[26] = 0;
data2[16] = 0;
// "strcpy" implementation
//  Not implemented yet:
//  - Loads, so we simulate a load with a constant op.
//  - Stores, so we push the result onto the belt and pretend we did something useful.
//  - Branches, so we only do a single iteration
export const program = Instructions(
    // Instructions are executed in phases: read > compute > pick > write
    // The outputs of operations in a phase are pushed to the belt all at once. This has two significant implications.
    //  - Operations can use the output of operations in the same instruction, iff they execute in an earlier phase.
    //  - Operations can *not* use the output of operations in the same phase (or later phases)
    {
        read: [
            // Constant pushes a vector onto the belt (everything is a vector)
            // Loop counter
            Ops.Constant(Types.U8, ...repeat(null, 32)), // Loaded data         7

            Ops.Constant(Types.S64, 10000),             // Input pointer        6
            Ops.Constant(Types.S64, -64),               // Output pointer       5
            Ops.Constant(Types.Bool, ...repeat(0, 32)), // CompareEQ            4
            Ops.Constant(Types.Bool, 0),                // Smear-1              3
            Ops.Constant(Types.Bool, ...repeat(0, 32)), // Smear-2              2

            Ops.Constant(Types.U8, ...repeat(null, 32)), // Pick's data         1
        ],
        write: [
            Ops.Load({ base: b(5) }, Types.U8, 32),
        ]
    },

    {
        compute: [
            Ops.AddW(b(6), i(32)),       // Increment input pointer
            Ops.AddW(b(5), i(32)),       // Increment output pointer
            Ops.CompareEQ(b(0), i(0)),   // Compare data just read.
            Ops.Smear(b(4)),             // Previous smear
        ],
        pick: [
            Ops.Pick(b(1), null, b(12)),
        ],
        write: [
            Ops.BranchFalse(b(1), 1),
            Ops.Store({ base: b(4) }, b(0)),
            Ops.Load({ base: b(5) }, Types.U8, 32),
        ]
    },
);

simulate(program);
// Program output: 
//  Cycle: 1
//    Constant        -> Vec<U8>     20   21   22   23   24   25   26   27   28   29   30   31   32   33   34   35   36   37   38   39   40   41   42   43   44   45    0   47   48   49   50   51
//    Constant        -> Vec<U8>      0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0    0
//    Constant        -> Vec<U8>   None None None None None None None None None None None None None None None None None None None None None None None None None None None None None None None None
//    CompareEQ       -> Vec<Bool>    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    T    _    _    _    _    _
//  Cycle: 2
//    Smear           -> Vec<Bool>    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    _    T    T    T    T    T
//    Pick            -> Vec<U8>     20   21   22   23   24   25   26   27   28   29   30   31   32   33   34   35   36   37   38   39   40   41   42   43   44   45    0 None None None None None