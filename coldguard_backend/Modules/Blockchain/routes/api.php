<?php

use Illuminate\Support\Facades\Route;
use Modules\Blockchain\App\Http\Controllers\BlockchainController;

// Public route — no auth needed (receiver scans QR)
Route::get('blockchain/receipt/{token}', [BlockchainController::class, 'receipt']);

// Protected routes — require auth
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('blockchain/{shipmentId}/logs',             [BlockchainController::class, 'logs']);
    Route::get('blockchain/{shipmentId}/verify',           [BlockchainController::class, 'verify']);
    Route::post('blockchain/{shipmentId}/confirm-delivery', [BlockchainController::class, 'confirmDelivery']);
});
