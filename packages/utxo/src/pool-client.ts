/**
 * pool-client.ts — UTXOPool contract client (ethers v6).
 *
 * Provides typed methods for querying UTXOPool state.
 * NOTE: Write operations (shield, transfer, unshield) are called through
 * a Cadence COA or directly from an EOA. This client is read-only for
 * state queries and ABI encoding.
 *
 * Deployed addresses (Flow EVM testnet — reuse, do NOT redeploy):
 *   UTXOPool:               0x6c1c172068f8325bd1f6564bc2fBa5B0A9BB1725
 *   ShieldGroth16Verifier:  0xCDfc8496C28a6d7e931C2A4FC95709381A43365D
 *   TransferGroth16Verifier: 0x25bd550F8fE81A0A9f5bf43a0BCf40152F9C4674
 *   UnshieldGroth16Verifier: 0xbe5449F55D1edb695aA08a5cee34885AcD60DC50
 *   PoseidonT3:             0xAA31b4EE06282d2580550C25dC32B5EAF0712F1E
 *   PoseidonT4:             0xda71Ba9ecAb56dAa64fEc9CD6fC2a8782862CF25
 */

import { Contract, Interface, JsonRpcProvider } from "ethers";
import type { Provider } from "ethers";
import type { SolidityProof, UTXOAddresses } from "./types.js";

// ── Deployed addresses ────────────────────────────────────────────────────────

export const TESTNET_ADDRESSES: UTXOAddresses = {
  utxoPool:         "0x6c1c172068f8325bd1f6564bc2fBa5B0A9BB1725",
  shieldVerifier:   "0xCDfc8496C28a6d7e931C2A4FC95709381A43365D",
  transferVerifier: "0x25bd550F8fE81A0A9f5bf43a0BCf40152F9C4674",
  unshieldVerifier: "0xbe5449F55D1edb695aA08a5cee34885AcD60DC50",
  poseidonT3:       "0xAA31b4EE06282d2580550C25dC32B5EAF0712F1E",
  poseidonT4:       "0xda71Ba9ecAb56dAa64fEc9CD6fC2a8782862CF25",
};

export const FLOW_EVM_TESTNET_RPC = "https://testnet.evm.nodes.onflow.org";
export const FLOW_EVM_TESTNET_CHAIN_ID = 545;

// ── ABI ───────────────────────────────────────────────────────────────────────

const UTXO_POOL_ABI = [
  // Read
  "function getCurrentRoot() view returns (uint256)",
  "function getNextLeafIndex() view returns (uint256)",
  "function isNullifierUsed(uint256 nullifierHash) view returns (bool)",
  "function isHistoricalRoot(uint256 root) view returns (bool)",
  "function getMerkleZero(uint8 level) view returns (uint256)",
  "function getFilledSubtree(uint8 level) view returns (uint256)",
  "function nextLeafIndex() view returns (uint256)",
  "function currentRoot() view returns (uint256)",
  "function TREE_DEPTH() view returns (uint8)",
  "function MAX_LEAVES() view returns (uint256)",
  "function cadenceCOAAddress() view returns (address)",

  // Write (call through COA or EOA)
  "function shield(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256 commitment, uint256 publicAmount)",
  "function transfer(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256 oldNullifierHash, uint256 newCommitment, uint256 root)",
  "function unshield(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256 nullifierHash, uint256 publicAmount, uint256 root, address recipient)",

  // Events
  "event Shielded(uint256 indexed commitment, uint256 leafIndex, uint256 newRoot)",
  "event Transferred(uint256 indexed oldNullifierHash, uint256 indexed newCommitment, uint256 newLeafIndex, uint256 newRoot)",
  "event Unshielded(uint256 indexed nullifierHash, uint256 amount, address indexed recipient)",
];

// ── Pool Client ───────────────────────────────────────────────────────────────

export class UTXOPoolClient {
  private readonly contract: Contract;
  readonly iface: Interface;
  readonly address: string;

  constructor(address: string, provider: Provider) {
    this.address = address;
    this.iface = new Interface(UTXO_POOL_ABI);
    this.contract = new Contract(address, UTXO_POOL_ABI, provider);
  }

