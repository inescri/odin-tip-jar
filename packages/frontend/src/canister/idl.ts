import { IDL } from '@dfinity/candid';
import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

/**
 * Candid interface for the app canister. Kept in sync by hand with the
 * generated `.did` (see `dfx build canister --check` output):
 *
 *   type Tip = record {
 *     id: nat; from: principal; to: principal;
 *     tokenId: text; amount: nat; timestamp: nat64;
 *   };
 *   getBalance:        (text) -> (nat) query
 *   getBalances:       () -> (vec record { text; nat }) query
 *   getOwner:          () -> (opt principal) query
 *   deposit:           (text, nat) -> (nat)
 *   withdraw:          (text, nat) -> (nat)
 *   tip:               (principal, text, nat) -> (nat)
 *   getRecentTips:     (nat) -> (vec Tip) query
 *   getTipsFor:        (principal, nat) -> (vec Tip) query
 *   getReceivedTotals: (principal) -> (vec record { text; nat }) query
 *
 * Tokens are identified by their Odin token id (text), not an ICRC ledger
 * principal — every Odin token shares one ledger, addressed by subaccount.
 */
export const idlFactory: IDL.InterfaceFactory = ({ IDL }) => {
    const Tip = IDL.Record({
        id: IDL.Nat,
        from: IDL.Principal,
        to: IDL.Principal,
        tokenId: IDL.Text,
        amount: IDL.Nat,
        timestamp: IDL.Nat64,
    });
    const Totals = IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat));
    return IDL.Service({
        getBalance: IDL.Func([IDL.Text], [IDL.Nat], ['query']),
        getBalances: IDL.Func([], [Totals], ['query']),
        getOwner: IDL.Func([], [IDL.Opt(IDL.Principal)], ['query']),
        deposit: IDL.Func([IDL.Text, IDL.Nat], [IDL.Nat], []),
        withdraw: IDL.Func([IDL.Text, IDL.Nat], [IDL.Nat], []),
        tip: IDL.Func([IDL.Principal, IDL.Text, IDL.Nat], [IDL.Nat], []),
        getRecentTips: IDL.Func([IDL.Nat], [IDL.Vec(Tip)], ['query']),
        getTipsFor: IDL.Func(
            [IDL.Principal, IDL.Nat],
            [IDL.Vec(Tip)],
            ['query'],
        ),
        getReceivedTotals: IDL.Func([IDL.Principal], [Totals], ['query']),
    });
};

/** One public tip-feed entry, as returned by the canister. */
export interface Tip {
    id: bigint;
    from: Principal;
    to: Principal;
    /** Odin token id. */
    tokenId: string;
    amount: bigint;
    /** IC time: nanoseconds since the Unix epoch. */
    timestamp: bigint;
}

export interface CanisterActor {
    getBalance: ActorMethod<[string], bigint>;
    getBalances: ActorMethod<[], Array<[string, bigint]>>;
    getOwner: ActorMethod<[], [] | [Principal]>;
    deposit: ActorMethod<[string, bigint], bigint>;
    withdraw: ActorMethod<[string, bigint], bigint>;
    tip: ActorMethod<[Principal, string, bigint], bigint>;
    getRecentTips: ActorMethod<[bigint], Tip[]>;
    getTipsFor: ActorMethod<[Principal, bigint], Tip[]>;
    getReceivedTotals: ActorMethod<[Principal], Array<[string, bigint]>>;
}
