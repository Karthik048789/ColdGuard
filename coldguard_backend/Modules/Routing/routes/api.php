<?php

use Illuminate\Support\Facades\Route;
use Modules\Routing\App\Http\Controllers\RoutingController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/shipments/{id}/location', [RoutingController::class, 'location']);
    Route::get('/shipments/{id}/route', [RoutingController::class, 'route']);
});
