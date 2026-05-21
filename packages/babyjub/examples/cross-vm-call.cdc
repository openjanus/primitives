// cross-vm-call.cdc — Call BabyJub.babyAdd from Cadence via COA pattern
//
// This example shows how to call the BabyJub.sol EVM contract from a Cadence
// transaction. The COA (Cadence Owned Account) pattern lets a Cadence account
// atomically dispatch EVM calls within a single Flow transaction.
//
// Prerequisites:
//   - The signer's account must have a COA at /storage/evm
//   - BabyJub.sol must be deployed (it is, at 0x27139AFda7425f51F68D32e0A38b7D43BcB0f870)
//
// Example invocation (flow CLI):
//   flow transactions send examples/cross-vm-call.cdc \
//     --network testnet \
//     --signer your-account \
//     --args-json '[
//       {"type":"UInt256","value":"995203441582195749578291179787384436505546430278305826713579947235728471134"},
//       {"type":"UInt256","value":"5472060717959818805561601436314318772137091100104008585924551046643952123905"},
//       {"type":"UInt256","value":"995203441582195749578291179787384436505546430278305826713579947235728471134"},
//       {"type":"UInt256","value":"5472060717959818805561601436314318772137091100104008585924551046643952123905"}
//     ]'
//
// Expected output for G + G (point doubling):
//   x = 1676417244152142056454616115823988517566305896059373631785843290555309632953
//   y = 11563908930482997415800970727888501192209530935490958274440594569809848042842

import "EVM"

transaction(x1: UInt256, y1: UInt256, x2: UInt256, y2: UInt256) {

    prepare(signer: auth(BorrowValue) &Account) {

        // Borrow the COA — must have EVM.Call entitlement
        let coa = signer.storage.borrow<auth(EVM.Call) &EVM.CadenceOwnedAccount>(
            from: /storage/evm
        ) ?? panic("No COA at /storage/evm")

        // BabyJub.sol deployed on Flow EVM testnet
        let babyJubAddr = "0x27139AFda7425f51F68D32e0A38b7D43BcB0f870"

        // ABI-encode the babyAdd call
        let calldata = EVM.encodeABIWithSignature(
            "babyAdd(uint256,uint256,uint256,uint256)",
            [x1, y1, x2, y2]
        )

        // Dispatch to EVM — babyAdd costs ~34,511 gas
        // Note: EVM gas cost does NOT count against Cadence CU budget
        let result = coa.call(
            to: EVM.addressFromString(babyJubAddr),
            data: calldata,
            gasLimit: 80_000,
            value: EVM.Balance(attoflow: 0)
        )

        // IMPORTANT: Always check EVM status. A failed EVM call does NOT
        // automatically revert the surrounding Cadence transaction.
        assert(
            result.status == EVM.Status.successful,
            message: "babyAdd EVM call failed: ".concat(result.errorMessage)
        )

        // Decode the returned (uint256, uint256) tuple
        let decoded = EVM.decodeABI(
            types: [Type<UInt256>(), Type<UInt256>()],
            data: result.data
        )
        let x3 = decoded[0] as! UInt256
        let y3 = decoded[1] as! UInt256

        log("BabyAdd result: ("
            .concat(x3.toString())
            .concat(", ")
            .concat(y3.toString())
            .concat(")"))
    }
}
