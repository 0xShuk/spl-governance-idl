import * as anchor from "@project-serum/anchor";
import * as web3 from "@solana/web3.js";
import secret from "../secret.json";
import * as token from "@solana/spl-token";
import { PublicKey, Keypair, Connection} from "@solana/web3.js";
import { Program, BN, Wallet, AnchorProvider } from "@project-serum/anchor";
import {IDL, idl} from "./idl";

const keyPair: Keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secret));
const wallet = new Wallet(keyPair);

const connection: Connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl('devnet'), "confirmed");
const provider = new AnchorProvider(connection,wallet as anchor.Wallet,{});

let programId = new PublicKey(idl.metadata.address);
const program = new Program<IDL>(idl as IDL,programId,provider);

(async() => {
    // Create Community Mint
    const communityMint = await token.createMint(connection, keyPair, keyPair.publicKey, keyPair.publicKey, 6);
    console.log(communityMint.toBase58());

    // Create Council Mint
    const councilMint = await token.createMint(connection, keyPair, keyPair.publicKey, keyPair.publicKey, 0);
    console.log(councilMint.toBase58());

    const name = "DAO TEST ZZ"

    const [governanceRealmAccount] = PublicKey.findProgramAddressSync([
        Buffer.from("governance"), 
        Buffer.from(name)
    ], programId);

    const [communityTokenHoldingAccount] = PublicKey.findProgramAddressSync([
        Buffer.from("governance"), 
        governanceRealmAccount.toBytes(),
        communityMint.toBytes()
    ], programId);

    const [councilTokenHoldingAccount] = PublicKey.findProgramAddressSync([
        Buffer.from("governance"), 
        governanceRealmAccount.toBytes(),
        councilMint.toBytes()
    ], programId);
    
    const [realmConfig] = PublicKey.findProgramAddressSync([
        Buffer.from("realm-config"), 
        governanceRealmAccount.toBytes()
    ], programId);

    const tx = await program.methods.createRealm(
        {createRealm: {}},
        name, 
        {
        useCouncilMint: true,
        minCommunityWeightToCreateGovernance: new BN(1000000),
        communityTokenConfigArgs: {
            useVoterWeightAddin: false,
            useMaxVoterWeightAddin: false,
            tokenType: {
                liquid: {}
            }
        },
        councilTokenConfigArgs: {
            useVoterWeightAddin: false,
            useMaxVoterWeightAddin: false,
            tokenType: {
                membership: {}
            }
        },
        communityMintMaxVoterWeightSource: {
            supplyFraction: {
                0: new BN(10000000000)
            }
        }
    }).accounts({
        governanceRealmAccount,
        realmAuthority: keyPair.publicKey,
        communityTokenMint: communityMint,
        tokenHoldingAccount: communityTokenHoldingAccount,
        payer: keyPair.publicKey,
        systemProgram: web3.SystemProgram.programId,
        splTokenProgram: token.TOKEN_PROGRAM_ID,
        sysVarRent: web3.SYSVAR_RENT_PUBKEY,
        councilTokenMint: councilMint,
        councilTokenHolding: councilTokenHoldingAccount,
        realmConfig: realmConfig,
        communityVoterWeight: null,
        councilVoterWeight: null,
        maxCommunityVoterWeight: null,
        maxCouncilVoterWeight: null,
    }).transaction();

    tx.instructions[0].data = tx.instructions[0].data.subarray(8, tx.instructions[0].data.length);

    const sig = await web3.sendAndConfirmTransaction(connection, tx, [keyPair]);

    console.log("TX :", sig);
    console.log("DAO Address: ", governanceRealmAccount.toBase58());
})()