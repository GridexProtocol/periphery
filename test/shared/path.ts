import {utils} from "ethers";
import {Resolution} from "./util";

const ADDR_SIZE = 20;
const RESOLUTION_SIZE = 3;
const PROTOCOL_SIZE = 1;
const OFFSET = ADDR_SIZE + RESOLUTION_SIZE + PROTOCOL_SIZE;
const DATA_SIZE = OFFSET + ADDR_SIZE;

export function encodePath(path: string[], resolutions: Resolution[], protocols: number[]): string {
    if (path.length != resolutions.length + 1) {
        throw new Error("path/resolution lengths do not match");
    }

    let encoded = "0x";

    for (let i = 0; i < resolutions.length; i++) {
        // 20 bytes encoding of the address
        encoded += path[i].slice(2);
        // 1 byte encoding of the protocol
        encoded += protocols[i].toString(16).padStart(2 * PROTOCOL_SIZE, "0");
        // 3 bytes encoding of the resolution
        encoded += resolutions[i].toString(16).padStart(2 * RESOLUTION_SIZE, "0");
    }

    // encode the final token
    encoded += path[path.length - 1].slice(2);

    return encoded.toLowerCase();
}

function decodeOne(tokenResolutionToken: Buffer): [[string, string], number, number] {
    // reads the first 20 bytes for the token address
    const tokenABytes = tokenResolutionToken.subarray(0, ADDR_SIZE);
    const tokenA = utils.getAddress("0x" + tokenABytes.toString("hex"));

    // reads the next 1 byte for the protocol
    const protocolBytes = tokenResolutionToken.subarray(ADDR_SIZE, ADDR_SIZE + PROTOCOL_SIZE);
    const protocol = protocolBytes.readUintBE(0, PROTOCOL_SIZE);

    // reads the next 3 bytes for the resolution
    const resolutionBytes = tokenResolutionToken.subarray(ADDR_SIZE + PROTOCOL_SIZE, OFFSET);
    const resolution = resolutionBytes.readUintBE(0, RESOLUTION_SIZE);

    // reads the next 20 bytes for the token address
    const tokenBBytes = tokenResolutionToken.subarray(OFFSET, DATA_SIZE);
    const tokenB = utils.getAddress("0x" + tokenBBytes.toString("hex"));

    return [[tokenA, tokenB], protocol, resolution];
}

export function decodePath(path: string): [string[], number[], number[]] {
    let data = Buffer.from(path.slice(2), "hex");

    let tokens: string[] = [];
    let resolutions: number[] = [];
    let protocols: number[] = [];
    let i = 0;
    let finalToken: string = "";
    while (data.length >= DATA_SIZE) {
        const [[tokenA, tokenB], protocol, resolution] = decodeOne(data);
        finalToken = tokenB;
        tokens = [...tokens, tokenA];
        resolutions = [...resolutions, resolution];
        protocols = [...protocols, protocol];
        data = data.subarray((i + 1) * OFFSET);
        i += 1;
    }
    tokens = [...tokens, finalToken];

    return [tokens, protocols, resolutions];
}
