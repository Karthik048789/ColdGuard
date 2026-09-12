<?php

use Illuminate\Support\Facades\Route;
use Modules\Routing\App\Http\Controllers\RoutingController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    Route::apiResource('routings', RoutingController::class)->names('routing');
});
