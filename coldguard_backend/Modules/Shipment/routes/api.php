<?php

use Illuminate\Support\Facades\Route;
use Modules\Shipment\App\Http\Controllers\ShipmentController;

/*
|--------------------------------------------------------------------------
| Shipment API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('shipments')->group(function () {
    Route::get('/', [ShipmentController::class, 'index']);
    Route::post('/', [ShipmentController::class, 'store']);
    Route::get('/{id}', [ShipmentController::class, 'show']);
    Route::post('/{id}/start', [ShipmentController::class, 'start']);
    Route::post('/{id}/deliver', [ShipmentController::class, 'deliver']);
});
