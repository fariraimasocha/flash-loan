import {
    query,
    update,
    Canister,
    text,
    Record,
    StableBTreeMap,
    Ok,
    Err,
Vec,
    Result,
    nat64,
    ic,
    Opt,
    Variant,
} from 'azle';

import { v4 as uuidv4 } from 'uuid';

const FlashLoan = Record({
    id: text,
    borrower: text,
    lender: text,
    amount: nat64,
    startTime: nat64,
    endTime: nat64,
    status: text,
});

const FlashLoanPayload = Record({
    borrower: text,
    lender: text,
    amount: nat64,
    startTime: nat64,
    endTime: nat64,
});

const Asset = Record({
    id: text,
    amount: nat64,
    startTime: nat64,
    endTime: nat64,
    startTimeDiff: nat64,
    endTimeDiff: nat64,
    blockTime: nat64,
});

const AssetPayload = Record({
    borrower: text,
    lender: text,
    amount: nat64,
    startTime: nat64,
    endTime: nat64,
    startTimeDiff: nat64,
    endTimeDiff: nat64,
    blockTime: nat64,
});

const Error = Variant({
    NotFound: text,
    InvalidPayload: text,
});

const flashLoanStorage = StableBTreeMap(text, FlashLoan, 0);
const assetStorage = StableBTreeMap(text, Asset, 0);

export default Canister({
    // Create a new flash loan
    createFlashLoan: update([FlashLoanPayload], Result<FlashLoan, Error>, (payload) => {
        const flashLoan = {
            id: uuidv4(),
            borrower: payload.borrower,
            lender: payload.lender,
            amount: payload.amount,
            startTime: payload.startTime,
            endTime: payload.endTime,
            status: 'active',
            startTimeDiff: ic.time(),
            endTimeDiff: ic.time(),
        };
        flashLoanStorage.insert(flashLoan.id, flashLoan);
        return Ok(flashLoan);
    }),

    // Get a flash loan by ID
    getFlashLoan: query([text], Opt<FlashLoan>, (id) => {
        return flashLoanStorage.get(id);
    }),

    // Get all flash loans
    getAllFlashLoans: query([], Vec<FlashLoan>, () => {
        return flashLoanStorage.values();
    }),

    // Update a flash loan by ID
    updateFlashLoan: update([text, FlashLoanPayload], Result<FlashLoan, Error>, (id, payload) => {
        const currentFlashLoan = flashLoanStorage.get(id);
        if (currentFlashLoan) {
            const updatedFlashLoan = {
                ...currentFlashLoan,
                ...payload,
            };
            flashLoanStorage.insert(id, updatedFlashLoan);
            return Ok(updatedFlashLoan);
        } else {
            return Err({ NotFound: `Flash Loan not found with id=${id}` });
        }
    }),

    // Close a flash loan
    closeFlashLoan: update([text], Result<AssetPayload, Error>, (id) => {
        const flashLoan = flashLoanStorage.get(id);
        if (flashLoan) {
            if (flashLoan.status === 'active') {
                const endTimeDiff = ic.time() - flashLoan.endTimeDiff;
                if (endTimeDiff <= ic.duration(1000)) {
                    const borrower = flashLoan.borrower;
                    const lender = flashLoan.lender;
                    const amount = flashLoan.amount;
                    const startTimeDiff = flashLoan.startTimeDiff;
                    const endTime = flashLoan.endTime;
                    const blockTime = flashLoan.status === 'active' ? ic.time() : endTime;
                    const borrowerAsset = {
                        id: borrower,
                        amount: amount,
                        startTime,
                        endTime,
                        startTimeDiff,
                        endTimeDiff,
                        blockTime,
                    };
                    const lenderAsset = {
                        id: lender,
                        amount: amount,
                        startTime,
                        endTime,
                        startTimeDiff,
                        endTimeDiff,
                        blockTime,
                    };
                    const borrowerAssetPayload = {
                        borrower,
                        lender,
                        amount,
                        startTime,
                        endTime,
                        startTimeDiff,
                        endTimeDiff,
                        blockTime,
                    };
                    const lenderAssetPayload = {
                        borrower,
                        lender,
                        amount,
                        startTime,
                        endTime,
                        startTimeDiff,
                        endTimeDiff,
                        blockTime,
                    };
                    flashLoanStorage.delete(id);
                    assetStorage.insert(borrower, borrowerAsset);
                    assetStorage.insert(lender, lenderAsset);
                    return Ok({ borrowerAssetPayload, lenderAssetPayload });
                } else {
                    return Err({ InvalidPayload: `Flash Loan not found with id=${id}` });
                }
            } else {
                return Err({ NotFound: `Flash Loan not found with id=${id}` });
            }
        } else {
            return Err({ NotFound: `Flash Loan not found with id=${id}` });
        }
    }),

    // Get an asset by ID
    getAsset: query([text], Opt<Asset>, (id) => {
        return assetStorage.get(id);
    }),

    // Get all assets
    getAllAssets: query([], Vec<Asset>, () => {
        return assetStorage.values();
    }),

    // Update an asset by ID
    updateAsset: update([text, AssetPayload], Result<Asset, Error>, (id, payload) => {
        const currentAsset = assetStorage.get(id);
        if (currentAsset) {
            const updatedAsset = {
                ...currentAsset,
                ...payload,
            };
            assetStorage.insert(id, updatedAsset);
            return Ok(updatedAsset);
        } else {
            return Err({ NotFound: `Asset not found with id=${id}` });
        }
    }),

    // Delete an asset by ID
    deleteAsset: update([text], Result<Asset, Error>, (id) => {
        const deletedAsset = assetStorage.remove(id);
        if ('None' in deletedAsset) {
            return Err({ NotFound: `Couldn't delete the asset with id=${id}. Error 404 asset not found.` });
        }
        return Ok(deletedAsset.Some);
    }),
});

globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    },
};