  /** Create a client connected to the Flow EVM testnet using the canonical addresses. */
  static testnet(): UTXOPoolClient {
    const provider = new JsonRpcProvider(FLOW_EVM_TESTNET_RPC, {
      chainId: FLOW_EVM_TESTNET_CHAIN_ID,
      name: "flow-evm-testnet",
    });
    return new UTXOPoolClient(TESTNET_ADDRESSES.utxoPool, provider);
  }

  // ── Read methods ─────────────────────────────────────────────────────────────

  async getCurrentRoot(): Promise<bigint> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return (this.contract["getCurrentRoot"] as () => Promise<bigint>)();
  }

  async getNextLeafIndex(): Promise<bigint> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return (this.contract["getNextLeafIndex"] as () => Promise<bigint>)();
  }

  async isNullifierUsed(nullifierHash: bigint): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return (this.contract["isNullifierUsed"] as (h: bigint) => Promise<boolean>)(nullifierHash);
  }

  async isHistoricalRoot(root: bigint): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return (this.contract["isHistoricalRoot"] as (r: bigint) => Promise<boolean>)(root);
  }

  async getMerkleZero(level: number): Promise<bigint> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return (this.contract["getMerkleZero"] as (l: number) => Promise<bigint>)(level);
  }

  async getFilledSubtree(level: number): Promise<bigint> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return (this.contract["getFilledSubtree"] as (l: number) => Promise<bigint>)(level);
  }

  // ── ABI encoding (for Cadence COA calls) ─────────────────────────────────────

  /**
   * Encode shield() calldata for use in a Cadence COA call.
   * The COA call passes this hex to EVM.call().
   */
  encodeShield(
    proof: SolidityProof,
    commitment: bigint,
    publicAmount: bigint
  ): string {
    return this.iface.encodeFunctionData("shield", [
      proof.pA,
      proof.pB,
      proof.pC,
      commitment,
      publicAmount,
    ]);
  }

  /**
   * Encode transfer() calldata.
   * Transfer is permissionless — can be called from any EOA or COA.
   */
  encodeTransfer(
    proof: SolidityProof,
    oldNullifierHash: bigint,
    newCommitment: bigint,
    root: bigint
  ): string {
    return this.iface.encodeFunctionData("transfer", [
      proof.pA,
      proof.pB,
      proof.pC,
      oldNullifierHash,
      newCommitment,
      root,
    ]);
  }

  /**
   * Encode unshield() calldata for use in a Cadence COA call.
   * Only the Cadence COA address can call unshield.
   */
  encodeUnshield(
    proof: SolidityProof,
    nullifierHash: bigint,
    publicAmount: bigint,
    root: bigint,
    recipient: string
  ): string {
    return this.iface.encodeFunctionData("unshield", [
      proof.pA,
      proof.pB,
      proof.pC,
      nullifierHash,
      publicAmount,
      root,
      recipient,
    ]);
  }

  // ── Event scanning ────────────────────────────────────────────────────────────

  /**
   * Fetch all Shielded events from the pool.
   * Returns commitment → { leafIndex, newRoot, blockNumber }.
   *
   * NOTE: Use this to rebuild the local Merkle tree state after a restart.
   * The on-chain contract does not store leaf values — they must be derived
   * from events.
   */
  async getShieldedEvents(fromBlock = 0): Promise<Array<{
    commitment: bigint;
    leafIndex: bigint;
    newRoot: bigint;
    blockNumber: number;
  }>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const filter = ((this.contract["filters"] as unknown) as { Shielded: () => unknown }).Shielded();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const events = await (this.contract["queryFilter"] as (f: unknown, b: number) => Promise<Array<{ args?: [bigint, bigint, bigint]; blockNumber: number }>>)(filter, fromBlock);
    return events.map(e => {
      const args = e.args!;
      return {
        commitment: args[0]!,
        leafIndex: args[1]!,
        newRoot: args[2]!,
        blockNumber: e.blockNumber,
      };
    });
  }
}
