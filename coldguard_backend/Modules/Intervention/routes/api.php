<?php

use Illuminate\Support\Facades\Route;
use Modules\Intervention\App\Http\Controllers\InterventionController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/shipments/{id}/intervention', [InterventionController::class, 'showActive']);
    Route::get('/shipments/{id}/interventions', [InterventionController::class, 'history']);
    Route::get('/shipments/{id}/alerts', [InterventionController::class, 'alerts']);
    Route::post('/interventions/{id}/acknowledge', [InterventionController::class, 'acknowledge']);
    Route::post('/interventions/{id}/resolve', [InterventionController::class, 'resolve']);
});
