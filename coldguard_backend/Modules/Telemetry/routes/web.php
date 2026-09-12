<?php

use Illuminate\Support\Facades\Route;
use Modules\Telemetry\App\Http\Controllers\TelemetryController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('telemetries', TelemetryController::class)->names('telemetry');
});
