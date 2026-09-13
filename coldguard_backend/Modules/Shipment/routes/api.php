<?php

use Illuminate\Support\Facades\Route;
use Modules\Shipment\App\Http\Controllers\ShipmentController;

/*
|--------------------------------------------------------------------------
| Shipment API Routes
|--------------------------------------------------------------------------
*/

// Public receiver endpoints (no auth required)
Route::get('receivers', [ShipmentController::class, 'receivers']);
Route::post('receivers', [ShipmentController::class, 'createReceiver']);
Route::delete('receivers/{id}', [ShipmentController::class, 'deleteReceiver']);
Route::post('shipments/by-receiver', [ShipmentController::class, 'byReceiver']);

Route::prefix('shipments')->group(function () {
    Route::get('/', [ShipmentController::class, 'index']);
    Route::post('/', [ShipmentController::class, 'store']);
    Route::get('/{id}', [ShipmentController::class, 'show']);
    Route::post('/{id}/start', [ShipmentController::class, 'start']);
    Route::post('/{id}/reroute', [ShipmentController::class, 'reroute']);
    Route::post('/{id}/deliver', [ShipmentController::class, 'deliver']);
});
