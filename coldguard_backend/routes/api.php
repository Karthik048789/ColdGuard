<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - ColdGuard AI
|--------------------------------------------------------------------------
*/

// Authentication Routes
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

// Facility Module Routes
Route::get('/facilities', [\Modules\Facility\App\Http\Controllers\FacilityController::class, 'index']);
Route::get('/shipments/{id}/facilities/eligible', [\Modules\Facility\App\Http\Controllers\FacilityController::class, 'eligible']);

// Routing & Continuous Live Tracking Module Routes
Route::get('/shipments/{id}/location', [\Modules\Routing\App\Http\Controllers\RoutingController::class, 'location']);
Route::get('/shipments/{id}/route', [\Modules\Routing\App\Http\Controllers\RoutingController::class, 'route']);

// Intervention & Alerts Module Routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/shipments/{id}/intervention', [\Modules\Intervention\App\Http\Controllers\InterventionController::class, 'showActive']);
    Route::get('/shipments/{id}/interventions', [\Modules\Intervention\App\Http\Controllers\InterventionController::class, 'history']);
    Route::get('/shipments/{id}/alerts', [\Modules\Intervention\App\Http\Controllers\InterventionController::class, 'alerts']);
    Route::post('/interventions/{id}/acknowledge', [\Modules\Intervention\App\Http\Controllers\InterventionController::class, 'acknowledge']);
    Route::post('/interventions/{id}/resolve', [\Modules\Intervention\App\Http\Controllers\InterventionController::class, 'resolve']);
});

// Health check endpoint
Route::get('/health', function () {
    return response()->json([
        'status' => 'online',
        'service' => 'ColdGuard AI API Engine',
        'timestamp' => now()->toIso8601String(),
    ]);
});
