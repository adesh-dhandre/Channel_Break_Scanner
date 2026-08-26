const scannerState = {
    scanning: false,

    lastScanStartedAt: null,

    lastScanCompletedAt: null,

    totalStocksScanned: 0,

    successfulStocks: 0,

    failedStocks: 0,

    activeSetups: [],

    scanSummary: []
};


function startScan() {

    scannerState.scanning = true;

    scannerState.lastScanStartedAt =
        new Date();

}


function completeScan(result) {

    scannerState.scanning = false;

    scannerState.lastScanCompletedAt =
        new Date();

    scannerState.totalStocksScanned =
        result.scannedStocks || 0;

    scannerState.successfulStocks =
        result.successfulStocks || 0;

    scannerState.failedStocks =
        result.failedStocks || 0;

    scannerState.activeSetups =
        result.activeSetups || [];

    scannerState.scanSummary =
        result.scanSummary || [];
}


function failScan() {

    scannerState.scanning = false;

    scannerState.lastScanCompletedAt =
        new Date();
}


function getScannerState() {

    return scannerState;
}


module.exports = {
    startScan,
    completeScan,
    failScan,
    getScannerState
};