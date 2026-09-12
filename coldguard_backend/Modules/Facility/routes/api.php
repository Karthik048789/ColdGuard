<?php

use Illuminate\Support\Facades\Route;
use Modules\Facility\App\Http\Controllers\FacilityController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/facilities', [FacilityController::class, 'index']);
    Route::get('/shipments/{id}/facilities/eligible', [FacilityController::class, 'eligible']);
});
