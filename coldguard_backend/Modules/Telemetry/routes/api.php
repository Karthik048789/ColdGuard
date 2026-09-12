<?php

use Illuminate\Support\Facades\Route;
use Modules\Telemetry\App\Http\Controllers\TelemetryController;

/*
|--------------------------------------------------------------------------
| Telemetry API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('shipments/{id}/telemetry')->group(function () {
    Route::post('/', [TelemetryController::class, 'store']);
    Route::get('/', [TelemetryController::class, 'index']);
    Route::get('/latest', [TelemetryController::class, 'latest']);
    Route::post('/simulate', [TelemetryController::class, 'simulate']);
});
