<?php

use Illuminate\Support\Facades\Route;
use Modules\Facility\App\Http\Controllers\FacilityController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    Route::apiResource('facilities', FacilityController::class)->names('facility');
});
