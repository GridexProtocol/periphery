import {expect, use} from "chai";
import {jestSnapshotPlugin} from "mocha-chai-jest-snapshot";
import {ContractTransaction} from "ethers";

use(jestSnapshotPlugin());

export {expect};

export async function snapshotGasCost(promise: Promise<ContractTransaction>) {
    const tx = await promise;
    const receipt = await tx.wait();
    expect(receipt.gasUsed.toNumber()).toMatchSnapshot();
}
